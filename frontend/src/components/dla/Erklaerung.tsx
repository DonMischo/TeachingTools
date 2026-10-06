"use client";
/**
 * »So geht's«: eine Zeitlupe, in der man einem einzelnen Wanderer zusieht
 * (ohne Sprünge, mit Spur und Fangkreis), dazu die Erklärung.
 */
import { useEffect, useRef, useState } from "react";
import { ANZIEHUNG, Dla, farbe } from "@/lib/dla/kern";
import { HINTERGRUND } from "./Flaeche";

const TEMPI = [
  { label: "🐢 langsam", schritte: 1 },
  { label: "🚶 mittel", schritte: 8 },
  { label: "🐇 schnell", schritte: 120 },
];
const KAP = 600;
const SPUR = 160;

function Zeitlupe() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [tempo, setTempo] = useState(1);
  const [lauf, setLauf] = useState(0);
  const [anzahl, setAnzahl] = useState(1);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dla = new Dla({ dim: 2, kapazitaet: KAP, haftung: 1, saat: "punkt", ohneSpruenge: true, zufall: (Math.random() * 2 ** 32) >>> 0 });
    const spur: number[] = [];
    let raf = 0, gemeldet = 1;
    const tick = () => {
      for (let k = 0; k < TEMPI[tempo].schritte && !dla.voll; k++) {
        if (dla.schritt()) spur.length = 0;
        else spur.push(dla.wanderer[0], dla.wanderer[1]);
        if (spur.length > SPUR * 2) spur.splice(0, 2);
      }
      const dpr = window.devicePixelRatio || 1;
      const b = Math.round(c.clientWidth * dpr);
      if (c.width !== b) { c.width = b; c.height = b; }
      const r = dla.rmax + 22;
      const m = c.width / (2 * r), mx = c.width / 2, my = c.height / 2;
      const X = (x: number) => mx + x * m, Y = (y: number) => my - y * m;
      ctx.fillStyle = HINTERGRUND;
      ctx.fillRect(0, 0, c.width, c.height);
      // Startkreis
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.setLineDash([4 * dpr, 6 * dpr]);
      ctx.beginPath();
      ctx.arc(mx, my, (dla.rmax + ANZIEHUNG + 2) * m, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
      // Haufen
      ctx.lineWidth = Math.max(1, m * 0.35);
      for (let i = 0; i < dla.anzahl; i++) {
        const [cr, cg, cb] = farbe(i / KAP);
        const col = `rgb(${cr * 255},${cg * 255},${cb * 255})`;
        const e = dla.eltern[i];
        if (e >= 0) {
          ctx.strokeStyle = col;
          ctx.beginPath();
          ctx.moveTo(X(dla.pos[e * 3]), Y(dla.pos[e * 3 + 1]));
          ctx.lineTo(X(dla.pos[i * 3]), Y(dla.pos[i * 3 + 1]));
          ctx.stroke();
        }
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(X(dla.pos[i * 3]), Y(dla.pos[i * 3 + 1]), Math.max(1.5, m * 0.45), 0, 2 * Math.PI);
        ctx.fill();
      }
      // Spur und Wanderer mit Fangkreis
      if (spur.length >= 4) {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = Math.max(1, dpr);
        ctx.beginPath();
        ctx.moveTo(X(spur[0]), Y(spur[1]));
        for (let i = 2; i < spur.length; i += 2) ctx.lineTo(X(spur[i]), Y(spur[i + 1]));
        ctx.stroke();
      }
      const wx = X(dla.wanderer[0]), wy = Y(dla.wanderer[1]);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.arc(wx, wy, ANZIEHUNG * m, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(wx, wy, Math.max(2.5, m * 0.5), 0, 2 * Math.PI);
      ctx.fill();
      if (dla.anzahl !== gemeldet) { gemeldet = dla.anzahl; setAnzahl(gemeldet); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tempo, lauf]);

  return (
    <div className="flex flex-col gap-2">
      <canvas ref={canvas} className="w-full max-w-[520px] aspect-square rounded-xl" style={{ background: HINTERGRUND }}
        aria-label="Zeitlupe: ein Teilchen irrt umher, bis es hängen bleibt" />
      <div className="flex flex-wrap items-center gap-1 text-sm">
        {TEMPI.map((t, i) => (
          <button key={t.label} className={`chip ${tempo === i ? "chip-on" : ""}`} onClick={() => setTempo(i)}>{t.label}</button>
        ))}
        <button className="btn btn-secondary" onClick={() => setLauf(l => l + 1)}>↺ Von vorn</button>
        <span className="text-muted tabular-nums ml-auto">{anzahl} / {KAP} Teilchen</span>
      </div>
      <p className="text-xs text-muted">
        Weiß: der Wanderer mit seiner Spur und seinem Fangkreis. Gestrichelt: der Kreis, auf dem jeder neue Wanderer startet.
        Läuft er zu weit weg, startet er neu.
      </p>
    </div>
  );
}

const ABSCHNITTE: { titel: string; text: string }[] = [
  {
    titel: "🎲 Die Regel",
    text: "Ein Teilchen startet irgendwo auf einem Kreis um den Haufen und irrt zufällig umher — wie ein Staubkorn in Wasser (brownsche Bewegung). Kommt es dem Haufen nahe genug, bleibt es kleben. Dann startet das nächste. Mehr steckt nicht dahinter: wandern, dann haften.",
  },
  {
    titel: "🌿 Warum Äste?",
    text: "Ein Wanderer, der von außen kommt, stößt fast immer zuerst an eine Spitze. In die Buchten zwischen den Ästen kommt er kaum hinein — er würde vorher irgendwo anstoßen. Die Spitzen »schirmen« das Innere ab. Wer vorne ist, wächst schneller: Aus einem kleinen Zufallshöcker wird ein Ast, aus dem Ast wachsen neue Spitzen. Deshalb bleibt das Innere luftig, auch nach einer Million Teilchen.",
  },
  {
    titel: "🧲 Haftwahrscheinlichkeit",
    text: "Bei 100 % klebt jedes Teilchen beim ersten Kontakt — die Äste werden dünn und fein. Prallt ein Teilchen oft ab, kann es weiter in die Buchten wandern, bevor es hängen bleibt. Der Haufen wird dichter und rundlicher, die Dimension steigt.",
  },
  {
    titel: "📏 Fraktale Dimension",
    text: "Bei einer vollen Scheibe vervierfacht sich die Teilchenzahl, wenn man den Radius verdoppelt (2² = 4), bei einer Kugel verachtfacht sie sich (2³ = 8), bei einer Linie verdoppelt sie sich nur (2¹). Beim DLA-Haufen in der Ebene sind es etwa 3,2-mal so viele: 2^1,7 ≈ 3,2. Er ist also »mehr als eine Linie, weniger als eine Fläche« — Dimension etwa 1,7. Im Raum liegt sie bei etwa 2,5. Gemessen wird das, indem man die Teilchen innerhalb von Kreisen mit wachsendem Radius zählt und doppelt-logarithmisch aufträgt: Die Steigung ist die Dimension.",
  },
  {
    titel: "🌍 Wo gibt es das?",
    text: "Kupferbäumchen bei der Elektrolyse einer Kupfersulfatlösung (Elektrochemie), Mangan-Dendriten auf Kalkstein, die wie versteinerte Farne aussehen, Eisblumen am Fenster, Lichtenberg-Figuren nach einem Blitz- oder Hochspannungsschlag, Bakterienkolonien auf nährstoffarmem Boden, Rußflocken und Feinstaub. Immer wandert etwas zufällig heran (Ionen, Wassermoleküle, Nährstoffe, Ladung) und bleibt am schon Vorhandenen hängen.",
  },
  {
    titel: "📚 Quellen",
    text: "T. A. Witten und L. M. Sander: Diffusion-Limited Aggregation, a Kinetic Critical Phenomenon (Physical Review Letters 47, 1981). Vorbild für Parameter und Sprung-Trick: dlaf von Michael Fogleman (github.com/fogleman/dlaf, MIT-Lizenz) — hier neu in TypeScript geschrieben, mit Gittern statt k-d-Baum. Anstoß: ein Clip von index.opensource auf Instagram.",
  },
];

export default function Erklaerung() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] items-start">
      <Zeitlupe />
      <div className="flex flex-col gap-3">
        {ABSCHNITTE.map(a => (
          <div key={a.titel} className="card p-4">
            <h3 className="font-bold mb-1">{a.titel}</h3>
            <p className="text-sm leading-relaxed">{a.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
