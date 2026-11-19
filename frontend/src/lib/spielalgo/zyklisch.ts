/**
 * Zyklische Generierung nach Joris Dormans (bekannt aus »Unexplored«):
 * Erst wird der Ablauf als Graph gebaut — Start und Ziel auf einer Schleife,
 * dazu Schlüssel und Schloss, Abkürzungen, Aussichten und Tempo — und erst
 * danach wird daraus eine Karte mit Räumen und Gängen.
 *
 * Die Schritte laufen als Generator (`yield` mit Notiz nach jeder Regel).
 */

export type KnotenArt = "start" | "ziel" | "raum" | "schluessel" | "belohnung" | "raetsel" | "kampf" | "ruhe";
/** weg = offen, tuer = verschlossen (braucht Schlüssel), einweg = nur von a nach b, sicht = sehen, nicht gehen */
export type KantenArt = "weg" | "tuer" | "einweg" | "sicht";

export interface Knoten { id: number; art: KnotenArt; x: number; y: number }
export interface Kante { a: number; b: number; art: KantenArt }

export type Zyklus = "schluessel" | "zweiwege" | "abkuerzung" | "gefahr";

export const ZYKLEN: Record<Zyklus, { name: string; text: string }> = {
  schluessel: {
    name: "Schlüssel und Schloss",
    text: "Der kurze Weg endet an einer verschlossenen Tür. Am Ende des langen Wegs liegt der Schlüssel — und durch ein Gitter sieht man schon das Ziel. Also zurück und aufschließen.",
  },
  zweiwege: {
    name: "Zwei Wege",
    text: "Zwei Wege führen zum Ziel. Der eine ist kurz, der andere lang, aber mit Belohnung. Die Spielerin entscheidet.",
  },
  abkuerzung: {
    name: "Versteckte Abkürzung",
    text: "Ein langer Weg führt zum Ziel. Dort geht eine Tür auf, die nur von dieser Seite öffnet: eine Abkürzung zurück zum Start.",
  },
  gefahr: {
    name: "Gefährlicher Weg",
    text: "Der kurze Weg ist voller Gegner, der lange ist ruhig. Mutig und schnell oder vorsichtig und langsam?",
  },
};

export interface AblaufOptionen {
  zyklus: Zyklus;
  /** zusätzliche Räume auf dem langen Bogen */
  laenge: number;
  /** Nebenschleifen, die einen Gang ersetzen */
  neben: number;
}

export interface Ablauf { knoten: Knoten[]; kanten: Kante[] }

export const neuerAblauf = (): Ablauf => ({ knoten: [], kanten: [] });

const START = 0, ZIEL = 1;

/** Knoten auf einem Halbbogen (oben: y < 0) gleichmäßig verteilen. */
function legeBogen(a: Ablauf, ids: number[], oben: boolean) {
  const n = ids.length;
  ids.forEach((id, i) => {
    const w = Math.PI * (1 - (i + 1) / (n + 1)); // von links nach rechts
    const k = a.knoten[id];
    k.x = Math.cos(w);
    k.y = (oben ? -1 : 1) * Math.sin(w) * 0.75;
  });
}

function neuerKnoten(a: Ablauf, art: KnotenArt): number {
  return a.knoten.push({ id: a.knoten.length, art, x: 0, y: 0 }) - 1;
}

/** Kette start → ids… → ende aus Kanten; `letzte` ist die Art der letzten Kante. */
function kette(a: Ablauf, start: number, ids: number[], ende: number, letzte: KantenArt = "weg", erste: KantenArt = "weg") {
  const folge = [start, ...ids, ende];
  for (let i = 0; i < folge.length - 1; i++) {
    const art = i === folge.length - 2 ? letzte : i === 0 ? erste : "weg";
    a.kanten.push({ a: folge[i], b: folge[i + 1], art });
  }
}

