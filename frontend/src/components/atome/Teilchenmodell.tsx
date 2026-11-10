"use client";
/**
 * Das Teilchenmodell zum Anfassen: Temperatur einstellen und zusehen, wie die
 * Teilchen schwingen, fließen oder fliegen — für einen Stoff, zwei Stoffe im
 * Gemisch oder eine Reaktion. Die Rechnung steht in `lib/atome/teilchen.ts`,
 * die Stoffdaten in `lib/atome/stoffe.ts`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { element } from "@/lib/elemente";
import { GRUPPEN, kugelFarbe, mischText, phaseVon, stoff, STOFFE, type Phase, type Stoff } from "@/lib/atome/stoffe";
import {
  atomZahl, BREITE, einzelSzene, HOEHE, mischSzene, REAKTIONEN, reaktionsSzene, schritt, stoffZahl, TRENNUNGEN,
  phasenZahl, stoffTemperatur, trennSzene, verteilung, waermeZufuehren, zuende, zuendStelle, type Szene,
  DIFFUSIONEN, diffusionsSzene, druckHpa, pegel, profil,
} from "@/lib/atome/teilchen";

type Modus = "zustand" | "mischen" | "trennen" | "diffusion" | "reaktion";
const PLATTE = 26;
const AUSWAHL = STOFFE.filter(s => !s.nurReaktion);

/** Der Regler läuft nicht linear: um 0 °C fein, bei Tausenden grob. */
const TMIN = -273.15, TMAX = 4000;
const f = (T: number) => Math.asinh(T / 60);
const zuRegler = (T: number) => (f(T) - f(TMIN)) / (f(TMAX) - f(TMIN));
const vonRegler = (u: number) => {
  const T = 60 * Math.sinh(f(TMIN) + u * (f(TMAX) - f(TMIN)));
  return Math.abs(T) < 10 ? Math.round(T) : Math.abs(T) < 300 ? Math.round(T / 5) * 5 : Math.round(T / 10) * 10;
};

// Kohlenstoff ist im CPK-Schema fast schwarz — auf dunklem Grund unsichtbar.
const FARBE_SONST: Record<string, string> = { W: "#2194d6", Ga: "#c28f8f", Ti: "#bfc2c7", C: "#7c7c7c" };
const atomFarbe = (s: string) => FARBE_SONST[s] ?? element(s)?.color ?? "#999";

const PHASEN: Record<Phase, { farbe: string; label: string; text: string }> = {
  fest: { farbe: "#60a5fa", label: "fest", text: "Die Teilchen sitzen dicht an festen Plätzen und schwingen nur hin und her — je wärmer, desto heftiger. Feste Form, festes Volumen." },
  "flüssig": { farbe: "#2dd4bf", label: "flüssig", text: "Die Teilchen liegen noch dicht, halten aber keinen Platz mehr: sie rollen aneinander vorbei. Festes Volumen, aber keine feste Form." },
  "gasförmig": { farbe: "#fb923c", label: "gasförmig", text: "Die Teilchen sind weit auseinander und fliegen schnell geradeaus, bis sie anstoßen. Ein Gas füllt jeden Raum." },
  zersetzt: { farbe: "#a16207", label: "zersetzt sich", text: "Hier gehen die Teilchen selbst kaputt — das ist kein Zustandswechsel mehr, sondern schon eine chemische Reaktion." },
};

const MISCHUNGEN: { label: string; a: string; b: string; T: number }[] = [
  { label: "Wasser + Öl", a: "h2o", b: "oel", T: 20 },
  { label: "Wasser + Ethanol", a: "h2o", b: "ethanol", T: 20 },
  { label: "Salz in Wasser", a: "nacl", b: "h2o", T: 20 },
  { label: "Zucker in Wasser", a: "zucker", b: "h2o", T: 60 },
  { label: "Sand + Wasser", a: "sio2", b: "h2o", T: 20 },
  { label: "Iod in Benzin", a: "i2", b: "hexan", T: 20 },
  { label: "Luft (N₂ + O₂)", a: "n2", b: "o2", T: 20 },
  { label: "Brom verdunstet", a: "br2", b: "n2", T: 40 },
  { label: "Messing (Cu + Zn)", a: "cu", b: "zn", T: 1100 },
  { label: "Wachs + Wasser", a: "paraffin", b: "h2o", T: 70 },
];

const SCHNELL_T: [string, number][] = [
  ["❄️ −196 °C", -196], ["🧊 0 °C", 0], ["🏠 20 °C", 20], ["♨️ 100 °C", 100], ["🔥 1000 °C", 1000],
];

function themaFarben(el: HTMLElement) {
  const s = getComputedStyle(el);
  const v = (n: string, d: string) => s.getPropertyValue(n).trim() || d;
  return { text: v("--text", "#eee"), muted: v("--text-muted", "#999"), line: v("--border", "#555") };
}

