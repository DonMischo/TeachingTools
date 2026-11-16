"use client";
/**
 * Karten zum Ordnen: links der Stapel, rechts die eigene Reihenfolge.
 * Karten lassen sich ziehen (Maus und Finger) — vom Stapel an eine beliebige
 * Stelle, innerhalb der Reihenfolge umsortieren oder zurück auf den Stapel.
 * Antippen legt eine Stapelkarte hinten an; ▲ ▼ ✕ bleiben als Knöpfe.
 */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";

interface Zug { id: string; ausPlan: boolean; x0: number; y0: number; x: number; y: number; dx: number; dy: number; b: number; bewegt: boolean; ziel: number | null }

export default function ZiehKarten({ stapel, plan, text, onPlan, stapelTitel, planTitel, leer, zeilenKlasse, knoepfe = true, gesperrt = false }: {
  /** Ids, die noch auf dem Stapel liegen (in Anzeigereihenfolge) */
  stapel: string[];
  plan: string[];
  text: (id: string) => ReactNode;
  onPlan: (p: string[]) => void;
  stapelTitel: ReactNode;
  planTitel: ReactNode;
  leer?: ReactNode;
  /** Rahmen einer Planzeile (z. B. gerade ausgeführt, falsch) */
  zeilenKlasse?: (id: string, i: number) => string;
  knoepfe?: boolean;
  gesperrt?: boolean;
}) {
  const [zug, setZug] = useState<Zug | null>(null);
  const planListe = useRef<HTMLOListElement>(null);

  const zielBei = (x: number, y: number, id: string): number | null => {
    const ol = planListe.current;
    if (!ol) return null;
    const r = ol.closest("section")?.getBoundingClientRect() ?? ol.getBoundingClientRect();
    if (x < r.left - 20 || x > r.right + 20 || y < r.top - 20 || y > r.bottom + 40) return null;
    let i = 0;
    for (const li of ol.querySelectorAll<HTMLElement>("[data-karte]")) {
      if (li.dataset.karte === id) continue;
      const q = li.getBoundingClientRect();
      if (y > q.top + q.height / 2) i++;
    }
    return i;
  };

  const runter = (e: RPointerEvent<HTMLElement>, id: string, ausPlan: boolean) => {
    if (gesperrt || e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    const r = e.currentTarget.getBoundingClientRect();
    setZug({ id, ausPlan, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, b: r.width, bewegt: false, ziel: null });
  };
  const bewegen = (e: PointerEvent) => {
    if (!zug) return;
    const bewegt = zug.bewegt || Math.hypot(e.clientX - zug.x0, e.clientY - zug.y0) > 6;
    setZug({ ...zug, x: e.clientX, y: e.clientY, bewegt, ziel: bewegt ? zielBei(e.clientX, e.clientY, zug.id) : null });
  };
  const los = () => {
    if (!zug) return;
    const z = zug;
    setZug(null);
    if (!z.bewegt) {
      if (!z.ausPlan) onPlan([...plan, z.id]);
      return;
    }
    const ohne = plan.filter(x => x !== z.id);
    if (z.ziel !== null) onPlan([...ohne.slice(0, z.ziel), z.id, ...ohne.slice(z.ziel)]);
    else if (z.ausPlan) onPlan(ohne);
  };
  // Während des Ziehens hört das Fenster mit — auch wenn der Finger die Fläche verlässt.
  const aktuell = useRef({ bewegen, los });
  aktuell.current = { bewegen, los };
  const laeuft = !!zug;
  useEffect(() => {
    if (!laeuft) return;
    const m = (e: PointerEvent) => aktuell.current.bewegen(e);
    const u = () => aktuell.current.los();
    const c = () => setZug(null);
    window.addEventListener("pointermove", m);
    window.addEventListener("pointerup", u);
    window.addEventListener("pointercancel", c);
    return () => { window.removeEventListener("pointermove", m); window.removeEventListener("pointerup", u); window.removeEventListener("pointercancel", c); };
  }, [laeuft]);

  const ziehend = zug?.bewegt ? zug : null;
  const knopf = "w-6 h-6 rounded bg-surface-hover hover:bg-line text-xs";
  const karte = "text-left text-sm rounded-lg border bg-page px-3 py-2 select-none touch-none";
  const griff = gesperrt ? "" : "cursor-grab active:cursor-grabbing";
  const marke = <li aria-hidden className="h-1.5 rounded-full bg-accent my-0.5" />;
  const planOhne = ziehend ? plan.filter(x => x !== ziehend.id) : plan;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <section className="card p-3 flex flex-col gap-2">
        <h3 className="text-sm font-bold">{stapelTitel}</h3>
        {stapel.map(id => (
          <div key={id} role="button" tabIndex={0} onPointerDown={e => runter(e, id, false)}
            onKeyDown={e => { if (!gesperrt && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onPlan([...plan, id]); } }}
            className={`${karte} ${griff} border-line hover:border-line-active ${ziehend?.id === id ? "opacity-30" : ""}`}>
            {text(id)}
          </div>
        ))}
        {ziehend?.ausPlan && <div className="rounded-lg border-2 border-dashed border-line px-3 py-2 text-xs text-muted text-center">hier ablegen = Karte entfernen</div>}
      </section>
      <section className={`card p-3 flex flex-col gap-2 ${ziehend && ziehend.ziel !== null ? "ring-2 ring-accent" : ""}`}>
        <h3 className="text-sm font-bold">{planTitel}</h3>
        {plan.length === 0 && !ziehend && leer && <p className="text-sm text-muted">{leer}</p>}
        <ol ref={planListe} className="flex flex-col gap-1 min-h-10">
          {planOhne.map((id, i) => (
            <FragmentZeile key={id} vorher={ziehend?.ziel === i ? marke : null}>
              <li data-karte={id} onPointerDown={e => runter(e, id, true)}
                className={`flex items-center gap-2 text-sm rounded-lg border px-2 py-1.5 select-none touch-none ${griff} ${zeilenKlasse?.(id, i) ?? "border-line"}`}>
                <span className="font-black tabular-nums w-5 text-right">{i + 1}.</span>
                <span className="flex-1">{text(id)}</span>
                {knoepfe && !gesperrt && (
                  <span className="inline-flex gap-1 shrink-0">
                    <button type="button" className={knopf} aria-label="nach oben" disabled={i === 0}
                      onClick={() => { const p = [...plan]; [p[i - 1], p[i]] = [p[i], p[i - 1]]; onPlan(p); }}>▲</button>
                    <button type="button" className={knopf} aria-label="nach unten" disabled={i === plan.length - 1}
                      onClick={() => { const p = [...plan]; [p[i + 1], p[i]] = [p[i], p[i + 1]]; onPlan(p); }}>▼</button>
                    <button type="button" className={knopf} aria-label="Karte entfernen" onClick={() => onPlan(plan.filter(x => x !== id))}>✕</button>
                  </span>
                )}
              </li>
            </FragmentZeile>
          ))}
          {ziehend && ziehend.ziel !== null && ziehend.ziel >= planOhne.length && marke}
        </ol>
      </section>
      {ziehend && (
        <div aria-hidden className={`${karte} border-line-active shadow-xl fixed z-50 pointer-events-none rotate-1`}
          style={{ left: ziehend.x - ziehend.dx, top: ziehend.y - ziehend.dy, width: ziehend.b }}>
          {text(ziehend.id)}
        </div>
      )}
    </div>
  );
}

function FragmentZeile({ vorher, children }: { vorher: ReactNode; children: ReactNode }) {
  return <>{vorher}{children}</>;
}
