/**
 * Holt die echten Bahnelemente der Monde von JPL Horizons.
 *
 * Bis dahin standen die Monde auf ausgedachten Stellen ihrer Bahn — jetzt
 * stehen sie dort, wo sie wirklich stehen. Gespeichert werden Keplerelemente
 * relativ zum Planeten in der Ekliptik (J2000) und die mittlere Länge samt
 * ihrer Rate, dazu eine Vergleichsposition, an der der Test die eigene
 * Rechnung misst.
 *
 * Warum die Rate nicht einfach aus zwei weit entfernten Zeitpunkten kommt:
 * dazwischen liegen bei Phobos über tausend Umläufe, und verzählt man sich um
 * einen einzigen, steht der Mond 90 Grad daneben. Deshalb tastet sich das
 * Skript über 1, 10, 100 und 365 Tage heran — jede Stufe macht die Zahl der
 * Umläufe der nächsten eindeutig. Die momentanen Elemente schwanken (Phobos um
 * mehrere Grad), über ein Jahr gemittelt läuft der Mond dagegen sauber rund.
 *
 * Aufruf:  node scripts/fetch-mondbahnen.mjs
 */
import { writeFileSync } from "fs";

const ZIEL = "src/lib/sonnensystem/mondbahnen.json";
/** Elemente zu diesem Zeitpunkt (julianisches Datum, TDB) — 1. Januar 2026. */
const EPOCHE = 2_461_041.5;
/** Stufen für das Herantasten an die Rate, in Tagen. */
const STUFEN = [1, 10, 100, 365];
/** Vergleichspunkt gut ein Jahr später, damit der Test auch die Bewegung prüft. */
const PROBE = 2_461_500.5;

const MONDE = [
  { id: "mond", horizons: "301", mutter: "399" },
  { id: "phobos", horizons: "401", mutter: "499" },
  { id: "deimos", horizons: "402", mutter: "499" },
  { id: "io", horizons: "501", mutter: "599" },
  { id: "europa", horizons: "502", mutter: "599" },
  { id: "ganymed", horizons: "503", mutter: "599" },
  { id: "kallisto", horizons: "504", mutter: "599" },
  { id: "mimas", horizons: "601", mutter: "699" },
  { id: "enceladus", horizons: "602", mutter: "699" },
  { id: "tethys", horizons: "603", mutter: "699" },
  { id: "dione", horizons: "604", mutter: "699" },
  { id: "rhea", horizons: "605", mutter: "699" },
  { id: "titan", horizons: "606", mutter: "699" },
  { id: "iapetus", horizons: "608", mutter: "699" },
  { id: "miranda", horizons: "705", mutter: "799" },
  { id: "titania", horizons: "703", mutter: "799" },
  { id: "oberon", horizons: "704", mutter: "799" },
  { id: "triton", horizons: "801", mutter: "899" },
  { id: "charon", horizons: "901", mutter: "999" },
];

async function horizons(params) {
  const url = "https://ssd.jpl.nasa.gov/api/horizons.api?format=json&OBJ_DATA=NO&MAKE_EPHEM=YES&"
    + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const { result } = await res.json();
  const block = result.split("$$SOE")[1]?.split("$$EOE")[0];
  if (!block) throw new Error(`Keine Daten: ${result.slice(0, 400)}`);
  // Jeder Datensatz beginnt mit seinem julianischen Datum am Zeilenanfang.
  return block.trim().split(/\n(?=\d{7}\.\d)/);
}

/**
 * Zieht »NAME= wert« aus einem Datensatz.
 *
 * Vor dem Namen muss eine Grenze stehen: sonst findet »A« die mittlere
 * Anomalie »MA« und »N« die Neigung »IN« — beides ist schon passiert.
 */
const wert = (text, name) => {
  const m = text.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(-?[\\d.]+(?:E[-+]?\\d+)?)`, "m"));
  if (!m) throw new Error(`${name} fehlt`);
  return Number(m[1]);
};

/** Winkeldifferenz in Grad, auf −180 … 180 gebracht. */
const differenz = (a, b) => ((a - b + 540) % 360) - 180;
/** Mittlere Länge: Knoten + Periapsis + mittlere Anomalie. */
const laenge = (satz) => (wert(satz, "OM") + wert(satz, "W") + wert(satz, "MA")) % 360;

const daten = { epoche: EPOCHE, probeJd: PROBE, monde: {} };

for (const m of MONDE) {
  const zeiten = [EPOCHE, ...STUFEN.map(t => EPOCHE + t)];
  const saetze = await horizons({
    COMMAND: `'${m.horizons}'`, CENTER: `'500@${m.mutter}'`, EPHEM_TYPE: "ELEMENTS",
    TLIST: zeiten.join(","), REF_PLANE: "ECLIPTIC", OUT_UNITS: "KM-D",
  });
  const [vektor] = await horizons({
    COMMAND: `'${m.horizons}'`, CENTER: `'500@${m.mutter}'`, EPHEM_TYPE: "VECTORS",
    TLIST: String(PROBE), REF_PLANE: "ECLIPTIC", OUT_UNITS: "KM-S", VEC_TABLE: "1",
  });
  if (saetze.length !== zeiten.length) throw new Error(`${m.id}: ${saetze.length} statt ${zeiten.length} Datensätzen`);

  const L0 = laenge(saetze[0]);
  // Herantasten: jede Stufe zählt ihre Umläufe mit der Rate der vorigen.
  let rate = wert(saetze[0], "N");
  STUFEN.forEach((spanne, k) => {
    const dL = differenz(laenge(saetze[k + 1]), L0);
    const umlaeufe = Math.round((rate * spanne - dL) / 360);
    rate = (dL + umlaeufe * 360) / spanne;
  });

  const mittel = (name) => saetze.reduce((summe, satz) => summe + wert(satz, name), 0) / saetze.length;
  daten.monde[m.id] = {
    // Halbachse km, Exzentrizität, Winkel in Grad; nL ist die mittlere Länge je Tag.
    // Alles ekliptikal (J2000), relativ zum Planeten.
    a: mittel("A"),
    e: mittel("EC"),
    i: mittel("IN"),
    knoten: wert(saetze[0], "OM"),
    periapsis: wert(saetze[0], "W"),
    L0,
    nL: rate,
    probe: [wert(vektor, "X"), wert(vektor, "Y"), wert(vektor, "Z")],
  };
  const d = daten.monde[m.id];
  console.log(`${m.id.padEnd(10)} a=${d.a.toFixed(0).padStart(8)} km  e=${d.e.toFixed(4)}  i=${d.i.toFixed(2)}°  Umlauf ${(360 / d.nL).toFixed(4)} d`);
  await new Promise(r => setTimeout(r, 400));
}

writeFileSync(ZIEL, JSON.stringify(daten, null, 2) + "\n");
console.log(`\nFertig: ${Object.keys(daten.monde).length} Mondbahnen in ${ZIEL}.`);