/** Phasenleiste: Temperaturachse mit fest/flüssig/gasförmig für einen Stoff — anklickbar. */
function Leiste({ s, T, setT, ist, zahl }: {
  s: Stoff; T: number; setT: (T: number) => void;
  /** Mittlere Temperatur der Teilchen — hängt beim Schmelzen und Sieden am Haltepunkt. */
  ist: number | null;
  zahl: { fest: number; fluessig: number; gas: number };
}) {
  const W = 300;
  const x = (t: number) => zuRegler(t) * W;
  const grenzen: [number, number, Phase][] = [];
  const schmelz = s.schmelz ?? TMIN, ende = s.zersetzt ?? TMAX;
  if (s.schmelz !== null || (s.siede === null && s.zersetzt !== undefined)) grenzen.push([TMIN, s.schmelz ?? ende, "fest"]);
  if (s.schmelz !== s.siede && !(s.schmelz === null && s.siede === null)) grenzen.push([schmelz, Math.min(s.siede ?? ende, ende), "flüssig"]);
  if (s.siede !== null && s.siede < ende) grenzen.push([s.siede, ende, "gasförmig"]);
  if (s.zersetzt !== undefined) grenzen.push([s.zersetzt, TMAX, "zersetzt"]);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-xs"><strong>{s.name}</strong>
        <span className="text-muted"> · Smp. {s.schmelz ?? "—"} °C · Sdp. {s.siede ?? (s.zersetzt !== undefined ? `zersetzt ab ${s.zersetzt}` : "—")} °C</span>
      </div>
      <svg viewBox={`0 0 ${W} 18`} className="w-full h-5 cursor-pointer" role="img"
        aria-label={`Zustände von ${s.name} über der Temperatur`}
        onClick={ev => {
          const r = (ev.currentTarget as SVGSVGElement).getBoundingClientRect();
          setT(vonRegler((ev.clientX - r.left) / r.width));
        }}>
        {grenzen.map(([a, b, ph]) => (
          <rect key={ph} x={x(a)} y={3} width={Math.max(0, x(b) - x(a))} height={12} fill={PHASEN[ph].farbe} opacity={0.7} />
        ))}
        <rect x={x(T) - 1.5} y={0} width={3} height={18} fill="currentColor" />
        {ist !== null && <circle cx={x(ist)} cy={9} r={4} fill="#ef4444" stroke="white" strokeWidth={1.2} />}
      </svg>
      {ist !== null && (
        <div className="text-[11px] text-muted tabular-nums">
          <span className="text-[#ef4444]">●</span> im Stoff {Math.round(ist).toLocaleString("de-DE")} °C
          {" · "}fest {zahl.fest} · flüssig {zahl.fluessig} · gasförmig {zahl.gas}
        </div>
      )}
    </div>
  );
}

