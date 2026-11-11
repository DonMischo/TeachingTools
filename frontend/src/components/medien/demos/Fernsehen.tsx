"use client";
/**
 * Fernsehen: Ein Elektronenstrahl malt das Bild Zeile für Zeile auf den
 * Leuchtschirm. Der Schirm leuchtet kurz nach — bei hohem Tempo sieht das Auge
 * deshalb ein ganzes, ruhiges Bild.
 */
import { useEffect, useRef, useState } from "react";
import { useErprobt } from "@/lib/medien/erprobt";

const B = 320, H = 240, SPALTEN = 160;
const STUFEN = [
  { n: 30, name: "30 Zeilen (Baird 1928)" },
  { n: 180, name: "180 Zeilen (Berlin 1935)" },
  { n: 625, name: "625 Zeilen (ab 1952)" },
];

function testbild(c: HTMLCanvasElement): boolean {
  const g = c.getContext("2d");
  if (!g) return false;
  c.width = B; c.height = H;
  g.fillStyle = "#808080"; g.fillRect(0, 0, B, H);
  g.strokeStyle = "#fff"; g.lineWidth = 2;
  for (let x = 0; x <= B; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y <= H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(B, y); g.stroke(); }
  g.fillStyle = "#111"; g.beginPath(); g.arc(160, 100, 72, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#eee"; g.beginPath(); g.arc(160, 100, 72, -Math.PI / 2, Math.PI / 2); g.lineTo(160, 100); g.fill();
  g.strokeStyle = "#fff"; g.lineWidth = 5; g.beginPath(); g.arc(160, 100, 72, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#808080"; g.fillRect(100, 82, 120, 36);
  g.fillStyle = "#000"; g.font = "bold 30px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("TT 1935", 160, 101);
  for (let i = 0; i < 8; i++) { const v = Math.round(i * 255 / 7); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i * 40, 190, 40, 50); }
  g.fillStyle = "#fff"; g.fillRect(0, 0, 24, 24); g.fillRect(B - 24, 0, 24, 24);
  g.fillStyle = "#000"; g.fillRect(0, H - 50, 24, 24); g.fillRect(B - 24, H - 50, 24, 24);
  return true;
}

type Api = { setN: (n: number) => void; scrub: (pos: number) => void };

export function FernsehenDemo() {
  const erprobt = useErprobt();
  const erprRef = useRef(erprobt);
  erprRef.current = erprobt;
  const cvRef = useRef<HTMLCanvasElement>(null);
  const api = useRef<Api | null>(null);
  const st = useRef({ n: 180, s: 0.6, spielt: true, pos: 0, slow: false, fertig: false });
  const [n, setN] = useState(180);
  const [s, setS] = useState(0.6);
  const [spielt, setSpielt] = useState(true);
  const [zeile, setZeile] = useState(0);
  const [kein, setKein] = useState(false);

  useEffect(() => {
    const cv = cvRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) { setKein(true); return; }
    cv.width = B; cv.height = H;
    const phos = document.createElement("canvas");
    phos.width = B; phos.height = H;
    const pg = phos.getContext("2d")!;
    const quelle = document.createElement("canvas");
    testbild(quelle);
    const low = document.createElement("canvas");
    const lg = low.getContext("2d")!;
    const baueLow = (zn: number) => {
      low.width = SPALTEN; low.height = zn;
      lg.imageSmoothingEnabled = true; lg.imageSmoothingQuality = "high";
      lg.drawImage(quelle, 0, 0, SPALTEN, zn);
    };
    baueLow(st.current.n);
    pg.fillStyle = "#000"; pg.fillRect(0, 0, B, H);

    const bereich = (a: number, b: number) => {
      const zn = st.current.n, h = H / zn;
      for (let j = Math.floor(a); j <= Math.floor(b) && j < zn; j++) {
        const x0 = j === Math.floor(a) ? a - j : 0;
        const x1 = j === Math.floor(b) ? b - j : 1;
        if (x1 - x0 < 0.002) continue;
        pg.drawImage(low, x0 * SPALTEN, j, (x1 - x0) * SPALTEN, 1, x0 * B, j * h, (x1 - x0) * B + 0.5, h + 0.5);
      }
    };
    api.current = {
      setN: zn => { st.current.n = zn; st.current.pos = 0; baueLow(zn); pg.fillStyle = "#000"; pg.fillRect(0, 0, B, H); },
      scrub: p => {
        st.current.pos = p;
        pg.fillStyle = "#000"; pg.fillRect(0, 0, B, H);
        bereich(0, Math.min(p, st.current.n - 0.001));
      },
    };

    let raf = 0, last = performance.now(), sync = 0;
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const S = st.current;
      const rate = Math.pow(25 * S.n, S.s);
      if (S.spielt) {
        pg.fillStyle = `rgba(0,0,0,${1 - Math.exp(-dt / 0.12)})`;
        pg.fillRect(0, 0, B, H);
        const alt = S.pos;
        S.pos += Math.min(rate * dt, S.n);
        if (S.pos >= S.n) { bereich(alt, S.n); S.pos -= S.n; bereich(0, S.pos); }
        else bereich(alt, S.pos);
        if (rate <= 2) S.slow = true;
      } else S.slow = true;
      if (!S.fertig && S.slow && S.spielt && S.n === 625 && S.s >= 0.98) { S.fertig = true; erprRef.current("fernsehen"); }
      ctx.drawImage(phos, 0, 0);
      const j = Math.min(S.n - 1, Math.floor(S.pos));
      const bx = (S.pos - j) * B, by = (j + 0.5) * H / S.n;
      const gr = ctx.createRadialGradient(bx, by, 0, bx, by, 14);
      gr.addColorStop(0, "rgba(230,255,240,0.95)"); gr.addColorStop(1, "rgba(120,255,170,0)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, by, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(bx, by, 2.5, 0, Math.PI * 2); ctx.fill();
      if (t - sync > 100) { sync = t; setZeile(j + 1); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); api.current = null; };
  }, []);

  const rate = Math.pow(25 * n, s);
  const bps = rate / n;
  const zahl = (x: number, d = 1) => x.toLocaleString("de-DE", { maximumFractionDigits: d });
  const tempo = s <= 0.005 ? "1 Zeile pro Sekunde" : s >= 0.995 ? "25 Bilder pro Sekunde" : `${zahl(rate, rate < 10 ? 1 : 0)} Zeilen pro Sekunde`;

  return (
    <div className="card space-y-3 p-3">
      <div className="mx-auto w-full max-w-md rounded-[28px] border border-line bg-surface-hover p-3">
        <canvas
          ref={cvRef}
          className="block w-full rounded-[18px] bg-black"
          style={{ aspectRatio: `${B} / ${H}`, boxShadow: "inset 0 0 40px 10px rgba(0,0,0,0.85)" }}
        />
        {kein && <p className="p-2 text-sm text-muted">Hier würde ein Elektronenstrahl das Testbild Zeile für Zeile malen – dein Browser kann leider keine Zeichenfläche.</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {STUFEN.map(x => (
          <button key={x.n} type="button" className={`chip ${n === x.n ? "chip-on" : ""}`}
            onClick={() => { setN(x.n); st.current.n = x.n; api.current?.setN(x.n); setZeile(0); }}>
            {x.name}
          </button>
        ))}
      </div>

      <label className="block text-sm">
        Tempo: <b>{tempo}</b>
        <input type="range" min={0} max={1} step={0.01} value={s} className="w-full"
          onChange={e => { const v = Number(e.target.value); setS(v); st.current.s = v; }} />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={() => { const v = !spielt; setSpielt(v); st.current.spielt = v; if (!v) st.current.slow = true; }}>
          {spielt ? "⏸ Pause" : "▶ Weiter"}
        </button>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span className="shrink-0 text-muted">Bild:</span>
          <input type="range" min={0} max={n} step={1} value={Math.min(zeile, n)} className="min-w-0 flex-1"
            onChange={e => {
              const v = Number(e.target.value);
              setSpielt(false); st.current.spielt = false; st.current.slow = true;
              api.current?.scrub(v); setZeile(v);
            }} />
        </label>
      </div>

      <p className="text-sm">
        Strahl in Zeile <b>{zeile}</b> von {n} · <b>{zahl(bps, 2)}</b> Bilder pro Sekunde
      </p>
      <p className="text-sm text-muted">
        Der Strahl malt immer nur einen einzigen Punkt. Weil der Schirm danach noch einen Moment nachleuchtet und dein Auge
        träge ist, verschmilzt alles zu einem Bild – bei 25 Bildern pro Sekunde sieht es ruhig aus, langsam siehst du nur
        den Schweif. Schalte auf 625 Zeilen und Vollgas, dann wird aus dem Punkt ein Testbild.
      </p>
    </div>
  );
}
