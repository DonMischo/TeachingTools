"use client";
/**
 * Das Lewis-Labor: Symbole mit ihren Außenelektronen als Punkte, zum
 * Zusammenschieben. Die Rechnung steht in `lib/atome/lewis.ts`; hier wird
 * gezeichnet (Canvas, damit 60 Bilder je Sekunde nichts neu rendern) und die
 * Maus angenommen.
 *
 * Dazu fertige Moleküle zum Einsetzen, Teilladungen (δ+/δ−) und die Kräfte
 * zwischen den Molekülen: Wasserstoffbrücken, Dipol-Dipol und Van der Waals.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BAUSAETZE, entferne, freierPlatz, fuegeHinzu, fuegeMolekuelEin, LABOR_ATOME, molekuele, MOLEKUELE,
  neuesLabor, schritt, teilladungen, elektronenUm, type Ereignis, type LewisLabor as Labor, type Molekuel,
  type Vorlage,
} from "@/lib/atome/lewis";
import { summenformel } from "@/lib/pse/bindung";

const W = 900, H = 520;
const MAX_ATOME = 72;

/** Die Farben des Themas, denn Canvas kennt kein var(). */
function farben(el: HTMLElement) {
  const s = getComputedStyle(el);
  const v = (n: string, f: string) => s.getPropertyValue(n).trim() || f;
  return { text: v("--text", "#eee"), muted: v("--text-muted", "#999"), ok: v("--green", "#4caf50"), bad: v("--red", "#f44336"), line: v("--border", "#555") };
}

/** Vergleiche, an denen man die Kräfte zwischen Molekülen sieht. */
const VERGLEICHE: { label: string; teile: [string, number][] }[] = [
  { label: "💧 6 × Wasser", teile: [["H₂O", 6]] },
  { label: "⛽ 6 × Methan", teile: [["CH₄", 6]] },
  { label: "🍷 4 × Ethanol", teile: [["C₂H₅OH", 4]] },
  { label: "🧪 4 × HCl", teile: [["HCl", 4]] },
  { label: "Wasser + Methan", teile: [["H₂O", 4], ["CH₄", 3]] },
  { label: "Wasser + Ethanol", teile: [["H₂O", 4], ["C₂H₅OH", 2]] },
];

const KONTAKT_FARBE = { bruecke: "#3b82f6", dipol: "#a855f7", london: "" } as const;

function Schalter({ an, setze, children }: { an: boolean; setze: (f: (x: boolean) => boolean) => void; children: React.ReactNode }) {
  return (
    <button onClick={() => setze(x => !x)}
      className={`px-2 py-1 rounded-lg border text-xs ${an ? "border-accent bg-accent/15 font-bold" : "border-line text-muted hover:text-fg"}`}>
      {children}
    </button>
  );
}