function Stoffwahl({ wert, setze }: { wert: string; setze: (id: string) => void }) {
  return (
    <select value={wert} onChange={e => setze(e.target.value)}
      className="px-2 py-1 rounded-lg border border-line bg-surface text-sm">
      {GRUPPEN.map(g => (
        <optgroup key={g} label={g}>
          {AUSWAHL.filter(x => x.gruppe === g).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export default function Teilchenmodell() {
  const [modus, setModus] = useState<Modus>("zustand");
  const [a, setA] = useState("h2o");
  const [b, setB] = useState("oel");
  const [rid, setRid] = useState("knallgas");
  const [tid, setTid] = useState("wein");
  const [did, setDid] = useState("tinte");
  // Konzentrationskarte: wie viel vom markierten Stoff in jedem Feld ist.
  const [konz, setKonz] = useState(false);
  const [T, setT] = useState(20);
  const [laufen, setLaufen] = useState(true);
  const [pfeile, setPfeile] = useState(false);
  // »Kugeln«: das Teilchenmodell der Schule — ein Stoff, eine Kugelsorte. Sonst Moleküle aus Atomen.
  const [kugeln, setKugeln] = useState(false);
  const [zeitlupe, setZeitlupe] = useState(1);
  const [, setTakt] = useState(0);
  const leinwand = useRef<HTMLCanvasElement>(null);
  const sz = useRef<Szene | null>(null);
  const start = useRef<Record<string, number>>({});
  // Erwärmte Teilchen einfärben, damit man die Konvektion sieht.
  const [waerme, setWaerme] = useState(false);
  // Gedrückt halten ins Gefäß: dort Wärme zuführen oder entziehen.
  const [werkzeug, setWerkzeug] = useState<"heiss" | "kalt">("heiss");
  const druck = useRef<{ x: number; y: number } | null>(null);
  // Welcher Stoff in der Konzentrationskarte zählt: der zweite (gelöst bzw. wandernd).
  const markiert = modus === "diffusion" || modus === "mischen" ? 1 : modus === "trennen" ? -2 : -1;
  const opt = useRef({ laufen, pfeile, zeitlupe, kugeln, waerme, werkzeug, konz, markiert });
  opt.current = { laufen, pfeile, zeitlupe, kugeln, waerme, werkzeug, konz, markiert };

  const reaktion = REAKTIONEN.find(r => r.id === rid)!;
  const trennung = TRENNUNGEN.find(t => t.id === tid)!;
  const diffusion = DIFFUSIONEN.find(d => d.id === did)!;

  // Neue Szene, wenn sich Stoff, Gemisch oder Reaktion ändert — nicht bei der Temperatur.
  const Tjetzt = useRef(T);
  Tjetzt.current = T;
  const neu = () => {
    const T0 = Tjetzt.current;
    sz.current = modus === "zustand" ? einzelSzene(a, T0)
      : modus === "mischen" ? mischSzene(a, b, T0)
      : modus === "trennen" ? trennSzene(trennung, T0)
      : modus === "diffusion" ? diffusionsSzene(diffusion, T0)
      : reaktionsSzene(reaktion, T0);
    start.current = atomZahl(sz.current);
    setTakt(t => t + 1);
  };
  useEffect(neu, [modus, a, b, rid, tid, did]);
  useEffect(() => { if (sz.current) sz.current.T = T; }, [T]);

  useEffect(() => {
    const c = leinwand.current!;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let farben = themaFarben(c);
    let id = 0, zuletzt = performance.now(), takt = 0, flacker = 0;
    const blitze: { x: number; y: number; t: number; w: number }[] = [];
    const H2 = HOEHE + PLATTE;
    const bild = (jetzt: number) => {
      const dt = Math.min(0.05, (jetzt - zuletzt) / 1000);
      zuletzt = jetzt;
      const s = sz.current;
      if (!s) { id = requestAnimationFrame(bild); return; }
      if (druck.current) {
        waermeZufuehren(s, druck.current.x, druck.current.y, (opt.current.werkzeug === "heiss" ? 1500 : -900) * dt);
      }
      if (opt.current.laufen) {
        const schritte = Math.max(1, Math.min(4, Math.round(dt * opt.current.zeitlupe * 120)));
        for (let i = 0; i < schritte; i++) {
          for (const e of schritt(s, (dt * opt.current.zeitlupe) / schritte)) blitze.push({ x: e.x, y: e.y, t: 0, w: e.waerme });
        }
      }
      takt += dt; flacker += dt;
      if (takt > 0.3) { takt = 0; setTakt(x => x + 1); farben = themaFarben(c); }

      const dpr = window.devicePixelRatio || 1;
      if (c.width !== BREITE * dpr) { c.width = BREITE * dpr; c.height = H2 * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, BREITE, H2);

      // Gefäß, nach Temperatur getönt: kalt bläulich, heiß rötlich.
      const warm = Math.max(-1, Math.min(1, s.T / 1000)), kalt = Math.max(0, Math.min(1, -s.T / 200));
      ctx.fillStyle = s.T >= 0 ? `rgba(255,110,40,${0.04 + 0.16 * warm})` : `rgba(90,160,255,${0.05 + 0.18 * kalt})`;
      ctx.fillRect(0, 0, BREITE, HOEHE);
      // Destillation: rechts die gekühlte Vorlage.
      if (s.kuehler !== null) {
        ctx.fillStyle = "rgba(90,160,255,0.16)";
        ctx.fillRect(BREITE / 2, 0, BREITE / 2, HOEHE);
      }

      // Heizplatte bzw. Kühlung unter dem Gefäß.
      const glut = Math.max(0, Math.min(1, (s.T - 20) / 900));
      ctx.fillStyle = s.T >= 20
        ? `rgb(${80 + 175 * glut},${70 + 40 * glut},${60 - 30 * glut})`
        : `rgb(${120 - 60 * kalt},${150 + 30 * kalt},${200 + 55 * kalt})`;
      ctx.fillRect(0, HOEHE + 4, BREITE, PLATTE - 4);
      if (s.kuehler !== null) {
        // Unter der Vorlage: Kühlung.
        ctx.fillStyle = "rgb(110,160,215)";
        ctx.fillRect(BREITE / 2, HOEHE + 4, BREITE / 2, PLATTE - 4);
        ctx.fillStyle = "#ffffffcc";
        ctx.font = "13px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (let i = 0; i < 6; i++) ctx.fillText("❄", BREITE / 2 + (i + 0.5) * BREITE / 12, HOEHE + PLATTE / 2 + 2);
      }
      if (s.T > 60) {
        // Der Brenner sitzt in der Mitte (bei der Destillation unter dem Kolben)
        // — dort heizt auch die Simulation. Mehr und höhere Flammen je heißer.
        const zahl = Math.min(12, Math.round(3 + glut * 9));
        const von = s.kuehler !== null ? 0.05 : 0.3, breit = 0.4;
        for (let i = 0; i < zahl; i++) {
          const fx = BREITE * von + (i + 0.5) * BREITE * breit / zahl, h = 6 + glut * 12 * (0.7 + 0.3 * Math.sin(flacker * 9 + i * 1.7));
          ctx.beginPath();
          ctx.moveTo(fx - 5, HOEHE + PLATTE);
          ctx.quadraticCurveTo(fx, HOEHE + PLATTE - h * 2, fx + 5, HOEHE + PLATTE);
          ctx.fillStyle = `rgba(255,${150 + 80 * (1 - glut)},40,0.85)`;
          ctx.fill();
        }
      } else if (s.T < 0) {
        ctx.fillStyle = "#ffffffcc";
        ctx.font = "13px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (let i = 0; i < 12; i++) ctx.fillText("❄", (i + 0.5) * BREITE / 12, HOEHE + PLATTE / 2 + 2);
      }
      ctx.strokeStyle = farben.line; ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, BREITE - 2, HOEHE - 1);

      // Heiße (und bei endothermen Reaktionen kalte) Flecken.
      for (const h of s.heiss) {
        const st = 1 - h.t / h.dauer;
        const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
        const farbe = h.dT > 0 ? "255,170,40" : "120,190,255";
        g.addColorStop(0, `rgba(${farbe},${0.55 * st})`);
        g.addColorStop(1, `rgba(${farbe},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
      }

      if (s.wand) {
        ctx.fillStyle = farben.muted;
        ctx.fillRect(BREITE / 2 - 3, s.wandOben, 6, HOEHE - s.wandOben);
      }
      if (s.kuehler !== null) {
        ctx.fillStyle = farben.muted; ctx.font = "14px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText("Kolben (geheizt)", BREITE / 4, s.wandOben + 6);
        ctx.fillText(`Vorlage (gekühlt, ${s.kuehler} °C)`, BREITE * 0.75, s.wandOben + 6);
      }
      if (s.membran) {
        // Membran: Poren, durch die nur das Lösemittel passt.
        ctx.save();
        ctx.strokeStyle = "#a3a3a3"; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(s.membran.x, 0); ctx.lineTo(s.membran.x, HOEHE); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = farben.muted; ctx.font = "14px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText("Membran", s.membran.x, 6);
      }
      // Konzentrationskarte: Anteil des markierten Stoffs je Feld (bei der
      // Trennung: der gelösten Teilchen).
      if (opt.current.konz && opt.current.markiert !== -1) {
        const F = 50, nx = Math.ceil(BREITE / F), ny = Math.ceil(HOEHE / F);
        const alle = new Int32Array(nx * ny), davon = new Int32Array(nx * ny);
        for (const p of s.t) {
          const k = Math.min(ny - 1, Math.floor(p.y / F)) * nx + Math.min(nx - 1, Math.floor(p.x / F));
          alle[k]++;
          if (opt.current.markiert === -2 ? p.geloest : p.s === opt.current.markiert) davon[k]++;
        }
        const farbe = opt.current.markiert >= 0 && s.stoffe[opt.current.markiert] ? kugelFarbe(s.stoffe[opt.current.markiert]) : "#a855f7";
        for (let k = 0; k < alle.length; k++) {
          if (!alle[k] || !davon[k]) continue;
          ctx.globalAlpha = Math.min(0.75, 0.15 + 0.8 * davon[k] / alle[k]);
          ctx.fillStyle = farbe;
          ctx.fillRect((k % nx) * F, Math.floor(k / nx) * F, F, F);
        }
        ctx.globalAlpha = 1;
      }
      if (s.filter !== null) {
        // Filterpapier: gestrichelt — die Lücken sind die Poren.
        ctx.save();
        ctx.strokeStyle = "#d6cfa8"; ctx.lineWidth = 4; ctx.setLineDash([10, 4]);
        ctx.beginPath(); ctx.moveTo(0, s.filter); ctx.lineTo(BREITE, s.filter); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = farben.muted; ctx.font = "14px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillText("Filter", 8, s.filter + 6);
        ctx.textBaseline = "bottom";
        ctx.fillText("Filtrat", 8, HOEHE - 4);
      }

      // Die Teilchen; mit »Wärme zeigen« nach ihrer eigenen Temperatur gefärbt:
      // wärmer als das Gefäß rot, kälter blau.
      const glueh = (p: { x: number; y: number; temp: number }, r: number) => {
        if (!opt.current.waerme) return;
        const d = p.temp - s.T;
        const staerke = d > 0 ? Math.min(0.8, d / 250) : Math.min(0.8, -d / 120);
        if (staerke < 0.05) return;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = d > 0 ? `rgba(255,60,0,${staerke})` : `rgba(40,120,255,${staerke})`;
        ctx.fill();
      };
      for (const p of s.t) {
        const st = s.stoffe[p.s], form = st.formen[p.form];
        if (opt.current.pfeile) {
          ctx.strokeStyle = farben.muted; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.08, p.y - p.vy * 0.08); ctx.stroke();
        }
        const verkohlt = st.schmelz !== null && phaseVon(st, s.T) === "zersetzt";
        if (opt.current.kugeln) {
          // Eine Kugel je Teilchen, Farbe und Größe nach Stoff, mit etwas Glanz.
          const g = ctx.createRadialGradient(p.x - st.r * 0.35, p.y - st.r * 0.35, st.r * 0.1, p.x, p.y, st.r);
          g.addColorStop(0, "#ffffffcc");
          g.addColorStop(0.35, verkohlt ? "#5b3a1a" : kugelFarbe(st));
          g.addColorStop(1, verkohlt ? "#2a1a0a" : kugelFarbe(st));
          ctx.beginPath();
          ctx.arc(p.x, p.y, st.r * 0.95, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
          ctx.strokeStyle = "#0008"; ctx.lineWidth = 0.8;
          ctx.stroke();
          glueh(p, st.r * 0.95);
          continue;
        }
        const cos = Math.cos(p.phi), sin = Math.sin(p.phi);
        for (const [sym, dx, dy, g] of form.atome) {
          const x = p.x + (dx * cos - dy * sin) * st.r, y = p.y + (dx * sin + dy * cos) * st.r;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1.5, g * st.r * (form.atome.length > 1 ? 1 : 0.95)), 0, Math.PI * 2);
          ctx.fillStyle = verkohlt ? "#5b3a1a" : atomFarbe(sym);
          ctx.fill();
          ctx.strokeStyle = "#0009"; ctx.lineWidth = 0.8;
          ctx.stroke();
        }
        if (form.ladung) {
          ctx.fillStyle = "#000"; ctx.font = "bold 8px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(form.ladung, p.x, p.y + 0.5);
        }
        glueh(p, st.r * 0.8);
      }

      for (let i = blitze.length - 1; i >= 0; i--) {
        const bl = blitze[i];
        bl.t += dt;
        if (bl.t > 0.4) { blitze.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(bl.x, bl.y, 4 + bl.t * 70, 0, Math.PI * 2);
        ctx.strokeStyle = bl.w >= 0 ? `rgba(255,230,120,${1 - bl.t / 0.4})` : `rgba(140,200,255,${1 - bl.t / 0.4})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      id = requestAnimationFrame(bild);
    };
    id = requestAnimationFrame(bild);
    return () => cancelAnimationFrame(id);
  }, []);

  const lage = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * BREITE / r.width, y: (ev.clientY - r.top) * (HOEHE + PLATTE) / r.height };
  };
  const runter = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    if (!sz.current) return;
    const p = lage(ev);
    if (modus === "reaktion") { zuende(sz.current, p.x, p.y); return; }
    ev.currentTarget.setPointerCapture(ev.pointerId);
    druck.current = p;
    setWaerme(true);
  };
  const ziehe = (ev: React.PointerEvent<HTMLCanvasElement>) => { if (druck.current) druck.current = lage(ev); };
  const los = () => { druck.current = null; };
  const ruehren = () => {
    for (const p of sz.current?.t ?? []) if (p.bewegung !== "gitter") { p.vx += (Math.random() - 0.5) * 500; p.vy -= Math.random() * 250; }
  };

  const s = sz.current;
  const zahl = s ? stoffZahl(s) : [];
  const atome = s ? atomZahl(s) : {};
  const sichtbar = s ? s.stoffe : [];
  const zustandsText = useMemo(() => PHASEN[phaseVon(stoff(a), T)], [a, T]);

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex self-start rounded-xl border border-line p-1 bg-surface">
        {([["zustand", "🧊 Aggregatzustände"], ["mischen", "🥤 Mischen"], ["trennen", "⚗️ Trennen"], ["diffusion", "🧫 Diffusion & Osmose"], ["reaktion", "💥 Reaktion"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => {
            setModus(id);
            if (id === "mischen" && a === b) setB(a === "h2o" ? "oel" : "h2o");
          }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${modus === id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="w-full lg:flex-1 min-w-0 flex flex-col gap-2">
          <canvas ref={leinwand} aria-label="Teilchenmodell"
            onPointerDown={runter} onPointerMove={ziehe} onPointerUp={los} onPointerCancel={los}
            style={{ aspectRatio: `${BREITE} / ${HOEHE + PLATTE}` }}
            className="w-full rounded-xl bg-black/10 dark:bg-white/5 cursor-crosshair" />
          {modus !== "reaktion" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted">Ins Gefäß drücken und halten:</span>
              {([["heiss", "🔥 erhitzen"], ["kalt", "❄ kühlen"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setWerkzeug(id)}
                  className={`px-2 py-0.5 rounded-lg border ${werkzeug === id ? "border-accent bg-accent/15 font-bold" : "border-line text-muted hover:text-fg"}`}>
                  {label}
                </button>
              ))}
              <span className="text-muted">— die Wärme wandert dann von Teilchen zu Teilchen.</span>
            </div>
          )}

          {/* Temperatur */}
          <div className="card p-3 flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl font-black tabular-nums w-28">{T.toLocaleString("de-DE")} °C</span>
              <span className="text-xs text-muted tabular-nums">{Math.round(T + 273.15).toLocaleString("de-DE")} K</span>
              <input type="range" min={0} max={1000} value={Math.round(zuRegler(T) * 1000)} aria-label="Temperatur"
                onChange={e => setT(vonRegler(Number(e.target.value) / 1000))}
                className="flex-1 min-w-40 accent-accent" />
            </div>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setT(t => Math.max(TMIN, t - 10))} className="px-2 py-0.5 rounded-lg border border-line text-xs">−10</button>
              <button onClick={() => setT(t => Math.min(TMAX, t + 10))} className="px-2 py-0.5 rounded-lg border border-line text-xs">+10</button>
              {SCHNELL_T.map(([l, t]) => (
                <button key={l} onClick={() => setT(t)} className="px-2 py-0.5 rounded-lg border border-line text-xs text-muted hover:text-fg">{l}</button>
              ))}
              <button onClick={() => setT(-273)} className="px-2 py-0.5 rounded-lg border border-line text-xs text-muted hover:text-fg">absoluter Nullpunkt</button>
            </div>
            {s?.stoffe.map((x, k) => ({ x, k })).filter(({ x }) => !x.nurReaktion || modus === "reaktion").map(({ x, k }) => (
              <Leiste key={x.id} s={x} T={T} setT={setT} ist={stoffTemperatur(s, k)} zahl={phasenZahl(s, k)} />
            ))}
            <div className="flex gap-3 text-[11px] text-muted flex-wrap">
              {(Object.keys(PHASEN) as Phase[]).map(p => (
                <span key={p} className="inline-flex items-center gap-1">
                  <span className="w-3 h-2 rounded-sm" style={{ background: PHASEN[p].farbe }} />{PHASEN[p].label}
                </span>
              ))}
              <span>· Leiste anklicken setzt die Temperatur</span>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[340px] shrink-0 card p-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setLaufen(l => !l)} className="px-2 py-1 rounded-lg border border-line text-xs text-muted hover:text-fg">
              {laufen ? "⏸ anhalten" : "▶ weiter"}
            </button>
            <button onClick={() => setPfeile(p => !p)}
              className={`px-2 py-1 rounded-lg border text-xs ${pfeile ? "border-accent bg-accent/15 font-bold" : "border-line text-muted hover:text-fg"}`}>
              ➶ Geschwindigkeit
            </button>
            <button onClick={() => setWaerme(w => !w)}
              title="Jedes Teilchen in seiner Temperatur: wärmer als das Gefäß rot, kälter blau"
              className={`px-2 py-1 rounded-lg border text-xs ${waerme ? "border-accent bg-accent/15 font-bold" : "border-line text-muted hover:text-fg"}`}>
              🌡 Wärme zeigen
            </button>
            {markiert !== -1 && (
              <button onClick={() => setKonz(k => !k)}
                title="Färbt das Gefäß feldweise nach dem Anteil des gelösten bzw. wandernden Stoffs — so sieht man das Konzentrationsgefälle"
                className={`px-2 py-1 rounded-lg border text-xs ${konz ? "border-accent bg-accent/15 font-bold" : "border-line text-muted hover:text-fg"}`}>
                📊 Konzentration
              </button>
            )}
            <button onClick={neu} className="px-2 py-1 rounded-lg border border-line text-xs text-muted hover:text-fg">↺ neu</button>
            <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Darstellung der Teilchen">
              {([[true, "⚪ Kugeln"], [false, "⚛️ Atome"]] as const).map(([k, label]) => (
                <button key={label} onClick={() => setKugeln(k)}
                  className={`px-2 py-0.5 rounded-md text-xs ${kugeln === k ? "bg-accent text-accent-fg font-bold" : "text-muted hover:text-fg"}`}>
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1 text-xs text-muted">
              Tempo
              <input type="range" min={0.1} max={1.5} step={0.1} value={zeitlupe} onChange={e => setZeitlupe(Number(e.target.value))}
                className="w-20 accent-accent" aria-label="Tempo" />
            </label>
          </div>

          <p className="text-[11px] text-muted -mt-1">
            {kugeln
              ? "Teilchenmodell: jeder Stoff besteht aus einer Sorte Kugeln — gleich innerhalb eines Stoffs, verschieden in Farbe und Größe zwischen Stoffen. Wie ein Teilchen gebaut ist, sagt das Modell nicht."
              : "Atomdarstellung: jedes Teilchen zeigt seine Atome (Kugelfarben nach CPK) — Ionenverbindungen als abwechselnde Ionen."}
          </p>
          {modus === "zustand" && (
            <>
              {GRUPPEN.map(g => (
                <div key={g} className="flex flex-col gap-1">
                  <span className="text-xs text-muted">{g}</span>
                  <div className="flex flex-wrap gap-1">
                    {AUSWAHL.filter(x => x.gruppe === g).map(x => (
                      <button key={x.id} onClick={() => setA(x.id)} title={x.name}
                        className={`px-2 py-0.5 rounded-lg border text-xs ${a === x.id ? "border-accent bg-accent/15 font-bold" : "border-line text-muted hover:text-fg"}`}>
                        {x.name.replace(/ \(.*\)/, "")}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="rounded-lg px-3 py-2 text-xs" style={{ background: `${zustandsText.farbe}22` }}>
                <strong>{stoff(a).name} ist bei {T.toLocaleString("de-DE")} °C {zustandsText.label}.</strong> {zustandsText.text}
              </div>
              {stoff(a).hinweis && <p className="text-xs text-muted">{stoff(a).hinweis}</p>}
              <div className="flex gap-1 flex-wrap">
                {stoff(a).schmelz !== null && (
                  <button onClick={() => setT(stoff(a).schmelz!)} className="px-2 py-0.5 rounded-lg border border-line text-xs">
                    zum Schmelzpunkt ({stoff(a).schmelz} °C)
                  </button>
                )}
                {stoff(a).siede !== null && stoff(a).siede !== stoff(a).schmelz && (
                  <button onClick={() => setT(stoff(a).siede!)} className="px-2 py-0.5 rounded-lg border border-line text-xs">
                    zum Siedepunkt ({stoff(a).siede} °C)
                  </button>
                )}
              </div>
            </>
          )}

          {modus === "mischen" && (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted">Links</span>
                <Stoffwahl wert={a} setze={setA} />
                <span className="text-xs text-muted">Rechts</span>
                <Stoffwahl wert={b} setze={setB} />
              </div>
              <div className="flex flex-wrap gap-1">
                {MISCHUNGEN.map(m => (
                  <button key={m.label} onClick={() => { setT(m.T); setA(m.a); setB(m.b); }}
                    className={`px-2 py-0.5 rounded-lg border text-xs ${a === m.a && b === m.b ? "border-accent bg-accent/15 font-bold" : "border-line text-muted hover:text-fg"}`}>
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <button onClick={() => { if (sz.current) sz.current.wand = !sz.current.wand; setTakt(t => t + 1); }}
                  className="px-3 py-1 rounded-lg bg-accent text-accent-fg text-xs font-bold">
                  {s?.wand ? "Trennwand herausziehen" : "Trennwand einsetzen"}
                </button>
                <button onClick={ruehren} className="px-2 py-1 rounded-lg border border-line text-xs">🥄 umrühren</button>
              </div>
              <p className="text-xs rounded-lg bg-accent/10 px-3 py-2">{mischText(stoff(a), stoff(b), T)}</p>
              {s && s.stoffe.some(x => x.loeslichIn) && (
                <p className="text-xs text-muted">
                  Gelöst: {s.t.filter(p => p.geloest).length} Teilchen. Beim Verdampfen des Lösemittels bleibt der
                  gelöste Stoff zurück und kristallisiert wieder.
                </p>
              )}
            </>
          )}

          {s && s.t.some(p => p.bewegung === "gas") && (
            <div className="text-xs rounded-lg border border-line px-3 py-1.5 flex items-baseline justify-between gap-2"
              title="Aus Zahl und Geschwindigkeit der Gasteilchen (kinetische Gastheorie): mehr Teilchen oder wärmer heißt mehr Druck">
              <span className="text-muted">Gasdruck im Gefäß</span>
              <strong className="tabular-nums">≈ {Math.round(druckHpa(s)).toLocaleString("de-DE")} hPa</strong>
            </div>
          )}

          {/* Die Szene wird erst im Effekt gebaut — bis dahin kann noch die alte mit einem Stoff da sein. */}
          {modus === "diffusion" && s && s.stoffe.length > 1 && (
            <>
              <div className="flex flex-wrap gap-1">
                {DIFFUSIONEN.map(d => (
                  <button key={d.id} onClick={() => { setT(d.T); setDid(d.id); setKonz(true); }}
                    className={`px-2 py-0.5 rounded-lg border text-xs ${did === d.id ? "border-accent bg-accent/15 font-bold" : "border-line text-muted hover:text-fg"}`}>
                    {d.titel}
                  </button>
                ))}
              </div>
              <p className="text-xs">{diffusion.text}</p>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted">
                  Konzentrationsprofil: Anteil {s.stoffe[1].name.replace(/ \(.*\)/, "")} von links nach rechts
                </span>
                <svg viewBox="0 0 200 50" className="w-full h-14 rounded bg-black/5 dark:bg-white/5" role="img" aria-label="Konzentrationsprofil">
                  {profil(s, 1).map((c, k) => (
                    <rect key={k} x={k * 10 + 1} y={50 - Math.min(1, c * 2) * 48} width={8} height={Math.min(1, c * 2) * 48}
                      fill={kugelFarbe(s.stoffe[1])} />
                  ))}
                  {s.membran && <line x1={100} y1={0} x2={100} y2={50} stroke="#a3a3a3" strokeDasharray="3 3" />}
                </svg>
              </div>
              {s.membran && (() => {
                const [l, r] = pegel(s);
                return (
                  <p className="text-xs">
                    Pegel links <strong className="tabular-nums">{Math.round(l)}</strong> · rechts{" "}
                    <strong className="tabular-nums">{Math.round(r)}</strong> · Unterschied{" "}
                    <strong className="tabular-nums">{Math.round(r - l)}</strong> (Bildpunkte)
                  </p>
                );
              })()}
              <p className="text-[11px] text-muted">Mit dem Temperaturregler vergleichen: warm geht alles schneller.</p>
            </>
          )}

          {modus === "trennen" && s && (
            <>
              {(["destillation", "filtration"] as const).map(art => (
                <div key={art} className="flex flex-col gap-1">
                  <span className="text-xs text-muted">{art === "destillation" ? "Destillation — nach Siedetemperatur" : "Filtration — nach fest und flüssig"}</span>
                  <div className="flex flex-wrap gap-1">
                    {TRENNUNGEN.filter(t => t.art === art).map(t => (
                      <button key={t.id} onClick={() => { setT(20); setTid(t.id); }}
                        className={`px-2 py-0.5 rounded-lg border text-xs ${tid === t.id ? "border-accent bg-accent/15 font-bold" : "border-line text-muted hover:text-fg"}`}>
                        {t.titel}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs">{trennung.text}</p>
              {trennung.art === "destillation" && (
                <button onClick={() => setT(trennung.ziel)} className="self-start px-3 py-1 rounded-lg bg-accent text-accent-fg text-xs font-bold">
                  🔥 Kolben auf {trennung.ziel} °C heizen
                </button>
              )}
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-muted">
                    <th className="text-left font-normal">Stoff</th>
                    <th className="text-right font-normal">{trennung.art === "destillation" ? "Kolben" : "über dem Filter"}</th>
                    <th className="text-right font-normal">{trennung.art === "destillation" ? "Vorlage" : "Filtrat"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const [a1, b1] = verteilung(s);
                    return s.stoffe.map((x, k) => (
                      <tr key={x.id} className="border-b border-line/50">
                        <td className="py-0.5">
                          <span className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle" style={{ background: kugelFarbe(x) }} />
                          {x.name}{trennung.geloest?.includes(x.id) ? " (gelöst)" : ""}
                        </td>
                        <td className="text-right tabular-nums">{a1[k]}</td>
                        <td className="text-right tabular-nums font-bold">{b1[k]}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </>
          )}

          {modus === "reaktion" && (
            <>
              <div className="flex flex-wrap gap-1">
                {REAKTIONEN.map(r => (
                  <button key={r.id} onClick={() => setRid(r.id)}
                    className={`px-2 py-0.5 rounded-lg border text-xs ${rid === r.id ? "border-accent bg-accent/15 font-bold" : "border-line text-muted hover:text-fg"}`}>
                    {r.titel}
                  </button>
                ))}
              </div>
              <div className="text-base font-bold">{reaktion.gleichung}</div>
              <p className="text-xs">{reaktion.text}</p>
              <p className="text-xs text-muted">
                Läuft ab {reaktion.start} °C{reaktion.rueckAb !== undefined ? `, zerfällt wieder über ${reaktion.rueckAb} °C` : ""}.
                {reaktion.waerme > 0 ? " Exotherm: jede Reaktion gibt Wärme ab." : " Endotherm: die Reaktion braucht Wärme."}
              </p>
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => { if (sz.current) { const p = zuendStelle(sz.current); zuende(sz.current, p.x, p.y); } }}
                  className="px-3 py-1 rounded-lg bg-accent text-accent-fg text-xs font-bold">🔥 Funke</button>
                {reaktion.getrennt && (
                  <button onClick={() => { if (sz.current) sz.current.wand = !sz.current.wand; setTakt(t => t + 1); }}
                    className="px-2 py-1 rounded-lg border border-line text-xs">
                    {s?.wand ? "Trennwand herausziehen" : "Trennwand einsetzen"}
                  </button>
                )}
                <button onClick={() => setT(reaktion.start + 20)} className="px-2 py-1 rounded-lg border border-line text-xs">
                  auf {reaktion.start + 20} °C heizen
                </button>
              </div>
              <span className="text-[11px] text-muted">Klick ins Gefäß zündet dort.</span>

              <table className="text-xs w-full">
                <tbody>
                  {sichtbar.map((x, k) => (
                    <tr key={x.id} className="border-b border-line/50">
                      <td className="py-0.5">{x.name}</td>
                      <td className="text-right tabular-nums font-bold">{zahl[k]}</td>
                    </tr>
                  ))}
                  <tr><td className="py-0.5 text-muted">Reaktionen</td><td className="text-right tabular-nums">{s?.umsatz ?? 0}{s?.rueck ? ` (−${s.rueck})` : ""}</td></tr>
                </tbody>
              </table>
              <div className="text-xs">
                <span className="text-muted">Atome — am Anfang / jetzt:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.keys(start.current).map(sym => (
                    <span key={sym} className={`px-1.5 py-0.5 rounded ${atome[sym] === start.current[sym] ? "bg-ok/15" : "bg-bad/15"}`}>
                      <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: atomFarbe(sym) }} />
                      {sym}: {start.current[sym]} / {atome[sym] ?? 0}
                    </span>
                  ))}
                </div>
                <p className="text-muted mt-1">Bei einer Reaktion werden die Atome nur neu verbunden — keins geht verloren, keins kommt dazu (Massenerhaltung).</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
