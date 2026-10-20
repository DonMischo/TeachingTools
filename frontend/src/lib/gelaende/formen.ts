/**
 * Formen erkennen: liest den aktuellen Zustand eines Querschnitts und findet,
 * was durch die Verwitterung entstanden ist — Höhlen, Tropfsteinhöhlen,
 * Höhlenbäche, Karstquellen, Schlucklöcher, Dolinen (Lösung/Einsturz),
 * Wollsäcke und Felsburgen, Grusdecken, Schutthalden, Dünen, Tümpel.
 * Ergebnis: Beschriftungen mit Ort und kurzer Erklärung.
 */
import { BODEN, GRANIT, GRUS, LUFT, SAND, SCHUTT, SINTER, STOFFE, WASSER, type Querschnitt } from "./verwitterung";

export interface Form { art: string; text: string; erklaerung: string; x: number; y: number; groesse: number }

export const FORM_INFO: Record<string, { icon: string; erklaerung: string }> = {
  "Tropfsteinhöhle": { icon: "🕯️", erklaerung: "Sickerwasser hat Kalk gelöst; in der Höhle gibt es CO₂ ab, der Kalk fällt als Tropfstein aus. Dicke Decke, kaum Durchfluss — stabil." },
  "Höhlenbach": { icon: "🌊", erklaerung: "Unterirdischer Fluss: Hier sammelt sich das Karstwasser und fließt zur Quelle. Er weitet seinen Gang, vor allem am Boden." },
  "Höhle": { icon: "🕳️", erklaerung: "Hohlraum, den Kohlensäure entlang von Klüften und Schichtfugen gelöst hat." },
  "Karströhre": { icon: "〰️", erklaerung: "Enger Wasserweg: Wo viel Wasser fließt, wird mehr gelöst — die Röhre zieht noch mehr Wasser an und wächst." },
  "Karstquelle": { icon: "💧", erklaerung: "Das Karstwasser tritt über der undurchlässigen Schicht am Hang wieder aus." },
  "Schluckloch": { icon: "⬇️", erklaerung: "Ponor: Hier verschwindet viel Wasser im Untergrund." },
  "Lösungsdoline": { icon: "🥣", erklaerung: "Trichter an der Oberfläche: Hier versickert viel Wasser und löst den Kalk von oben." },
  "Einsturzdoline": { icon: "💥", erklaerung: "Eine Höhlendecke ist eingebrochen — der Trichter reicht über einer Höhle bis zur Oberfläche." },
  "Wollsack": { icon: "🪨", erklaerung: "Granitkern, von Grus umhüllt: Die Verwitterung hat sich von allen Klüften her eingefressen und die Ecken gerundet." },
  "Felsburg": { icon: "🏰", erklaerung: "Freigelegte Wollsäcke: Der Grus wurde weggespült, die harten Kerne bleiben stehen (wie am Brocken)." },
  "Gerollter Block": { icon: "⚫", erklaerung: "Ein losgelöster Block ist den Hang hinabgerollt — so entstehen Blockmeere." },
  "Grusdecke": { icon: "🟫", erklaerung: "Zerfallener Granit: Feldspat ist zu Ton geworden, die Quarzkörner liegen lose." },
  "Schutthalde": { icon: "⛰️", erklaerung: "Gesteinsschutt sammelt sich am Hangfuß — vor allem durch Frostsprengung." },
  "Düne": { icon: "🏜️", erklaerung: "Vom Wind angehäufter Sand: flacher Luvhang, steiler Leehang." },
  "Tümpel": { icon: "🫧", erklaerung: "In einer Senke sammelt sich Wasser, bis es versickert oder überläuft." },
};

const fest = (m: number) => m !== LUFT && m !== WASSER;

/** Läufe benachbarter Spalten mit Bedingung → [von, bis] */
function laeufe(W: number, ok: (i: number) => boolean, min = 3): [number, number][] {
  const aus: [number, number][] = [];
  let a = -1;
  for (let i = 0; i <= W; i++) {
    if (i < W && ok(i)) { if (a < 0) a = i; }
    else if (a >= 0) { if (i - a >= min) aus.push([a, i - 1]); a = -1; }
  }
  return aus;
}

