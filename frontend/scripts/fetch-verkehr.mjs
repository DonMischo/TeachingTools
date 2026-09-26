/**
 * Holt die Karte der Verkehrs-Simulation aus OpenStreetMap.
 *
 * Mitte ist die Schule in der Eugen-Richter-Straße 22 (Erfurt), Radius 750 m —
 * so weit, dass die Straßenbahn und die Bahnstrecke Wolkramshausen–Erfurt noch
 * hineinfallen. Gespeichert wird in Metern um die Mitte (x nach Osten, y nach
 * Süden, wie auf dem Bildschirm), auf Dezimeter gerundet, damit die Datei klein
 * bleibt. Linien, die aus dem Quadrat hinauslaufen, werden abgeschnitten.
 *
 * Daten © OpenStreetMap-Mitwirkende, ODbL 1.0 — der Nachweis steht in der
 * Datei und wird in der Simulation angezeigt.
 *
 * Aufruf:  node scripts/fetch-verkehr.mjs
 *          node scripts/fetch-verkehr.mjs --nur-linien   (nur Bus-/Tramlinien neu, Rest bleibt)
 */
import { readFileSync, writeFileSync } from "fs";

const ZIEL = "src/lib/verkehr/karte.json";
const MITTE = { lat: 50.98967, lon: 11.03754 };
/**
 * Das Kartengebiet: von der Schule im Norden bis hinter den Hauptbahnhof im
 * Süden, vom Petersberg/Domplatz im Westen bis zur Ostkante des Viertels —
 * damit die Innenstadt (Anger, Fischmarkt, Domplatz, Hbf) mit drin ist.
 */
const BBOX = { sued: 50.9700, west: 11.0195, nord: 50.9965, ost: 11.0485 };
const BB = `${BBOX.sued},${BBOX.west},${BBOX.nord},${BBOX.ost}`;
/** Etwas Rand, damit Linien nicht direkt an der Kante enden. */
const UEBER = 30;

const ABFRAGE = `[out:json][timeout:240];
(
  way(${BB})[highway];
  way(${BB})[building];
  way(${BB})[railway~"^(rail|tram|platform)$"];
  way(${BB})[public_transport=platform];
  way(${BB})[landuse~"^(grass|allotments|meadow|forest|railway)$"];
  way(${BB})[leisure~"^(park|pitch|playground|garden)$"];
  way(${BB})[amenity~"^(parking|school|kindergarten)$"];
  way(${BB})[natural~"^(scrub|wood|water)$"];
  node(${BB})[highway~"^(crossing|traffic_signals|bus_stop|stop|give_way)$"];
  node(${BB})[railway~"^(tram_stop|halt|station|level_crossing|crossing)$"];
  node(${BB})[public_transport~"^(platform|stop_position)$"];
  node(${BB})[shop][name];
  node(${BB})[amenity~"^(school|kindergarten|pharmacy|restaurant|fast_food|cafe)$"][name];
  node(${BB})[natural=tree];
  node(${BB})[highway=street_lamp];
  node(${BB})["addr:housenumber"]["addr:street"];
);
out body;
>;
out skel qt;`;

const M_JE_LAT = 111_320;
const M_JE_LON = 111_320 * Math.cos((MITTE.lat * Math.PI) / 180);
const r1 = (v) => Math.round(v * 10) / 10;
const projiziere = (lat, lon) => [r1((lon - MITTE.lon) * M_JE_LON), r1((MITTE.lat - lat) * M_JE_LAT)];
const [X0, Y1] = projiziere(BBOX.sued, BBOX.west), [X1, Y0] = projiziere(BBOX.nord, BBOX.ost);
/** Das Gebiet in Metern um die Schule (x nach Osten, y nach Süden). */
const BEREICH = { x0: X0, x1: X1, y0: Y0, y1: Y1 };
const drin = ([x, y]) => x >= X0 - UEBER && x <= X1 + UEBER && y >= Y0 - UEBER && y <= Y1 + UEBER;

