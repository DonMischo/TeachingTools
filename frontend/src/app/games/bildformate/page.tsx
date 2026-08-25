"use client";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * PBM / PGM / PPM (Netpbm-Textformate) zum Anfassen: links die Datei als Text,
 * rechts das Bild — live. Klicks ins Bild schreiben den Wert zurück in den Text,
 * damit Schüler den Zusammenhang Zahl ↔ Pixel selbst entdecken.
 *
 * Bewusst tolerant geparst: Zeilenumbrüche sind irrelevant (die Werte werden
 * der Reihe nach gelesen und alle `Breite` Werte umgebrochen), Kommentare mit
 * `#` sind erlaubt, und unvollständige Dateien werden trotzdem angezeigt.
 */

type Magic = "P1" | "P2" | "P3";

const MAX_DIM = 128;

const FORMATS: { magic: Magic; name: string; sub: string; color: string }[] = [
  { magic: "P1", name: "PBM", sub: "Schwarz-Weiß · P1", color: "#64748b" },
  { magic: "P2", name: "PGM", sub: "Graustufen · P2", color: "#8b5cf6" },
  { magic: "P3", name: "PPM", sub: "Farbe · P3", color: "#f97316" },
];

const EXAMPLES: Record<Magic, string> = {
  P1: `P1
# Ein Haus. 0 = weiß, 1 = schwarz
12 12
000001100000
000011110000
000111111000
001111111100
011111111110
111111111111
001000000100
001011110100
001011110100
001000000100
001001100100
001111111100
`,
  P2: `P2
# Grauverlauf. 0 = schwarz, 255 = weiß
8 4
255
  0  36  73 109 146 182 219 255
  0  36  73 109 146 182 219 255
255 219 182 146 109  73  36   0
255 219 182 146 109  73  36   0
`,
  P3: `P3
# Die acht Grundfarben. Je Pixel: Rot Grün Blau
4 2
255
  0   0   0   255 255 255   255   0   0     0 255   0
  0   0 255   255 255   0     0 255 255   255   0 255
`,
};

const STRUCTURE: Record<Magic, [string, string][]> = {
  P1: [
    ["P1", "Kennung: Schwarz-Weiß-Bild als Text"],
    ["12 12", "Breite und Höhe in Pixeln"],
    ["0 1 1 0 …", "ein Wert je Pixel — 0 = weiß, 1 = schwarz"],
  ],
  P2: [
    ["P2", "Kennung: Graustufenbild als Text"],
    ["8 4", "Breite und Höhe in Pixeln"],
    ["255", "Maximalwert — dieser Wert ist weiß"],
    ["0 36 73 …", "ein Wert je Pixel — 0 = schwarz bis Maximalwert = weiß"],
  ],
  P3: [
    ["P3", "Kennung: Farbbild als Text"],
    ["4 2", "Breite und Höhe in Pixeln"],
    ["255", "Maximalwert je Farbkanal"],
    ["255 0 0 …", "drei Werte je Pixel — Rot, Grün, Blau"],
  ],
};

const PPM_COLORS: [string, number, number, number][] = [
  ["Schwarz", 0, 0, 0],
  ["Weiß", 255, 255, 255],
  ["Rot", 255, 0, 0],
  ["Grün", 0, 255, 0],
  ["Blau", 0, 0, 255],
  ["Gelb", 255, 255, 0],
  ["Cyan", 0, 255, 255],
  ["Magenta", 255, 0, 255],
];

const PGM_STEPS = [0, 64, 128, 192, 255];

// ── Parser ────────────────────────────────────────────────────────────────────

type Token = { text: string; start: number; end: number };

type Parsed = {
  magic: Magic | null;
  w: number;
  h: number;
  max: number;
  comps: number;
  values: number[];
  spans: Token[]; // Quelltext-Position jedes Werts — für das Zurückschreiben
  error: string | null;
  notes: string[];
};

const BLANK: Parsed = {
  magic: null, w: 0, h: 0, max: 1, comps: 1, values: [], spans: [], error: null, notes: [],
};

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "#") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const start = i;
    while (i < src.length && !/\s/.test(src[i]) && src[i] !== "#") i++;
    out.push({ text: src.slice(start, i), start, end: i });
  }
  return out;
}