export function* erzeugeAblauf(a: Ablauf, o: AblaufOptionen, rng: () => number): Generator<string> {
  a.knoten = [];
  a.kanten = [];
  neuerKnoten(a, "start");
  neuerKnoten(a, "ziel");
  a.knoten[START].x = -1; a.knoten[ZIEL].x = 1;
  yield "Regel 1: Es gibt einen Start (links) und ein Ziel (rechts).";

  // Regel 2: die Hauptschleife — zwei Bögen von Start nach Ziel
  const lang = [neuerKnoten(a, "raum")];
  const kurz = [neuerKnoten(a, "raum")];
  legeBogen(a, lang, true);
  legeBogen(a, kurz, false);
  const z = o.zyklus;
  if (z === "schluessel") {
    a.knoten[lang[0]].art = "schluessel";
    kette(a, START, lang, ZIEL, "sicht");
    kette(a, START, kurz, ZIEL, "tuer");
  } else if (z === "abkuerzung") {
    kette(a, START, lang, ZIEL);
    // Rückweg: vom Ziel über den unteren Bogen, erste Tür nur von dieser Seite
    kette(a, ZIEL, kurz, START, "weg", "einweg");
  } else {
    if (z === "zweiwege") a.knoten[lang[0]].art = "belohnung";
    if (z === "gefahr") { a.knoten[kurz[0]].art = "kampf"; a.knoten[lang[0]].art = "ruhe"; }
    kette(a, START, lang, ZIEL);
    kette(a, START, kurz, ZIEL);
  }
  yield `Regel 2: Hauptschleife »${ZYKLEN[z].name}«. ${ZYKLEN[z].text}`;

  // Regel 3: den langen Bogen verlängern — neuer Raum vor dem Sonderraum
  for (let i = 0; i < o.laenge; i++) {
    const kandidaten = a.kanten.filter(k => k.art === "weg" && lang.includes(k.b) && (k.a === START || lang.includes(k.a)));
    const k = kandidaten[Math.floor(rng() * kandidaten.length)];
    if (!k) break;
    const n = neuerKnoten(a, "raum");
    a.kanten.push({ a: n, b: k.b, art: "weg" });
    k.b = n;
    lang.splice(k.a === START ? 0 : lang.indexOf(k.a) + 1, 0, n);
    legeBogen(a, lang, true);
    yield `Regel 3: Gang durch einen Raum ersetzt – der lange Weg wird länger (${lang.length} Räume).`;
  }
  if (z !== "schluessel" && z !== "abkuerzung" && o.laenge > 0) {
    // auf dem kurzen Weg ein Raum mehr, damit er nicht nur ein Flur ist
    const k = a.kanten.find(e => e.a === START && e.b === kurz[0])!;
    const n = neuerKnoten(a, z === "gefahr" ? "kampf" : "raum");
    a.kanten.push({ a: n, b: k.b, art: "weg" });
    k.b = n;
    kurz.unshift(n);
    legeBogen(a, kurz, false);
    yield "Regel 3: Auch der kurze Weg bekommt einen Raum dazu.";
  }

  // Regel 4: Nebenschleifen — ein offener Gang a→b wird zu einer kleinen Schleife
  const schonNeben = new Set<Kante>();
  for (let i = 0; i < o.neben; i++) {
    const kandidaten = a.kanten.filter(k => k.art === "weg" && !schonNeben.has(k) && k.a !== START && k.b !== ZIEL && k.a !== ZIEL && k.b !== START);
    const k = kandidaten[Math.floor(rng() * kandidaten.length)];
    if (!k) break;
    const A = a.knoten[k.a], B = a.knoten[k.b];
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const laenge = Math.hypot(mx, my) || 1;
    const n = neuerKnoten(a, "belohnung");
    // nach außen schieben, weg von der Mitte der Hauptschleife
    a.knoten[n].x = mx + (mx / laenge) * 0.45;
    a.knoten[n].y = my + (my / laenge) * 0.45;
    schonNeben.add(k);
    const aussicht = rng() < 0.5;
    a.kanten.push({ a: k.a, b: n, art: aussicht ? "sicht" : "weg" }, { a: n, b: k.b, art: "weg" });
    yield aussicht
      ? "Regel 4: Nebenschleife mit Aussicht – die Belohnung sieht man schon, erreichbar ist sie erst von der anderen Seite."
      : "Regel 4: Nebenschleife – ein kleiner Umweg mit Belohnung.";
  }

  // Regel 5: Tempo — Ruhe, Rätsel, Kampf wechseln sich entlang der Wege ab
  const reihe: KnotenArt[] = ["ruhe", "raetsel", "kampf"];
  const tiefe = abstaende(a);
  for (const k of a.knoten) {
    if (k.art !== "raum") continue;
    k.art = reihe[(tiefe[k.id] + Math.floor(rng() * 2)) % 3];
  }
  yield "Regel 5: Tempo – Ruhe, Rätsel und Kampf wechseln sich ab, damit es nicht eintönig wird.";

  const p = pruefe(a);
  yield p.loesbar
    ? `Prüfung: lösbar. ${p.schritte.join(" → ")}.`
    : "Prüfung: NICHT lösbar – so etwas darf der Generator nicht ausgeben.";
}

