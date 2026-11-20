/**
 * Pixel-Studio: eingebaute Beispielprojekte. Sie zeigen, was das Studio kann (Ebenen, Bewegung,
 * Tags, Modifier, Farbzyklus, Kacheln), und entstehen beim Öffnen aus Zeichen-Rastern und denselben
 * Funktionen, die auch die Knöpfe benutzen.
 */
import { neuesProjekt, neueId, type Projekt } from "./dokument";
import { bewegungEinfuegen, STANDARD_BEWEGUNG } from "./animation";
import { bildEinfuegen } from "./werkzeuge";

/** Zeichenraster → Zelle; Zeichen laut `farben` (Zeichen → Palettenwert), alles andere durchsichtig */
function raster(zeilen: string[], w: number, h: number, farben: Record<string, number>): Uint8Array {
  const z = new Uint8Array(w * h);
  zeilen.slice(0, h).forEach((zeile, y) => { for (let x = 0; x < Math.min(w, zeile.length); x++) z[y * w + x] = farben[zeile[x]] ?? 0; });
  return z;
}

function schleim(): Projekt {
  // 1 dunkel · 2 Grün dunkel · 3 Grün · 4 Hellgrün · 5 Weiß
  const p = neuesProjekt(16, 16, ["#1a1c2c", "#257179", "#38b764", "#a7f070", "#f4f4f4"]);
  const figur = p.ebenen[0].id, schatten = neueId();
  p.ebenen[0].name = "Figur";
  p.ebenen.unshift({ id: schatten, name: "Schatten", sichtbar: true, deckkraft: 0.35 });
  const f = { d: 2, g: 3, l: 4, w: 5, k: 1 };
  p.zellen[figur] = [raster([
    "................",
    "................",
    "................",
    "................",
    "................",
    "......gggg......",
    "....gglllggg....",
    "...gllwllgggg...",
    "..gglwlllggggd..",
    "..ggkwgggkwggd..",
    "..ggkkgggkkggd..",
    ".gggggggggggggd.",
    ".ggggggkkggggdd.",
    "..dgggggggggddd.",
    "...dddddddddd...",
    "................",
  ], 16, 16, f)];
  p.zellen[schatten] = [raster([...Array(15).fill(""), "...kkkkkkkkkk..."], 16, 16, f)];
  // Atmen im Stand (alle Bilder 1–6), dahinter Hüpfen (7–14); der Schatten bleibt liegen
  bewegungEinfuegen(p, 0, [figur], { ...STANDARD_BEWEGUNG, art: "atmen", bilder: 6, staerke: 0.16 }, 140, "stehen");
  bildEinfuegen(p, p.bilder.length - 1, false);
  const letztes = p.bilder.length - 1;
  p.zellen[figur][letztes] = p.zellen[figur][0].slice();
  p.zellen[schatten][letztes] = p.zellen[schatten][0].slice();
  bewegungEinfuegen(p, letztes, [figur], { ...STANDARD_BEWEGUNG, art: "huepfen", bilder: 8, weite: 4 }, 90, "hüpfen");
  // Umriss als Modifier: ändert keine Pixel, wirkt in allen Bildern
  p.ebenen.find(e => e.id === figur)!.mods = [{ id: neueId(), art: "umriss", an: true, lage: "aussen", farbe: "#1a1c2c", breite: 1, deckkraft: 100 }];
  return p;
}

function feuer(): Projekt {
  // 1 dunkel · 2/3 Holz · 4 Rot · 5 Orange · 6 Gelb · 7 Glut-Weiß
  const p = neuesProjekt(16, 16, ["#1a1c2c", "#5a3a26", "#8d5a3b", "#b13e53", "#ef7d57", "#ffcd75", "#fff3c4"]);
  const holz = p.ebenen[0].id, flamme = neueId();
  p.ebenen[0].name = "Holz";
  p.ebenen.push({ id: flamme, name: "Flamme", sichtbar: true, deckkraft: 1 });
  const f = { k: 1, b: 2, B: 3, r: 4, o: 5, y: 6, w: 7 };
  p.zellen[flamme] = [raster([
    "................",
    ".......r........",
    "......rr..r.....",
    ".....rorr.rr....",
    "....rroorrorr...",
    "....roooyoorr...",
    "...rroyyyyorr...",
    "...royywwyyor...",
    "...royywwyyor...",
    "....royyyyor....",
    ".....rooooor....",
    "......rrrrr.....",
  ], 16, 16, f)];
  p.zellen[holz] = [raster([
    "", "", "", "", "", "", "", "", "", "", "", "",
    "..bBBb....bBBb..",
    "...bBBBbbBBBb...",
    "....bBBBBBBb....",
    "...kkkkkkkkkk...",
  ], 16, 16, f)];
  // Rot → Orange → Gelb im Kreis: die Flamme flackert, ohne dass ein Pixel wandert
  bewegungEinfuegen(p, 0, [flamme], { ...STANDARD_BEWEGUNG, art: "farbzyklus", bilder: 6, farbVon: 4, farbBis: 6 }, 110, "flackern");
  return p;
}

function wasser(): Projekt {
  // 1 Tiefe · 2 Wasser · 3 Welle · 4 Gischt
  const p = neuesProjekt(16, 16, ["#1b2a4a", "#2d5f8a", "#4f97c9", "#a7d7f0"]);
  const id = p.ebenen[0].id;
  p.ebenen[0].name = "Wasser";
  const z = new Uint8Array(256).fill(2);
  // Muster mit Periode 8: passt nahtlos an jede Nachbarkachel
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const a = x % 8, b = y % 8, i = y * 16 + x;
    if (b === 2 && a <= 2) z[i] = a === 1 ? 4 : 3;
    if (b === 3 && (a === 3 || a === 4)) z[i] = 3;
    if (b === 6 && a >= 4 && a <= 6) z[i] = a === 5 ? 4 : 3;
    if (b === 7 && (a === 7 || a === 0)) z[i] = 3;
    if (b === 0 && a === 5) z[i] = 1;
    if (b === 4 && a === 1) z[i] = 1;
  }
  p.zellen[id] = [z];
  p.kachel = 16;
  // 2 Pixel je Bild nach rechts, mit Umlauf: nach 8 Bildern ist die Kachel einmal herum
  bewegungEinfuegen(p, 0, [id], { ...STANDARD_BEWEGUNG, art: "verschieben", bilder: 8, dx: 16, dy: 0, umlauf: true }, 120, "strömen");
  return p;
}

export const BEISPIELE: { id: string; name: string; text: string; bauen: () => Projekt }[] = [
  { id: "schleim", name: "Schleim", text: "Zwei Ebenen (Figur und halbdurchsichtiger Schatten), Tags »stehen« und »hüpfen«, Umriss als Modifier.", bauen: schleim },
  { id: "feuer", name: "Lagerfeuer", text: "Farbzyklus: Rot, Orange und Gelb wandern im Kreis — die Flamme flackert, ohne dass ein Pixel sich bewegt.", bauen: feuer },
  { id: "wasser", name: "Wasser-Kachel", text: "Nahtlose 16×16-Kachel (Kachel 3×3 in der Vorschau), die per Verschieben mit Umlauf strömt.", bauen: wasser },
];
