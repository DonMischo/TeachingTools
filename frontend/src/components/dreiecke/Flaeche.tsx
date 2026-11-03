"use client";
/**
 * Blatt »Umfang und Fläche«: Grundseite g, Höhe h und Lage der Spitze per
 * Regler. Der Umfang wird als Streifen abgerollt, die Flächenformel
 * A = g · h : 2 entsteht im Trickfilm durch Ergänzen — zum Parallelogramm
 * (Kopie um die Seitenmitte gedreht) oder zum Rechteck (die beiden Teile
 * neben der Höhe klappen nach außen). Dazu die Kongruenzsätze als
 * Konstruktions-Hinweis.
 */
import { useEffect, useRef, useState } from "react";
import { z } from "@/lib/prozent";
import { ausWinkeln, mitte, seitenLaengen, type Dreieck } from "@/lib/dreiecke";
import type { Pt } from "@/lib/geometrie/skizze";
import { SkizzenBild } from "@/components/geometrie/Skizze";
import { skizzeDreieck } from "@/lib/dreiecke-aufgaben";
import Zeichenblatt, { FARBE, Linie, RechterWinkel, SeitenText, T, Txt } from "./Zeichenblatt";

const pfad = (pts: Pt[]) => pts.map(p => { const q = T(p); return `${q.x},${q.y}`; }).join(" ");
const dreh = (m: Pt, grad: number) => { const c = T(m); return `rotate(${grad} ${c.x} ${c.y})`; };

