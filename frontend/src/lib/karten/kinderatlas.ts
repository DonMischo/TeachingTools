/**
 * Kinderatlas (Kartennetz »Robinson Crusoe«): Robinson-Netz, bunte Länder, dazu Tiere und
 * Pflanzen dort, wo sie zu Hause sind — als Kacheln wie die Avatar-Tiere (AvatarPicker, auch im
 * Maus-Führerschein): Emoji auf farbigem, abgerundetem Feld. Tiere, die es als Avatar gibt,
 * sehen genau so aus wie dort. Was gezeigt wird, wählt man im ☰-Menü.
 */
import { AVATARS } from "@/components/AvatarPicker";
import { vor, type Projektion } from "./projektion";

export type KinderWahl = "tiere" | "pflanzen";
export const KINDER_WAHL: { id: KinderWahl; name: string }[] = [
  { id: "tiere", name: "🦁 Tiere" },
  { id: "pflanzen", name: "🌵 Pflanzen" },
];

/** id = Bild public/karten/kinderatlas/<id>.png (Openclipart, scripts/fetch-kinderatlas.mjs); bild = Emoji (Kachel, Ersatz) */
type Eintrag = { id: string; name: string; bild: string; art: KinderWahl; lon: number; lat: number; rang?: number };

/** Bildstil: gezeichnete Illustrationen (Openclipart) oder Avatar-Kacheln wie im Maus-Führerschein */
export type KinderStil = "illustriert" | "niedlich";
export const KINDER_STILE: { id: KinderStil; name: string }[] = [
  { id: "illustriert", name: "Illustriert" },
  { id: "niedlich", name: "Niedlich (Kacheln)" },
];