/** Linien (Bus/Tram) über die Haltestellen im Umkreis — mit den Namen ihrer Haltestellen. */
const LINIEN_ABFRAGE = `[out:json][timeout:240];
node(${BB})[public_transport=platform]->.p;
way(${BB})[railway=tram]->.w;
(rel(bn.p)[type=route][route~"^(bus|tram)$"];rel(bw.w)[type=route][route=tram];)->.r;
.r out geom;
node(r.r)[name];
out tags;
way(r.r)[public_transport=platform][name];
out tags;`;

/** Zwei Server im Wechsel — Overpass drosselt schnell. */
const SERVER = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

async function hole(abfrage = ABFRAGE) {
  for (let versuch = 1; versuch <= 6; versuch++) {
    const antwort = await fetch(SERVER[(versuch - 1) % SERVER.length], {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "TT-Teaching-Tools/1.0" },
      body: "data=" + encodeURIComponent(abfrage),
    });
    const text = await antwort.text();
    // Overpass drosselt gern mit einer leeren oder HTML-Antwort.
    if (antwort.ok && text.startsWith("{")) return JSON.parse(text);
    console.warn(`Versuch ${versuch}: HTTP ${antwort.status}, warte …`);
    await new Promise((fertig) => setTimeout(fertig, 15_000 * versuch));
  }
  throw new Error("Overpass antwortet nicht.");
}

/** Zerlegt eine Linie in die Stücke, die im Quadrat liegen (ein Punkt Überhang bleibt). */
function schneide(punkte) {
  const stuecke = [];
  let jetzt = [];
  punkte.forEach((p, i) => {
    const nachbarDrin = drin(p) || (i > 0 && drin(punkte[i - 1])) || (i + 1 < punkte.length && drin(punkte[i + 1]));
    if (nachbarDrin) jetzt.push(p);
    else if (jetzt.length) { stuecke.push(jetzt); jetzt = []; }
  });
  if (jetzt.length) stuecke.push(jetzt);
  return stuecke.filter((s) => s.length >= 2);
}

const STRASSEN = new Set(["primary", "secondary", "tertiary", "residential", "unclassified", "living_street", "service", "primary_link", "secondary_link", "tertiary_link"]);
const WEGE = new Set(["footway", "path", "pedestrian", "steps", "track"]);

function flaechenArt(t) {
  if (t.building) return null;
  if (t.amenity === "parking") return "parkplatz";
  if (t.amenity === "school" || t.amenity === "kindergarten") return "schulhof";
  if (t.leisure === "pitch") return "sportplatz";
  if (t.leisure === "playground") return "spielplatz";
  if (t.landuse === "railway") return "gleisbett";
  if (t.natural === "water") return "wasser";
  if (t.landuse === "forest" || t.natural === "wood" || t.natural === "scrub") return "gehoelz";
  if (t.landuse === "allotments") return "garten";
  if (t.landuse || t.leisure) return "gruen";
  return null;
}

function punktArt(t) {
  if (t.highway === "traffic_signals") return "ampel";
  if (t.highway === "crossing") {
    const c = t.crossing;
    if (c === "traffic_signals") return "ampelUebergang";
    if (c === "zebra" || t["crossing:markings"] === "zebra" || t.crossing_ref === "zebra" || c === "marked") return "zebra";
    if (c === "no") return null;
    return "querung";
  }
  // Haltestellen sind oft nur als public_transport=platform mit tram/train=yes getaggt.
  if (t.railway === "tram_stop" || (t.public_transport === "platform" && t.tram === "yes")) return "tramhalt";
  if (t.railway === "halt" || t.railway === "station" || (t.public_transport === "platform" && t.train === "yes")) return "bahnhalt";
  if (t.highway === "bus_stop" || (t.public_transport === "platform" && t.bus === "yes")) return "bushalt";
  if (t.railway === "level_crossing" || t.railway === "crossing") return "bahnuebergang";
  if (t.highway === "stop") return "stopp";
  if (t.highway === "give_way") return "vorfahrtAchten";
  if (t.natural === "tree") return "baum";
  if (t.highway === "street_lamp") return "laterne";
  if (t.shop || t.amenity) return "ort";
  if (t["addr:housenumber"] && t["addr:street"]) return "adresse";
  return null;
}

