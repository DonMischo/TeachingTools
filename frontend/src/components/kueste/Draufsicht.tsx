"use client";
/**
 * Draufsicht auf 2 km Ostseeküste: links ein Kliff, rechts eine Bucht.
 * Schräg anlaufende Wellen treiben den Sand im Zickzack den Strand entlang;
 * am Ende wächst ein Haken in die Bucht. Buhnen, Deckwerk und Aufspülung
 * lassen sich per Klick setzen. Rechnung: `@/lib/kueste/laengs`.
 */
import { useEffect, useRef, useState } from "react";
import {
  DXL, KLIFF_ZELLEN, ZELLEN, aufspuelen, buhneSetzen, deckwerkSetzen, entfernen, hakenLaenge,
  istKliff, laengsSchritt, neueKueste, transport, type Laengs,
} from "@/lib/kueste/laengs";

type Werkzeug = "buhne" | "deckwerk" | "sand" | "weg";

const WERKZEUGE: { id: Werkzeug; label: string; hilfe: string }[] = [
  { id: "buhne", label: "🪵 Buhne", hilfe: "Klick auf den Strand setzt eine Buhne (≈ 0,3 Mio. €)." },
  { id: "deckwerk", label: "🧱 Deckwerk", hilfe: "Klick auf Kliff oder Düne panzert 100 m Ufer (≈ 1,5 Mio. €)." },
  { id: "sand", label: "🚢 Aufspülen", hilfe: "Klick auf den Strand spült auf 180 m Länge Sand auf." },
  { id: "weg", label: "✖ Entfernen", hilfe: "Klick entfernt Buhne oder Deckwerk an dieser Stelle." },
];

const TEMPI = [
  { id: "tag", label: "1 Tag/s", h: 24 },
  { id: "woche", label: "1 Woche/s", h: 168 },
  { id: "monat", label: "1 Monat/s", h: 730 },
  { id: "jahr", label: "1 Jahr/s", h: 8766 },
];

/** Weltausschnitt in m: 2 km Küste plus die Bucht rechts */
const WELT = { x0: -40, x1: ZELLEN * DXL + 700, y0: 20, y1: 250 };

const zahl = (v: number, st = 0) => v.toLocaleString("de-DE", { minimumFractionDigits: st, maximumFractionDigits: st });

interface Korn { x: number; t: number; weg: number }

