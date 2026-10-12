/**
 * Kinderatlas (Kartennetz »Robinson Crusoe«): Robinson-Netz, bunte Länder, dazu Tiere und
 * Pflanzen dort, wo sie zu Hause sind — als runde Bildchen (Emoji der Systemschrift, auf den
 * Schul-PCs Segoe UI Emoji) mit Namen. Was gezeigt wird, wählt man im ☰-Menü.
 */
import { vor, type Projektion } from "./projektion";

export type KinderWahl = "tiere" | "pflanzen";
export const KINDER_WAHL: { id: KinderWahl; name: string }[] = [
  { id: "tiere", name: "🦁 Tiere" },
  { id: "pflanzen", name: "🌵 Pflanzen" },
];

type Eintrag = { name: string; bild: string; art: KinderWahl; lon: number; lat: number; rang?: number };

/** rang 1 = schon auf der ganzen Welt zu sehen; 2 = erst beim Heranzoomen, wenn Platz ist */
export const KINDER_EINTRAEGE: Eintrag[] = [
  // Polargebiete und Meere
  { name: "Eisbär", bild: "🐻‍❄️", art: "tiere", lon: -75, lat: 74, rang: 1 },
  { name: "Pinguin", bild: "🐧", art: "tiere", lon: 0, lat: -74, rang: 1 },
  { name: "Robbe", bild: "🦭", art: "tiere", lon: -50, lat: -70 },
  { name: "Wal", bild: "🐋", art: "tiere", lon: -150, lat: 20, rang: 1 },
  { name: "Wal", bild: "🐋", art: "tiere", lon: 80, lat: -50 },
  { name: "Delfin", bild: "🐬", art: "tiere", lon: -32, lat: 30, rang: 1 },
  { name: "Hai", bild: "🦈", art: "tiere", lon: 75, lat: -15, rang: 1 },
  { name: "Krake", bild: "🐙", art: "tiere", lon: 165, lat: -30 },
  { name: "Schildkröte", bild: "🐢", art: "tiere", lon: -91, lat: -1 },
  // Afrika
  { name: "Löwe", bild: "🦁", art: "tiere", lon: 35, lat: -3, rang: 1 },
  { name: "Elefant", bild: "🐘", art: "tiere", lon: 24, lat: -16, rang: 1 },
  { name: "Giraffe", bild: "🦒", art: "tiere", lon: 37, lat: 6 },
  { name: "Zebra", bild: "🦓", art: "tiere", lon: 31, lat: -12 },
  { name: "Nashorn", bild: "🦏", art: "tiere", lon: 27, lat: -27 },
  { name: "Gorilla", bild: "🦍", art: "tiere", lon: 25, lat: 0 },
  { name: "Dromedar", bild: "🐪", art: "tiere", lon: 5, lat: 24, rang: 1 },
  // Asien
  { name: "Panda", bild: "🐼", art: "tiere", lon: 103, lat: 31, rang: 1 },
  { name: "Tiger", bild: "🐅", art: "tiere", lon: 79, lat: 21, rang: 1 },
  { name: "Orang-Utan", bild: "🦧", art: "tiere", lon: 114, lat: 1 },
  { name: "Trampeltier", bild: "🐫", art: "tiere", lon: 105, lat: 44 },
  { name: "Wolf", bild: "🐺", art: "tiere", lon: 95, lat: 63, rang: 1 },
  { name: "Elefant", bild: "🐘", art: "tiere", lon: 100, lat: 17 },
  // Australien
  { name: "Känguru", bild: "🦘", art: "tiere", lon: 134, lat: -25, rang: 1 },
  { name: "Koala", bild: "🐨", art: "tiere", lon: 149, lat: -31 },
  { name: "Krokodil", bild: "🐊", art: "tiere", lon: 133, lat: -14 },
  // Amerika
  { name: "Bison", bild: "🦬", art: "tiere", lon: -102, lat: 42, rang: 1 },
  { name: "Grizzlybär", bild: "🐻", art: "tiere", lon: -122, lat: 59, rang: 1 },
  { name: "Weißkopfseeadler", bild: "🦅", art: "tiere", lon: -114, lat: 38 },
  { name: "Waschbär", bild: "🦝", art: "tiere", lon: -84, lat: 37 },
  { name: "Biber", bild: "🦫", art: "tiere", lon: -76, lat: 50 },
  { name: "Faultier", bild: "🦥", art: "tiere", lon: -70, lat: -7, rang: 1 },
  { name: "Papagei", bild: "🦜", art: "tiere", lon: -55, lat: -12 },
  { name: "Jaguar", bild: "🐆", art: "tiere", lon: -58, lat: -19 },
  { name: "Lama", bild: "🦙", art: "tiere", lon: -68, lat: -18, rang: 1 },
  // Europa
  { name: "Fuchs", bild: "🦊", art: "tiere", lon: 16, lat: 63, rang: 1 },
  { name: "Hirsch", bild: "🦌", art: "tiere", lon: 26, lat: 56 },
  { name: "Igel", bild: "🦔", art: "tiere", lon: 9, lat: 50 },
  { name: "Eichhörnchen", bild: "🐿️", art: "tiere", lon: 14, lat: 47 },

  // Pflanzen
  { name: "Kaktus", bild: "🌵", art: "pflanzen", lon: -108, lat: 28, rang: 1 },
  { name: "Mais", bild: "🌽", art: "pflanzen", lon: -91, lat: 41 },
  { name: "Ahorn", bild: "🍁", art: "pflanzen", lon: -71, lat: 47, rang: 1 },
  { name: "Nadelwald", bild: "🌲", art: "pflanzen", lon: -100, lat: 56, rang: 1 },
  { name: "Weizen", bild: "🌾", art: "pflanzen", lon: -106, lat: 51 },
  { name: "Ananas", bild: "🍍", art: "pflanzen", lon: -156, lat: 20 },
  { name: "Banane", bild: "🍌", art: "pflanzen", lon: -86, lat: 14, rang: 1 },
  { name: "Palme", bild: "🌴", art: "pflanzen", lon: -73, lat: 20 },
  { name: "Regenwald", bild: "🌳", art: "pflanzen", lon: -58, lat: -2, rang: 1 },
  { name: "Kaffee", bild: "☕", art: "pflanzen", lon: -46, lat: -20, rang: 1 },
  { name: "Kartoffel", bild: "🥔", art: "pflanzen", lon: -76, lat: -11 },
  { name: "Tulpe", bild: "🌷", art: "pflanzen", lon: 5, lat: 52, rang: 1 },
  { name: "Weintraube", bild: "🍇", art: "pflanzen", lon: 2, lat: 46 },
  { name: "Orange", bild: "🍊", art: "pflanzen", lon: -4, lat: 38 },
  { name: "Olive", bild: "🫒", art: "pflanzen", lon: 22, lat: 39 },
  { name: "Sonnenblume", bild: "🌻", art: "pflanzen", lon: 34, lat: 48 },
  { name: "Kakao", bild: "🍫", art: "pflanzen", lon: -5, lat: 7, rang: 1 },
  { name: "Regenwald", bild: "🌳", art: "pflanzen", lon: 15, lat: 2 },
  { name: "Dattelpalme", bild: "🌴", art: "pflanzen", lon: 30, lat: 26 },
  { name: "Nadelwald", bild: "🌲", art: "pflanzen", lon: 115, lat: 60, rang: 1 },
  { name: "Bambus", bild: "🎋", art: "pflanzen", lon: 111, lat: 26 },
  { name: "Reis", bild: "🌾", art: "pflanzen", lon: 104, lat: 13, rang: 1 },
  { name: "Tee", bild: "🍵", art: "pflanzen", lon: 81, lat: 7 },
  { name: "Kirschblüte", bild: "🌸", art: "pflanzen", lon: 138, lat: 36, rang: 1 },
  { name: "Kiwi", bild: "🥝", art: "pflanzen", lon: 172, lat: -42 },
  { name: "Kokosnuss", bild: "🥥", art: "pflanzen", lon: -150, lat: -17 },
];