const NUR_LINIEN = process.argv.includes("--nur-linien");
const daten = NUR_LINIEN ? { elements: [] } : await hole();
const knoten = new Map();
for (const e of daten.elements) if (e.type === "node") knoten.set(e.id, e);

const karte = NUR_LINIEN ? JSON.parse(readFileSync(ZIEL, "utf8")) : {
  nachweis: "Kartendaten © OpenStreetMap-Mitwirkende, ODbL 1.0 (openstreetmap.org/copyright)",
  stand: new Date().toISOString().slice(0, 10),
  mitte: MITTE,
  radius: Math.max(-X0, X1, -Y0, Y1),
  bereich: BEREICH,
  strassen: [],
  wege: [],
  gleise: [],
  gebaeude: [],
  flaechen: [],
  punkte: [],
};

const gesehen = new Set();
for (const e of daten.elements) {
  if (!e.tags || gesehen.has(e.type + e.id)) continue;
  gesehen.add(e.type + e.id);
  const t = e.tags;
  if (e.type === "node") {
    const art = punktArt(t);
    if (!art) continue;
    const p = projiziere(e.lat, e.lon);
    if (!drin(p)) continue;
    const eintrag = { art, p };
    if (t.name) eintrag.name = t.name;
    if (art === "adresse") eintrag.name = `${t["addr:street"]} ${t["addr:housenumber"]}`;
    if (t.shop) eintrag.shop = t.shop;
    if (art === "ort" && t.amenity) eintrag.amenity = t.amenity;
    karte.punkte.push(eintrag);
    continue;
  }
  if (e.type !== "way") continue;
  const roh = (e.nodes ?? []).map((id) => knoten.get(id)).filter(Boolean).map((n) => projiziere(n.lat, n.lon));
  if (roh.length < 2) continue;
  const hw = t.highway;
  if (hw && STRASSEN.has(hw)) {
    for (const linie of schneide(roh)) {
      const s = { art: hw.replace("_link", ""), linie };
      if (t.name) s.name = t.name;
      if (t.lanes) s.spuren = Number(t.lanes) || undefined;
      // Spuren je Richtung (fehlt oft — dann teilt die Simulation »lanes« auf)
      if (t["lanes:forward"]) s.spurenHin = Number(t["lanes:forward"]) || undefined;
      if (t["lanes:backward"]) s.spurenRueck = Number(t["lanes:backward"]) || undefined;
      if (t.oneway === "yes") s.einbahn = true;
      if (t.sidewalk) s.gehweg = t.sidewalk;
      if (t["cycleway:both"] || t["cycleway:left"] || t["cycleway:right"] || t.cycleway) s.radstreifen = true;
      if (t.maxspeed) s.tempo = Number(t.maxspeed) || undefined;
      karte.strassen.push(s);
    }
  } else if (hw === "cycleway" || (hw === "path" && t.bicycle === "designated") || (hw === "footway" && t.bicycle === "designated")) {
    const art = t.foot === "designated" || t.segregated === "no" ? "geh_rad" : "rad";
    for (const linie of schneide(roh)) karte.wege.push({ art, linie });
  } else if (hw && WEGE.has(hw)) {
    const art = hw === "steps" ? "treppe" : hw === "track" ? "feldweg" : t.footway === "crossing" ? "querung" : "geh";
    for (const linie of schneide(roh)) karte.wege.push({ art, linie });
  } else if (t.railway === "rail" || t.railway === "tram") {
    for (const linie of schneide(roh)) karte.gleise.push({ art: t.railway === "tram" ? "tram" : "bahn", linie });
  } else if (t.building) {
    if (!roh.some(drin)) continue;
    const g = { umriss: roh.slice(0, -1) };
    if (t.name) g.name = t.name;
    if (t.building !== "yes") g.art = t.building;
    if (t["building:levels"]) g.etagen = Number(t["building:levels"]) || undefined;
    // Adresse fürs Handy (Suche)
    if (t["addr:street"] && t["addr:housenumber"]) g.adresse = `${t["addr:street"]} ${t["addr:housenumber"]}`;
    karte.gebaeude.push(g);
  } else if (t.railway === "platform" || t.public_transport === "platform") {
    if (!roh.some(drin)) continue;
    karte.flaechen.push({ art: "bahnsteig", umriss: roh.slice(0, -1) });
  } else {
    const art = flaechenArt(t);
    if (!art || !roh.some(drin)) continue;
    karte.flaechen.push({ art, umriss: roh.slice(0, -1) });
  }
}

