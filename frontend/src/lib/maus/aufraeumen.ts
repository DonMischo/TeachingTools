/**
 * »Aufräumen« — Ziehen und Ablegen.
 *
 * Erste Runde: Tiere dorthin, wo sie leben. Zweite Runde: Dateien in Ordner
 * und eine in den Papierkorb — das ist schon der Griff, den der Explorer am
 * Ende braucht.
 */
import { AVATARS } from "@/components/AvatarPicker";
import { ziehe } from "./klickspiele";
import { tierName } from "./tiere";

export type Ding = { id: string; icon: string; label: string; ziel: string; bg?: string };
export type Zone = { id: string; icon: string; label: string };
export type Rechteck = { id: string; left: number; top: number; right: number; bottom: number };

export const TIER_ZONEN: Zone[] = [
  { id: "wasser", icon: "🌊", label: "Wasser" },
  { id: "land", icon: "🌳", label: "Land" },
  { id: "luft", icon: "☁️", label: "Luft" },
];

/** Nur Tiere, bei denen ein Kind nicht lange streiten muss. */
export const LEBENSRAUM: Record<string, string> = {
  whale: "wasser", dolphin: "wasser", shark: "wasser", octopus: "wasser", crab: "wasser",
  cat: "land", dog: "land", fox: "land", lion: "land", tiger: "land", cow: "land",
  pig: "land", panda: "land", hedgehog: "land",
  owl: "luft", butterfly: "luft", bee: "luft", parrot: "luft",
};

/** Zwei Tiere je Lebensraum, gemischt. */
export function tierRunde(zufall = Math.random): Ding[] {
  const dinge = TIER_ZONEN.flatMap(zone => {
    const kandidaten = AVATARS.filter(a => LEBENSRAUM[a.id] === zone.id);
    return ziehe(kandidaten, 2, zufall).map(a => ({
      id: a.id, icon: a.emoji, label: tierName(a.id), ziel: zone.id, bg: a.bg,
    }));
  });
  return ziehe(dinge, dinge.length, zufall);
}

export const DATEI_ZONEN: Zone[] = [
  { id: "bilder", icon: "📁", label: "Bilder" },
  { id: "musik", icon: "📁", label: "Musik" },
  { id: "dokumente", icon: "📁", label: "Dokumente" },
  { id: "papierkorb", icon: "🗑️", label: "Papierkorb" },
];

export const DATEIEN: Ding[] = [
  { id: "urlaub", icon: "🖼️", label: "Urlaub.jpg", ziel: "bilder" },
  { id: "katze", icon: "🖼️", label: "Katze.png", ziel: "bilder" },
  { id: "lied", icon: "🎵", label: "Lieblingslied.mp3", ziel: "musik" },
  { id: "hausaufgabe", icon: "📄", label: "Hausaufgabe.docx", ziel: "dokumente" },
  { id: "einkauf", icon: "📄", label: "Einkaufsliste.txt", ziel: "dokumente" },
  { id: "muell", icon: "📄", label: "Müll.txt", ziel: "papierkorb" },
];

export function dateiRunde(zufall = Math.random): Ding[] {
  return ziehe(DATEIEN, DATEIEN.length, zufall);
}

/** In welcher Ablagefläche liegt der Punkt? */
export function zoneBei(rechtecke: Rechteck[], x: number, y: number): string | null {
  const r = rechtecke.find(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
  return r ? r.id : null;
}

/** Bis zu 1000 je Runde — für jedes Ding, das beim ersten Mal richtig lag. */
export function rundenPunkte(richtigBeimErstenMal: number, anzahl: number): number {
  return anzahl ? Math.round((1000 * richtigBeimErstenMal) / anzahl) : 0;
}