/** In P1 dürfen die Bits ohne Leerzeichen stehen ("00110") — als Bild getippt
 *  ist das die anschaulichste Form, also wird jede Ziffer ein eigener Wert. */
function expandBits(tok: Token): Token[] {
  if (!/^[01]{2,}$/.test(tok.text)) return [tok];
  return tok.text.split("").map((ch, k) => ({ text: ch, start: tok.start + k, end: tok.start + k + 1 }));
}

function parse(src: string): Parsed {
  const fail = (error: string): Parsed => ({ ...BLANK, error });
  const tokens = tokenize(src);
  if (tokens.length === 0) return fail("Tippe links eine Bilddatei — sie beginnt mit P1, P2 oder P3.");

  const head = tokens[0].text.toUpperCase();
  if (head === "P4" || head === "P5" || head === "P6")
    return fail(`${head} ist die Binär-Variante. Hier gehen die Text-Varianten P1, P2 und P3.`);
  if (head !== "P1" && head !== "P2" && head !== "P3")
    return fail(`»${tokens[0].text}« ist keine bekannte Kennung. Die Datei beginnt mit P1, P2 oder P3.`);

  const magic = head as Magic;
  const comps = magic === "P3" ? 3 : 1;
  const int = (i: number): number | null => {
    const tok = tokens[i];
    if (!tok) return null;
    return /^\d+$/.test(tok.text) ? parseInt(tok.text, 10) : NaN;
  };

  const w = int(1);
  const h = int(2);
  if (w === null || h === null) return fail("Nach der Kennung folgen Breite und Höhe, z. B. »8 4«.");
  if (Number.isNaN(w) || Number.isNaN(h)) return fail("Breite und Höhe müssen ganze Zahlen sein.");
  if (w < 1 || h < 1) return fail("Breite und Höhe müssen mindestens 1 sein.");
  if (w > MAX_DIM || h > MAX_DIM) return fail(`Höchstens ${MAX_DIM} × ${MAX_DIM} Pixel.`);

  let max = 1;
  let dataAt = 3;
  if (magic !== "P1") {
    const m = int(3);
    if (m === null) return fail("Nach Breite und Höhe folgt der Maximalwert, z. B. »255«.");
    if (Number.isNaN(m) || m < 1 || m > 255) return fail("Der Maximalwert muss zwischen 1 und 255 liegen.");
    max = m;
    dataAt = 4;
  }

  let data = tokens.slice(dataAt);
  if (magic === "P1") data = data.flatMap(expandBits);

  const values: number[] = [];
  const spans: Token[] = [];
  let error: string | null = null;
  for (const tok of data) {
    if (!/^\d+$/.test(tok.text)) {
      error = `»${tok.text}« ist keine Zahl — erlaubt sind nur ganze Zahlen von 0 bis ${max}.`;
      break;
    }
    values.push(parseInt(tok.text, 10));
    spans.push(tok);
  }

  const notes: string[] = [];
  const expected = w * h * comps;
  if (!error) {
    if (values.length < expected) notes.push(`Es fehlen noch ${expected - values.length} von ${expected} Werten.`);
    else if (values.length > expected) notes.push(`${values.length - expected} Werte zu viel — sie werden nicht angezeigt.`);
  }
  const tooBig = values.find(v => v > max);
  if (tooBig !== undefined) notes.push(`Der Wert ${tooBig} ist größer als der Maximalwert ${max}.`);

  return { magic, w, h, max, comps, values, spans, error, notes };
}

function pixelColor(p: Parsed, index: number): string | null {
  const b = index * p.comps;
  if (b + p.comps > p.values.length) return null;
  const scale = (v: number) => Math.max(0, Math.min(255, Math.round((v / p.max) * 255)));
  if (p.magic === "P1") return p.values[b] >= 1 ? "#000000" : "#ffffff";
  if (p.magic === "P2") {
    const g = scale(p.values[b]);
    return `rgb(${g},${g},${g})`;
  }
  return `rgb(${scale(p.values[b])},${scale(p.values[b + 1])},${scale(p.values[b + 2])})`;
}