/** Schritte vom Start (ohne Schlösser), für das Tempo. */
function abstaende(a: Ablauf): number[] {
  const d = a.knoten.map(() => -1);
  d[START] = 0;
  const q = [START];
  for (let i = 0; i < q.length; i++) {
    for (const k of a.kanten) {
      if (k.art === "sicht") continue;
      const nb = k.a === q[i] ? k.b : k.b === q[i] && k.art !== "einweg" ? k.a : -1;
      if (nb >= 0 && d[nb] < 0) { d[nb] = d[q[i]] + 1; q.push(nb); }
    }
  }
  return d;
}

/** Was erreicht man vom Start aus mit oder ohne Schlüssel? */
export function erreichbar(a: Ablauf, mitSchluessel: boolean): Set<number> {
  const da = new Set([START]);
  const q = [START];
  for (let i = 0; i < q.length; i++) {
    for (const k of a.kanten) {
      if (k.art === "sicht" || (k.art === "tuer" && !mitSchluessel)) continue;
      const nb = k.a === q[i] ? k.b : k.b === q[i] && k.art !== "einweg" ? k.a : -1;
      if (nb >= 0 && !da.has(nb)) { da.add(nb); q.push(nb); }
    }
  }
  return da;
}

export interface Pruefung { loesbar: boolean; brauchtSchluessel: boolean; schritte: string[] }

export function pruefe(a: Ablauf): Pruefung {
  const ohne = erreichbar(a, false);
  const schluessel = a.knoten.find(k => k.art === "schluessel");
  const hatTuer = a.kanten.some(k => k.art === "tuer");
  if (ohne.has(ZIEL)) {
    return { loesbar: true, brauchtSchluessel: false, schritte: ["Start", "Ziel ohne Schlüssel erreichbar"] };
  }
  if (hatTuer && schluessel && ohne.has(schluessel.id) && erreichbar(a, true).has(ZIEL)) {
    return { loesbar: true, brauchtSchluessel: true, schritte: ["Start", "Schlüssel holen", "zurück zur Tür", "Ziel"] };
  }
  return { loesbar: false, brauchtSchluessel: hatTuer, schritte: [] };
}

// ── Vom Graphen zur Karte ────────────────────────────────────────────────

export const KZ = { FELS: 0, RAUM: 1, GANG: 2, TUER: 3, GITTER: 4, EINWEG: 5 } as const;

export interface Karte {
  b: number;
  h: number;
  z: Uint8Array;
  /** Raum je Knoten (Rechteck, Mittelpunkt) */
  raeume: { id: number; x: number; y: number; b: number; h: number; mx: number; my: number }[];
  /** Gänge, die eine andere Belegung kreuzen mussten (sollte 0 sein) */
  notloesungen: number;
}