/** rang 1 = schon auf der ganzen Welt zu sehen; 2 = erst beim Heranzoomen, wenn Platz ist */
export const KINDER_EINTRAEGE: Eintrag[] = [
  // Polargebiete und Meere
  { id: "eisbaer", name: "Eisbär", bild: "🐻‍❄️", art: "tiere", lon: -75, lat: 74, rang: 1 },
  { id: "pinguin", name: "Pinguin", bild: "🐧", art: "tiere", lon: 0, lat: -74, rang: 1 },
  { id: "robbe", name: "Robbe", bild: "🦭", art: "tiere", lon: -50, lat: -70 },
  { id: "wal", name: "Wal", bild: "🐳", art: "tiere", lon: -150, lat: 20, rang: 1 },
  { id: "wal", name: "Wal", bild: "🐳", art: "tiere", lon: 80, lat: -50 },
  { id: "delfin", name: "Delfin", bild: "🐬", art: "tiere", lon: -32, lat: 30, rang: 1 },
  { id: "hai", name: "Hai", bild: "🦈", art: "tiere", lon: 75, lat: -15, rang: 1 },
  { id: "krake", name: "Krake", bild: "🐙", art: "tiere", lon: 165, lat: -30 },
  { id: "schildkroete", name: "Schildkröte", bild: "🐢", art: "tiere", lon: -91, lat: -1 },
  // Afrika
  { id: "loewe", name: "Löwe", bild: "🦁", art: "tiere", lon: 35, lat: -3, rang: 1 },
  { id: "elefant", name: "Elefant", bild: "🐘", art: "tiere", lon: 24, lat: -16, rang: 1 },
  { id: "giraffe", name: "Giraffe", bild: "🦒", art: "tiere", lon: 37, lat: 6 },
  { id: "zebra", name: "Zebra", bild: "🦓", art: "tiere", lon: 31, lat: -12 },
  { id: "nashorn", name: "Nashorn", bild: "🦏", art: "tiere", lon: 27, lat: -27 },
  { id: "gorilla", name: "Gorilla", bild: "🦍", art: "tiere", lon: 25, lat: 0 },
  { id: "dromedar", name: "Dromedar", bild: "🐪", art: "tiere", lon: 5, lat: 24, rang: 1 },
  // Asien
  { id: "panda", name: "Panda", bild: "🐼", art: "tiere", lon: 103, lat: 31, rang: 1 },
  { id: "tiger", name: "Tiger", bild: "🐯", art: "tiere", lon: 79, lat: 21, rang: 1 },
  { id: "orangutan", name: "Orang-Utan", bild: "🦧", art: "tiere", lon: 114, lat: 1 },
  { id: "trampeltier", name: "Trampeltier", bild: "🐫", art: "tiere", lon: 105, lat: 44 },
  { id: "wolf", name: "Wolf", bild: "🐺", art: "tiere", lon: 95, lat: 63, rang: 1 },
  { id: "elefant", name: "Elefant", bild: "🐘", art: "tiere", lon: 100, lat: 17 },
  // Australien
  { id: "kaenguru", name: "Känguru", bild: "🦘", art: "tiere", lon: 134, lat: -25, rang: 1 },
  { id: "koala", name: "Koala", bild: "🐨", art: "tiere", lon: 149, lat: -31 },
  { id: "krokodil", name: "Krokodil", bild: "🐊", art: "tiere", lon: 133, lat: -14 },
  // Amerika
  { id: "bison", name: "Bison", bild: "🦬", art: "tiere", lon: -102, lat: 42, rang: 1 },
  { id: "grizzly", name: "Grizzlybär", bild: "🐻", art: "tiere", lon: -122, lat: 59, rang: 1 },
  { id: "adler", name: "Weißkopfseeadler", bild: "🦅", art: "tiere", lon: -114, lat: 38 },
  { id: "waschbaer", name: "Waschbär", bild: "🦝", art: "tiere", lon: -84, lat: 37 },
  { id: "biber", name: "Biber", bild: "🦫", art: "tiere", lon: -76, lat: 50 },
  { id: "faultier", name: "Faultier", bild: "🦥", art: "tiere", lon: -70, lat: -7, rang: 1 },
  { id: "papagei", name: "Papagei", bild: "🦜", art: "tiere", lon: -55, lat: -12 },
  { id: "jaguar", name: "Jaguar", bild: "🐆", art: "tiere", lon: -58, lat: -19 },
  { id: "lama", name: "Lama", bild: "🦙", art: "tiere", lon: -68, lat: -18, rang: 1 },
  // Europa
  { id: "fuchs", name: "Fuchs", bild: "🦊", art: "tiere", lon: 16, lat: 63, rang: 1 },
  { id: "hirsch", name: "Hirsch", bild: "🦌", art: "tiere", lon: 26, lat: 56 },
  { id: "igel", name: "Igel", bild: "🦔", art: "tiere", lon: 9, lat: 50 },
  { id: "eichhoernchen", name: "Eichhörnchen", bild: "🐿️", art: "tiere", lon: 14, lat: 47 },

  // Pflanzen
  { id: "kaktus", name: "Kaktus", bild: "🌵", art: "pflanzen", lon: -108, lat: 28, rang: 1 },
  { id: "mais", name: "Mais", bild: "🌽", art: "pflanzen", lon: -91, lat: 41 },
  { id: "ahorn", name: "Ahorn", bild: "🍁", art: "pflanzen", lon: -71, lat: 47, rang: 1 },
  { id: "nadelbaum", name: "Nadelwald", bild: "🌲", art: "pflanzen", lon: -100, lat: 56, rang: 1 },
  { id: "weizen", name: "Weizen", bild: "🌾", art: "pflanzen", lon: -106, lat: 51 },
  { id: "ananas", name: "Ananas", bild: "🍍", art: "pflanzen", lon: -156, lat: 20 },
  { id: "banane", name: "Banane", bild: "🍌", art: "pflanzen", lon: -86, lat: 14, rang: 1 },
  { id: "palme", name: "Palme", bild: "🌴", art: "pflanzen", lon: -73, lat: 20 },
  { id: "laubbaum", name: "Regenwald", bild: "🌳", art: "pflanzen", lon: -58, lat: -2, rang: 1 },
  { id: "kaffee", name: "Kaffee", bild: "☕", art: "pflanzen", lon: -46, lat: -20, rang: 1 },
  { id: "kartoffel", name: "Kartoffel", bild: "🥔", art: "pflanzen", lon: -76, lat: -11 },
  { id: "tulpe", name: "Tulpe", bild: "🌷", art: "pflanzen", lon: 5, lat: 52, rang: 1 },
  { id: "traube", name: "Weintraube", bild: "🍇", art: "pflanzen", lon: 2, lat: 46 },
  { id: "orange", name: "Orange", bild: "🍊", art: "pflanzen", lon: -4, lat: 38 },
  { id: "olive", name: "Olive", bild: "🫒", art: "pflanzen", lon: 22, lat: 39 },
  { id: "sonnenblume", name: "Sonnenblume", bild: "🌻", art: "pflanzen", lon: 34, lat: 48 },
  { id: "kakao", name: "Kakao", bild: "🍫", art: "pflanzen", lon: -5, lat: 7, rang: 1 },
  { id: "laubbaum", name: "Regenwald", bild: "🌳", art: "pflanzen", lon: 15, lat: 2 },
  { id: "palme", name: "Dattelpalme", bild: "🌴", art: "pflanzen", lon: 30, lat: 26 },
  { id: "nadelbaum", name: "Nadelwald", bild: "🌲", art: "pflanzen", lon: 115, lat: 60, rang: 1 },
  { id: "bambus", name: "Bambus", bild: "🎋", art: "pflanzen", lon: 111, lat: 26 },
  { id: "reis", name: "Reis", bild: "🌾", art: "pflanzen", lon: 104, lat: 13, rang: 1 },
  { id: "tee", name: "Tee", bild: "🍵", art: "pflanzen", lon: 81, lat: 7 },
  { id: "kirschbluete", name: "Kirschblüte", bild: "🌸", art: "pflanzen", lon: 138, lat: 36, rang: 1 },
  { id: "kiwi", name: "Kiwi", bild: "🥝", art: "pflanzen", lon: 172, lat: -42 },
  { id: "kokosnuss", name: "Kokosnuss", bild: "🥥", art: "pflanzen", lon: -150, lat: -17 },
];