/** Datei neu schreiben: Kommentare bleiben, Werte werden auf Breite × Höhe
 *  gebracht und Zeile für Zeile sauber untereinander gesetzt. */
function rebuild(src: string, p: Parsed): string {
  const magic = p.magic as Magic;
  const expected = p.w * p.h * p.comps;
  const vals = p.values.slice(0, expected);
  while (vals.length < expected) vals.push(0);

  const pad = Math.max(...vals.map(v => String(v).length), 1);
  const comments = src.split("\n").map(l => l.trim()).filter(l => l.startsWith("#"));
  const lines = [magic, ...comments, `${p.w} ${p.h}`];
  if (magic !== "P1") lines.push(String(p.max));

  for (let y = 0; y < p.h; y++) {
    const row = vals.slice(y * p.w * p.comps, (y + 1) * p.w * p.comps);
    if (magic === "P1") {
      lines.push(row.join(""));
    } else if (magic === "P2") {
      lines.push(row.map(v => String(v).padStart(pad)).join(" "));
    } else {
      const px: string[] = [];
      for (let x = 0; x < p.w; x++) px.push(row.slice(x * 3, x * 3 + 3).map(v => String(v).padStart(pad)).join(" "));
      lines.push(px.join("   "));
    }
  }
  return lines.join("\n") + "\n";
}

// ── Seite ─────────────────────────────────────────────────────────────────────