export function karte(a: Ablauf, b = 64, h = 44, organisch = false): Karte {
  const z = new Uint8Array(b * h);
  // Knoten auf das Raster legen
  const xs = a.knoten.map(k => k.x), ys = a.knoten.map(k => k.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const rand = 6;
  const sx = (b - 2 * rand) / Math.max(maxX - minX, 1e-6), sy = (h - 2 * rand) / Math.max(maxY - minY, 1e-6);
  const besitzer = new Int32Array(b * h).fill(-1);
  const raeume: Karte["raeume"] = [];
  for (const k of a.knoten) {
    let mx = Math.round(rand + (k.x - minX) * sx), my = Math.round(rand + (k.y - minY) * sy);
    const gross = k.art === "start" || k.art === "ziel";
    let rb = gross ? 7 : 5, rh = gross ? 5 : 4;
    const lage = (cx: number, cy: number) => [
      Math.max(1, Math.min(b - rb - 1, cx - (rb >> 1))), Math.max(1, Math.min(h - rh - 1, cy - (rh >> 1))),
    ];
    // stößt mit einem Raum zusammen (2 Felder Abstand)?
    const stoesst = (cx: number, cy: number) => {
      const [x, y] = lage(cx, cy);
      return raeume.some(r => x - 2 < r.x + r.b && r.x < x + rb + 2 && y - 2 < r.y + r.h && r.y < y + rh + 2);
    };
    // erst kleiner machen, dann in der Nähe ausweichen
    while (stoesst(mx, my) && (rb > 3 || rh > 3)) { if (rb > 3) rb--; if (rh > 3) rh--; }
    for (let d = 1; d < 12 && stoesst(mx, my); d++) {
      const frei = [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]].find(([dx, dy]) => !stoesst(mx + dx, my + dy));
      if (frei) { mx += frei[0]; my += frei[1]; }
    }
    const [x, y] = lage(mx, my);
    raeume.push({ id: k.id, x, y, b: rb, h: rh, mx: x + (rb >> 1), my: y + (rh >> 1) });
    for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rb; xx++) {
      if (organisch && (xx === x || xx === x + rb - 1) && (yy === y || yy === y + rh - 1)) continue; // Ecken abrunden
      z[yy * b + xx] = KZ.RAUM;
      besitzer[yy * b + xx] = k.id;
    }
  }

  // Gänge per A* auf dem Raster: fremde Räume und vorhandene Gänge samt Rand sind tabu
  let notloesungen = 0;
  const gangVon = new Int32Array(b * h).fill(-1); // Kantenindex je Gangfeld
  const reihenfolge = a.kanten.map((_, i) => i).sort((p, q) => (a.kanten[p].art === "sicht" ? 1 : 0) - (a.kanten[q].art === "sicht" ? 1 : 0));
  for (const ki of reihenfolge) {
    const k = a.kanten[ki];
    const ra = raeume[k.a], rb = raeume[k.b];
    const darf = (i: number, streng: boolean) => {
      const o = besitzer[i];
      if (o === k.a || o === k.b) return true;
      if (o >= 0) return false;
      if (!streng) return gangVon[i] < 0;
      // 1 Feld Abstand zu fremden Räumen und Gängen
      const x = i % b, y = (i / b) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= b || yy >= h) return false;
        const j = yy * b + xx, oj = besitzer[j];
        if (oj >= 0 && oj !== k.a && oj !== k.b) return false;
        if (gangVon[j] >= 0 && !nahAn(raeume, xx, yy, k.a, k.b)) return false;
      }
      return true;
    };
    let weg = gangSuche(b, h, ra.my * b + ra.mx, rb.my * b + rb.mx, i => darf(i, true));
    if (!weg) { weg = gangSuche(b, h, ra.my * b + ra.mx, rb.my * b + rb.mx, i => darf(i, false)); notloesungen++; }
    if (!weg) weg = gangSuche(b, h, ra.my * b + ra.mx, rb.my * b + rb.mx, () => true) ?? [];
    const gang = weg.filter(i => besitzer[i] < 0);
    // nur eigene Felder bekommen Tür/Gitter, nicht die eines anderen Gangs, den dieser mitbenutzt
    const eigen = gang.filter(i => gangVon[i] < 0);
    gang.forEach(i => { if (z[i] === KZ.FELS) z[i] = KZ.GANG; if (gangVon[i] < 0) gangVon[i] = ki; });
    if (!eigen.length) continue;
    // Sonderfelder: Tür bzw. Gitter auf jedem Gangfeld direkt an Raum b (sonst ginge man
    // daneben vorbei), Einweg-Pfeil am Anfang
    if (k.art === "tuer" || k.art === "sicht") {
      const an = eigen.filter(i => [i - 1, i + 1, i - b, i + b].some(j => besitzer[j] === k.b));
      for (const i of an.length ? an : [eigen[eigen.length - 1]]) z[i] = k.art === "tuer" ? KZ.TUER : KZ.GITTER;
    }
    if (k.art === "einweg") z[eigen[0]] = KZ.EINWEG;
  }

  const karte: Karte = { b, h, z, raeume, notloesungen };
  if (organisch) annagen(karte);
  return karte;
}

/**
 * Felsränder annagen: Fels mit wenigen Fels-Nachbarn wird frei. Das öffnet nur;
 * damit dabei kein Schleichweg an Tür oder Gitter vorbei entsteht, wird jede
 * Runde geprüft und notfalls verworfen.
 */
