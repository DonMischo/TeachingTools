"use client";
/**
 * Ein Zählwerk zum Selberdrehen: je Stelle eine Walze mit ▲/▼ (oder Pfeiltasten,
 * eine Ziffer tippen setzt die Walze direkt). Läuft eine Walze über ihre größte
 * Ziffer hinaus, dreht sie weiter auf 0 — sichtbar nach unten, nicht zurück.
 *
 * `mitdrehen`: wie im echten Kilometerzähler nimmt eine überlaufende Walze die
 * links daneben eins mit (rückwärts: leiht sich eins). Jede Walze kommt ein
 * wenig später als die vorige dran, so wandert der Übertrag Walze für Walze.
 *
 * Jede Walze zählt ihre Drehungen ohne Grenze mit (`dreh`); die Ziffer ist
 * davon der Rest. So weiß die Walze bei einem Schritt von F auf 0, ob sie vor-
 * oder zurückgedreht wurde, und rollt in die richtige Richtung.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { lies, spalte, ziffer, ziffernVon, type Basis } from "@/lib/stellenwert";

/** Zeit zwischen zwei Walzen beim Mitdrehen (ms) — etwas länger als eine Drehung */
export const VERZUG_MS = 280;
const DREHUNG_MS = 220;

const rest = (z: number, b: number) => ((z % b) + b) % b;

/** Eine Walze: drei Ziffernstreifen hintereinander, damit sie über 0 hinweg weiterrollen kann. */
function Walze({ dreh, basis, farbe, h }: { dreh: number; basis: number; farbe: string; h: number }) {
  const d = rest(dreh, basis);
  const [pos, setPos] = useState(basis + d);
  const [rollt, setRollt] = useState(false);
  const vorher = useRef(dreh);

  useEffect(() => {
    const schritt = dreh - vorher.current;
    vorher.current = dreh;
    if (schritt === 1 || schritt === -1) {
      setRollt(true);
      setPos(p => { const n = p + schritt; return n < 0 || n >= 3 * basis ? basis + d : n; });
    } else {
      setRollt(false);
      setPos(basis + d);
    }
  }, [dreh]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative overflow-hidden rounded-md" style={{ height: `${h}rem`, width: `${h * 0.72}rem`, background: farbe }}>
      <div className="flex flex-col"
        style={{ transform: `translateY(-${pos * h}rem)`, transition: rollt ? `transform ${DREHUNG_MS}ms ease-out` : "none" }}
        // nach dem Überlauf zurück in den mittleren Streifen springen — ohne Bewegung
        onTransitionEnd={() => { if (pos !== basis + d) { setRollt(false); setPos(basis + d); } }}>
        {Array.from({ length: 3 * basis }, (_, k) => (
          <span key={k} className="flex items-center justify-center font-mono font-black text-white"
            style={{ height: `${h}rem`, fontSize: `${h * 0.6}rem` }}>{ziffer(k % basis)}</span>
        ))}
      </div>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(#0006, transparent 30%, transparent 70%, #0006)" }} />
    </div>
  );
}

export function DrehZaehlwerk({ basis, stellen, start, mitdrehen, gesperrt = false, beschriftet = false, gross = true, onWert, onLaeuft, onEnter }: {
  basis: Basis; stellen: number; start: number;
  mitdrehen: boolean;
  gesperrt?: boolean;
  beschriftet?: boolean;
  gross?: boolean;
  /** die Zahl, die gerade eingestellt ist */
  onWert: (n: number) => void;
  /** true, solange ein Übertrag noch unterwegs ist */
  onLaeuft?: (laeuft: boolean) => void;
  onEnter?: () => void;
}) {
  // Index = Stelle von rechts (0 = Einer)
  const anfang = () => ziffernVon(start, basis, stellen).slice(-stellen).reverse();
  const [dreh, setDreh] = useState<number[]>(anfang);
  const aktuell = useRef<number[]>(dreh);
  const unterwegs = useRef(0);
  const uhren = useRef<ReturnType<typeof setTimeout>[]>([]);
  const walzen = useRef<(HTMLButtonElement | null)[]>([]);
  const h = gross ? 3.5 : 2.5;

  useEffect(() => () => uhren.current.forEach(clearTimeout), []);
  useEffect(() => {
    onWert(dreh.reduce((s, z, exp) => s + rest(z, basis) * basis ** exp, 0));
  }, [dreh]); // eslint-disable-line react-hooks/exhaustive-deps
  // die Einer haben den Fokus: dort fängt man an zu drehen
  useEffect(() => { walzen.current[0]?.focus(); }, []);

  const melde = (n: number) => { unterwegs.current = n; onLaeuft?.(n > 0); };

  const drehe = (exp: number, schritt: 1 | -1) => {
    const alt = rest(aktuell.current[exp], basis);
    aktuell.current = aktuell.current.map((z, i) => (i === exp ? z + schritt : z));
    setDreh(aktuell.current);
    const ueber = schritt > 0 ? alt === basis - 1 : alt === 0;
    if (mitdrehen && ueber && exp + 1 < stellen) {
      melde(unterwegs.current + 1);
      uhren.current.push(setTimeout(() => { melde(unterwegs.current - 1); drehe(exp + 1, schritt); }, VERZUG_MS));
    }
  };

  /** eine Ziffer direkt einstellen (Tastatur) — ohne Übertrag */
  const setze = (exp: number, wert: number) => {
    aktuell.current = aktuell.current.map((z, i) => (i === exp ? z - rest(z, basis) + wert : z));
    setDreh(aktuell.current);
  };

  const taste = (exp: number, e: KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); onEnter?.(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); walzen.current[exp + 1]?.focus(); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); walzen.current[exp - 1]?.focus(); return; }
    if (gesperrt) return;
    if (e.key === "ArrowUp") { e.preventDefault(); drehe(exp, 1); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); drehe(exp, -1); return; }
    const wert = e.key.length === 1 ? lies(e.key, basis) : null;
    if (wert !== null) { e.preventDefault(); setze(exp, wert); walzen.current[exp - 1]?.focus(); }
  };

  const knopf = "w-full rounded bg-surface hover:bg-surface-hover font-black leading-none py-1 disabled:opacity-30";
  return (
    <div className="inline-flex gap-1 p-2 rounded-xl bg-neutral-900 shadow-inner" role="group" aria-label="Zählwerk zum Drehen">
      {Array.from({ length: stellen }, (_, i) => stellen - 1 - i).map(exp => {
        const s = spalte(basis, exp);
        const d = rest(dreh[exp], basis);
        return (
          <div key={exp} className="flex flex-col items-center gap-1">
            {beschriftet && <span className="text-xs font-black leading-none" style={{ color: s.farbe }}>{s.kurz}</span>}
            <button type="button" className={knopf} disabled={gesperrt} tabIndex={-1}
              aria-label={`${s.name} hochdrehen`} onClick={() => drehe(exp, 1)}>▲</button>
            <button type="button" ref={el => { walzen.current[exp] = el; }}
              className="rounded-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
              aria-label={`${s.name}: ${ziffer(d)}`} onKeyDown={e => taste(exp, e)}>
              <Walze dreh={dreh[exp]} basis={basis} farbe={s.farbe} h={h} />
            </button>
            <button type="button" className={knopf} disabled={gesperrt} tabIndex={-1}
              aria-label={`${s.name} runterdrehen`} onClick={() => drehe(exp, -1)}>▼</button>
          </div>
        );
      })}
    </div>
  );
}
