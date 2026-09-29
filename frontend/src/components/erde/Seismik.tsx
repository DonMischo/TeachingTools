"use client";
/**
 * Erdbebenwellen durch die Erde: Strahlenfächer, Schattenzonen, Laufzeiten.
 * Drei Erdmodelle zeigen, wie man den Kern entdeckt hat.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ERDRADIUS, SCHICHTEN } from "@/lib/erde/schichten";
import { MODELLE, ankunft, faecher, type Erdmodell, type Strahl, type Welle } from "@/lib/erde/seismik";

const FARBE: Record<Welle, string> = { P: "#3b82f6", S: "#f59e0b" };
const INNENKERN_FARBE = "#a855f7";

type Auswahl = "P" | "S" | "PS";

export default function Seismik() {
  const leinwandRef = useRef<HTMLCanvasElement>(null);
  const [modell, setModell] = useState<Erdmodell>("innenkern");
  const [auswahl, setAuswahl] = useState<Auswahl>("PS");
  const [anzahl, setAnzahl] = useState(36);
  const [laeuft, setLaeuft] = useState(true);
  const [zeit, setZeit] = useState(0); // Sekunden nach dem Beben
  const zeitRef = useRef(0);

  const wellen: Welle[] = auswahl === "PS" ? ["P", "S"] : [auswahl];
  const strahlen = useMemo(() => wellen.flatMap(w => faecher(w, modell, anzahl)), [modell, auswahl, anzahl]); // eslint-disable-line react-hooks/exhaustive-deps
  const treffer = useMemo(() => ({ P: ankunft("P", modell, 900), S: ankunft("S", modell, 900) }), [modell]);

  // Zeit läuft: 1 Sekunde echt = 90 Sekunden nach dem Beben.
  useEffect(() => {
    if (!laeuft) return;
    let letzte = performance.now(), id = 0;
    const tick = (jetzt: number) => {
      zeitRef.current = (zeitRef.current + ((jetzt - letzte) / 1000) * 90) % 1500;
      letzte = jetzt;
      setZeit(zeitRef.current);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [laeuft]);

  useEffect(() => {
    const c = leinwandRef.current;
    if (!c) return;
    zeichne(c, strahlen, treffer, wellen, zeit);
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <div className="flex flex-col gap-2">
        <canvas ref={leinwandRef} width={900} height={760} className="w-full rounded-2xl border border-[var(--border)] bg-[#0b1120]" />
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setLaeuft(l => !l)} className="px-3 py-1 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-text,#111)]">
            {laeuft ? "⏸ anhalten" : "▶ abspielen"}
          </button>
          <input type="range" min={0} max={1500} value={Math.round(zeit)} className="flex-1"
            onChange={e => { setLaeuft(false); zeitRef.current = +e.target.value; setZeit(+e.target.value); }} />
          <span className="w-28 text-right font-mono">{Math.floor(zeit / 60)} min {String(Math.floor(zeit % 60)).padStart(2, "0")} s</span>
        </div>
      </div>
      <aside className="flex flex-col gap-3 text-sm">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-2">
          <b>Wie sieht die Erde innen aus?</b>
          {MODELLE.map(m => (
            <label key={m.id} className="flex items-start gap-2 cursor-pointer">
              <input type="radio" checked={modell === m.id} onChange={() => setModell(m.id)} className="mt-1" />
              <span><b>{m.label}</b><br /><span className="text-xs text-[var(--text-muted)]">{m.jahr}</span></span>
            </label>
          ))}
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-2">
          <div className="flex gap-1">
            {(["P", "S", "PS"] as Auswahl[]).map(a => (
              <button key={a} onClick={() => setAuswahl(a)}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${auswahl === a ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "border border-[var(--border)]"}`}>
                {a === "PS" ? "beide" : `${a}-Wellen`}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs">Strahlen
            <input type="range" min={8} max={80} value={anzahl} onChange={e => setAnzahl(+e.target.value)} className="flex-1" />
            <b>{anzahl}</b>
          </label>
          <div className="text-xs flex flex-col gap-1">
            <span><i className="inline-block w-4 h-1 align-middle mr-1" style={{ background: FARBE.P }} /><b>P-Wellen</b> (Druckwellen): schnell, durch Festes und Flüssiges</span>
            <span><i className="inline-block w-4 h-1 align-middle mr-1" style={{ background: FARBE.S }} /><b>S-Wellen</b> (Scherwellen): langsamer, nur durch Festes</span>
            <span><i className="inline-block w-4 h-1 align-middle mr-1" style={{ background: INNENKERN_FARBE }} />durch den inneren Kern</span>
          </div>
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 leading-relaxed">
          <b>Was man sieht</b>
          <ul className="list-disc pl-5 mt-1 flex flex-col gap-1">
            <li>Die Wellen laufen auf <b>gebogenen Bahnen</b>: nach unten werden sie schneller und werden wie Licht in Glas gebrochen.</li>
            <li><b>S-Schatten:</b> Ab etwa 103° Entfernung kommt keine S-Welle mehr an — der äußere Kern ist flüssig.</li>
            <li><b>P-Schatten</b> zwischen etwa 103° und 142°: Am Kern werden die P-Wellen langsamer und stark geknickt.</li>
            <li>Mit festem Innenkern tauchen <b>schwache P-Wellen im Schatten</b> auf — so fand Inge Lehmann 1936 den inneren Kern.</li>
            <li>Stelle »überall gleich« ein: Dann gäbe es keinen Schatten. Genau der fehlte in den Messungen.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}

function zeichne(c: HTMLCanvasElement, strahlen: Strahl[], treffer: { P: boolean[]; S: boolean[] }, wellen: Welle[], zeit: number) {
  const ctx = c.getContext("2d")!;
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2 + 10, R = Math.min(W, H) / 2 - 60;
  const px = (r: number, th: number): [number, number] => [cx + (r / ERDRADIUS) * R * Math.sin(th), cy - (r / ERDRADIUS) * R * Math.cos(th)];

  // Schichten.
  for (const s of SCHICHTEN) {
    ctx.beginPath();
    ctx.arc(cx, cy, ((ERDRADIUS - s.von) / ERDRADIUS) * R, 0, Math.PI * 2);
    ctx.fillStyle = s.farbe;
    ctx.globalAlpha = s.id === "aussenkern" || s.id === "innenkern" ? 0.45 : 0.35;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  for (const r of [ERDRADIUS, ERDRADIUS - 2891, ERDRADIUS - 5150]) {
    ctx.beginPath(); ctx.arc(cx, cy, (r / ERDRADIUS) * R, 0, Math.PI * 2); ctx.stroke();
  }

  // Schattenzonen am Rand.
  const bogen = (von: number, bis: number, farbe: string, versatz: number) => {
    for (const seite of [1, -1]) {
      ctx.beginPath();
      const a0 = -Math.PI / 2 + seite * (von * Math.PI) / 180;
      const a1 = -Math.PI / 2 + seite * (bis * Math.PI) / 180;
      ctx.arc(cx, cy, R + versatz, Math.min(a0, a1), Math.max(a0, a1));
      ctx.strokeStyle = farbe;
      ctx.lineWidth = 7;
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  };
  const schatten = (t: boolean[]) => {
    const aus: [number, number][] = [];
    let start: number | null = null;
    for (let g = 12; g <= 180; g++) {
      if (!t[g] && start == null) start = g;
      if ((t[g] || g === 180) && start != null) { aus.push([start, t[g] ? g : 180]); start = null; }
    }
    return aus;
  };
  wellen.forEach((w, i) => {
    for (const [a, b] of schatten(treffer[w])) bogen(a, b, w === "P" ? "rgba(59,130,246,0.55)" : "rgba(245,158,11,0.55)", 10 + i * 9);
  });

  // Strahlen: bis zur aktuellen Zeit hell, danach blass.
  for (const s of strahlen) {
    const farbe = s.durchInnenkern && s.welle === "P" ? INNENKERN_FARBE : FARBE[s.welle];
    for (const seite of [1, -1]) {
      ctx.beginPath();
      s.punkte.forEach(([r, th], i) => {
        const [x, y] = px(r, seite * th);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = farbe;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.stroke();
      // Bis jetzt gelaufen.
      ctx.beginPath();
      let front: [number, number] | null = null;
      for (let i = 0; i < s.punkte.length; i++) {
        const [r, th] = s.punkte[i];
        if (s.zeiten[i] > zeit) {
          if (i > 0) {
            const f = (zeit - s.zeiten[i - 1]) / (s.zeiten[i] - s.zeiten[i - 1]);
            const [r0, t0] = s.punkte[i - 1];
            front = px(r0 + (r - r0) * f, seite * (t0 + (th - t0) * f));
            ctx.lineTo(front[0], front[1]);
          }
          break;
        }
        const [x, y] = px(r, seite * th);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      if (front) {
        ctx.beginPath(); ctx.arc(front[0], front[1], 3, 0, Math.PI * 2);
        ctx.fillStyle = farbe; ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;

  // Stationen alle 20°.
  ctx.font = "bold 13px system-ui";
  for (let g = 20; g <= 180; g += 20) {
    for (const seite of g === 180 ? [1] : [1, -1]) {
      const th = (seite * g * Math.PI) / 180;
      const [x, y] = px(ERDRADIUS, th);
      ctx.fillStyle = "#e5e7eb";
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      const [lx, ly] = px(ERDRADIUS * 1.15, th);
      ctx.textAlign = "center";
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(`${g}°`, lx, ly + 4);
    }
  }
  // Herd.
  const [hx, hy] = px(ERDRADIUS, 0);
  ctx.fillStyle = "#ef4444";
  ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText("Erdbeben", hx, hy - 16);

  // Legende der Schatten.
  ctx.textAlign = "left";
  ctx.font = "12px system-ui";
  wellen.forEach((w, i) => {
    ctx.fillStyle = w === "P" ? "rgba(59,130,246,0.9)" : "rgba(245,158,11,0.9)";
    ctx.fillRect(16, H - 44 + i * 18, 18, 6);
    ctx.fillStyle = "#e5e7eb";
    ctx.fillText(`${w}-Schatten: hier kommt keine ${w}-Welle an`, 40, H - 38 + i * 18);
  });
}
