"use client";
/**
 * »Echtes Entrauschen« — die Punktwolke.
 *
 * Der Bilderteil kann den Rückweg nur abspielen, weil dafür ein trainiertes
 * Modell fehlt. Hier wird er wirklich gerechnet: Aus reinem Rauschen entsteht
 * Schritt für Schritt die gewählte Form — mit derselben Formel wie bei einem
 * Bildgenerator, nur in zwei Dimensionen statt in 65 536 Pixeln.
 *
 * Drei Regler, drei Lehren:
 *   ▸ **Form** ist der Prompt. Sie entscheidet, wohin gerechnet wird.
 *   ▸ **Seed** ist der Würfel. Gleicher Seed, gleiches Bild — immer.
 *   ▸ **Prompt-Stärke** ist die Guidance: zu niedrig wird beliebig, zu hoch
 *     drückt die Punkte über die Form hinaus. Die Mitte ist richtig.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FORMEN, ALLE_PUNKTE, rauschwolke, entrauscheSchritt, aehnlichkeit, type Punkt,
} from "@/lib/ki/punktdiffusion";
import { rng, seedAusSignatur } from "@/lib/ki/rng";
import { Wissen } from "@/components/ki/Wissen";

const GROESSE = 256;
const SCHRITTE = 30;
const PUNKTE = 220;

function male(ctx: CanvasRenderingContext2D, wolke: readonly Punkt[], farbe: string) {
  ctx.clearRect(0, 0, GROESSE, GROESSE);
  ctx.fillStyle = "rgba(127,127,127,0.10)";
  ctx.fillRect(0, 0, GROESSE, GROESSE);
  ctx.fillStyle = farbe;
  for (const p of wolke) {
    // −1…1 auf die Leinwand, y nach oben.
    const x = (p.x * 0.45 + 0.5) * GROESSE;
    const y = (0.5 - p.y * 0.45) * GROESSE;
    ctx.beginPath();
    ctx.arc(x, y, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function erklaerung(t: number): string {
  const anteil = t / SCHRITTE;
  if (anteil > 0.95) return "Start: reines Rauschen. Nichts daran ist ein Bild — es sind nur zufällige Punkte.";
  if (anteil > 0.6) return "Erste Ordnung: Die Punkte sammeln sich grob dort, wo die Form dichter ist.";
  if (anteil > 0.3) return "Jetzt wird die Form erkennbar. Jeder Schritt schiebt die Punkte ein Stück weiter dorthin, wo es wahrscheinlicher wird.";
  if (anteil > 0) return "Die letzten Schritte machen die Kanten sauber — wie die Details bei einem KI-Bild ganz zum Schluss.";
  return "Fertig. Kein einziger Punkt wurde »gemalt«: Jeder ist dreißigmal ein Stück in die wahrscheinlichere Richtung gerückt.";
}

export function Punktwolke({ signatur }: { signatur: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [formNr, setFormNr] = useState(0);
  const [staerke, setStaerke] = useState(1);
  const [t, setT] = useState(SCHRITTE);
  const [laeuft, setLaeuft] = useState(false);
  const [wolke, setWolke] = useState<Punkt[]>([]);
  const wuerfel = useRef<() => number>(rng(1));

  const seed = useMemo(
    () => (signatur ? seedAusSignatur(signatur) % 100000 : 20260922),
    [signatur],
  );
  const form = FORMEN[formNr];

  /** Zurück auf Anfang: reines Rauschen, derselbe Seed ergibt dasselbe. */
  const zuruecksetzen = useCallback(() => {
    wuerfel.current = rng(seed);
    setWolke(rauschwolke(PUNKTE, seed));
    setT(SCHRITTE);
    setLaeuft(false);
  }, [seed]);

  useEffect(() => { zuruecksetzen(); }, [zuruecksetzen]);

  // Ein Schritt je Bildwechsel — schnell genug zum Zusehen, langsam genug zum
  // Mitdenken.
  useEffect(() => {
    if (!laeuft || t <= 0) { if (t <= 0) setLaeuft(false); return; }
    const id = window.setTimeout(() => {
      setWolke(alt => entrauscheSchritt(alt, t, SCHRITTE, form.punkte, ALLE_PUNKTE, staerke, wuerfel.current));
      setT(x => x - 1);
    }, 110);
    return () => window.clearTimeout(id);
  }, [laeuft, t, form, staerke]);

  useEffect(() => {
    const flaeche = canvas.current;
    const ctx = flaeche?.getContext("2d");
    // Die Farbe steht als `color` an der Leinwand (text-[var(--accent)]) — so
    // folgen die Punkte dem Hell/Dunkel-Wechsel der App, ohne Sonderweg.
    if (ctx && flaeche) male(ctx, wolke, getComputedStyle(flaeche).color);
  }, [wolke]);

  const passt = wolke.length ? aehnlichkeit(wolke, form.punkte) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <canvas
            ref={canvas}
            width={GROESSE}
            height={GROESSE}
            className="block rounded-xl text-[var(--accent)]"
            style={{ width: GROESSE, maxWidth: "100%" }}
            aria-label={`Punktwolke, Schritt ${t} von ${SCHRITTE}, Ähnlichkeit ${Math.round(passt * 100)} Prozent`}
          />
        </div>

        <div className="flex-1 flex flex-col gap-3 w-full">
          <p className="text-sm font-bold leading-relaxed">{erklaerung(t)}</p>

          <div className="flex flex-wrap gap-2">
            {FORMEN.map((f, i) => (
              <button
                key={f.slug}
                type="button"
                onClick={() => { setFormNr(i); zuruecksetzen(); }}
                className={`px-3 py-1.5 rounded-xl border text-sm font-bold ${
                  i === formNr
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {f.icon} {f.titel}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold">
              🎚️ Prompt-Stärke: {staerke.toFixed(1)}
              <span className="ml-2 font-normal text-[var(--text-muted)]">
                {staerke === 0 ? "hört gar nicht auf den Wunsch"
                  : staerke <= 2 ? "gut so"
                    : staerke <= 6 ? "drängt schon" : "viel zu viel"}
              </span>
            </span>
            <input
              type="range" min={0} max={12} step={0.5}
              value={staerke}
              onChange={e => { setStaerke(Number(e.target.value)); zuruecksetzen(); }}
              className="w-full accent-[var(--accent)]"
              aria-label="Prompt-Stärke"
            />
          </label>

          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] flex-wrap">
            <span>Schritt {SCHRITTE - t} von {SCHRITTE}</span>
            <span>·</span>
            <span>Seed {signatur ?? "—"}</span>
            <span>·</span>
            <span>trifft die Form zu {Math.round(passt * 100)} %</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { if (t <= 0) zuruecksetzen(); setLaeuft(l => !l); }}
              className="px-4 py-2 rounded-xl font-black bg-[var(--accent)] text-[var(--accent-text)]"
            >
              {laeuft ? "⏸ Anhalten" : t <= 0 ? "↺ Noch einmal" : "▶︎ Entrauschen"}
            </button>
            <button
              type="button"
              onClick={zuruecksetzen}
              className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]
                hover:bg-[var(--surface-hover)] text-sm font-bold"
            >
              ↺ Zurück zum Rauschen
            </button>
          </div>

          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Hier wird nichts abgespielt: Jeder Schritt wird gerade ausgerechnet. Das geht nur,
            weil das Ziel bekannt ist — eine Handvoll Punkte statt aller Bilder der Welt. Ein
            echtes Bildmodell muss diese Richtung aus Milliarden Bildern schätzen, den Rest macht
            es genauso.
          </p>
        </div>
      </div>

      <Wissen thema="entrauschen" />
    </div>
  );
}
