"use client";
/**
 * Vom Bild zu den Zahlen — der Schritt, an dem aus einem Foto Bytes werden:
 *   ① Ein Bild ist aus Kästchen (Pixel) — Regler von grob bis fein
 *   ② Jedes Kästchen sind drei Zahlen (Rot, Grün, Blau) — und so schreibt man sie in Hex
 *   ③ So viele Zahlen — und wie JPEG sie kleiner macht
 *   ④ ab Fortgeschritten: so beginnt die echte Datei (FF D8 …, Breite/Höhe in Hex)
 *   ⑤ Experte: Quantisierungstabelle und JPEG-Ablauf
 * Für Text statt Foto: Zeichen → UTF-8-Bytes.
 */
import { useEffect, useRef, useState } from "react";
import { abschnitte, groesse, quantisierung } from "@/lib/schichten/jpeg";
import { hex2 } from "@/lib/schichten/bytes";
import { kb, type Niveau } from "./Bausteine";
import type { Inhalt } from "./inhalt";

const STUFEN = [6, 12, 24, 48, 96, 0];
const HEXZIFFERN = "0123456789ABCDEF";

function Schritt({ nr, titel, children }: { nr: string; titel: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <h4 className="font-bold flex items-center gap-2"><span className="w-7 h-7 rounded-full bg-accent text-accent-fg grid place-items-center text-sm shrink-0">{nr}</span>{titel}</h4>
      {children}
    </div>
  );
}

/** Eine Zahl 0–255 als zwei Hex-Ziffern, mit Rechenweg */
function HexWeg({ wert, einfach }: { wert: number; einfach: boolean }) {
  const hi = Math.floor(wert / 16), lo = wert % 16;
  return (
    <span className="font-mono text-sm">
      {wert} = {hi}·16 + {lo} → <b>{HEXZIFFERN[hi]}{HEXZIFFERN[lo]}</b>
      {!einfach && <span className="text-muted"> · {wert.toString(2).padStart(8, "0")}</span>}
    </span>
  );
}

export default function BildZuZahlen({ inhalt, niveau }: { inhalt: Inhalt; niveau: Niveau }) {
  if (inhalt.art === "text") return <TextZuZahlen inhalt={inhalt} niveau={niveau} />;
  return <FotoZuZahlen inhalt={inhalt} niveau={niveau} />;
}

