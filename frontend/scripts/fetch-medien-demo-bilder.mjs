/**
 * Holt Fotos (Dia, Polaroid) und den Diskettenlaufwerk-Ton für die Demos der
 * »Geschichte der Medien« von Wikimedia Commons nach public/medien/demo/ und
 * schreibt die Nachweise nach src/lib/medien/demo-bilder.json. Nur freie Lizenzen.
 *
 * Aufruf:  node scripts/fetch-medien-demo-bilder.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { FREI, holeGalerie } from "./commons-galerie.mjs";

const BILDER = {
  dia_dolomiten: "Lech de Crespëina Parc Naturel Puez.jpg",
  dia_dorum: "Sunset at Dorum with Obereversand lighthouse.jpg",
  dia_godrevy: "Godrevy Lighthouse July 2026 02.jpg",
  polaroid_leuchtturm: "Cape May Lighthouse September 2020 002.jpg",
  polaroid_katze: "Domestic shorthair cat portrait in grass.jpg",
  polaroid_hund: "Labrador Retriever portrait.jpg",
};
const TOENE = { diskette_laufwerk: "Floppy drive sounds.ogg" };

const DATEI = "src/lib/medien/demo-bilder.json";
const UA = { "User-Agent": "TT-Teaching-Tools/1.0 (Unterrichtsmaterial; Medien-Demos)" };
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const ohneHtml = (s = "") => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** Commons-API mit ≥ 3 s Abstand; bei »too many requests« 30 s warten */
async function api(params) {
  for (let i = 0; i < 6; i++) {
    await warte(3000);
    const u = new URL("https://commons.wikimedia.org/w/api.php");
    Object.entries({ format: "json", ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
    const r = await fetch(u, { headers: UA });
    const t = await r.text();
    if (/too many requests/i.test(t)) { console.log("Drosselung, warte 30 s …"); await warte(30000); continue; }
    return JSON.parse(t);
  }
  throw new Error("Commons drosselt dauerhaft");
}

await mkdir("public/medien/demo", { recursive: true });
await holeGalerie({ bilder: BILDER, ziel: "public/medien/demo", nachweise: DATEI, url: "/medien/demo" });

const alt = JSON.parse(readFileSync(DATEI, "utf8"));
const nachweise = {};
for (const [id, n] of Object.entries(alt)) {
  const { seite, quelle, lizenzUrl, ...rest } = n;
  nachweise[id] = { ...rest, quelle: quelle ?? seite };
}
for (const [id, datei] of Object.entries(TOENE)) {
  if (existsSync(`public/medien/demo/${id}.mp3`) && alt[id]) { nachweise[id] = alt[id]; continue; }
  const r = await api({ action: "query", titles: `File:${datei}`, prop: "imageinfo|videoinfo", iiprop: "url|extmetadata", viprop: "derivatives" });
  const seite = Object.values(r.query.pages)[0];
  const info = seite.imageinfo[0], m = info.extmetadata;
  const lizenz = ohneHtml(m.LicenseShortName?.value);
  if (!FREI.test(lizenz)) throw new Error(`${datei}: Lizenz »${lizenz}« ist nicht frei`);
  const mp3 = seite.videoinfo?.[0]?.derivatives?.find((d) => d.type === "audio/mpeg")?.src;
  if (!mp3) throw new Error(`${datei}: keine MP3-Fassung`);
  const res = await fetch(mp3, { headers: UA });
  if (!res.ok) throw new Error(`${datei}: ${res.status}`);
  const daten = Buffer.from(await res.arrayBuffer());
  await writeFile(`public/medien/demo/${id}.mp3`, daten);
  nachweise[id] = {
    datei: `/medien/demo/${id}.mp3`, titel: ohneHtml(m.ObjectName?.value) || datei,
    urheber: ohneHtml(m.Artist?.value) || "unbekannt", lizenz, quelle: info.descriptionurl,
  };
  console.log(`${String(Math.round(daten.length / 1024)).padStart(6)} KB  ${id}  (${lizenz})`);
}
writeFileSync(DATEI, JSON.stringify(nachweise, null, 2) + "\n");
console.log(`Fertig: ${Object.keys(nachweise).length} Nachweise in ${DATEI}`);
