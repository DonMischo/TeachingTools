"use client";
/** Zufall gegen Poisson-Disc, dazu Voronoi-Regionen und Lloyd-Glättung. */
import { useMemo, useRef, useState } from "react";
import { zufall } from "@/lib/regeln/maschine";
import { lloyd, minAbstand, neuerPoisson, poisson, voronoi, zufallsPunkte, type Poisson, type Pt } from "@/lib/spielalgo/verteilen";
import { Buehne, Frage, Legende, Notiz, Rahmen, Regler, Steuerung, knopf, useAblauf } from "./gemeinsam";

const B = 300, H = 210, S = 2; // Fläche in Einheiten, Zeichenmaßstab

function zeichneFeld(ctx: CanvasRenderingContext2D, punkte: Pt[], mitVoronoi: boolean, r: number, extra?: (ctx: CanvasRenderingContext2D) => void) {
  ctx.fillStyle = "#e9f1dc";
  ctx.fillRect(0, 0, B * S, H * S);
  if (mitVoronoi && punkte.length) {
    const aufl = 3;
    const v = voronoi(punkte, B, H, aufl);
    const bb = Math.ceil(B / aufl);
    for (let i = 0; i < v.length; i++) {
      ctx.fillStyle = `hsl(${(v[i] * 137.5) % 360} 55% 80%)`;
      ctx.fillRect((i % bb) * aufl * S, Math.floor(i / bb) * aufl * S, aufl * S + 0.5, aufl * S + 0.5);
    }
  }
  // Abstandskreise zeigen, wo kein Nachbar hin darf
  ctx.strokeStyle = "rgba(22,101,52,0.18)";
  for (const p of punkte) { ctx.beginPath(); ctx.arc(p.x * S, p.y * S, (r / 2) * S, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = "#166534";
  for (const p of punkte) { ctx.beginPath(); ctx.arc(p.x * S, p.y * S, 3, 0, Math.PI * 2); ctx.fill(); }
  extra?.(ctx);
}

export default function Verteilen() {
  const [seed, setSeed] = useState(1);
  const [r, setR] = useState(16);
  const [mitVoronoi, setMitVoronoi] = useState(false);
  const [geglaettet, setGeglaettet] = useState<Pt[] | null>(null);
  const s = useRef<Poisson>(neuerPoisson(B, H, r));

  const ablauf = useAblauf(() => {
    s.current = neuerPoisson(B, H, r);
    setGeglaettet(null);
    return poisson(s.current, zufall(seed));
  }, [seed, r], 5);

  const poissonPunkte = geglaettet ?? s.current.punkte;
  const n = s.current.punkte.length;
  // Zufallspunkte in derselben Anzahl (feste Folge je Seed, wächst mit)
  const alleZufall = useMemo(() => zufallsPunkte(4000, B, H, zufall(seed + 7)), [seed]);
  const zufallPunkte = alleZufall.slice(0, n);

  const zeichneZufall = (ctx: CanvasRenderingContext2D) => zeichneFeld(ctx, zufallPunkte, mitVoronoi, r);
  const zeichnePoisson = (ctx: CanvasRenderingContext2D) => zeichneFeld(ctx, poissonPunkte, mitVoronoi, r, c => {
    const st = s.current;
    if (geglaettet || st.mitte < 0) return;
    // aktive Punkte, Suchring und Kandidaten
    c.fillStyle = "#e11d48";
    for (const i of st.aktiv) { const p = st.punkte[i]; c.beginPath(); c.arc(p.x * S, p.y * S, 3.5, 0, Math.PI * 2); c.fill(); }
    const m = st.punkte[st.mitte];
    c.strokeStyle = "#f59e0b";
    c.setLineDash([4, 4]);
    for (const rr of [st.r, 2 * st.r]) { c.beginPath(); c.arc(m.x * S, m.y * S, rr * S, 0, Math.PI * 2); c.stroke(); }
    c.setLineDash([]);
    for (const k of st.kandidaten) {
      c.fillStyle = k.ok ? "#16a34a" : "#9ca3af";
      c.fillRect(k.p.x * S - 2, k.p.y * S - 2, 4, 4);
    }
  });

  const dz = n > 1 ? minAbstand(zufallPunkte) : 0;
  const dp = poissonPunkte.length > 1 ? minAbstand(poissonPunkte) : 0;
  const takt = `${ablauf.takt}-${mitVoronoi}-${geglaettet ? geglaettet.length + geglaettet[0].x : 0}`;

  return (
    <Rahmen
      einstellungen={<>
        <Regler label="Mindestabstand r" wert={r} min={8} max={40} setWert={setR} />
        <label className="flex items-center gap-1"><input type="checkbox" checked={mitVoronoi} onChange={e => setMitVoronoi(e.target.checked)} /> Voronoi-Regionen</label>
        <button className={knopf} disabled={!ablauf.fertig} onClick={() => setGeglaettet(lloyd(poissonPunkte, B, H))} title="jeden Punkt in die Mitte seiner Region schieben">
          🧲 Lloyd-Schritt
        </button>
      </>}
      buehne={<>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <figure className="flex flex-col gap-1">
            <figcaption className="text-sm font-bold">🎲 reiner Zufall <span className="font-normal text-muted text-xs">– kleinster Abstand {dz.toFixed(1).replace(".", ",")}</span></figcaption>
            <Buehne b={B * S} h={H * S} takt={takt} zeichne={zeichneZufall} data-zufall />
          </figure>
          <figure className="flex flex-col gap-1">
            <figcaption className="text-sm font-bold">🌳 Poisson-Disc <span className="font-normal text-muted text-xs">– kleinster Abstand {dp.toFixed(1).replace(".", ",")}</span></figcaption>
            <Buehne b={B * S} h={H * S} takt={takt} zeichne={zeichnePoisson} data-poisson />
          </figure>
        </div>
        <p className="text-sm text-center text-muted">{n} Punkte auf beiden Seiten</p>
        <Notiz ablauf={ablauf} />
        <Steuerung ablauf={ablauf} seed={seed} setSeed={setSeed} />
      </>}
      erklaerung={<>
        <h3 className="font-black text-lg">Gleichmäßig, aber nicht im Raster</h3>
        <p>
          Stell dir einen Wald im Spiel vor. Mit <b>reinem Zufall</b> stehen manche Bäume ineinander, anderswo sind große Lücken.
          Im <b>Raster</b> sieht es aus wie eine Plantage. <b>Poisson-Disc</b> liegt dazwischen: Kein Baum steht näher als r am nächsten, und trotzdem wirkt es natürlich.
        </p>
        <h4 className="font-bold">So rechnet Bridsons Verfahren</h4>
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>Ein erster Punkt, er ist <span className="text-rose-600 font-bold">aktiv</span>.</li>
          <li>Um einen aktiven Punkt werden bis zu 30 Kandidaten im Ring zwischen r und 2r gewürfelt (gestrichelt).</li>
          <li>Hält ein Kandidat zu allen Punkten Abstand r, wird er gesetzt und ist auch aktiv.</li>
          <li>Klappt es 30-mal nicht, ist der Punkt umzingelt und wird inaktiv. Fertig, wenn keiner mehr aktiv ist.</li>
        </ol>
        <p>Damit das schnell geht, merkt sich ein Hilfsgitter, welcher Punkt in welchem Kästchen liegt. So muss man nur die Nachbarkästchen prüfen.</p>
        <h4 className="font-bold">Voronoi und Lloyd</h4>
        <p>
          Bei <b>Voronoi</b> gehört jeder Ort zum nächstgelegenen Punkt. So entstehen Länder, Reviere oder Felder für eine Strategiekarte.
          Ein <b>Lloyd-Schritt</b> schiebt jeden Punkt in die Mitte seiner Region. Nach ein paar Schritten werden die Regionen fast zu Bienenwaben.
        </p>
        <Legende eintraege={[["#e11d48", "aktiv"], ["#16a34a", "Kandidat passt"], ["#9ca3af", "Kandidat zu nah"]]} />
        <Frage>Vergleiche den kleinsten Abstand links und rechts. Schalte Voronoi ein: Welche Seite hätte gerechtere Länder? Drücke dann fünfmal Lloyd.</Frage>
      </>}
    />
  );
}
