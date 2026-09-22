"use client";
/**
 * Station »Zeichnen & Erkennen« — eine Maschine anlernen.
 *
 * Man malt eine Form, sagt dazu, was es ist, und wiederholt das ein paarmal.
 * Danach errät die Maschine neue Zeichnungen — durch Vergleichen mit dem, was
 * sie kennt.
 *
 * Die Lehren kommen von selbst, wenn man es macht:
 *   ▸ Mit einem Beispiel je Form liegt sie oft daneben. Mit fünf wird sie gut.
 *   ▸ Zeigt man ihr eine Form, die sie nie gesehen hat, rät sie trotzdem —
 *     und zwar mit Überzeugung. »Weiß nicht« ist nicht vorgesehen.
 *   ▸ Wer schlampig anlernt, bekommt eine schlampige Maschine. Die Daten sind
 *     das Programm.
 */
import { useRef, useState } from "react";
import {
  KANTE, leeresBild, istLeer, erkenne, type Beispiel, type Bild, type Urteil,
} from "@/lib/ki/knn";
import { Wissen } from "@/components/ki/Wissen";

const FORMEN = ["Kreis", "Kreuz", "Dreieck"];
const FELD = 224;
const KASTEN = FELD / KANTE;

/** Ein kleines Vorschaubild eines gespeicherten Beispiels. */
function Miniatur({ bild, groesse = 44 }: { bild: Bild; groesse?: number }) {
  const k = groesse / KANTE;
  return (
    <svg width={groesse} height={groesse} className="rounded-lg border border-[var(--border)] shrink-0">
      {bild.map((v, i) => v > 0 && (
        <rect
          key={i}
          x={(i % KANTE) * k} y={Math.floor(i / KANTE) * k}
          width={k} height={k}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

export function Zeichnen() {
  const [bild, setBild] = useState<Bild>(leeresBild);
  const [beispiele, setBeispiele] = useState<Beispiel[]>([]);
  const [urteil, setUrteil] = useState<Urteil | null>(null);
  const malt = useRef(false);
  const naechsteId = useRef(1);

  /** Kästchen anmalen — mit den Nachbarn, sonst wird die Linie zu dünn. */
  function male(clientX: number, clientY: number, feld: SVGSVGElement) {
    const kasten = feld.getBoundingClientRect();
    const x = Math.floor(((clientX - kasten.left) / kasten.width) * KANTE);
    const y = Math.floor(((clientY - kasten.top) / kasten.height) * KANTE);
    if (x < 0 || y < 0 || x >= KANTE || y >= KANTE) return;
    setBild(alt => {
      const neu = [...alt];
      neu[y * KANTE + x] = 1;
      return neu;
    });
    setUrteil(null);
  }

  function merken(klasse: string) {
    if (istLeer(bild)) return;
    setBeispiele(alt => [...alt, { id: naechsteId.current++, klasse, bild }]);
    setBild(leeresBild());
    setUrteil(null);
  }

  function raten() {
    setUrteil(erkenne(beispiele, bild));
  }

  const jeKlasse = FORMEN.map(f => ({ form: f, anzahl: beispiele.filter(b => b.klasse === f).length }));
  const bereit = beispiele.length >= 2 && new Set(beispiele.map(b => b.klasse)).size >= 2;

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-3">
        <h2 className="font-black">✏️ Zeichnen &amp; Erkennen</h2>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          Male eine Form und sage der Maschine, was es ist. Nach ein paar Beispielen kann sie raten —
          nicht, weil sie weiß, was ein Kreis ist, sondern weil sie Kästchen vergleicht.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <svg
            width={FELD} height={FELD}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg)] touch-none shrink-0 text-[var(--accent)]"
            style={{ maxWidth: "100%" }}
            role="img"
            aria-label="Malfeld, 16 mal 16 Kästchen"
            onPointerDown={e => {
              malt.current = true;
              (e.target as Element).setPointerCapture?.(e.pointerId);
              male(e.clientX, e.clientY, e.currentTarget);
            }}
            onPointerMove={e => { if (malt.current) male(e.clientX, e.clientY, e.currentTarget); }}
            onPointerUp={() => { malt.current = false; }}
            onPointerLeave={() => { malt.current = false; }}
          >
            {Array.from({ length: KANTE + 1 }, (_, i) => (
              <g key={i} stroke="var(--border)" strokeWidth={0.5} opacity={0.5}>
                <line x1={i * KASTEN} y1={0} x2={i * KASTEN} y2={FELD} />
                <line x1={0} y1={i * KASTEN} x2={FELD} y2={i * KASTEN} />
              </g>
            ))}
            {bild.map((v, i) => v > 0 && (
              <rect
                key={i}
                x={(i % KANTE) * KASTEN} y={Math.floor(i / KANTE) * KASTEN}
                width={KASTEN} height={KASTEN}
                fill="currentColor"
              />
            ))}
          </svg>

          <div className="flex-1 flex flex-col gap-3 w-full">
            <div className="flex flex-wrap gap-2">
              {FORMEN.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => merken(f)}
                  disabled={istLeer(bild)}
                  className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]
                    hover:bg-[var(--surface-hover)] text-sm font-bold disabled:opacity-40"
                >
                  Das ist ein {f}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={raten}
                disabled={!bereit || istLeer(bild)}
                className="px-4 py-2 rounded-xl font-black bg-[var(--accent)] text-[var(--accent-text)] disabled:opacity-40"
              >
                🤖 Was ist das?
              </button>
              <button
                type="button"
                onClick={() => { setBild(leeresBild()); setUrteil(null); }}
                className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]
                  hover:bg-[var(--surface-hover)] text-sm font-bold"
              >
                🧽 Feld leeren
              </button>
              {beispiele.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setBeispiele([]); setUrteil(null); }}
                  className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]
                    hover:bg-[var(--surface-hover)] text-sm font-bold"
                >
                  🗑️ Alles vergessen
                </button>
              )}
            </div>

            <div className="text-xs text-[var(--text-muted)]">
              {jeKlasse.map(k => `${k.form}: ${k.anzahl}`).join(" · ")}
              {!bereit && " — mindestens zwei Formen mit je einem Beispiel anlernen."}
            </div>

            {urteil && (
              <div className="p-3 rounded-xl border border-[var(--accent)] bg-[var(--surface)] flex flex-col gap-2">
                <p className="text-sm">
                  Das ist ein <b>{urteil.klasse}</b>
                  <span className="text-[var(--text-muted)]">
                    {" "}— {urteil.sicherheit > 0.4 ? "ziemlich sicher" : "aber ziemlich unsicher"}
                    {" "}({Math.round(urteil.sicherheit * 100)} %).
                  </span>
                </p>
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>weil es dem hier am ähnlichsten sieht:</span>
                  <span className="text-[var(--accent)]"><Miniatur bild={urteil.naechstes.bild} /></span>
                </div>
              </div>
            )}

            {beispiele.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  Was die Maschine kennt
                </span>
                <div className="flex flex-wrap gap-2">
                  {beispiele.map(b => (
                    <span key={b.id} className="flex flex-col items-center gap-0.5 text-[10px] text-[var(--text-muted)]">
                      <span className="text-[var(--accent)]"><Miniatur bild={b.bild} groesse={36} /></span>
                      {b.klasse}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Probiere zum Schluss etwas, das du ihr nie gezeigt hast — einen Buchstaben zum Beispiel.
          Sie wird trotzdem antworten, und zwar bestimmt. »Kenne ich nicht« ist in diesem Verfahren
          nicht vorgesehen; erst die Sicherheitszahl daneben verrät, wie dünn das Eis ist.
        </p>
      </div>

      <Wissen thema="erkennen" />
    </div>
  );
}