export default function LewisLabor() {
  const leinwand = useRef<HTMLCanvasElement>(null);
  const lab = useRef<Labor>(neuesLabor(W, H));
  const blitze = useRef<(Ereignis & { t: number })[]>([]);
  const [striche, setStriche] = useState(false);
  const [laufen, setLaufen] = useState(true);
  const [polar, setPolar] = useState(false);
  const [zwischen, setZwischen] = useState(false);
  const [waerme, setWaerme] = useState(0);
  const [anzahl, setAnzahl] = useState(1);
  const [teile, setTeile] = useState<Molekuel[]>([]);
  const [kontakte, setKontakte] = useState({ bruecke: 0, dipol: 0, london: 0 });
  const optionen = useRef({ striche, laufen, polar, zwischen, waerme });
  optionen.current = { striche, laufen, polar, zwischen, waerme };

  // Summenformel jeder Vorlage → Vorlage, damit die Liste Namen und Siedepunkt kennt.
  const nachFormel = useMemo(() => new Map(MOLEKUELE.map(m => [summenformel(m.atome.map(a => a[0])), m])), []);

  const auffrischen = () => setTeile(molekuele(lab.current));

  const lege = (symbole: string[]) => {
    lab.current = neuesLabor(W, H);
    // Im Kreis auslegen — weit genug auseinander, dass noch nichts passiert.
    symbole.forEach((s, i) => {
      const w = (i / symbole.length) * Math.PI * 2 - Math.PI / 2;
      const r = symbole.length === 1 ? 0 : 150;
      fuegeHinzu(lab.current, s, W / 2 + r * Math.cos(w) * 1.3, H / 2 + r * Math.sin(w) * 0.95);
    });
    auffrischen();
  };

  const setzeEin = (m: Vorlage, n: number) => {
    for (let i = 0; i < n; i++) {
      if (lab.current.atome.length + m.atome.length > MAX_ATOME) break;
      const p = freierPlatz(lab.current);
      fuegeMolekuelEin(lab.current, m, p.x, p.y, Math.random() * Math.PI * 2);
    }
    auffrischen();
  };

  const vergleiche = (v: (typeof VERGLEICHE)[number]) => {
    lab.current = neuesLabor(W, H);
    setPolar(true);
    setZwischen(true);
    if (waerme === 0) setWaerme(0.25);
    // Dicht beieinander in der Mitte, damit die Kräfte gleich wirken — wer
    // schwach zusammenhält, driftet mit der Wärmebewegung auseinander.
    const liste = v.teile.flatMap(([label, n]) => Array<Vorlage>(n).fill(MOLEKUELE.find(m => m.label === label)!));
    const spalten = Math.ceil(Math.sqrt(liste.length * 1.5));
    const zeilen = Math.ceil(liste.length / spalten);
    liste.forEach((m, i) => {
      const x = W / 2 + ((i % spalten) - (spalten - 1) / 2) * 135;
      const y = H / 2 + (Math.floor(i / spalten) - (zeilen - 1) / 2) * 125;
      fuegeMolekuelEin(lab.current, m, x, y, Math.random() * Math.PI * 2);
    });
    auffrischen();
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
      const o = optionen.current;
      L.optionen = { polar: o.polar, zwischen: o.zwischen, waerme: o.waerme };
      if (o.laufen) {
        for (let i = 0; i < 3; i++) for (const e of schritt(L, dt / 3)) blitze.current.push({ ...e, t: 0 });
      }
      takt += dt;
      if (takt > 0.25) {
        takt = 0;
        setTeile(molekuele(L));
        const z = { bruecke: 0, dipol: 0, london: 0 };
        for (const k of L.kontakte) z[k.art]++;
        setKontakte(z);
        f = farben(c);
      }

      const dpr = window.devicePixelRatio || 1;
      if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const atom = new Map(L.atome.map(a => [a.id, a]));

      // Kräfte zwischen Molekülen: Brücken blau gestrichelt, Dipole lila, Van der Waals grau gepunktet.
      if (o.zwischen) {
        for (const k of L.kontakte) {
          const A = atom.get(k.a), B = atom.get(k.b);
          if (!A || !B) continue;
          ctx.save();
          if (k.art === "bruecke") {
            ctx.setLineDash([6, 4]); ctx.strokeStyle = KONTAKT_FARBE.bruecke; ctx.lineWidth = 1.5 + 2 * k.t; ctx.globalAlpha = 0.5 + 0.5 * k.t;
          } else if (k.art === "dipol") {
            ctx.setLineDash([2, 4]); ctx.strokeStyle = KONTAKT_FARBE.dipol; ctx.lineWidth = 1 + 1.5 * k.t; ctx.globalAlpha = 0.25 + 0.5 * k.t;
          } else {
            ctx.setLineDash([1, 5]); ctx.strokeStyle = f.muted; ctx.lineWidth = 1; ctx.globalAlpha = 0.15 + 0.4 * k.t;
          }
          const d = Math.hypot(B.x - A.x, B.y - A.y) || 1, ux = (B.x - A.x) / d, uy = (B.y - A.y) / d;
          ctx.beginPath();
          ctx.moveTo(A.x + ux * 15, A.y + uy * 15);
          ctx.lineTo(B.x - ux * 15, B.y - uy * 15);
          ctx.stroke();
          ctx.restore();
        }
      }

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
      if (o.striche) {
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

      // Die Symbole mit Hof in ihrer Farbe, Elektronenzähler und Teilladung.
      const q = o.polar ? teilladungen(L) : null;
      const voll = L.atome.length > 24;
      for (const A of L.atome) {
        const zahl = elektronenUm(L, A), fertig = zahl === A.ziel;
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
        // Bei vielen Molekülen nur noch die offenen Zähler, sonst wird es unlesbar.
        if (!voll || !fertig) {
          ctx.font = "11px system-ui, sans-serif";
          ctx.fillStyle = fertig ? f.ok : f.muted;
          ctx.fillText(`${zahl}${fertig ? " ✓" : `/${A.ziel}`}`, A.x, A.y + 44);
        }
        const qa = q?.get(A.id);
        if (qa) {
          ctx.font = `bold ${Math.round(12 + Math.min(1.5, Math.abs(qa)) * 4)}px system-ui, sans-serif`;
          ctx.fillStyle = qa > 0 ? "#f87171" : "#60a5fa";
          ctx.fillText(qa > 0 ? "δ+" : "δ−", A.x + 25, A.y - 25);
        }
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
  const punkt = (ev: { clientX: number; clientY: number }) => {
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
    const a = treffer(punkt(ev));
    if (!a) return;
    // Mit Umschalttaste das ganze Molekül.
    const weg = ev.shiftKey ? molekuele(lab.current).find(m => m.atome.includes(a.id))!.atome : [a.id];
    for (const id of weg) entferne(lab.current, id);
    auffrischen();
  };

  const schuetteln = () => {
    for (const a of lab.current.atome) {
      a.vx += (Math.random() - 0.5) * 2400;
      a.vy += (Math.random() - 0.5) * 2400;
    }
  };

  // Gleiche Moleküle zusammenfassen: »6 × H₂O«.
  const gruppen = useMemo(() => {
    const g = new Map<string, { m: Molekuel; n: number; offen: boolean }>();
    for (const m of teile.filter(x => x.atome.length > 1)) {
      const k = m.formel + (m.offen.length ? "!" : "");
      const alt = g.get(k);
      if (alt) alt.n++;
      else g.set(k, { m, n: 1, offen: m.offen.length > 0 });
    }
    return [...g.values()];
  }, [teile]);
  const einzeln = teile.filter(m => m.atome.length === 1);
  const voll = lab.current.atome.length >= MAX_ATOME;

  return (
    <div className="flex flex-col xl:flex-row gap-4 items-start">
      <div className="w-full xl:flex-1 min-w-0 flex flex-col gap-2">
        <canvas ref={leinwand} aria-label="Lewis-Labor: Elementsymbole mit Außenelektronen"
          onPointerDown={runter} onPointerMove={bewege} onPointerUp={hoch} onPointerCancel={hoch}
          onDoubleClick={doppel}
          style={{ aspectRatio: `${W} / ${H}`, touchAction: "none" }}
          className="w-full rounded-xl bg-black/10 dark:bg-white/5 border border-line cursor-grab active:cursor-grabbing" />
        <p className="text-xs text-muted">
          Symbole mit der Maus zusammenschieben. Kommen sich zwei nahe, spüren sich ihre einzelnen Elektronen,
          drehen sich zueinander und ziehen — nah genug, springen sie als Paar in die Mitte.
          Schnell auseinanderziehen reißt die Bindung wieder. Doppelklick entfernt ein Atom, mit gedrückter
          Umschalttaste das ganze Molekül.
        </p>
        {zwischen && (
          <div className="card p-3 text-xs flex flex-col gap-1">
            <div className="flex flex-wrap gap-3">
              <span><span className="inline-block w-5 border-t-2 border-dashed align-middle mr-1" style={{ borderColor: KONTAKT_FARBE.bruecke }} />
                Wasserstoffbrücken: <strong>{kontakte.bruecke}</strong></span>
              <span><span className="inline-block w-5 border-t-2 border-dotted align-middle mr-1" style={{ borderColor: KONTAKT_FARBE.dipol }} />
                Dipol-Dipol: <strong>{kontakte.dipol}</strong></span>
              <span><span className="inline-block w-5 border-t border-dotted border-muted align-middle mr-1" />
                Van der Waals: <strong>{kontakte.london}</strong></span>
            </div>
            <p className="text-muted">
              <strong className="text-fg">Wasserstoffbrücke:</strong> ein H, das an N, O oder F hängt, ist stark δ+ und wird vom
              freien Elektronenpaar eines N, O oder F im Nachbarmolekül angezogen — die stärkste Kraft zwischen
              Molekülen. <strong className="text-fg">Dipol-Dipol:</strong> δ+ zieht δ− an, gleiche Teilladungen stoßen sich ab.{" "}
              <strong className="text-fg">Van der Waals</strong> (London-Kräfte): schwach, wirken zwischen allen Molekülen
              und wachsen mit der Größe — darum siedet Butan höher als Methan.
              Je stärker die Kräfte, desto höher der Siedepunkt.
            </p>
          </div>
        )}
      </div>

      <div className="w-full xl:w-[340px] shrink-0 card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setLaufen(l => !l)}
            className="px-2 py-1 rounded-lg border border-line text-xs text-muted hover:text-fg">
            {laufen ? "⏸ anhalten" : "▶ weiter"}
          </button>
          <Schalter an={striche} setze={setStriche}>✏️ Valenzstriche</Schalter>
          <Schalter an={polar} setze={setPolar}>δ Teilladungen</Schalter>
          <Schalter an={zwischen} setze={setZwischen}>🔗 Kräfte zwischen Molekülen</Schalter>
          <button onClick={schuetteln} className="px-2 py-1 rounded-lg border border-line text-xs text-muted hover:text-fg">
            🫨 schütteln
          </button>
          <button onClick={() => lege([])} className="px-2 py-1 rounded-lg text-xs text-muted hover:text-fg">
            alles leeren
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          🌡️ Wärmebewegung
          <input type="range" min={0} max={1} step={0.05} value={waerme} onChange={e => setWaerme(Number(e.target.value))}
            className="flex-1 accent-accent" aria-label="Wärmebewegung" />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Vergleichen (Teilladungen und Kräfte gehen an)</span>
          <div className="flex flex-wrap gap-1">
            {VERGLEICHE.map(v => (
              <button key={v.label} onClick={() => vergleiche(v)}
                className="px-2 py-0.5 rounded-lg border border-line text-xs text-muted hover:text-fg hover:border-accent">
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {(["Anorganisch", "Organisch"] as const).map(gruppe => (
          <div key={gruppe} className="flex flex-col gap-1">
            <span className="text-xs text-muted flex items-center gap-2">
              Molekül einsetzen — {gruppe.toLowerCase()}
              {gruppe === "Anorganisch" && (
                <span className="ml-auto inline-flex gap-0.5">
                  {[1, 3, 6].map(n => (
                    <button key={n} onClick={() => setAnzahl(n)}
                      className={`px-1.5 rounded border text-[11px] ${anzahl === n ? "border-accent bg-accent/15 font-bold" : "border-line"}`}>
                      ×{n}
                    </button>
                  ))}
                </span>
              )}
            </span>
            <div className="flex flex-wrap gap-1">
              {MOLEKUELE.filter(m => m.gruppe === gruppe).map(m => (
                <button key={m.label} disabled={voll} title={`${m.name}, Sdp. ${m.sdp} °C`}
                  onClick={() => setzeEin(m, anzahl)}
                  className="px-2 py-0.5 rounded-lg border border-line text-xs hover:border-accent disabled:opacity-30">
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Einzelnes Atom dazulegen</span>
          <div className="flex flex-wrap gap-1">
            {LABOR_ATOME.map(s => (
              <button key={s} disabled={voll}
                onClick={() => {
                  const p = freierPlatz(lab.current);
                  fuegeHinzu(lab.current, s, p.x, p.y);
                  auffrischen();
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
          {gruppen.length === 0 && einzeln.length === 0 && <span className="text-xs text-muted">Noch leer.</span>}
          {gruppen.map(({ m, n, offen }) => {
            const v = nachFormel.get(m.formel);
            return (
              <div key={m.formel + offen} className={`rounded-lg px-3 py-1.5 text-xs ${offen ? "bg-accent/10" : "bg-ok/10"}`}>
                <strong className="text-sm">{n > 1 ? `${n} × ` : ""}{m.gesetzt}</strong>
                {(v?.name ?? m.name) && <span className="text-muted"> · {v?.name ?? m.name}</span>}
                {!offen && v && <span className="text-muted"> · Sdp. {v.sdp.toLocaleString("de-DE")} °C</span>}
                <span className="block">
                  {!offen
                    ? "Alle Atome haben ihr Oktett (H: Duett)."
                    : m.offen.map(o => `${o.symbol}: ${o.zahl} von ${o.ziel}`).join(", ")}
                </span>
              </div>
            );
          })}
          {einzeln.length > 0 && (
            <span className="text-xs text-muted">
              Einzeln: {einzeln.map(m => m.gesetzt).join(", ")}
            </span>
          )}
        </div>

        <p className="text-xs text-muted">
          Die Zahl unter dem Symbol zählt die eigenen Außenelektronen plus je eins vom Partner pro Bindung —
          ein bindendes Paar gehört beiden. {polar
            ? "δ+ und δ− entstehen, wo die Elektronegativität der Partner um mindestens 0,5 verschieden ist: das Paar rückt zum stärker ziehenden Atom."
            : "Gepaarte Elektronen (freie Paare) binden nicht; sie weichen den Bindungen nur aus."}
        </p>
      </div>
    </div>
  );
}