/** Kachelfarbe: die des Avatars mit demselben Emoji, sonst ein freundlicher Ton je Art */
const AVATAR_FARBE = new Map<string, string>(AVATARS.map((a) => [a.emoji, a.bg]));
const FARBE_SONST: Record<KinderWahl, string[]> = {
  tiere: ["#FFB703", "#F4A261", "#E9C46A", "#FFADAD", "#BDE0FE", "#CDB4DB", "#A8DADC"],
  pflanzen: ["#95D5B2", "#B5EAD7", "#80B918", "#FFE770", "#FFDDE1", "#06D6A0"],
};
export function kachelFarbe(e: Eintrag, i: number): string {
  return AVATAR_FARBE.get(e.bild) ?? FARBE_SONST[e.art][i % FARBE_SONST[e.art].length];
}

/** Punkte für die Karte, schon im Kartennetz (Robinson) */
export function kinderPunkte(wahl: KinderWahl[], p: Projektion, stil: KinderStil = "illustriert"): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: KINDER_EINTRAEGE.flatMap((e, i) => (wahl.includes(e.art) ? [{
      type: "Feature" as const, geometry: { type: "Point" as const, coordinates: vor([e.lon, e.lat], p) },
      properties: { name: e.name, art: e.art, bild: `${stil === "niedlich" ? "kind" : `kindbild:${e.id}`}:${kachelFarbe(e, i)}:${e.bild}`, rang: e.rang ?? 2 },
    }] : [])),
  };
}

/** Bildchen: abgerundete Kachel in der Avatar-Farbe mit weißem Rand, Emoji darauf */
export function zeichneKind(name: string): { width: number; height: number; data: Uint8ClampedArray; pixelRatio: number } | null {
  const [, farbe, ...rest] = name.split(":");
  const bild = rest.join(":");
  const s = 64, c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  if (!g || !bild) return null;
  g.fillStyle = farbe; g.strokeStyle = "#ffffff"; g.lineWidth = 4;
  g.beginPath(); g.roundRect(3, 3, s - 6, s - 6, 16); g.fill(); g.stroke();
  g.font = `${s * 0.6}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(bild, s / 2, s / 2 + s * 0.04);
  return { width: s, height: s, data: g.getImageData(0, 0, s, s).data, pixelRatio: 2 };
}

/**
 * Illustration (»kindbild:<id>:<farbe>:<emoji>«): Bild aus public/karten/kinderatlas mit weißem Saum,
 * damit es auf jeder Länderfarbe steht. Gibt es kein Bild (Löwe, Kakao …), kommt die Kachel.
 */
export async function ladeKindBild(name: string): Promise<{ width: number; height: number; data: Uint8ClampedArray; pixelRatio: number } | null> {
  const [, id, ...kachel] = name.split(":");
  const img = new Image();
  img.src = `/karten/kinderatlas/${id}.png`;
  try { await img.decode(); } catch { return zeichneKind(`kind:${kachel.join(":")}`); }
  const s = 96, rand = 5, c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  if (!g) return null;
  const f = Math.min((s - 2 * rand) / img.naturalWidth, (s - 2 * rand) / img.naturalHeight);
  const w = img.naturalWidth * f, h = img.naturalHeight * f, x = (s - w) / 2, y = (s - h) / 2;
  // Saum: das Bild weiß eingefärbt ringsum versetzt, dann das Bild selbst darüber
  const saum = document.createElement("canvas");
  saum.width = saum.height = s;
  const sg = saum.getContext("2d")!;
  sg.drawImage(img, x, y, w, h);
  sg.globalCompositeOperation = "source-in"; sg.fillStyle = "#ffffff"; sg.fillRect(0, 0, s, s);
  for (let a = 0; a < 16; a++) g.drawImage(saum, Math.cos((a * Math.PI) / 8) * 3, Math.sin((a * Math.PI) / 8) * 3);
  g.drawImage(img, x, y, w, h);
  return { width: s, height: s, data: g.getImageData(0, 0, s, s).data, pixelRatio: 2 };
}