function annagen(k: Karte) {
  const { b, h } = k;
  const raeumeErreichbar = () => {
    const da = kartenErreichbar(k, false);
    return k.raeume.map(r => da[r.my * b + r.mx]).join("");
  };
  const vorher = raeumeErreichbar();
  for (let runde = 0; runde < 2; runde++) {
    const alt = k.z.slice();
    const neu = k.z.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < b - 1; x++) {
      const i = y * b + x;
      if (alt[i] !== KZ.FELS) continue;
      let fels = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (alt[(y + dy) * b + x + dx] === KZ.FELS) fels++;
      if (fels <= 5 && hashZufall(i, runde) < 0.6) neu[i] = KZ.GANG;
    }
    k.z = neu;
    if (raeumeErreichbar() !== vorher) { k.z = alt; break; }
  }

}


function hashZufall(i: number, s: number): number {
  let t = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(s + 1, 0xc2b2ae35);
  t ^= t >>> 13; t = Math.imul(t, 0x27d4eb2f); t ^= t >>> 16;
  return (t >>> 0) / 4294967296;
}

function nahAn(raeume: Karte["raeume"], x: number, y: number, a: number, b: number): boolean {
  for (const id of [a, b]) {
    const r = raeume[id];
    if (x >= r.x - 2 && x < r.x + r.b + 2 && y >= r.y - 2 && y < r.y + r.h + 2) return true;
  }
  return false;
}

/** A* in 4 Richtungen; leichte Strafe für Kurven, damit Gänge gerade laufen. */
function gangSuche(b: number, h: number, start: number, ziel: number, darf: (i: number) => boolean): number[] | null {
  const n = b * h;
  const g = new Float64Array(n * 2).fill(Infinity); // Zustand = Zelle × (zuletzt waagrecht?)
  const vor = new Int32Array(n * 2).fill(-1);
  const zx = ziel % b, zy = (ziel / b) | 0;
  const offen: [number, number][] = [];
  const rein = (s: number, f: number) => {
    let i = offen.push([s, f]) - 1;
    while (i > 0) { const e = (i - 1) >> 1; if (offen[e][1] <= f) break; [offen[i], offen[e]] = [offen[e], offen[i]]; i = e; }
  };
  const raus = () => {
    const top = offen[0], last = offen.pop()!;
    if (offen.length) {
      offen[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < offen.length && offen[l][1] < offen[m][1]) m = l;
        if (r < offen.length && offen[r][1] < offen[m][1]) m = r;
        if (m === i) break;
        [offen[i], offen[m]] = [offen[m], offen[i]];
        i = m;
      }
    }
    return top;
  };
  for (const d of [0, 1]) { g[start * 2 + d] = 0; rein(start * 2 + d, 0); }
  while (offen.length) {
    const [s] = raus();
    const c = s >> 1, waag = s & 1;
    if (c === ziel) {
      const weg: number[] = [];
      for (let k = s; k >= 0; k = vor[k]) weg.unshift(k >> 1);
      return weg;
    }
    const x = c % b, y = (c / b) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= b || yy >= h) continue;
      const j = yy * b + xx;
      if (j !== ziel && !darf(j)) continue;
      const nw = dx ? 1 : 0;
      const t = j * 2 + nw;
      const ng = g[s] + 1 + (nw !== waag ? 0.5 : 0);
      if (ng < g[t]) { g[t] = ng; vor[t] = s; rein(t, ng + Math.abs(xx - zx) + Math.abs(yy - zy)); }
    }
  }
  return null;
}

/** Felder der Karte, die man vom Startraum aus erreicht (Tür optional offen). */
export function kartenErreichbar(k: Karte, tuerOffen: boolean): Uint8Array {
  const da = new Uint8Array(k.b * k.h);
  const s = k.raeume[START];
  const start = s.my * k.b + s.mx;
  da[start] = 1;
  const st = [start];
  while (st.length) {
    const i = st.pop()!;
    const x = i % k.b, y = (i / k.b) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= k.b || yy >= k.h) continue;
      const j = yy * k.b + xx, v = k.z[j];
      if (da[j] || v === KZ.FELS || v === KZ.GITTER || (v === KZ.TUER && !tuerOffen)) continue;
      da[j] = 1;
      st.push(j);
    }
  }
  return da;
}
