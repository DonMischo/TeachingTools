/**
 * Holt Film (Kino) und Radiosender-Aufnahmen für die Demos der »Geschichte der
 * Medien« von Wikimedia Commons — als verkleinerte Fassungen (»derivatives«) —
 * nach public/medien/kino-radio/ und schreibt die Nachweise nach
 * src/lib/medien/kino-radio.json. Nur freie Lizenzen.
 *
 * Aufruf:  node scripts/fetch-medien-kino-radio.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { FREI } from "./commons-galerie.mjs";

/** id → { Dateiname auf Commons, Art } */
export const DATEIEN = {
  film: { datei: "Arrival of a Train at La Ciotat (The Lumière Brothers, 1895).webm", art: "video" },
  apollo: { datei: "Armstrong Small Step.ogg", art: "audio" },
  edison: { datei: "Thomas Edison Mary had lamb.ogg", art: "audio" },
  sullivan: { datei: "Arthur Sullivan - wax cylinder recording.ogg", art: "audio" },
  tschai: { datei: "Tchaikowsky & Anton Rubinstein & friends(1890).ogg", art: "audio" },
  zeit: { datei: "WWV time signal - 20090503.ogg", art: "audio" },
};

const UA = { "User-Agent": "TT-Teaching-Tools/1.0 (Unterrichtsmaterial; Medien-Demos)" };
const ohneHtml = (s = "") => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const warte = (ms) => new Promise(res => setTimeout(res, ms));

async function holen(url) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.status === 429) { await warte(30000); continue; }
    return r;
  }
  throw new Error(`Zu viele Anfragen: ${url}`);
}

await mkdir("public/medien/kino-radio", { recursive: true });
const nachweise = {};
for (const [id, { datei, art }] of Object.entries(DATEIEN)) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({ action: "query", format: "json", titles: `File:${datei}`, prop: "imageinfo|videoinfo", iiprop: "url|extmetadata", viprop: "derivatives" })
    .forEach(([k, v]) => u.searchParams.set(k, v));
  const j = await (await holen(u)).json();
  const seite = Object.values(j.query.pages)[0];
  const info = seite.imageinfo[0];
  const m = info.extmetadata;
  const lizenz = m.LicenseShortName?.value ?? "";
  if (!FREI.test(lizenz)) throw new Error(`${datei}: Lizenz »${lizenz}« ist nicht frei`);
  const ders = seite.videoinfo?.[0]?.derivatives ?? [];
  let quelle, ende;
  if (art === "audio") {
    quelle = ders.find(d => d.type === "audio/mpeg")?.src;
    ende = "mp3";
  } else {
    const cand = ders.filter(d => d.type.startsWith("video/webm") && d.width <= 640).sort((a, b) => b.width - a.width);
    quelle = (cand[0] ?? ders.find(d => d.type.startsWith("video/mp4")))?.src;
    ende = "webm";
  }
  if (!quelle) throw new Error(`${datei}: keine passende Fassung`);
  const r = await holen(quelle);
  if (!r.ok) throw new Error(`${datei}: nicht ladbar (${r.status}) ${quelle}`);
  const daten = Buffer.from(await r.arrayBuffer());
  await writeFile(`public/medien/kino-radio/${id}.${ende}`, daten);
  nachweise[id] = {
    datei: `/medien/kino-radio/${id}.${ende}`, titel: ohneHtml(m.ObjectName?.value) || datei, urheber: ohneHtml(m.Artist?.value) || "unbekannt",
    lizenz, quelle: info.descriptionurl,
  };
  console.log(`${String(Math.round(daten.length / 1024)).padStart(6)} KB  ${id}  (${lizenz})`);
  await warte(3500);
}
await writeFile("src/lib/medien/kino-radio.json", JSON.stringify(nachweise, null, 2) + "\n");
console.log("Fertig: src/lib/medien/kino-radio.json");