export default function Draufsicht() {
  const kueste = useRef<Laengs>(neueKueste());
  const [, setTick] = useState(0);
  const [winkel, setWinkel] = useState(15);
  const [hoehe, setHoehe] = useState(1.2);
  const [tempo, setTempo] = useState("woche");
  const [laeuft, setLaeuft] = useState(true);
  const [werkzeug, setWerkzeug] = useState<Werkzeug>("buhne");
  const canvas = useRef<HTMLCanvasElement>(null);
  const huelle = useRef<HTMLDivElement>(null);
  const z = useRef({ winkel, hoehe, tempo, laeuft });
  z.current = { winkel, hoehe, tempo, laeuft };
  const koerner = useRef<Korn[]>(Array.from({ length: 36 }, (_, i) => ({ x: (i * 57) % (ZELLEN * DXL), t: i * 0.37, weg: 0 })));

  useEffect(() => {
    let raf = 0, vorher = performance.now(), rest = 0, bild = 0;
    const t0 = performance.now();
    const frame = (jetzt: number) => {
      const dt = Math.min(0.1, (jetzt - vorher) / 1000);
      vorher = jetzt;
      const k = kueste.current;
      const s = z.current;
      if (s.laeuft) {
        rest += dt * TEMPI.find(x => x.id === s.tempo)!.h;
        let n = 0;
        while (rest >= 6 && n < 400) { laengsSchritt(k, s.hoehe, s.winkel, 6); rest -= 6; n++; }
      }
      zeichnen(k, s.winkel, s.hoehe, (jetzt - t0) / 1000, dt);
      if (++bild % 10 === 0) setTick(t => t + 1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const c = canvas.current, h = huelle.current;
    if (!c || !h) return;
    const passen = () => {
      const b = h.clientWidth, hh = Math.round(Math.min(460, Math.max(260, b * 0.42)));
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(b * dpr); c.height = Math.round(hh * dpr);
      c.style.width = `${b}px`; c.style.height = `${hh}px`;
    };
    passen();
    const ro = new ResizeObserver(passen);
    ro.observe(h);
    return () => ro.disconnect();
  }, []);

  function zeichnen(k: Laengs, winkelGrad: number, H: number, t: number, dt: number) {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = c.width / dpr, h = c.height / dpr;
    const X = (x: number) => ((x - WELT.x0) / (WELT.x1 - WELT.x0)) * w;
    const Y = (y: number) => ((y - WELT.y0) / (WELT.y1 - WELT.y0)) * h;
    const xm = (i: number) => (i + 0.5) * DXL;
    const ende = ZELLEN * DXL;

    // Meer
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#5fa8d8"); g.addColorStop(1, "#1f5f99");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // Wellenkämme, schräg anlaufend. Im Bildmaßstab gezeichnet, weil die
    // Strandbreite überzeichnet ist — sonst sähe der Winkel viel steiler aus.
    const a = (winkelGrad * Math.PI) / 180;
    const kx = Math.cos(a), ky = Math.sin(a);
    const lx = Math.sin(a), ly = -Math.cos(a);
    const abstand = 26;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.5;
    const lauf = (t * 14 * (0.5 + H / 2)) % abstand;
    for (let s = -40; s < 40; s++) {
      const d = s * abstand + lauf;
      const mx = w / 2 + lx * d, my = h + ly * d;
      ctx.beginPath();
      ctx.moveTo(mx - kx * 3000, my - ky * 3000);
      ctx.lineTo(mx + kx * 3000, my + ky * 3000);
      ctx.stroke();
    }
    ctx.restore();

    // Land (oben) und Strand
    ctx.beginPath();
    ctx.moveTo(X(WELT.x0), Y(0));
    ctx.lineTo(X(WELT.x0), Y(k.y[0]));
    for (let i = 0; i < ZELLEN; i++) ctx.lineTo(X(xm(i)), Y(k.y[i]));
    ctx.lineTo(X(ende), Y(k.y[ZELLEN - 1]));
    ctx.lineTo(X(ende), Y(0));
    ctx.closePath();
    ctx.fillStyle = "#e6cf93"; ctx.fill();

    // Brandungssaum
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3 + Math.sin(t * 3) * 1;
    ctx.beginPath();
    for (let i = 0; i < ZELLEN; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(xm(i)), Y(k.y[i] + 4 + Math.sin(t * 2 + i) * 2));
    ctx.stroke();

    // Hinterland: Kliff mit Wald, Düne mit Gras
    ctx.beginPath();
    ctx.moveTo(X(WELT.x0), Y(0));
    ctx.lineTo(X(WELT.x0), Y(k.land[0]));
    for (let i = 0; i < ZELLEN; i++) ctx.lineTo(X(xm(i)), Y(k.land[i]));
    ctx.lineTo(X(ende), Y(k.land[ZELLEN - 1]));
    ctx.lineTo(X(ende), Y(0));
    ctx.closePath();
    ctx.fillStyle = "#86b46a"; ctx.fill();
    for (let i = 0; i < ZELLEN; i++) {
      if (istKliff(i)) {
        ctx.fillStyle = "#efe9d8";
        ctx.fillRect(X(i * DXL), Y(k.land[i] - 14), X(DXL) - X(0) + 1, Y(k.land[i]) - Y(k.land[i] - 14));
        if (i % 2 === 0) { ctx.fillStyle = "#3f7a3a"; ctx.beginPath(); ctx.arc(X(xm(i)), Y(k.land[i] - 40), 7, 0, Math.PI * 2); ctx.fill(); }
      } else {
        ctx.fillStyle = "#d8c27f";
        ctx.fillRect(X(i * DXL), Y(k.land[i] - 16), X(DXL) - X(0) + 1, Y(k.land[i]) - Y(k.land[i] - 16));
      }
      if (k.deckwerk[i]) {
        ctx.fillStyle = "#8e9296";
        ctx.fillRect(X(i * DXL), Y(k.land[i] - 2), X(DXL) - X(0) + 1, Y(k.land[i] + 6) - Y(k.land[i] - 2));
      }
    }
    // Bucht rechts mit Gegenufer
    ctx.fillStyle = "#86b46a";
    ctx.beginPath();
    ctx.moveTo(X(ende), Y(0)); ctx.lineTo(X(WELT.x1), Y(0)); ctx.lineTo(X(WELT.x1), Y(40)); ctx.quadraticCurveTo(X(ende + 300), Y(70), X(ende), Y(k.land[ZELLEN - 1]));
    ctx.fill();

    // Haken: wächst nach rechts und biegt landwärts in die Bucht
    const L = Math.min(1400, hakenLaenge(k));
    if (L > 1) {
      ctx.strokeStyle = "#e6cf93";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(5, Y(40) - Y(0));
      ctx.beginPath();
      let hx = ende, hy = k.y[ZELLEN - 1] - 12, richtung = 0;
      ctx.moveTo(X(hx), Y(hy));
      for (let s = 0; s < L; s += 10) {
        richtung = Math.min(Math.PI * 0.75, s / 520);
        hx += Math.cos(richtung) * 10;
        hy -= Math.sin(richtung) * 10;
        ctx.lineTo(X(hx), Y(hy));
      }
      ctx.stroke();
      ctx.lineCap = "butt";
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillText("Haken", X(hx) + 8, Y(hy));
    }

    // Buhnen
    ctx.strokeStyle = "#5b3a1e";
    ctx.lineWidth = 4;
    for (const b of k.buhnen) {
      ctx.beginPath(); ctx.moveTo(X(b.f * DXL), Y(k.land[b.f] + 4)); ctx.lineTo(X(b.f * DXL), Y(b.spitze)); ctx.stroke();
    }

    // Häuser
    ctx.font = "18px system-ui, \"Segoe UI Emoji\", sans-serif";
    ctx.textAlign = "center";
    for (const hs of k.haeuser) ctx.fillText(hs.weg ? "💥" : "🏠", X(xm(hs.i)), Y(hs.y) + 6);
    ctx.textAlign = "left";

    // Sandkörner im Zickzack: schräg hinauf mit der Welle, gerade hinab mit dem Rücksog
    const Q = transport(k, H, winkelGrad);
    ctx.fillStyle = "#7a4e1d";
    for (const korn of koerner.current) {
      const i = Math.max(0, Math.min(ZELLEN - 1, Math.floor(korn.x / DXL)));
      korn.t += dt * (0.8 + H * 0.4);
      const zyklus = korn.t % 1;
      const fluss = Q[Math.min(ZELLEN, i + 1)];
      // Buhne im Weg? Dann bleibt das Korn davor liegen.
      const naechste = k.buhnen.find(b => fluss > 0 ? b.f * DXL > korn.x && b.f * DXL - korn.x < 8 : korn.x - b.f * DXL > 0 && korn.x - b.f * DXL < 8);
      if (zyklus < 0.5 && !(naechste && naechste.spitze > k.y[i] + 20)) korn.x += Math.sign(fluss) * Math.min(1, Math.abs(fluss) / 10) * dt * 60;
      if (korn.x < 0) korn.x += ende; if (korn.x > ende) korn.x -= ende;
      const auf = zyklus < 0.5 ? zyklus * 2 : 2 - zyklus * 2;
      ctx.beginPath();
      ctx.arc(X(korn.x), Y(k.y[i] - 2 - auf * 16), 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pfeile: Küstenlängsstrom
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    for (let i = 5; i < ZELLEN; i += 12) {
      const q = Q[i];
      if (Math.abs(q) < 0.2) continue;
      const len = Math.min(60, 12 + Math.abs(q) * 3) * Math.sign(q);
      const yy = Y(k.y[i] + 28);
      ctx.beginPath(); ctx.moveTo(X(xm(i)), yy); ctx.lineTo(X(xm(i)) + len, yy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(xm(i)) + len, yy); ctx.lineTo(X(xm(i)) + len - 6 * Math.sign(len), yy - 4); ctx.lineTo(X(xm(i)) + len - 6 * Math.sign(len), yy + 4); ctx.fill();
    }

    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("Kliff", X(DXL * 2), Y(30));
    ctx.fillText("Düne", X(DXL * (KLIFF_ZELLEN + 4)), Y(30));
    ctx.fillText("Bucht (Bodden)", X(ende + 260), Y(160));
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText("Küstenlängsstrom", X(DXL * 40), Y(k.y[40] + 46));
    // Maßstab
    ctx.strokeStyle = "white"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(10, h - 10); ctx.lineTo(10 + X(500) - X(0), h - 10); ctx.stroke();
    ctx.fillStyle = "white"; ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("500 m (Strandbreite überzeichnet)", 12, h - 14);
  }

  function klick(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const x = WELT.x0 + ((e.clientX - r.left) / r.width) * (WELT.x1 - WELT.x0);
    if (x < 0 || x > ZELLEN * DXL) return;
    const zelle = x / DXL;
    const k = kueste.current;
    if (werkzeug === "buhne") buhneSetzen(k, zelle);
    else if (werkzeug === "deckwerk") deckwerkSetzen(k, zelle);
    else if (werkzeug === "sand") aufspuelen(k, zelle);
    else entfernen(k, zelle);
    setTick(t => t + 1);
  }

  const k = kueste.current;
  const rueckgang = Array.from(k.land.slice(0, KLIFF_ZELLEN)).reduce((s, v) => s + (100 - v), 0) / KLIFF_ZELLEN;
  const jahre = k.stunde / 8766;
  const verloren = k.haeuser.filter(h => h.weg).length;

  return (
    <div className="flex flex-col gap-4">
      <div ref={huelle} className="rounded-2xl overflow-hidden border border-[var(--border)]">
        <canvas ref={canvas} onClick={klick} className="block w-full cursor-crosshair" aria-label="Küste von oben mit Küstenlängsstrom" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setLaeuft(!laeuft)} className="px-3 py-1.5 rounded-lg text-sm font-bold border border-[var(--border)] hover:bg-[var(--surface-hover)]">
          {laeuft ? "⏸ Pause" : "▶ Weiter"}
        </button>
        <div className="inline-flex rounded-xl border border-[var(--border)] p-1 bg-[var(--surface)]">
          {TEMPI.map(t => (
            <button key={t.id} onClick={() => setTempo(t.id)}
              className={`px-2 py-1 rounded-lg text-xs font-bold ${tempo === t.id ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-xl border border-[var(--border)] p-1 bg-[var(--surface)]">
          {WERKZEUGE.map(t => (
            <button key={t.id} onClick={() => setWerkzeug(t.id)} title={t.hilfe}
              className={`px-2 py-1 rounded-lg text-xs font-bold ${werkzeug === t.id ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={() => { kueste.current = neueKueste(); setTick(t => t + 1); }} className="px-3 py-1.5 rounded-lg text-sm font-bold border border-[var(--border)] hover:bg-[var(--surface-hover)]">↺ Neu</button>
      </div>
      <p className="text-xs text-[var(--text-muted)] -mt-2">{WERKZEUGE.find(t => t.id === werkzeug)!.hilfe}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
          <h3 className="font-black">🌊 Wellen</h3>
          <label className="text-sm">
            Richtung: <b>{winkel === 0 ? "gerade auf den Strand" : winkel > 0 ? `${winkel}° von links` : `${-winkel}° von rechts`}</b>
            <input type="range" min={-30} max={30} value={winkel} onChange={e => setWinkel(Number(e.target.value))} className="w-full" />
          </label>
          <label className="text-sm">
            Höhe: <b>{zahl(hoehe, 1)} m</b>
            <input type="range" min={0.3} max={3} step={0.1} value={hoehe} onChange={e => setHoehe(Number(e.target.value))} className="w-full" />
          </label>
          <p className="text-xs text-[var(--text-muted)]">An der deutschen Ostseeküste kommt der Wind meist aus West — der Sand wandert deshalb meist nach Osten.</p>
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm grid grid-cols-2 gap-x-3 gap-y-1 content-start">
          <h3 className="font-black col-span-2 mb-1">📊 Nach {zahl(jahre, 1)} Jahren</h3>
          <span className="text-[var(--text-muted)]">Haken</span><b>{zahl(hakenLaenge(k))} m lang</b>
          <span className="text-[var(--text-muted)]">Sand in den Haken</span><b>{zahl(k.haken / 1000)} Tsd. m³</b>
          <span className="text-[var(--text-muted)]">Sand vom Kliff</span><b>{zahl(k.geliefert / 1000)} Tsd. m³</b>
          <span className="text-[var(--text-muted)]">Kliff zurück</span><b>{zahl(rueckgang, 1)} m</b>
          <span className="text-[var(--text-muted)]">Häuser verloren</span><b className={verloren ? "text-red-500" : ""}>{verloren} von {k.haeuser.length}</b>
          <span className="text-[var(--text-muted)]">Kosten</span><b>{zahl(k.kosten, 1)} Mio. €</b>
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm flex flex-col gap-2">
          <h3 className="font-black">📰 Meldungen</h3>
          {k.meldungen.length === 0 ? <p className="text-[var(--text-muted)]">Noch nichts passiert.</p>
            : [...k.meldungen].reverse().slice(0, 5).map((m, i) => <p key={i} className="border-l-4 border-red-500 bg-red-500/10 px-2 py-1 rounded">{m}</p>)}
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm flex flex-col gap-2 leading-relaxed">
        <h3 className="font-black">📘 So wandert der Sand</h3>
        <p><b>Strandversetzung:</b> Die Welle läuft schräg den Strand hinauf und nimmt Sandkörner mit. Zurück fließt das Wasser auf dem kürzesten Weg — gerade hinab. So rückt jedes Korn mit jeder Welle ein Stück weiter: im Zickzack an der Küste entlang. Draußen in der Brandung schiebt der <b>Küstenlängsstrom</b> den Sand in dieselbe Richtung.</p>
        <p><b>Haken und Nehrung:</b> Wo die Küste abknickt, läuft der Sand geradeaus weiter ins tiefe Wasser und baut einen Haken, der sich zur Bucht hin krümmt. Wächst er bis zum anderen Ufer, entsteht eine Nehrung und aus der Bucht ein Strandsee. Beispiele: Darßer Ort, der Bug auf Rügen, der Bessin auf Hiddensee.</p>
        <p><b>Ausgleichsküste:</b> Kliffe weichen zurück, Haken wachsen in die Buchten — die Küste wird mit der Zeit glatter.</p>
        <p><b>Buhnen und Lee-Erosion:</b> Eine Buhne hält den Sand auf der Seite fest, von der er kommt (Luv). Auf der anderen Seite (Lee) fehlt er — dort bricht der Strand ein. Darum baut man Buhnen immer in Reihen. Ein Deckwerk am Kliff stoppt den Nachschub: dann hungern die Strände weiter hinten.</p>
      </section>
    </div>
  );
}
