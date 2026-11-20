"use client";
/** Zufall gegen Poisson-Disc, dazu Voronoi-Regionen und Lloyd-Glättung. */
import { useMemo, useRef, useState } from "react";
import { zufall } from "@/lib/regeln/maschine";
import { lloyd, minAbstand, neuerPoisson, poisson, voronoi, zufallsPunkte, type Metrik, type Poisson, type Pt } from "@/lib/spielalgo/verteilen";
import { gradientRauschen } from "@/lib/spielalgo/rauschen";
import { Buehne, Frage, Legende, Notiz, Rahmen, Regler, Steuerung, knopf, useAblauf } from "./gemeinsam";
import { Hinweis, Vertiefung, Wahl } from "./Vertiefung";
import { CODE_VERTEILEN } from "./code";

const B = 300, H = 210, S = 2; // Fläche in Einheiten, Zeichenmaßstab

function zeichneFeld(ctx: CanvasRenderingContext2D, punkte: Pt[], mitVoronoi: boolean, r: number, extra?: (ctx: CanvasRenderingContext2D) => void, metrik: Metrik = "euklid", rOrt?: (x: number, y: number) => number) {
  ctx.fillStyle = "#e9f1dc";
  ctx.fillRect(0, 0, B * S, H * S);
  if (mitVoronoi && punkte.length) {
    const aufl = 3;
    const v = voronoi(punkte, B, H, aufl, metrik);
    const bb = Math.ceil(B / aufl);
    for (let i = 0; i < v.length; i++) {
      ctx.fillStyle = `hsl(${(v[i] * 137.5) % 360} 55% 80%)`;
      ctx.fillRect((i % bb) * aufl * S, Math.floor(i / bb) * aufl * S, aufl * S + 0.5, aufl * S + 0.5);
    }
  }
  // Abstandskreise zeigen, wo kein Nachbar hin darf
  ctx.strokeStyle = "rgba(22,101,52,0.18)";
  for (const p of punkte) { ctx.beginPath(); ctx.arc(p.x * S, p.y * S, ((rOrt ? rOrt(p.x, p.y) : r) / 2) * S, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = "#166534";
  for (const p of punkte) { ctx.beginPath(); ctx.arc(p.x * S, p.y * S, 3, 0, Math.PI * 2); ctx.fill(); }
  extra?.(ctx);
}

export default function Verteilen() {
  const [seed, setSeed] = useState(1);
  const [r, setR] = useState(16);
  const [mitVoronoi, setMitVoronoi] = useState(false);
  const [geglaettet, setGeglaettet] = useState<Pt[] | null>(null);
  const [k, setK] = useState(30);
  const [ring, setRing] = useState(2);
  const [dichte, setDichte] = useState(false);
  const [metrik, setMetrik] = useState<Metrik>("euklid");
  const s = useRef<Poisson>(neuerPoisson(B, H, r));
  // ortsabhängiger Abstand aus Rauschen: Dickicht (r · 0,35) bis Lichtung (r)
  const rOrt = useMemo(() => {
    if (!dichte) return undefined;
    const n = gradientRauschen(seed + 5);
    return (x: number, y: number) => r * (0.35 + 0.65 * Math.min(1, Math.max(0, (n(x / 60, y / 60) + 0.7) / 1.4)));
  }, [dichte, seed, r]);

  const ablauf = useAblauf(() => {
    s.current = neuerPoisson(B, H, r, k, { ring, rOrt, rMin: r * 0.35 });
    setGeglaettet(null);
    return poisson(s.current, zufall(seed));
  }, [seed, r, k, ring, rOrt], 5);

  const poissonPunkte = geglaettet ?? s.current.punkte;
  const n = s.current.punkte.length;
  // Zufallspunkte in derselben Anzahl (feste Folge je Seed, wächst mit)
  const alleZufall = useMemo(() => zufallsPunkte(4000, B, H, zufall(seed + 7)), [seed]);
  const zufallPunkte = alleZufall.slice(0, n);

  const zeichneZufall = (ctx: CanvasRenderingContext2D) => zeichneFeld(ctx, zufallPunkte, mitVoronoi, r, undefined, metrik);
  const zeichnePoisson = (ctx: CanvasRenderingContext2D) => zeichneFeld(ctx, poissonPunkte, mitVoronoi, r, c => {
    const st = s.current;
    if (geglaettet || st.mitte < 0) return;
    // aktive Punkte, Suchring und Kandidaten
    c.fillStyle = "#e11d48";
    for (const i of st.aktiv) { const p = st.punkte[i]; c.beginPath(); c.arc(p.x * S, p.y * S, 3.5, 0, Math.PI * 2); c.fill(); }
    const m = st.punkte[st.mitte];
    c.strokeStyle = "#f59e0b";
    c.setLineDash([4, 4]);
    const rm = rOrt ? rOrt(m.x, m.y) : st.r;
    for (const rr of [rm, st.ring * rm]) { c.beginPath(); c.arc(m.x * S, m.y * S, rr * S, 0, Math.PI * 2); c.stroke(); }
    c.setLineDash([]);
    for (const kd of st.kandidaten) {
      c.fillStyle = kd.ok ? "#16a34a" : "#9ca3af";
      c.fillRect(kd.p.x * S - 2, kd.p.y * S - 2, 4, 4);
    }
  }, metrik, rOrt);

  const dz = n > 1 ? minAbstand(zufallPunkte) : 0;
  const dp = poissonPunkte.length > 1 ? minAbstand(poissonPunkte) : 0;
  const takt = `${ablauf.takt}-${mitVoronoi}-${metrik}-${geglaettet ? geglaettet.length + geglaettet[0].x : 0}`;

  return (
    <Rahmen
      einstellungen={<>
        <Regler label="Mindestabstand r" wert={r} min={8} max={40} setWert={setR} />
        <label className="flex items-center gap-1"><input type="checkbox" checked={mitVoronoi} onChange={e => setMitVoronoi(e.target.checked)} /> Voronoi-Regionen</label>
        <button className={knopf} disabled={!ablauf.fertig} onClick={() => setGeglaettet(lloyd(poissonPunkte, B, H))} title="jeden Punkt in die Mitte seiner Region schieben">
          🧲 Lloyd-Schritt
        </button>
      </>}
      vertiefung={
        <Vertiefung
          code={CODE_VERTEILEN}
          hintergrund={<>
            <p>
              Robert Bridson hat 2007 gezeigt, wie man Poisson-Disc in linearer Zeit erzeugt. Der Trick ist das <b>Hilfsgitter</b>:
              Seine Kästchen sind so klein (r / √2), dass in jedes höchstens ein Punkt passt. Ob ein Kandidat zu nah ist, sieht man dann an wenigen Nachbarkästchen.
            </p>
            <p>
              In Spielen bekommt r oft einen <b>Ort</b>: dichter Wald am Fluss, lichter auf dem Hügel. Schalte »Dichte aus Rauschen« ein –
              dann gilt zwischen zwei Punkten der größere ihrer beiden Abstände.
            </p>
            <p>Die <b>Abstandsart</b> ändert die Form der Voronoi-Grenzen: euklidisch (Luftlinie) gibt schräge Kanten, Manhattan (nur waagrecht und senkrecht laufen) rautenförmige, Tschebyschow (wie der König im Schach) achteckige.</p>
          </>}
          stellschrauben={<>
            <Regler label="Versuche k" wert={k} min={1} max={60} setWert={setK} />
            <Hinweis>wenige Versuche = schneller, aber Lücken bleiben; Bridson empfiehlt 30</Hinweis>
            <Regler label="Suchring bis" wert={ring} min={1.2} max={4} schritt={0.1} setWert={setRing} anzeige={`${ring.toFixed(1).replace(".", ",")}·r`} />
            <Hinweis>breiter Ring = Punkte weiter verstreut, mehr Fehlversuche am Ende</Hinweis>
            <label className="flex items-center gap-1"><input type="checkbox" checked={dichte} onChange={e => setDichte(e.target.checked)} /> Dichte aus Rauschen (Dickicht und Lichtungen)</label>
            <Wahl label="Abstand für Voronoi" wert={metrik} setWert={m => { setMetrik(m); setMitVoronoi(true); }}
              optionen={[["euklid", "euklidisch (Luftlinie)"], ["manhattan", "Manhattan (Taxi)"], ["tschebyschow", "Tschebyschow (König)"]]} />
          </>}
        />
      }
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