export function formenErkennen(q: Querschnitt): Form[] {
  const { W, H, stoff, start } = q;
  const N = W * H;
  const draussen = q.draussen;
  const formen: Form[] = [];
  const neu = (art: string, x: number, y: number, groesse: number, text = art) =>
    formen.push({ art, text: `${FORM_INFO[art].icon} ${text}`, erklaerung: FORM_INFO[art].erklaerung, x, y, groesse });

  const top = new Int16Array(W);
  for (let i = 0; i < W; i++) { let j = 0; while (j < H && !fest(stoff[j * W + i])) j++; top[i] = j; }
  const startTop = new Int16Array(W);
  for (let i = 0; i < W; i++) { let j = 0; while (j < H && !fest(start[j * W + i])) j++; startTop[i] = j; }
  const loeslich = (m: number) => fest(m) && STOFFE[m].loes > 0 && m !== SINTER;
  const karstig = start.some(m => loeslich(m));

  // Hohlräume (Luft oder Wasser, die nicht zum Himmel gehören)
  if (draussen) {
    const seen = new Uint8Array(N);
    for (let c0 = 0; c0 < N; c0++) {
      if (seen[c0] || fest(stoff[c0]) || draussen[c0]) continue;
      const zell = [c0];
      seen[c0] = 1;
      let sinter = 0, flussMax = 0, sx = 0, sy = 0;
      for (let t = 0; t < zell.length; t++) {
        const c = zell[t], i = c % W, j = (c - i) / W;
        sx += i; sy += j;
        flussMax = Math.max(flussMax, q.karst?.[c] ?? 0);
        for (const n of [c - 1, c + 1, c - W, c + W]) {
          if (n < 0 || n >= N) continue;
          if (stoff[n] === SINTER) sinter++;
          if (!seen[n] && !fest(stoff[n]) && !draussen[n]) { seen[n] = 1; zell.push(n); }
        }
      }
      const g = zell.length, cx = sx / g, cy = sy / g;
      if (g >= 30 && sinter >= 6 && flussMax < 8) neu("Tropfsteinhöhle", cx, cy, g);
      else if (g >= 15 && flussMax >= 3) neu("Höhlenbach", cx, cy, g);
      else if (g >= 30) neu("Höhle", cx, cy, g);
      else if (g >= 6 && flussMax >= 4) neu("Karströhre", cx, cy, g);
    }
  }

  if (karstig && q.karst && draussen) {
    // Karstquellen: Netzzellen am Hang mit viel Austritt
    const quellen: number[] = [];
    for (let c = 0; c < N; c++) {
      if ((q.karst[c] ?? 0) < 6) continue;
      const i = c % W;
      const anLuft = (i > 0 && draussen[c - 1]) || (i < W - 1 && draussen[c + 1]) || (c + W < N && draussen[c + W]);
      const unten = c + W < N ? stoff[c + W] : 0;
      if (anLuft && (unten !== LUFT && !loeslich(unten))) quellen.push(c);
    }
    for (const [a, b] of laeufe(W, i => quellen.some(c => c % W === i), 1)) {
      const c = quellen.find(x => x % W >= a && x % W <= b)!;
      neu("Karstquelle", (a + b) / 2, Math.floor(c / W), b - a + 1);
    }
    // Schlucklöcher: viel Durchfluss an der Oberfläche
    let summe = 0, n = 0;
    for (let i = 0; i < W; i++) if (top[i] < H) { summe += q.karst[top[i] * W + i]; n++; }
    const mittel = summe / (n || 1);
    for (const [a, b] of laeufe(W, i => top[i] < H && q.karst![top[i] * W + i] > Math.max(8, mittel * 5), 1)) neu("Schluckloch", (a + b) / 2, top[a] - 2, b - a + 1);
    // Dolinen: Mulden in der Oberfläche
    const tiefe = new Float32Array(W);
    for (let i = 0; i < W; i++) {
      let l = H, r = H;
      for (let d = 3; d <= 28; d++) { if (i - d >= 0) l = Math.min(l, top[i - d]); if (i + d < W) r = Math.min(r, top[i + d]); }
      if (l === H || r === H) continue;
      tiefe[i] = top[i] - Math.max(l, r);
    }
    for (const [a, b] of laeufe(W, i => tiefe[i] >= 4, 3)) {
      let m = a;
      for (let i = a; i <= b; i++) if (tiefe[i] > tiefe[m]) m = i;
      const einsturz = (q.einstuerze ?? []).some(e => Math.abs(e.x - m) < 20);
      const unterHoehle = draussen && (() => { for (let j = top[m] + 1; j < Math.min(H, top[m] + 30); j++) if (!fest(stoff[j * W + m]) && !draussen[j * W + m]) return true; return false; })();
      neu(einsturz || unterHoehle ? "Einsturzdoline" : "Lösungsdoline", m, top[m] - 4, b - a + 1);
    }
  }

  // Granit: Kerne zwischen Grus
  if (start.some(m => m === GRANIT)) {
    const seen = new Uint8Array(N);
    const bloecke: Form[] = [];
    for (let c0 = 0; c0 < N; c0++) {
      if (seen[c0] || stoff[c0] !== GRANIT) continue;
      const i0 = c0 % W, j0 = (c0 - i0) / W;
      if (j0 - top[i0] > 45) continue; // nur oberflächennah
      const zell = [c0];
      seen[c0] = 1;
      let rand = 0, grus = 0, sx = 0, sy = 0, tief = false;
      for (let t = 0; t < zell.length && zell.length < 3000; t++) {
        const c = zell[t], i = c % W, j = (c - i) / W;
        sx += i; sy += j;
        if (j - top[i] > 60 || j === H - 1) tief = true;
        // Zellen mit offenen Rissen trennen Blöcke ebenso wie Grus
        for (const n of [c - 1, c + 1, c - W, c + W]) {
          if (n < 0 || n >= N) continue;
          const m = stoff[n];
          if (m === GRANIT && q.riss[n] < 0.7) { if (!seen[n]) { seen[n] = 1; zell.push(n); } }
          else { rand++; if (m === GRUS || m === BODEN) grus++; }
        }
      }
      const g = zell.length;
      if (tief || g < 25 || g >= 3000 || grus < rand * 0.4) continue;
      const cx = sx / g, cy = sy / g;
      const lose = q.lose?.[c0] === 1;
      const ixc = Math.round(cx);
      const frei = cy - top[Math.max(0, Math.min(W - 1, ixc))] < Math.sqrt(g) * 0.6;
      let bewegt = 0;
      if (q.gerollt) for (const c of zell) bewegt += q.gerollt[c];
      const gerollt = lose && bewegt > g * 0.5;
      bloecke.push({ art: gerollt ? "Gerollter Block" : frei ? "Felsburg" : "Wollsack", text: "", erklaerung: "", x: cx, y: cy, groesse: g });
    }
    bloecke.sort((a, b) => b.groesse - a.groesse);
    const gezeigt: Form[] = [];
    for (const b of bloecke) {
      if (gezeigt.length >= 6 || gezeigt.some(o => Math.hypot(o.x - b.x, o.y - b.y) < 30)) continue;
      gezeigt.push(b);
      neu(b.art, b.x, b.y, b.groesse);
    }
    const anzahl = bloecke.length;
    if (anzahl > gezeigt.length) formen.push({ art: "Wollsack", text: `🪨 ${anzahl} Wollsäcke und Blöcke`, erklaerung: FORM_INFO.Wollsack.erklaerung, x: -1, y: -1, groesse: anzahl });
    for (const [a, b] of laeufe(W, i => { let n = 0; for (let j = top[i]; j < Math.min(H, top[i] + 8); j++) if (stoff[j * W + i] === GRUS) n++; return n >= 5; }, 12)) neu("Grusdecke", (a + b) / 2, top[Math.round((a + b) / 2)] + 4, b - a + 1);
  }

  // Schutthalden: neu aufgeschütteter Schutt an der Oberfläche
  for (const [a, b] of laeufe(W, i => { let n = 0; for (let j = top[i]; j < Math.min(H, top[i] + 6); j++) if (stoff[j * W + i] === SCHUTT) n++; return n >= 4 && top[i] < startTop[i] + 2; }, 6)) {
    const m = Math.round((a + b) / 2);
    neu("Schutthalde", m, top[m] - 3, b - a + 1);
  }
  // Dünen: Sandkuppen
  if (start.some(m => m === SAND)) for (let i = 10; i < W - 10; i++) {
    if (stoff[top[i] * W + i] !== SAND) continue;
    let gipfel = true;
    for (let d = 1; d <= 10; d++) if (top[i - d] < top[i] || top[i + d] < top[i]) { gipfel = false; break; }
    const tal = Math.max(top[Math.max(0, i - 40)], top[Math.min(W - 1, i + 40)]);
    if (gipfel && tal - top[i] >= 8 && !formen.some(f => f.art === "Düne" && Math.abs(f.x - i) < 30)) neu("Düne", i, top[i] - 4, tal - top[i]);
  }
  // Tümpel
  for (const [a, b] of laeufe(W, i => i < W && top[i] > 1 && stoff[(top[i] - 1) * W + i] === WASSER && stoff[(top[i] - 2) * W + i] === WASSER, 6)) {
    const m = Math.round((a + b) / 2);
    neu("Tümpel", m, top[m] - 3, b - a + 1);
  }
  // je Art höchstens 4, die größten zuerst; nichts doppelt am selben Ort
  const aus: Form[] = [];
  for (const f of formen.slice().sort((a, b) => b.groesse - a.groesse)) {
    const gleiche = aus.filter(o => o.art === f.art);
    if (f.x >= 0 && (gleiche.length >= 4 || gleiche.some(o => o.x >= 0 && Math.hypot(o.x - f.x, o.y - f.y) < 25))) continue;
    aus.push(f);
  }
  return aus.slice(0, 18);
}

/** Zusammenhängende Gebiete einer Maske (4er-Nachbarschaft) mit Mitte und Größe, größte zuerst */
export function haufen(maske: Uint8Array, n: number, min = 10): { x: number; y: number; groesse: number }[] {
  const seen = new Uint8Array(n * n);
  const aus: { x: number; y: number; groesse: number }[] = [];
  for (let c0 = 0; c0 < n * n; c0++) {
    if (!maske[c0] || seen[c0]) continue;
    const st = [c0];
    seen[c0] = 1;
    let sx = 0, sy = 0, g = 0;
    while (st.length) {
      const c = st.pop()!, i = c % n, j = (c - i) / n;
      sx += i; sy += j; g++;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
        const k = jj * n + ii;
        if (maske[k] && !seen[k]) { seen[k] = 1; st.push(k); }
      }
    }
    if (g >= min) aus.push({ x: sx / g, y: sy / g, groesse: g });
  }
  return aus.sort((a, b) => b.groesse - a.groesse);
}

/** Beschriftung für Draufsichten (Zellkoordinaten) */
export interface Marke { text: string; erklaerung: string; x: number; y: number }