function FotoZuZahlen({ inhalt, niveau }: { inhalt: Inhalt; niveau: Niveau }) {
  const einfach = niveau === "einsteiger";
  const anzeige = useRef<HTMLCanvasElement>(null);
  const [bild, setBild] = useState<HTMLImageElement | null>(null);
  const [stufe, setStufe] = useState(1);
  const [farbe, setFarbe] = useState<[number, number, number] | null>(null);
  const b = inhalt.breite ?? 1, h = inhalt.hoehe ?? 1;
  const spalten = STUFEN[stufe] || b;
  const zeilen = Math.max(1, Math.round((spalten * h) / b));

  useEffect(() => {
    if (!inhalt.url) return;
    const img = new Image();
    img.onload = () => setBild(img);
    img.src = inhalt.url;
  }, [inhalt.url]);

  useEffect(() => {
    const c = anzeige.current;
    if (!c || !bild) return;
    const klein = document.createElement("canvas");
    klein.width = spalten;
    klein.height = zeilen;
    klein.getContext("2d")!.drawImage(bild, 0, 0, spalten, zeilen);
    c.width = 480;
    c.height = Math.round((480 * h) / b);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = spalten === b;
    ctx.drawImage(klein, 0, 0, c.width, c.height);
    if (spalten <= 48) {
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      for (let x = 1; x < spalten; x++) { const px = Math.round((x * c.width) / spalten) + 0.5; ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, c.height); ctx.stroke(); }
      for (let y = 1; y < zeilen; y++) { const py = Math.round((y * c.height) / zeilen) + 0.5; ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(c.width, py); ctx.stroke(); }
    }
    const d = klein.getContext("2d")!.getImageData(Math.floor(spalten / 2), Math.floor(zeilen / 3), 1, 1).data;
    setFarbe(f => f ?? [d[0], d[1], d[2]]);
  }, [bild, spalten, zeilen, b, h]);

  const tippe = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = anzeige.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * c.width), y = Math.floor(((e.clientY - r.top) / r.height) * c.height);
    const d = c.getContext("2d")!.getImageData(Math.min(c.width - 1, x), Math.min(c.height - 1, y), 1, 1).data;
    setFarbe([d[0], d[1], d[2]]);
  };

  const pixel = b * h;
  const roh = pixel * 3;
  const kopfBytes = inhalt.bytes.subarray(0, 24);
  const teile = abschnitte(inhalt.bytes);
  const g = groesse(inhalt.bytes);
  const q = niveau === "experte" ? quantisierung(inhalt.bytes) : null;

  return (
    <div className="flex flex-col gap-3">
      <Schritt nr="1" titel={einfach ? "Ein Bild besteht aus winzigen Kästchen" : "Pixel: das Bild als Raster"}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,480px)_minmax(0,1fr)] items-start">
          <canvas ref={anzeige} onClick={tippe} className="w-full rounded-lg cursor-crosshair border border-line" style={{ imageRendering: "pixelated" }}
            aria-label="Das Foto in wählbarer Auflösung — antippen zeigt die Farbe eines Kästchens" />
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex flex-col gap-1">
              <span className="label">{einfach ? "Wie viele Kästchen?" : "Auflösung"}: {spalten} × {zeilen}{STUFEN[stufe] === 0 ? " (Original)" : ""}</span>
              <input type="range" min={0} max={STUFEN.length - 1} value={stufe} onChange={e => setStufe(+e.target.value)} />
            </label>
            <p>
              {einfach
                ? <>Schieb den Regler: Mit wenigen Kästchen ist die Katze nur ein Farbklecks. Je mehr Kästchen, desto schärfer. Das echte Foto hat <b>{b.toLocaleString("de-DE")} × {h.toLocaleString("de-DE")}</b> Kästchen — man nennt sie <b>Pixel</b>.</>
                : <>Jedes Pixel hat genau eine Farbe. Das Original hat {b.toLocaleString("de-DE")} × {h.toLocaleString("de-DE")} = {pixel.toLocaleString("de-DE")} Pixel. Gröbere Stufen mitteln benachbarte Pixel.</>}
            </p>
            <p className="text-muted">👆 Tippe ein Kästchen an.</p>
          </div>
        </div>
      </Schritt>

      {farbe && (
        <Schritt nr="2" titel={einfach ? "Jedes Kästchen sind drei Zahlen" : "Farbe = drei Bytes (RGB)"}>
          <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)] items-start">
            <div className="w-28 h-28 rounded-xl border border-line shadow-inner" style={{ background: `rgb(${farbe.join(",")})` }} />
            <div className="flex flex-col gap-2">
              {(["Rot", "Grün", "Blau"] as const).map((n, i) => (
                <div key={n} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                  <span className="font-semibold">{n}</span>
                  <div className="h-4 rounded-full bg-surface-hover overflow-hidden">
                    <div className="h-full" style={{ width: `${(farbe[i] / 255) * 100}%`, background: ["#ef4444", "#22c55e", "#3b82f6"][i] }} />
                  </div>
                  <HexWeg wert={farbe[i]} einfach={einfach} />
                </div>
              ))}
              <p className="text-sm">
                {einfach
                  ? <>Jede Farbe wird aus <b>Rot, Grün und Blau</b> gemischt — wie Licht am Bildschirm. Jeder Anteil ist eine Zahl von 0 (aus) bis 255 (ganz hell). Für dieses Kästchen also <b className="font-mono">{farbe.join(", ")}</b>.</>
                  : <>Je Farbkanal ein Byte (0–255), zusammen 24 Bit — über 16 Millionen Farben. Als Hex-Farbcode: <b className="font-mono">#{farbe.map(v => hex2(v).toUpperCase()).join("")}</b>.</>}
              </p>
              <details className="text-sm" open={!einfach}>
                <summary className="cursor-pointer font-semibold">🔢 {einfach ? "Profi-Trick: Zahlen kürzer schreiben (Hex)" : "Wie liest man Hex?"}</summary>
                <p className="mt-1">
                  Wir zählen mit 10 Ziffern (0–9). Computer-Leute zählen gern mit <b>16 Ziffern</b>: 0–9 und dann A=10, B=11, C=12, D=13, E=14, F=15.
                  Mit zwei solchen Ziffern passt jede Zahl von 0 bis 255 hinein: die erste zählt die Sechzehner, die zweite den Rest.
                  So wird aus {farbe[0]} → <b className="font-mono">{hex2(farbe[0]).toUpperCase()}</b>. Diese Schreibweise heißt <b>hexadezimal</b> (kurz Hex) — genau die Zahlen im Hex-Bild später.
                </p>
                <div className="flex flex-wrap gap-1 mt-2 font-mono text-xs">
                  {Array.from(HEXZIFFERN, (z, i) => <span key={z} className="rounded bg-surface-hover px-1.5 py-0.5">{z}={i}</span>)}
                </div>
              </details>
            </div>
          </div>
        </Schritt>
      )}

      <Schritt nr="3" titel={einfach ? "So viele Zahlen — und wie sie kleiner werden" : "Rohdaten und JPEG-Komprimierung"}>
        <div className="grid sm:grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-surface-hover p-3"><div className="text-xl font-black tabular-nums">{pixel.toLocaleString("de-DE")}</div><div className="text-xs text-muted">Pixel</div></div>
          <div className="rounded-lg bg-surface-hover p-3"><div className="text-xl font-black tabular-nums">{kb(roh)}</div><div className="text-xs text-muted">× 3 Zahlen = roh</div></div>
          <div className="rounded-lg bg-surface-hover p-3"><div className="text-xl font-black tabular-nums">{kb(inhalt.bytes.length)}</div><div className="text-xs text-muted">als JPEG ({Math.round((roh / inhalt.bytes.length) * 10) / 10}-mal kleiner)</div></div>
        </div>
        <p className="text-sm">
          {einfach
            ? <>Über {Math.round(roh / 1e6)} Millionen Zahlen — das dauert. Darum wird das Foto <b>gepackt</b> (JPEG): Statt »beige, beige, beige, beige …« merkt man sich »ganz viel beige«. Und winzige Unterschiede, die unser Auge sowieso nicht sieht, werden weggelassen.</>
            : <>JPEG zerlegt das Bild in 8×8-Blöcke, beschreibt jeden Block als Mischung aus Mustern (von glatt bis fein gestreift) und speichert feine Muster nur grob — das Auge merkt es kaum. Gleiche Werte bekommen kurze Codes.</>}
        </p>
      </Schritt>

      {!einfach && (
        <Schritt nr="4" titel="So beginnt die echte Datei">
          <div className="font-mono text-xs rounded-lg bg-[#060a14] text-slate-300 p-3 flex flex-wrap gap-x-[0.45em]">
            {Array.from(kopfBytes, (v, i) => {
              const t = teile.find(a => i >= a.von && i < a.von + Math.min(a.laenge, 24));
              const farbe = t?.marker === 0xd8 ? "#f59e0b" : t?.marker === 0xe0 ? "#ec4899" : "#94a3b8";
              return <span key={i} style={{ color: farbe }} title={t?.name}>{hex2(v).toUpperCase()}</span>;
            })}
            <span className="text-muted">…</span>
          </div>
          <ul className="text-sm space-y-1">
            <li><b className="font-mono text-amber-500">FF D8</b> — »Achtung, ein JPEG!« Daran erkennt jedes Programm die Datei, egal wie sie heißt.</li>
            {kopfBytes[6] === 0x4a && <li><b className="font-mono text-pink-500">4A 46 49 46</b> — das sind ASCII-Buchstaben: <b>J F I F</b> (JPEG File Interchange Format).</li>}
            {g && <li><b className="font-mono">{hex2(inhalt.bytes[g.von]).toUpperCase()} {hex2(inhalt.bytes[g.von + 1]).toUpperCase()}</b> und <b className="font-mono">{hex2(inhalt.bytes[g.von + 2]).toUpperCase()} {hex2(inhalt.bytes[g.von + 3]).toUpperCase()}</b> an Byte {g.von} im Bildkopf: Höhe {inhalt.bytes[g.von]}·256 + {inhalt.bytes[g.von + 1]} = <b>{g.hoehe}</b>, Breite {inhalt.bytes[g.von + 2]}·256 + {inhalt.bytes[g.von + 3]} = <b>{g.breite}</b>.</li>}
          </ul>
          <div className="flex flex-wrap gap-1 text-xs">
            {teile.map(a => <span key={a.von} className="chip" title={a.erkl}>{a.name} · {a.laenge.toLocaleString("de-DE")} B</span>)}
            <span className="chip">Bilddaten · {(inhalt.bytes.length - (teile.at(-1)?.von ?? 0)).toLocaleString("de-DE")} B</span>
          </div>
        </Schritt>
      )}

      {q && (
        <Schritt nr="5" titel="🎓 Was JPEG wirklich rechnet">
          <ol className="text-sm list-decimal pl-5 space-y-1">
            <li>RGB → YCbCr: Helligkeit (Y) getrennt von Farbe; die Farbanteile werden oft halbiert (Chroma-Subsampling) — das Auge sieht Helligkeit schärfer als Farbe.</li>
            <li>8×8-Blöcke → diskrete Kosinustransformation (DCT): 64 Werte für »wie viel von welchem Muster«.</li>
            <li>Quantisierung: jeden Wert durch die Zahl aus der Tabelle teilen und runden — hier geht Information verloren. Rechts unten (feine Muster) steht mehr → gröber.</li>
            <li>Zickzack-Reihenfolge, Lauflängen und Huffman-Codes: viele Nullen am Ende kosten fast nichts.</li>
          </ol>
          <div className="grid grid-cols-8 gap-0.5 w-fit font-mono text-[11px]">
            {q.flat().map((v, i) => (
              <span key={i} className="w-8 h-6 grid place-items-center rounded-sm" style={{ background: `rgba(99,102,241,${Math.min(1, v / 120)})`, color: v > 60 ? "#fff" : undefined }}>{v}</span>
            ))}
          </div>
          <p className="text-xs text-muted">Die Helligkeits-Quantisierungstabelle aus genau dieser Datei (Qualität 85).</p>
        </Schritt>
      )}
    </div>
  );
}