/** Punkte für die Karte, schon im Kartennetz (Robinson) */
export function kinderPunkte(wahl: KinderWahl[], p: Projektion): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: KINDER_EINTRAEGE.filter((e) => wahl.includes(e.art)).map((e) => ({
      type: "Feature", geometry: { type: "Point", coordinates: vor([e.lon, e.lat], p) },
      properties: { name: e.name, art: e.art, bild: `kind:${e.art}:${e.bild}`, rang: e.rang ?? 2 },
    })),
  };
}

/** Bildchen: runder weißer Aufkleber mit farbigem Rand (Tiere orange, Pflanzen grün), Emoji darauf */
export function zeichneKind(name: string): { width: number; height: number; data: Uint8ClampedArray; pixelRatio: number } | null {
  const [, art, ...rest] = name.split(":");
  const bild = rest.join(":");
  const s = 64, c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  if (!g || !bild) return null;
  g.fillStyle = "#ffffff"; g.strokeStyle = art === "tiere" ? "#ff8a3d" : "#3fbf5f"; g.lineWidth = 4;
  g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 3, 0, Math.PI * 2); g.fill(); g.stroke();
  g.font = `${s * 0.62}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(bild, s / 2, s / 2 + s * 0.04);
  return { width: s, height: s, data: g.getImageData(0, 0, s, s).data, pixelRatio: 2 };
}