export default function BildformatePage() {
  const [tab, setTab] = useState<Magic>("P1");
  const [texts, setTexts] = useState<Record<Magic, string>>(EXAMPLES);
  const [gray, setGray] = useState(0);
  const [rgb, setRgb] = useState<[number, number, number]>([255, 0, 0]);
  const [caret, setCaret] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const src = texts[tab];
  const setSrc = (next: string) => setTexts(prev => ({ ...prev, [tab]: next }));

  const p = useMemo(() => parse(src), [src]);
  const { w, h, comps, max, values, spans, magic } = p;
  const cell = Math.max(1, Math.min(48, Math.floor(460 / Math.max(w, 1)), Math.floor(420 / Math.max(h, 1))));

  // Cursor im Text → zugehöriges Pixel hervorheben.
  const caretPixel = useMemo(() => {
    if (caret === null) return null;
    const i = spans.findIndex(s => caret >= s.start && caret <= s.end);
    return i < 0 ? null : Math.floor(i / comps);
  }, [caret, spans, comps]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || w < 1) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * cell * dpr);
    cv.height = Math.round(h * cell * dpr);
    cv.style.width = `${w * cell}px`;
    cv.style.height = `${h * cell}px`;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const color = pixelColor(p, y * w + x);
        // Noch nicht getippte Pixel: Karomuster statt Farbe.
        ctx.fillStyle = color ?? ((x + y) % 2 === 0 ? "#f1f1f4" : "#e0e0e8");
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    if (cell >= 6) {
      ctx.strokeStyle = "rgba(120,120,140,0.35)";
      ctx.lineWidth = 1;
      for (let x = 1; x < w; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cell + 0.5, 0);
        ctx.lineTo(x * cell + 0.5, h * cell);
        ctx.stroke();
      }
      for (let y = 1; y < h; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cell + 0.5);
        ctx.lineTo(w * cell, y * cell + 0.5);
        ctx.stroke();
      }
    }
    if (caretPixel !== null && caretPixel < w * h) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.strokeRect((caretPixel % w) * cell + 1, Math.floor(caretPixel / w) * cell + 1, cell - 2, cell - 2);
    }
  }, [p, w, h, cell, caretPixel]);

  /** Werte eines Pixels an Ort und Stelle im Text ersetzen — Umbrüche,
   *  Einrückung und Kommentare der Datei bleiben dabei erhalten. */
  function writePixel(index: number, next: number[]) {
    const base = index * comps;
    let out = "";
    for (let k = 0; k < next.length; k++) {
      const tok = spans[base + k];
      if (k > 0) out += src.slice(spans[base + k - 1].end, tok.start);
      out += String(next[k]).padStart(tok.text.length, " ");
    }
    const first = spans[base];
    const last = spans[base + comps - 1];
    setSrc(src.slice(0, first.start) + out + src.slice(last.end));
  }

  function paint(index: number) {
    const base = index * comps;
    if (base + comps > values.length) return;
    if (magic === "P1") writePixel(index, [values[base] >= 1 ? 0 : 1]);
    else if (magic === "P2") writePixel(index, [Math.round((gray / 255) * max)]);
    else writePixel(index, rgb.map(c => Math.round((c / 255) * max)));
  }

  function pixelAt(e: React.MouseEvent<HTMLCanvasElement>): number | null {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / cell);
    const y = Math.floor((e.clientY - r.top) / cell);
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
    return y * w + x;
  }

  function describe(index: number): string {
    const base = index * comps;
    const pos = `Zeile ${Math.floor(index / w) + 1}, Spalte ${(index % w) + 1}`;
    if (base + comps > values.length) return `${pos} · noch kein Wert`;
    if (magic === "P3") return `${pos} · R ${values[base]}  G ${values[base + 1]}  B ${values[base + 2]}`;
    return `${pos} · Wert ${values[base]}`;
  }

  const expected = w * h * comps;
  const complete = !p.error && w > 0 && values.length === expected;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black tracking-tight">🖼️ Bildformate</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          PBM, PGM und PPM sind Bilddateien aus lauter Zahlen. Links tippen, rechts sofort sehen —
          oder ins Bild klicken und zusehen, wie sich die Zahlen ändern.
        </p>
      </div>

      {/* Formatwahl — jedes Format hat sein eigenes Blatt, nichts geht verloren */}
      <div className="flex flex-wrap items-center gap-2">
        {FORMATS.map(f => (
          <button
            key={f.magic}
            onClick={() => { setTab(f.magic); setCaret(null); setHover(null); }}
            className={`px-4 py-2 rounded-xl border text-left transition-colors ${
              tab === f.magic
                ? "border-[var(--accent)] bg-[var(--surface)]"
                : "border-[var(--border)] hover:border-[var(--accent)]"
            }`}
          >
            <div className="font-black text-sm" style={{ color: f.color }}>{f.name}</div>
            <div className="text-xs text-[var(--text-muted)]">{f.sub}</div>
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setSrc(rebuild(src, p))}
          disabled={w < 1 || !!p.error}
          className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)] disabled:opacity-40"
          title={`Werte auf ${w} × ${h} bringen und je ${w} Werte pro Zeile untereinander setzen`}
        >
          ↹ Aufräumen
        </button>
        <button
          onClick={() => { setSrc(EXAMPLES[tab]); setCaret(null); }}
          className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)]"
        >
          ↺ Beispiel
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Datei als Text */}
        <div className="flex flex-col gap-3">
          <textarea
            value={src}
            onChange={e => { setSrc(e.target.value); setCaret(e.target.selectionStart); }}
            onSelect={e => setCaret(e.currentTarget.selectionStart)}
            onBlur={() => setCaret(null)}
            spellCheck={false}
            rows={20}
            className="w-full font-mono text-sm leading-relaxed rounded-2xl border border-[var(--border)]
              bg-[var(--surface)] p-4 resize-y focus:outline-none focus:border-[var(--accent)]"
            aria-label="Bilddatei als Text"
          />

          {p.error ? (
            <p className="text-sm rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2">⚠️ {p.error}</p>
          ) : (
            <p className="text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              {complete ? "✅ " : "✏️ "}
              {magic} · {w} × {h} Pixel · {expected} Werte
              {magic !== "P1" && ` · Maximalwert ${max}`}
            </p>
          )}
          {p.notes.map(n => (
            <p key={n} className="text-sm rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2">💡 {n}</p>
          ))}

          {/* Aufbau der Datei */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-xs uppercase tracking-widest text-[var(--text-muted)] mb-3">Aufbau</div>
            <div className="flex flex-col gap-1.5">
              {STRUCTURE[tab].map(([code, text]) => (
                <div key={code} className="flex gap-3 text-sm">
                  <code className="font-mono shrink-0 w-24 text-[var(--accent)]">{code}</code>
                  <span className="text-[var(--text-muted)]">{text}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-3 leading-relaxed">
              Zeilenumbrüche sind egal: Die Werte werden der Reihe nach gelesen und nach je{" "}
              {w > 0 ? w : "Breite"} Werten in die nächste Bildzeile umgebrochen. Zeilen mit{" "}
              <code className="font-mono">#</code> sind Kommentare.
            </p>
          </div>
        </div>

        {/* Bild */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
            <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Bild</div>
            {w > 0 ? (
              <div className="overflow-x-auto">
                <canvas
                  ref={canvasRef}
                  onClick={e => { const i = pixelAt(e); if (i !== null) paint(i); }}
                  onMouseMove={e => setHover(pixelAt(e))}
                  onMouseLeave={() => setHover(null)}
                  className="border border-[var(--border)] rounded-lg cursor-crosshair"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Noch kein Bild — der Kopf der Datei stimmt nicht.</p>
            )}
            <p className="text-xs text-[var(--text-muted)] font-mono min-h-[1.25rem]">
              {hover !== null ? describe(hover) : ""}
            </p>
          </div>

          {/* Werkzeug zum Klicken */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
            <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Ins Bild klicken</div>
            {tab === "P1" && (
              <p className="text-sm text-[var(--text-muted)]">
                Ein Klick schaltet das Pixel zwischen <code className="font-mono">0</code> (weiß) und{" "}
                <code className="font-mono">1</code> (schwarz) um.
              </p>
            )}
            {tab === "P2" && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {PGM_STEPS.map(v => (
                    <button
                      key={v}
                      onClick={() => setGray(v)}
                      className={`w-11 h-11 rounded-lg border-2 ${gray === v ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                      style={{ background: `rgb(${v},${v},${v})` }}
                      title={`Grauwert ${Math.round((v / 255) * max)}`}
                      aria-label={`Grauwert ${Math.round((v / 255) * max)}`}
                    />
                  ))}
                  <input
                    type="range" min={0} max={255} value={gray}
                    onChange={e => setGray(Number(e.target.value))}
                    className="flex-1 min-w-[8rem]"
                    aria-label="Grauwert"
                  />
                </div>
                <p className="text-sm text-[var(--text-muted)]">
                  Gewählter Wert: <span className="font-mono font-bold">{Math.round((gray / 255) * max)}</span> von {max}
                </p>
              </>
            )}
            {tab === "P3" && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PPM_COLORS.map(([name, r, g, b]) => {
                    const on = rgb[0] === r && rgb[1] === g && rgb[2] === b;
                    return (
                      <button
                        key={name}
                        onClick={() => setRgb([r, g, b])}
                        className={`rounded-lg border-2 px-2 py-2 flex items-center gap-2 text-xs ${
                          on ? "border-[var(--accent)]" : "border-[var(--border)]"
                        }`}
                        title={`${r} ${g} ${b}`}
                      >
                        <span
                          className="w-5 h-5 rounded shrink-0 border border-black/20"
                          style={{ background: `rgb(${r},${g},${b})` }}
                        />
                        {name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-sm text-[var(--text-muted)]">
                  Gewählte Farbe:{" "}
                  <span className="font-mono font-bold">{rgb.map(c => Math.round((c / 255) * max)).join(" ")}</span>{" "}
                  (Rot Grün Blau, je 0 bis {max})
                </p>
              </>
            )}
            {!complete && (
              <p className="text-xs text-[var(--text-muted)]">
                Malen geht nur bei Pixeln, für die schon ein Wert dasteht — »↹ Aufräumen« füllt den Rest mit 0 auf.
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        P1, P2 und P3 sind die Text-Varianten. Dieselben Bilder gibt es als P4, P5 und P6 —
        dort stehen dieselben Zahlen platzsparend als Bytes statt als lesbare Ziffern.
      </p>
    </div>
  );
}