/** Die Wege einer Route zu einem Zug aneinanderhängen (Wege liegen mal vorwärts, mal rückwärts). */
function kette(wege) {
  const gleich = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
  const aus = [];
  wege.forEach((w, i) => {
    let p = w;
    if (!aus.length) {
      // Den ersten so drehen, dass er am zweiten anschließt.
      const n = wege[i + 1];
      if (n && (gleich(p[0], n[0]) || gleich(p[0], n[n.length - 1]))) p = [...p].reverse();
    } else if (gleich(p[p.length - 1], aus[aus.length - 1]) && !gleich(p[0], aus[aus.length - 1])) p = [...p].reverse();
    aus.push(...(gleich(p[0], aus[aus.length - 1]) ? p.slice(1) : p));
  });
  return aus;
}

// Linien: je Linie und Richtung die Haltestellen in Fahrtreihenfolge — die Namen,
// dazu im Quadrat der echte Fahrweg (`spur`, abgeschnittene Stücke) und die
// Bussteige dieser Richtung (`steige`), damit der Bus die richtige Straßenseite nimmt.
const routen = await hole(LINIEN_ABFRAGE);
// Namen der Halte: Knoten und Bahnsteig-Flächen (Schlüssel mit Typ, IDs können sich überschneiden)
const namen = new Map(routen.elements.filter((e) => e.type !== "relation" && e.tags?.name).map((e) => [`${e.type}${e.id}`, e.tags.name]));
const linien = new Map();
for (const r of routen.elements) {
  if (r.type !== "relation" || !r.tags?.ref) continue;
  // Bus: die Bussteige; Straßenbahn: die Haltepositionen am Gleis (Bahnsteige sind dort oft Flächen)
  const tram = r.tags.route === "tram";
  const rolle = (m) => (tram ? m.role.startsWith("stop") : m.role.startsWith("platform"));
  const halte = r.members.filter((m) => m.type === "node" && rolle(m)).map((m) => namen.get(`node${m.ref}`)).filter(Boolean);
  const key = `${r.tags.route}|${r.tags.ref}`;
  const eintrag = linien.get(key) ?? { art: r.tags.route, nr: r.tags.ref, betreiber: r.tags.operator ?? r.tags.network ?? "", richtungen: [] };
  const ziel = r.tags.to ?? (r.tags.name ?? "").split("=>").pop().trim();
  const wege = r.members.filter((m) => m.type === "way" && !m.role.startsWith("platform") && m.geometry)
    .map((m) => m.geometry.map((g) => projiziere(g.lat, g.lon)));
  const spur = schneide(kette(wege));
  const steige = r.members.filter((m) => rolle(m) && namen.get(`${m.type}${m.ref}`))
    .map((m) => ({ name: namen.get(`${m.type}${m.ref}`), p: m.type === "node" ? projiziere(m.lat, m.lon) : m.geometry ? projiziere(m.geometry[0].lat, m.geometry[0].lon) : null }))
    .filter((x) => x.p && drin(x.p));
  if (!eintrag.richtungen.some((x) => x.ziel === ziel)) eintrag.richtungen.push({ ziel, halte, ...(spur.length ? { spur } : {}), ...(steige.length ? { steige } : {}) });
  linien.set(key, eintrag);
}
karte.linien = [...linien.values()];

writeFileSync(ZIEL, JSON.stringify(karte));
const z = (k) => karte[k].length;
console.log(`${karte.linien.map((l) => l.nr).join(", ")}: ${karte.linien.length} Linien`);
console.log(`${ZIEL}: ${z("strassen")} Straßen, ${z("wege")} Wege, ${z("gleise")} Gleise, ${z("gebaeude")} Gebäude, ${z("flaechen")} Flächen, ${z("punkte")} Punkte`);
