/**
 * Holt die Musik für die Demos der »Geschichte der Medien« (Kassette,
 * Plattenspieler) von Wikimedia Commons — als MP3-Fassung, die Commons aus
 * dem Original erzeugt — nach public/medien/ton/ und schreibt die Nachweise
 * nach src/lib/medien/toene.json. Nur freie Lizenzen.
 *
 * Aufruf:  node scripts/fetch-medien-toene.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { FREI } from "./commons-galerie.mjs";

/** id → Dateiname auf Commons */
export const TOENE = {
  mixtape: "Steve Combs - 02 - News Breaks And Shortly After So Do I The Pop Song.ogg",
  schellack: "\"Marching Through Georgia\" by Henry C. Work – sung by Harlan & Stanley (1904).ogg",
};

const UA = { "User-Agent": "TT-Teaching-Tools/1.0 (Unterrichtsmaterial; Medien-Demos)" };
const ohneHtml = (s = "") => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

await mkdir("public/medien/ton", { recursive: true });
const nachweise = {};
for (const [id, datei] of Object.entries(TOENE)) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({ action: "query", format: "json", titles: `File:${datei}`, prop: "imageinfo|videoinfo", iiprop: "url|extmetadata", viprop: "derivatives" })
    .forEach(([k, v]) => u.searchParams.set(k, v));
  const seite = Object.values((await (await fetch(u, { headers: UA })).json()).query.pages)[0];
  const info = seite.imageinfo[0];
  const m = info.extmetadata;
  const lizenz = m.LicenseShortName?.value ?? "";
  if (!FREI.test(lizenz)) throw new Error(`${datei}: Lizenz »${lizenz}« ist nicht frei`);
  // MP3-Fassung, die Commons aus dem Original erzeugt (»derivatives«)
  const mp3 = seite.videoinfo?.[0]?.derivatives?.find(d => d.type === "audio/mpeg")?.src;
  if (!mp3) throw new Error(`${datei}: keine MP3-Fassung`);
  const r = await fetch(mp3, { headers: UA });
  if (!r.ok) throw new Error(`${datei}: MP3-Fassung nicht ladbar (${r.status}) ${mp3}`);
  const daten = Buffer.from(await r.arrayBuffer());
  await writeFile(`public/medien/ton/${id}.mp3`, daten);
  nachweise[id] = {
    datei: `/medien/ton/${id}.mp3`, titel: ohneHtml(m.ObjectName?.value) || datei, urheber: ohneHtml(m.Artist?.value) || "unbekannt",
    lizenz, quelle: info.descriptionurl,
  };
  console.log(`${String(Math.round(daten.length / 1024)).padStart(6)} KB  ${id}  (${lizenz})`);
  await new Promise(res => setTimeout(res, 2000));
}
await writeFile("src/lib/medien/toene.json", JSON.stringify(nachweise, null, 2) + "\n");
console.log("Fertig: src/lib/medien/toene.json");
