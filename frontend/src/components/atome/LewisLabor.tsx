"use client";
/**
 * Das Lewis-Labor: Symbole mit ihren Außenelektronen als Punkte, zum
 * Zusammenschieben. Die Rechnung steht in `lib/atome/lewis.ts`; hier wird
 * gezeichnet (Canvas, damit 60 Bilder je Sekunde nichts neu rendern) und die
 * Maus angenommen.
 */
import { useEffect, useRef, useState } from "react";
import {
  BAUSAETZE, entferne, freierPlatz, fuegeHinzu, LABOR_ATOME, molekuele, neuesLabor, schritt,
  elektronenUm, type Ereignis, type LewisLabor as Labor, type Molekuel,
} from "@/lib/atome/lewis";

const W = 720, H = 420;

/** Die Farben des Themas, denn Canvas kennt kein var(). */
function farben(el: HTMLElement) {
  const s = getComputedStyle(el);
  const v = (n: string, f: string) => s.getPropertyValue(n).trim() || f;
  return { text: v("--text", "#eee"), muted: v("--text-muted", "#999"), ok: v("--green", "#4caf50"), bad: v("--red", "#f44336"), line: v("--border", "#555") };
}

export default function LewisLabor() {
  const leinwand = useRef<HTMLCanvasElement>(null);
  const lab = useRef<Labor>(neuesLabor(W, H));
  const blitze = useRef<(Ereignis & { t: number })[]>([]);
  const [striche, setStriche] = useState(false);
  const [laufen, setLaufen] = useState(true);
  const [teile, setTeile] = useState<Molekuel[]>([]);
  const optionen = useRef({ striche, laufen });
  optionen.current = { striche, laufen };

  const lege = (symbole: string[]) => {
    lab.current = neuesLabor(W, H);
    // Im Kreis auslegen — weit genug auseinander, dass noch nichts passiert.
    symbole.forEach((s, i) => {
      const w = (i / symbole.length) * Math.PI * 2 - Math.PI / 2;
      const r = symbole.length === 1 ? 0 : 150;
      fuegeHinzu(lab.current, s, W / 2 + r * Math.cos(w) * 1.3, H / 2 + r * Math.sin(w) * 0.95);
    });
    setTeile(molekuele(lab.current));
  };

  useEffect(() => { lege(["H", "H", "O"]); }, []);

  // Zeichnen und rechnen.
  useEffect(() => {
    const c = leinwand.current!;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let f = farben(c);
    let id = 0, zuletzt = performance.now(), takt = 0;
    const bild = (jetzt: number) => {
      const dt = Math.min(0.05, (jetzt - zuletzt) / 1000);
      zuletzt = jetzt;
      const L = lab.current;
      if (optionen.current.laufen) {
        for (let i = 0; i < 3; i++) for (const e of schritt(L, dt / 3)) blitze.current.push({ ...e, t: 0 });
      }
      takt += dt;
      if (takt > 0.25) { takt = 0; setTeile(molekuele(L)); f = farben(c); }

      const dpr = window.devicePixelRatio || 1;
      if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const atom = new Map(L.atome.map(a => [a.id, a]));

      // Magnetzug: gestrichelte Linie zwischen den Elektronen, die sich suchen.
      for (const z of L.zug) {
        const ga = L.gruppen.find(g => g.id === z.ga), gb = L.gruppen.find(g => g.id === z.gb);
        const ea = ga && L.el.find(e => e.id === ga.el[0]), eb = gb && L.el.find(e => e.id === gb.el[0]);
        if (!ea || !eb) continue;
        ctx.save();
        ctx.globalAlpha = 0.15 + 0.5 * z.t;
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = f.muted;
        ctx.lineWidth = 1 + z.t * 1.5;
        ctx.beginPath(); ctx.moveTo(ea.x, ea.y); ctx.lineTo(eb.x, eb.y); ctx.stroke();
        ctx.restore();
      }

      // Valenzstriche für fertige Bindungen.
      if (optionen.current.striche) {
        const paare = new Map<string, number>();
        for (const b of L.bindungen) {
          const k = b.a < b.b ? `${b.a}-${b.b}` : `${b.b}-${b.a}`;
          paare.set(k, (paare.get(k) ?? 0) + 1);
        }
        for (const [k, n] of paare) {
          const [a, b] = k.split("-").map(Number);
          const A = atom.get(a)!, B = atom.get(b)!;
          const d = Math.hypot(B.x - A.x, B.y - A.y), ux = (B.x - A.x) / d, uy = (B.y - A.y) / d;
          ctx.strokeStyle = f.text; ctx.lineWidth = 2.5;
          for (let i = 0; i < n; i++) {
            const q = (i - (n - 1) / 2) * 7;
            ctx.beginPath();
            ctx.moveTo(A.x + ux * 17 - uy * q, A.y + uy * 17 + ux * q);
            ctx.lineTo(B.x - ux * 17 - uy * q, B.y - uy * 17 + ux * q);
            ctx.stroke();
          }
        }
      }

      // Funken, wo gerade eine Bindung entstanden oder gerissen ist.
      blitze.current = blitze.current.filter(b => (b.t += dt) < 0.6);
      for (const b of blitze.current) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 6 + b.t * 50, 0, Math.PI * 2);
        ctx.strokeStyle = b.art === "gebunden" ? f.ok : f.bad;
        ctx.globalAlpha = 1 - b.t / 0.6;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Die Symbole mit Hof in ihrer Farbe und dem Elektronenzähler.
      for (const A of L.atome) {
        const zahl = elektronenUm(L, A), voll = zahl === A.ziel;
        ctx.beginPath();
        ctx.arc(A.x, A.y, 17, 0, Math.PI * 2);
        ctx.fillStyle = A.farbe + "33";
        ctx.fill();
        ctx.strokeStyle = A.gehalten ? f.text : A.farbe + "88";
        ctx.lineWidth = A.gehalten ? 2 : 1;
        ctx.stroke();
        ctx.fillStyle = f.text;
        ctx.font = "bold 24px system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(A.symbol, A.x, A.y + 1);
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillStyle = voll ? f.ok : f.muted;
        ctx.fillText(`${zahl}${voll ? " ✓" : `/${A.ziel}`}`, A.x, A.y + 44);
      }

      // Die Elektronen, jedes in der Farbe seines Atoms.
      for (const e of L.el) {
        const A = atom.get(e.atom);
        if (!A) continue;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 4.2, 0, Math.PI * 2);
        ctx.fillStyle = A.farbe;
        ctx.fill();
        ctx.strokeStyle = "#0008";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      id = requestAnimationFrame(bild);
    };
    id = requestAnimationFrame(bild);
    return () => cancelAnimationFrame(id);
  }, []);

  // Ziehen mit Maus oder Finger.
  const gehalten = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const punkt = (ev: React.PointerEvent) => {
    const r = leinwand.current!.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height };
  };
  const treffer = (p: { x: number; y: number }) =>
    [...lab.current.atome].reverse().find(a => Math.hypot(a.x - p.x, a.y - p.y) < 26);
  const runter = (ev: React.PointerEvent) => {
    const p = punkt(ev), a = treffer(p);
    if (!a) return;
    a.gehalten = true;
    gehalten.current = { id: a.id, dx: a.x - p.x, dy: a.y - p.y };
    (ev.target as Element).setPointerCapture(ev.pointerId);
  };
  const bewege = (ev: React.PointerEvent) => {
    const g = gehalten.current;
    if (!g) return;
    const a = lab.current.atome.find(x => x.id === g.id);
    if (!a) return;
    const p = punkt(ev);
    a.x = Math.max(20, Math.min(W - 20, p.x + g.dx));
    a.y = Math.max(20, Math.min(H - 20, p.y + g.dy));
  };
  const hoch = () => {
    const g = gehalten.current;
    if (g) { const a = lab.current.atome.find(x => x.id === g.id); if (a) a.gehalten = false; }
    gehalten.current = null;
  };
  const doppel = (ev: React.MouseEvent) => {
    const r = leinwand.current!.getBoundingClientRect();
    const a = treffer({ x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height });
    if (a) { entferne(lab.current, a.id); setTeile(molekuele(lab.current)); }
  };

  const schuetteln = () => {
    for (const a of lab.current.atome) {
      a.vx += (Math.random() - 0.5) * 2400;
      a.vy += (Math.random() - 0.5) * 2400;
    }
  };

  const fertig = teile.filter(m => m.atome.length > 1);
  const einzeln = teile.filter(m => m.atome.length === 1);
  const alleVoll = teile.length > 0 && teile.every(m => m.offen.length === 0);

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <div className="w-full lg:flex-1 min-w-0 flex flex-col gap-2">
        <canvas ref={leinwand} aria-label="Lewis-Labor: Elementsymbole mit Außenelektronen"
          onPointerDown={runter} onPointerMove={bewege} onPointerUp={hoch} onPointerCancel={hoch}
          onDoubleClick={doppel}
          style={{ aspectRatio: `${W} / ${H}`, touchAction: "none" }}
          className="w-full rounded-xl bg-black/10 dark:bg-white/5 border border-line cursor-grab active:cursor-grabbing" />
        <p className="text-xs text-muted">
          Symbole mit der Maus zusammenschieben. Kommen sich zwei nahe, spüren sich ihre einzelnen Elektronen, drehen sich zueinander und ziehen — nah genug, springen sie als Paar in die Mitte.
          Schnell auseinanderziehen reißt die Bindung wieder. Doppelklick entfernt ein Atom.
        </p>
      </div>

      <div className="w-full lg:w-[320px] shrink-0 card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setLaufen(l => !l)}
            className="px-2 py-1 rounded-lg border border-line text-xs text-muted hover:text-fg">
            {laufen ? "⏸ anhalten" : "▶ weiter"}
          </button>
          <button onClick={() => setStriche(s => !s)}
            className={`px-2 py-1 rounded-lg border text-xs ${striche ? "border-accent bg-accent/15 font-bold" : "border-line text-muted hover:text-fg"}`}>
            ✏️ Valenzstriche
          </button>
          <button onClick={schuetteln} className="px-2 py-1 rounded-lg border border-line text-xs text-muted hover:text-fg">
            🫨 schütteln
          </button>
          <button onClick={() => lege([])} className="px-2 py-1 rounded-lg text-xs text-muted hover:text-fg">
            alles leeren
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Atom dazulegen</span>
          <div className="flex flex-wrap gap-1">
            {LABOR_ATOME.map(s => (
              <button key={s} disabled={lab.current.atome.length >= 14}
                onClick={() => {
                  const p = freierPlatz(lab.current);
                  fuegeHinzu(lab.current, s, p.x, p.y);
                  setTeile(molekuele(lab.current));
                }}
                className="px-2 py-0.5 rounded-lg border border-line text-xs hover:border-accent disabled:opacity-30">
                +{s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Bausatz (liegt auseinander — zusammenschieben!)</span>
          <div className="flex flex-wrap gap-1">
            {BAUSAETZE.map(b => (
              <button key={b.label} onClick={() => lege(b.symbole)}
                className="px-2 py-0.5 rounded-lg border border-line text-xs text-muted hover:text-fg hover:border-accent">
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted">Was gerade da ist</span>
          {fertig.length === 0 && einzeln.length === 0 && <span className="text-xs text-muted">Noch leer.</span>}
          {fertig.map(m => (
            <div key={m.atome.join()} className={`rounded-lg px-3 py-1.5 text-xs ${m.offen.length ? "bg-accent/10" : "bg-ok/10"}`}>
              <strong className="text-sm">{m.gesetzt}</strong>
              {m.name && <span className="text-muted"> · {m.name}</span>}
              <span className="block">
                {m.offen.length === 0
                  ? "Alle Atome haben ihr Oktett (H: Duett)."
                  : m.offen.map(o => `${o.symbol}: ${o.zahl} von ${o.ziel}`).join(", ")}
              </span>
            </div>
          ))}
          {einzeln.length > 0 && (
            <span className="text-xs text-muted">
              Einzeln: {einzeln.map(m => m.gesetzt).join(", ")}
            </span>
          )}
          {alleVoll && fertig.length > 0 && einzeln.length === 0 && (
            <span className="text-xs text-ok font-bold">✓ Kein einzelnes Elektron mehr übrig.</span>
          )}
        </div>

        <p className="text-xs text-muted">
          Die Zahl unter dem Symbol zählt die eigenen Außenelektronen plus je eins vom Partner pro Bindung —
          ein bindendes Paar gehört beiden. Gepaarte Elektronen (freie Paare) binden nicht; sie weichen den
          Bindungen nur aus. Bor bleibt mit drei Bindungen bei sechs.
        </p>
      </div>
    </div>
  );
}
