"use client";
/**
 * Der »Mehr dazu«-Kasten an jeder Station.
 *
 * Zugeklappt ist er eine Zeile, aufgeklappt ein kurzer Text in der gewählten
 * Lesestufe. Die Stufe gilt für das ganze Werkzeug und bleibt auf dem Gerät
 * gespeichert: Wer einmal »Klasse 10+« gewählt hat, liest überall die dichtere
 * Fassung, ohne es je wieder einzustellen.
 *
 * Absichtlich zugeklappt in der Grundstellung — die Station soll man spielen
 * können, ohne vorher zu lesen.
 */
import { useEffect, useState } from "react";
import { LESESTUFEN, WISSEN, type Lesestufe } from "@/lib/ki/wissen";
import { MitFachworten } from "@/components/ki/Fachwort";

const SPEICHER = "ki.lesestufe";

function istStufe(v: string | null): v is Lesestufe {
  return v === "5-7" || v === "8+" || v === "10+";
}

export function Wissen({ thema }: { thema: keyof typeof WISSEN | string }) {
  const eintrag = WISSEN[thema];
  const [offen, setOffen] = useState(false);
  const [stufe, setStufe] = useState<Lesestufe>("8+");

  // Erst lesen, dann schreiben — und geschrieben wird nur im Klick. Ein
  // useEffect, das *speichert*, würde beim zweiten Lauf unter StrictMode den
  // gerade geladenen Stand mit der Grundstellung überschreiben.
  useEffect(() => {
    try {
      const gespeichert = localStorage.getItem(SPEICHER);
      if (istStufe(gespeichert)) setStufe(gespeichert);
    } catch { /* Privatmodus: dann eben jedes Mal neu wählen */ }
  }, []);

  function waehle(s: Lesestufe) {
    setStufe(s);
    try { localStorage.setItem(SPEICHER, s); } catch { /* egal */ }
  }

  if (!eintrag) return null;

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOffen(o => !o)}
        aria-expanded={offen}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-bold
          hover:bg-surface-hover transition-colors"
      >
        <span aria-hidden>📖</span>
        <span className="flex-1">Mehr dazu: {eintrag.titel}</span>
        <span className="text-muted" aria-hidden>{offen ? "▲" : "▼"}</span>
      </button>

      {offen && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lesestufe">
            {LESESTUFEN.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => waehle(s.id)}
                title={s.titel}
                aria-pressed={s.id === stufe}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-colors ${
                  s.id === stufe
                    ? "border-accent bg-accent text-accent-fg"
                    : "border-line bg-surface hover:bg-surface-hover"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {eintrag.stufen[stufe].map((absatz, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted">
              <MitFachworten text={absatz} />
            </p>
          ))}

          <p className="text-[10px] text-muted">
            Unterstrichene Wörter erklären sich beim Antippen.
          </p>
        </div>
      )}
    </div>
  );
}
