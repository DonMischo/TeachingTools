/**
 * Die kleinen Codes der Mitmach-Demos: Morse, Hieroglyphen-Namen,
 * Quipu-Knoten, Handy-Mehrfachtippen, Fax-Zeilen. Reine Rechnung, getestet.
 */

// ── Morse ──
export const MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
  K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
  U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
};
const RUECK = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

/** Text → Morse, Buchstaben durch Leerzeichen, Wörter durch » / « getrennt */
export function zuMorse(text: string): string {
  return text.toUpperCase().replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE").replace(/ß/g, "SS")
    .split(/\s+/).filter(Boolean)
    .map(w => [...w].map(c => MORSE[c]).filter(Boolean).join(" ")).filter(Boolean).join(" / ");
}

/** Morse → Text; Unbekanntes wird zu »?« */
export function ausMorse(code: string): string {
  return code.trim().split(/\s*\/\s*/).map(w => w.split(/\s+/).filter(Boolean).map(z => RUECK[z] ?? "?").join("")).join(" ");
}

/** Dauer eines Tastendrucks → Punkt oder Strich (Grenze in ms) */
export const zeichenAusDauer = (ms: number, grenze = 250): "." | "-" => (ms < grenze ? "." : "-");

// ── Hieroglyphen (Einkonsonanten-Zeichen, vereinfacht) ──
/** Gardiner-Zeichen als Codepunkte (Unicode-Block »Egyptian Hieroglyphs«) */
const H = {
  geier: 0x1313f, schilf: 0x131cb, zweiSchilf: 0x131cc, kueken: 0x13171, fuss: 0x130c0, hocker: 0x132aa,
  viper: 0x13191, eule: 0x13153, wasser: 0x13216, mund: 0x1308b, hof: 0x13254, sieb: 0x1340d,
  riegel: 0x13283, tuch: 0x132f4, teich: 0x13219, huegel: 0x1320e, korb: 0x133a1, krugstaender: 0x133bc,
  brot: 0x133cf, hand: 0x130a7, kobra: 0x13193, loewe: 0x130ed,
};
export const HIEROGLYPHEN_NAMEN: Record<keyof typeof H, string> = {
  geier: "Geier (a)", schilf: "Schilfblatt (i, e)", zweiSchilf: "zwei Schilfblätter (y)", kueken: "Wachtelküken (u, w, o)",
  fuss: "Fuß (b)", hocker: "Hocker (p)", viper: "Hornviper (f, v)", eule: "Eule (m)", wasser: "Wasser (n)", mund: "Mund (r)",
  hof: "Hof (h)", sieb: "Sieb (ch)", riegel: "Riegel (z)", tuch: "Tuch (s)", teich: "Teich (sch)",
  huegel: "Hügel (q)", korb: "Korb (k, c)", krugstaender: "Krugständer (g)", brot: "Brot (t)", hand: "Hand (d)",
  kobra: "Kobra (dsch, j)", loewe: "Löwe (l)",
};

/** Laut → Zeichen. Mehrbuchstabige Laute zuerst prüfen. */
const LAUTE: [string, (keyof typeof H)[]][] = [
  ["sch", ["teich"]], ["ch", ["sieb"]], ["ck", ["korb"]], ["ph", ["viper"]], ["qu", ["huegel", "kueken"]], ["x", ["korb", "tuch"]],
  ["a", ["geier"]], ["e", ["schilf"]], ["i", ["schilf"]], ["j", ["kobra"]], ["y", ["zweiSchilf"]], ["o", ["kueken"]], ["u", ["kueken"]], ["w", ["kueken"]],
  ["b", ["fuss"]], ["p", ["hocker"]], ["f", ["viper"]], ["v", ["viper"]], ["m", ["eule"]], ["n", ["wasser"]], ["r", ["mund"]],
  ["l", ["loewe"]], ["h", ["hof"]], ["z", ["riegel"]], ["s", ["tuch"]], ["q", ["huegel"]], ["k", ["korb"]], ["c", ["korb"]],
  ["g", ["krugstaender"]], ["t", ["brot"]], ["d", ["hand"]],
];

export interface Glyphe { zeichen: string; name: string; laut: string }

/** Ein Name in vereinfachten Hieroglyphen (so, wie es Museen für Kinder machen) */
export function inHieroglyphen(name: string): Glyphe[] {
  const s = name.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z]/g, "");
  const aus: Glyphe[] = [];
  let i = 0;
  while (i < s.length) {
    const treffer = LAUTE.find(([l]) => s.startsWith(l, i));
    if (!treffer) { i++; continue; }
    const [laut, zeichen] = treffer;
    // Doppelte Buchstaben (»tt«, »ll«) schrieb man nur einmal
    if (laut.length === 1 && s[i - 1] === laut && aus.length) { i++; continue; }
    for (const z of zeichen) aus.push({ zeichen: String.fromCodePoint(H[z]), name: HIEROGLYPHEN_NAMEN[z], laut });
    i += laut.length;
  }
  return aus;
}

// ── Quipu ──
export const quipuWert = (knoten: number[]) => knoten.reduce((s, k, i) => s + k * 10 ** i, 0);

// ── Handy-Tastatur (Mehrfachtippen) ──
export const TASTEN: Record<string, string> = {
  "1": ".,?!1", "2": "abc2", "3": "def3", "4": "ghi4", "5": "jkl5", "6": "mno6", "7": "pqrs7", "8": "tuv8", "9": "wxyz9", "0": " 0",
};
/** Wie oft muss man tippen? »hallo« → 2+1+3+3+3 = 12 */
export function tippZahl(text: string): number {
  let n = 0;
  for (const c of text.toLowerCase()) {
    const t = Object.values(TASTEN).find(v => v.includes(c));
    n += t ? t.indexOf(c) + 1 : 0;
  }
  return n;
}
/** Buchstabe für Taste + wie oft gedrückt */
export const buchstabe = (taste: string, mal: number) => {
  const v = TASTEN[taste] ?? "";
  return v ? v[(mal - 1) % v.length] : "";
};

// ── Fax ──
/** Eine Zeile aus 0/1 → Lauflängen, abwechselnd weiß/schwarz, beginnend mit Weiß */
export function lauflaengen(zeile: (0 | 1)[]): number[] {
  const aus: number[] = [];
  let farbe: 0 | 1 = 0, n = 0;
  for (const p of zeile) {
    if (p === farbe) n++;
    else { aus.push(n); farbe = p; n = 1; }
  }
  aus.push(n);
  return aus;
}
export function ausLauflaengen(laengen: number[]): (0 | 1)[] {
  const aus: (0 | 1)[] = [];
  laengen.forEach((n, i) => { for (let k = 0; k < n; k++) aus.push((i % 2) as 0 | 1); });
  return aus;
}