function UmfangFlaeche() {
  const [g, setG] = useState(7);
  const [h, setH] = useState(4);
  const [p, setP] = useState(2);
  const [weg, setWeg] = useState<"parallelogramm" | "rechteck">("parallelogramm");
  const [t, setT] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const raf = useRef(0);
  useEffect(() => {
    if (!laeuft) return;
    const start = performance.now() - t * 2200;
    const s = (j: number) => { const x = Math.min(1, (j - start) / 2200); setT(x); if (x < 1) raf.current = requestAnimationFrame(s); else setLaeuft(false); };
    raf.current = requestAnimationFrame(s);
    return () => cancelAnimationFrame(raf.current);
  }, [laeuft]); // eslint-disable-line react-hooks/exhaustive-deps

  const x0 = Math.max(0.5, 0.5 - Math.min(0, p)), y0 = 7.5;
  const A = { x: x0, y: y0 }, B = { x: x0 + g, y: y0 }, C = { x: x0 + p, y: y0 - h }, F = { x: C.x, y: y0 };
  const d: Dreieck = [A, B, C];
  const s = seitenLaengen(d), u = s.a + s.b + s.c, flaeche = g * h / 2;
  const rechteckGeht = p >= 0 && p <= g;
  const innen = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
  const zuruecksetzen = () => { setLaeuft(false); setT(0); };

  // Parallelogramm: Kopie um die Mitte von BC gedreht; Rechteck: Teile links/rechts der Höhe um die Mitten von AC bzw. BC
  const ergaenzung = weg === "parallelogramm" ? (
    <g transform={dreh(mitte(B, C), 180 * t)}>
      <polygon points={pfad(d)} fill={FARBE.gamma} fillOpacity={0.3} stroke={FARBE.gamma} strokeWidth={2} strokeDasharray="6 4" />
    </g>
  ) : rechteckGeht ? (
    <>
      <g transform={dreh(mitte(A, C), 180 * t)}><polygon points={pfad([A, F, C])} fill={FARBE.alpha} fillOpacity={0.3} stroke={FARBE.alpha} strokeWidth={2} strokeDasharray="6 4" /></g>
      <g transform={dreh(mitte(B, C), -180 * t)}><polygon points={pfad([F, B, C])} fill={FARBE.beta} fillOpacity={0.3} stroke={FARBE.beta} strokeWidth={2} strokeDasharray="6 4" /></g>
    </>
  ) : null;

  // Umfang als abgerollter Streifen unter der Zeichnung
  const st = 8.9, sk = Math.min(1, 13 / u);
  const teile = [{ l: s.c, f: FARBE.alpha, n: "c" }, { l: s.a, f: FARBE.beta, n: "a" }, { l: s.b, f: FARBE.gamma, n: "b" }];
  let lauf = 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
      <Zeichenblatt d={d} label="Dreieck mit Grundseite und Höhe" namen
        hinten={t > 0 ? ergaenzung : null}
        kinder={<>
          {(p < 0 || p > g) && <Linie a={p < 0 ? A : B} b={F} gestrichelt />}
          <Linie a={C} b={F} farbe={FARBE.rot} gestrichelt breite={2.5} />
          <RechterWinkel p={F} q={C} r={p > g / 2 ? A : B} farbe={FARBE.rot} />
          <SeitenText a={A} b={B} innen={innen}>{`g = ${z(g)} cm`}</SeitenText>
          <Txt p={{ x: T(C).x + 34, y: (T(C).y + T(F).y) / 2 }} farbe={FARBE.rot}>{`h = ${z(h)} cm`}</Txt>
          <SeitenText a={B} b={C} innen={innen} farbe="var(--text-muted)" groesse={13}>{`a ≈ ${z(s.a, 1)}`}</SeitenText>
          <SeitenText a={C} b={A} innen={innen} farbe="var(--text-muted)" groesse={13}>{`b ≈ ${z(s.b, 1)}`}</SeitenText>
          {teile.map(x => {
            const a = { x: 0 + lauf * sk, y: st }, b = { x: (lauf + x.l) * sk, y: st };
            lauf += x.l;
            return (
              <g key={x.n}>
                <Linie a={a} b={b} farbe={x.f} breite={8} />
                <Txt p={{ x: (T(a).x + T(b).x) / 2, y: T(a).y - 14 }} farbe={x.f} groesse={12}>{x.n}</Txt>
              </g>
            );
          })}
          <Txt p={{ x: T({ x: lauf * sk, y: st }).x + 40, y: T({ x: 0, y: st }).y }} groesse={13}>{`u ≈ ${z(u, 1)}`}</Txt>
        </>} />
      <div className="flex flex-col gap-3">
        <div className="card p-4 flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2"><span className="w-24">g = {z(g)} cm</span><input type="range" className="flex-1" min={2} max={10} step={0.5} value={g} aria-label="Grundseite g" onChange={e => { setG(Number(e.target.value)); zuruecksetzen(); }} /></label>
          <label className="flex items-center gap-2"><span className="w-24">h = {z(h)} cm</span><input type="range" className="flex-1" min={1} max={7} step={0.5} value={h} aria-label="Höhe h" onChange={e => { setH(Number(e.target.value)); zuruecksetzen(); }} /></label>
          <label className="flex items-center gap-2"><span className="w-24">Spitze</span><input type="range" className="flex-1" min={-2} max={Math.min(13 - g, g + 2)} step={0.5} value={p} aria-label="Lage der Spitze" onChange={e => { setP(Number(e.target.value)); zuruecksetzen(); }} /></label>
          <p className="text-muted">Schieb die Spitze waagrecht: Die Fläche bleibt gleich, solange g und h gleich bleiben — der Umfang nicht.</p>
        </div>
        <div className="card p-4 flex flex-col gap-2 text-sm">
          <h3 className="font-black">Umfang</h3>
          <p>u = a + b + c ≈ {z(s.a, 1)} + {z(s.b, 1)} + {z(s.c, 1)} ≈ <strong>{z(u, 1)} cm</strong></p>
          <h3 className="font-black mt-2">Fläche</h3>
          <div className="flex flex-wrap gap-1.5">
            <button className={`chip ${weg === "parallelogramm" ? "chip-on" : ""}`} onClick={() => { setWeg("parallelogramm"); zuruecksetzen(); }}>zum Parallelogramm ergänzen</button>
            <button className={`chip ${weg === "rechteck" ? "chip-on" : ""}`} onClick={() => { setWeg("rechteck"); zuruecksetzen(); }}>zum Rechteck ergänzen</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" onClick={() => { if (t >= 1) setT(0); setLaeuft(true); }} disabled={laeuft || (weg === "rechteck" && !rechteckGeht)}>▶ Ergänzen</button>
            <input type="range" min={0} max={1} step={0.01} value={t} className="flex-1 min-w-24" aria-label="Fortschritt" onChange={e => { setLaeuft(false); setT(Number(e.target.value)); }} />
          </div>
          {weg === "rechteck" && !rechteckGeht
            ? <p className="text-bad">Der Fußpunkt der Höhe liegt nicht auf g — so klappt das Rechteck nicht. Nimm das Parallelogramm.</p>
            : <p>{weg === "parallelogramm"
              ? "Eine Kopie des Dreiecks, um die Mitte von BC gedreht, ergänzt es zu einem Parallelogramm mit A = g · h. Das Dreieck ist genau die Hälfte."
              : "Die Höhe teilt das Dreieck in zwei rechtwinklige Teile. Jedes klappt nach außen und füllt das Rechteck g × h — das Dreieck ist die Hälfte davon."}</p>}
          <p className="text-lg font-black">A = g · h : 2 = {z(g)} · {z(h)} : 2 = {z(flaeche)} cm²</p>
        </div>
      </div>
    </div>
  );
}

