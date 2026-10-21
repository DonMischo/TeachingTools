"use client";
/**
 * Code-Modus der Diagramm-Werkstatt im Stil eines Codeblocks.
 *
 * Ein durchsichtiges Textfeld liegt genau über einer eingefärbten Kopie des
 * Codes (gleiche Schrift, gleiche Zeilenhöhe, kein Umbruch). Beide wachsen mit
 * dem Inhalt und scrollen gemeinsam im äußeren Rahmen — so braucht es keinen
 * Scroll-Abgleich und keine Editor-Bibliothek.
 *
 * Die Farben sind fest (dunkler Editor), unabhängig vom App-Thema: ein
 * Codeblock soll überall gleich aussehen.
 */
import { forwardRef, useMemo, useState } from "react";
import { codeAusAntwort, zeileHervorheben, type Art } from "@/lib/diagramm/hervorheben";

export const FARBE: Record<Art, string> = {
  kommentar: "#6a9955",
  text: "#ce9178",
  pfeil: "#c586c0",
  klammer: "#ffd700",
  satzzeichen: "#d4d4d4",
  reserviert: "#569cd6",
  schluessel: "#9cdcfe",
  wert: "#dcdcaa",
  zahl: "#b5cea8",
  leer: "inherit",
};

const SCHRIFT = "text-[13px] leading-5 font-mono";

export const CodeFeld = forwardRef<HTMLTextAreaElement, {
  code: string;
  fehlerZeilen: Set<number>;
  setze: (code: string) => void;
}>(function CodeFeld({ code, fehlerZeilen, setze }, ref) {
  const zeilen = useMemo(() => code.split("\n"), [code]);
  const breite = Math.max(...zeilen.map(z => z.length), 20);
  const [kopiert, setKopiert] = useState(false);

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1500);
    } catch { /* ohne https kein Zwischenspeicher */ }
  };

  return (
    <div className="rounded-lg overflow-hidden border border-[#333] bg-[#1e1e1e] text-[#d4d4d4]">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#252526] border-b border-[#333] text-xs">
        <span className="font-mono text-[#9cdcfe]">diagramm.d2</span>
        <span className="flex-1" />
        <button onClick={kopieren} className="px-2 py-0.5 rounded hover:bg-[#37373d]" title="Ganzen Code kopieren">
          {kopiert ? "✓ kopiert" : "📋 Kopieren"}
        </button>
      </div>
      <div className="overflow-auto max-h-[70vh]">
        <div className="flex min-w-max">
          <div aria-hidden className={`sticky left-0 z-10 select-none text-right py-2 pl-2 pr-3 bg-[#1e1e1e] text-[#858585] ${SCHRIFT}`}>
            {zeilen.map((_, i) => (
              <div key={i} className={fehlerZeilen.has(i + 1) ? "text-[#f48771] font-bold" : ""}>{i + 1}</div>
            ))}
          </div>
          <div className="relative flex-1" style={{ minWidth: `calc(${breite}ch + 2rem)` }}>
            <pre aria-hidden className={`absolute inset-0 m-0 py-2 pr-4 pointer-events-none whitespace-pre ${SCHRIFT}`}>
              {zeilen.map((z, i) => (
                <div key={i} className={`h-5 ${fehlerZeilen.has(i + 1) ? "bg-[#5a1d1d]" : ""}`}>
                  {zeileHervorheben(z).map((s, j) => (
                    <span key={j} style={{
                      color: FARBE[s.art],
                      fontStyle: s.art === "kommentar" ? "italic" : undefined,
                      textDecoration: s.farbe ? `underline 3px ${s.farbe}` : undefined,
                      textUnderlineOffset: s.farbe ? "3px" : undefined,
                    }}>{s.text}</span>
                  ))}
                  {"\n"}
                </div>
              ))}
            </pre>
            <textarea ref={ref} value={code} spellCheck={false} aria-label="D2-Code" wrap="off"
              autoCapitalize="off" autoComplete="off" autoCorrect="off"
              className={`relative block w-full resize-none overflow-hidden bg-transparent py-2 pr-4 outline-none text-transparent caret-white selection:bg-[#264f78] ${SCHRIFT}`}
              style={{ height: `${zeilen.length * 20 + 16}px`, minHeight: "420px" }}
              onChange={e => setze(e.target.value)}
              onPaste={e => {
                const text = e.clipboardData.getData("text");
                const sauber = codeAusAntwort(text);
                if (sauber === text) return;
                e.preventDefault();
                const t = e.currentTarget;
                const { selectionStart: a, selectionEnd: b } = t;
                setze(code.slice(0, a) + sauber + code.slice(b));
                requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = a + sauber.length; });
              }}
              onKeyDown={e => {
                if (e.key !== "Tab") return;
                e.preventDefault();
                const t = e.currentTarget;
                const { selectionStart: a, selectionEnd: b } = t;
                setze(code.slice(0, a) + "  " + code.slice(b));
                requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = a + 2; });
              }} />
          </div>
        </div>
      </div>
    </div>
  );
});

/** Kleiner, nur lesbarer Codeblock mit denselben Farben (für den Spickzettel). */
export function CodeSchnipsel({ code }: { code: string }) {
  return (
    <pre className="m-0 rounded-md bg-[#1e1e1e] px-3 py-2 text-[12.5px] leading-5 font-mono text-[#d4d4d4] overflow-x-auto">
      {code.split("\n").map((z, i) => (
        <div key={i} className="min-h-5">
          {zeileHervorheben(z).map((s, j) => (
            <span key={j} style={{ color: FARBE[s.art], fontStyle: s.art === "kommentar" ? "italic" : undefined,
              textDecoration: s.farbe ? `underline 3px ${s.farbe}` : undefined, textUnderlineOffset: s.farbe ? "3px" : undefined }}>{s.text}</span>
          ))}
        </div>
      ))}
    </pre>
  );
}