function TextZuZahlen({ inhalt, niveau }: { inhalt: Inhalt; niveau: Niveau }) {
  const einfach = niveau === "einsteiger";
  const zeichen = Array.from(new TextDecoder().decode(inhalt.bytes));
  return (
    <Schritt nr="1" titel={einfach ? "Jedes Zeichen wird zu Zahlen" : "Text → UTF-8-Bytes"}>
      <div className="flex flex-wrap gap-2">
        {zeichen.slice(0, 40).map((z, i) => {
          const bytes = new TextEncoder().encode(z);
          return (
            <div key={i} className="rounded-lg border border-line px-2 py-1 text-center">
              <div className="text-xl font-bold">{z === " " ? "␣" : z}</div>
              <div className="font-mono text-xs text-muted">{Array.from(bytes).map(v => (einfach ? v : hex2(v).toUpperCase())).join(" ")}</div>
            </div>
          );
        })}
      </div>
      <p className="text-sm">
        {einfach
          ? "Jeder Buchstabe hat eine Nummer. Normale Buchstaben brauchen eine Zahl, Umlaute wie ü zwei und Emojis sogar vier."
          : "UTF-8: ASCII-Zeichen (0–127) brauchen ein Byte, Umlaute zwei, Emojis vier. Das erste Byte verrät, wie viele folgen."}
      </p>
    </Schritt>
  );
}