const SAETZE: { id: string; name: string; text: string; schritte: string[]; achtung?: string; b: Parameters<typeof skizzeDreieck>[1] }[] = [
  {
    id: "SSS", name: "SSS — drei Seiten", text: "Stimmen zwei Dreiecke in allen drei Seiten überein, sind sie kongruent.",
    schritte: ["Seite c zeichnen (A und B).", "Kreis um A mit Radius b, Kreis um B mit Radius a.", "Schnittpunkt der Kreise ist C."],
    achtung: "Geht nur, wenn jede Seite kürzer ist als die beiden anderen zusammen (Dreiecksungleichung).",
    b: { a: "a", b: "b", c: "c" },
  },
  {
    id: "SWS", name: "SWS — zwei Seiten und der Winkel dazwischen", text: "Zwei Seiten und der eingeschlossene Winkel legen das Dreieck fest.",
    schritte: ["Seite c zeichnen.", "In A den Winkel α antragen.", "Auf dem freien Schenkel b abmessen — das ist C. C mit B verbinden."],
    b: { b: "b", c: "c", alpha: "α" },
  },
  {
    id: "WSW", name: "WSW — eine Seite und die beiden Winkel daran", text: "Eine Seite und die beiden anliegenden Winkel legen das Dreieck fest.",
    schritte: ["Seite c zeichnen.", "In A den Winkel α, in B den Winkel β antragen.", "Die freien Schenkel schneiden sich in C."],
    achtung: "Ist ein Winkel nicht anliegend, rechnet man ihn mit der Winkelsumme um (WWS → WSW). α + β muss unter 180° bleiben.",
    b: { c: "c", alpha: "α", beta: "β" },
  },
  {
    id: "SsW", name: "SsW — zwei Seiten und der Winkel gegenüber der größeren", text: "Liegt der Winkel der längeren der beiden Seiten gegenüber, ist das Dreieck eindeutig.",
    schritte: ["Seite b zeichnen (A und C).", "In A den Winkel α antragen.", "Kreis um C mit Radius a — er schneidet den freien Schenkel in B."],
    achtung: "Liegt der Winkel der kürzeren Seite gegenüber, kann der Kreis zweimal schneiden: zwei verschiedene Dreiecke. Drei Winkel (WWW) legen nur die Form fest, nicht die Größe.",
    b: { a: "a (lang)", b: "b", alpha: "α" },
  },
];

function Kongruenz() {
  const d = ausWinkeln(6, 62, 48);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted max-w-3xl">
        Zwei Dreiecke sind <strong>kongruent</strong> (deckungsgleich), wenn man sie genau aufeinanderlegen kann. Man muss dafür nicht alle sechs
        Stücke vergleichen — drei passende reichen. Genau diese drei braucht man auch, um ein Dreieck eindeutig zu konstruieren.
        Markiert ist jeweils, was gegeben ist.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {SAETZE.map(s => (
          <div key={s.id} className="card p-4 flex flex-col gap-2 text-sm">
            <h3 className="font-black">{s.name}</h3>
            <p>{s.text}</p>
            <SkizzenBild s={skizzeDreieck(d, s.b)} label={`Kongruenzsatz ${s.id}`} />
            <ol className="list-decimal pl-5 flex flex-col gap-0.5">{s.schritte.map(x => <li key={x}>{x}</li>)}</ol>
            {s.achtung && <p className="text-muted">⚠ {s.achtung}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Flaeche() {
  const [ansicht, setAnsicht] = useState<"flaeche" | "kongruenz">("flaeche");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ansicht">
        <button className={`chip ${ansicht === "flaeche" ? "chip-on" : ""}`} aria-pressed={ansicht === "flaeche"} onClick={() => setAnsicht("flaeche")}>Umfang und Fläche</button>
        <button className={`chip ${ansicht === "kongruenz" ? "chip-on" : ""}`} aria-pressed={ansicht === "kongruenz"} onClick={() => setAnsicht("kongruenz")}>Kongruenzsätze</button>
      </div>
      {ansicht === "flaeche" ? <UmfangFlaeche /> : <Kongruenz />}
    </div>
  );
}
