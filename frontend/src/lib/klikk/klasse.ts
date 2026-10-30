/**
 * Klikk in der Klasse: generierte Namen (kein Freitext), feste Kommentare
 * (dieselbe Liste wie api/routers/klikk.py) und die Kommentare, die unter den
 * eigenen Beiträgen auftauchen — auch ohne Klasse, von erfundenen Leuten.
 */
import { zufall } from "./feed";

const EIGENSCHAFT = ["blauer", "roter", "wilder", "leiser", "flinker", "mutiger", "sonniger", "frecher", "kluger", "kleiner", "lauter", "bunter"];
const TIER = ["otter", "fuchs", "panda", "koala", "pinguin", "igel", "luchs", "rabe", "delfin", "adler", "dachs", "gecko"];

/** Drei Namensvorschläge im Format der Server-Prüfung (»blauer.otter.17«). */
export function namensVorschlaege(seed: number): string[] {
  const r = zufall(seed);
  return [0, 1, 2].map(() => `${EIGENSCHAFT[Math.floor(r() * EIGENSCHAFT.length)]}.${TIER[Math.floor(r() * TIER.length)]}.${1 + Math.floor(r() * 98)}`);
}

export const NAME_MUSTER = /^[a-zäöü]{3,12}\.[a-zäöü]{3,12}\.\d{1,2}$/;

/** Feste Kommentare — Schlüssel wie im Backend. */
export const KOMMENTARE: Record<string, { text: string; gemein: boolean }> = {
  krass: { text: "Krass 🔥", gemein: false },
  lol: { text: "😂😂", gemein: false },
  suess: { text: "Süß 🥹", gemein: false },
  cool: { text: "Cool 😎", gemein: false },
  stark: { text: "Stark von dir 💪", gemein: false },
  fake: { text: "Fake 🤡", gemein: true },
  cringe: { text: "Cringe 😬", gemein: true },
  mehr: { text: "Mach's krasser!", gemein: false },
  vorsicht: { text: "Pass auf dich auf 🙏", gemein: false },
  loeschen: { text: "Lösch das lieber", gemein: false },
  nieda: { text: "Nie erreichbar 🙄", gemein: true },
  mitspielen: { text: "Kannst eh nicht mitspielen 🤷", gemein: true },
  eltern: { text: "Darfst wohl nicht wegen Mami 👶", gemein: true },
  morgen: { text: "Kein Stress, wir spielen morgen 🤝", gemein: false },
  handyfrei: { text: "Handyfrei ist auch okay 👍", gemein: false },
  /** nur unter Beiträgen von jemandem mit niedriger Hygiene */
  stinkt: { text: "Riecht man bis hier 🤢", gemein: true },
};

export const SPIEL_NAME: Record<string, { name: string; emoji: string; einheit: string }> = {
  klick: { name: "Klicker", emoji: "🎯", einheit: "Punkte" }, doppelklick: { name: "Doppelklicker", emoji: "✌️", einheit: "Punkte" },
  bloecke: { name: "Blockregen", emoji: "🧱", einheit: "Punkte" }, sprung: { name: "Würfelsprung", emoji: "🟨", einheit: "m" },
  logik: { name: "Lichtschalter", emoji: "💡", einheit: "Punkte" }, candy: { name: "Candy Blast", emoji: "🍬", einheit: "Punkte" },
  quiz: { name: "Typ-Quiz", emoji: "🔮", einheit: "" },
};

/** Sprüche zum Teilen eines Spielergebnisses — dieselbe Liste wie im Backend (SPRUECHE). */
export const SPRUECHE: Record<string, string> = {
  yeah: "Yeah! 🎉", gg: "GG 🤝", rekord: "Neuer Rekord! 🏆", easy: "Easy. 😴", zuleicht: "Zu einfach 🥱",
  toppen: "Wer kann das toppen? 👀", traut: "Kommt ran, wenn ihr euch traut 😏", geuebt: "Hab nur ein bisschen geübt 😇",
  glueck: "Glück gehabt 🍀", gut: "Bin ich gut oder bin ich gut? 💅", anfang: "Das war erst der Anfang 🔥",
  neidisch: "Schaut nicht so neidisch 😏", owned: "Owned! 😎", noobs: "Owned, ihr Noobs 🎮😎",
};

/** Antworten auf Kommentare unter eigenen Beiträgen — ebenfalls fest. */
export const ANTWORTEN = ["Danke 🥰", "Haha ja 😂", "Was soll das?", "🙄", "Lass mich in Ruhe."];

/** Was Fremde unter einen eigenen Beitrag schreiben. Ab und zu ist etwas Gemeines dabei. */
export function npcKommentare(seed: number, riskant: boolean): { von: string; text: string; gemein: boolean }[] {
  const r = zufall(seed);
  const leute = namensVorschlaege(seed * 3 + 1).concat(namensVorschlaege(seed * 5 + 2));
  const nett = riskant ? ["Krass 🔥", "Mach's krasser!", "LEGENDE 🔥🔥", "Pass auf dich auf 🙏"] : ["Süß 🥹", "Cool 😎", "😂😂", "Stark 💪"];
  const gemein = riskant
    ? ["Fake 🤡", "Cringe 😬 wer macht sowas", "Hoffentlich fliegst du dabei hin 😂"]
    : ["Cringe 😬", "Wer hat gefragt? 💀", "Lösch dich 🤡"];
  const n = 2 + Math.floor(r() * 3);
  const out = Array.from({ length: n }, (_, i) => ({ von: leute[i], text: nett[Math.floor(r() * nett.length)], gemein: false }));
  if (r() < 0.65) out.push({ von: leute[n], text: gemein[Math.floor(r() * gemein.length)], gemein: true });
  return out;
}
