"use client";
/** Wegsuche: Dijkstra, A* und Greedy auf Gelände mit Kosten, dazu ein Flowfield mit vielen Figuren. */
import { useEffect, useRef, useState } from "react";
import { zufall } from "@/lib/regeln/maschine";
import { gradientRauschen } from "@/lib/spielalgo/rauschen";
import { RICHTUNGEN, ZUSTAND, flowfield, neueSuche, suche, type Feld, type Flowfield, type Heuristik, type SuchStand, type Suche } from "@/lib/spielalgo/wege";
import { Buehne, Frage, Legende, Notiz, Rahmen, Regler, Steuerung, auswahl, knopf, useAblauf } from "./gemeinsam";
import { Hinweis, Vertiefung, Wahl } from "./Vertiefung";
import { CODE_WEGE } from "./code";

const B = 40, H = 26, PX = 18;
const SUCHEN: Record<Suche, { name: string; text: string }> = {
  dijkstra: { name: "Dijkstra", text: "Nimmt immer das Feld mit den kleinsten Kosten seit dem Start. Breitet sich wie eine Welle aus, im Sumpf langsamer. Findet sicher den billigsten Weg, schaut aber sehr viel an." },
  astar: { name: "A*", text: "Wie Dijkstra, rechnet aber die geschätzte Reststrecke dazu: f = g (Kosten bisher) + h (Luftlinie zum Ziel). Die Welle wird zum Ziel hin gezogen. Billigster Weg bei viel weniger Arbeit." },
  greedy: { name: "Greedy (gierig)", text: "Schaut nur auf die Luftlinie h und stürmt los. Sehr schnell, aber blind für Sumpf und Umwege: Der Weg ist oft nicht der billigste." },
};
type Pinsel = "wand" | "sumpf" | "weg" | "start" | "ziel";
const PINSEL: { id: Pinsel; name: string }[] = [
  { id: "wand", name: "🧱 Wand" }, { id: "sumpf", name: "🟫 Sumpf" }, { id: "weg", name: "🧽 frei" }, { id: "start", name: "🟢 Start" }, { id: "ziel", name: "🏁 Ziel" },
];
const SUMPF = 5;

function erzeugeFeld(seed: number): Feld {
  const r = gradientRauschen(seed), r2 = gradientRauschen(seed + 99);
  const kosten = new Uint8Array(B * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < B; x++) {
    const w = r(x / 6, y / 6), s = r2(x / 8, y / 8);
    kosten[y * B + x] = w > 0.32 ? 0 : s > 0.2 ? SUMPF : 1;
  }
  return { b: B, h: H, kosten };
}

interface Zeile { art: Suche; besucht: number; kosten: number; laenge: number }

export default function Wegsuche() {
  const [seed, setSeed] = useState(3);
  const [art, setArt] = useState<Suche>("astar");
  const [pinsel, setPinsel] = useState<Pinsel>("wand");
  const [version, setVersion] = useState(0);
  const [modus, setModus] = useState<"suche" | "flow">("suche");
  const [vergleich, setVergleich] = useState<Zeile[]>([]);
  const [gewicht, setGewicht] = useState(1);
  const [heuristik, setHeuristik] = useState<Heuristik>("manhattan");
  const [diagonal, setDiagonal] = useState(false);
  const [sumpf, setSumpfRoh] = useState(SUMPF);
  const feld = useRef<Feld>(erzeugeFeld(seed));
  /** Sumpfkosten ändern: alle Sumpffelder bekommen den neuen Preis */
  const setSumpf = (v: number) => {
    const k = feld.current.kosten;
    for (let i = 0; i < k.length; i++) if (k[i] > 1) k[i] = v;
    setSumpfRoh(v);
    setVergleich([]);
    setVersion(x => x + 1);
  };
  const start = useRef(13 * B + 2);
  const ziel = useRef(13 * B + 37);
  const s = useRef<SuchStand>(neueSuche(feld.current));

  // neuer Seed → neues Gelände, Start/Ziel freiräumen
  useEffect(() => {
    feld.current = erzeugeFeld(seed);
    const k = feld.current.kosten;
    for (let i = 0; i < k.length; i++) if (k[i] > 1) k[i] = sumpf;
    for (const i of [start.current, ziel.current]) k[i] = 1;
    setVergleich([]);
    setVersion(v => v + 1);
  }, [seed]);

  const ablauf = useAblauf(() => {
    s.current = neueSuche(feld.current);
    const gen = suche(feld.current, start.current, ziel.current, art, s.current, { gewicht, heuristik, diagonal });
    return (function* () {
      const r = yield* gen;
      const st = s.current;
      setVergleich(v => [...v.filter(z => z.art !== art), { art, besucht: st.besucht, kosten: st.wegKosten, laenge: st.weg.length }]);
      return r;
    })();
  }, [art, version, gewicht, heuristik, diagonal], 5);

  // Flowfield + Figuren
  const ff = useRef<Flowfield | null>(null);
  const figuren = useRef<{ x: number; y: number }[]>([]);
  const [flowTakt, setFlowTakt] = useState(0);
  useEffect(() => {
    if (modus !== "flow") return;
    ff.current = flowfield(feld.current, ziel.current);
    const rng = zufall(seed + version);
    const freiesFeld = () => {
      for (let t = 0; t < 1000; t++) {
        const i = Math.floor(rng() * B * H);
        if (feld.current.kosten[i] && ff.current!.dist[i] < Infinity && i !== ziel.current) return { x: (i % B) + 0.5, y: Math.floor(i / B) + 0.5 };
      }
      return { x: 0.5, y: 0.5 };
    };
    figuren.current = Array.from({ length: 60 }, freiesFeld);
    let id = 0;
    const tick = () => {
      const f = ff.current!;
      for (const p of figuren.current) {
        const i = Math.floor(p.y) * B + Math.floor(p.x);
        const r = f.richtung[i];
        if (r < 0) { Object.assign(p, freiesFeld()); continue; }
        const [dx, dy] = RICHTUNGEN[r];
        const tx = Math.floor(p.x) + dx + 0.5, ty = Math.floor(p.y) + dy + 0.5;
        const v = 0.09 / feld.current.kosten[i];
        const d = Math.hypot(tx - p.x, ty - p.y) || 1;
        p.x += ((tx - p.x) / d) * v;
        p.y += ((ty - p.y) / d) * v;
      }
      setFlowTakt(t => t + 1);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [modus, version, seed]);

  const malen = useRef(false);
  const male = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget, rect = c.getBoundingClientRect();
    // object-contain: tatsächliche Bildfläche im Element berechnen
    const sk = Math.min(rect.width / c.width, rect.height / c.height);
    const ox = (rect.width - c.width * sk) / 2, oy = (rect.height - c.height * sk) / 2;
    const x = Math.floor((e.clientX - rect.left - ox) / sk / PX), y = Math.floor((e.clientY - rect.top - oy) / sk / PX);
    if (x < 0 || y < 0 || x >= B || y >= H) return;
    const i = y * B + x, k = feld.current.kosten;
    if (pinsel === "start" || pinsel === "ziel") {
      if (!k[i]) k[i] = 1;
      if (pinsel === "start" && i !== ziel.current) start.current = i;
      if (pinsel === "ziel" && i !== start.current) ziel.current = i;
    } else {
      if (i === start.current || i === ziel.current) return;
      const neu = pinsel === "wand" ? 0 : pinsel === "sumpf" ? sumpf : 1;
      if (k[i] === neu) return;
      k[i] = neu;
    }
    setVergleich([]);
    setVersion(v => v + 1);
  };

  const zeichne = (ctx: CanvasRenderingContext2D) => {
    const f = feld.current, st = s.current, flow = modus === "flow" ? ff.current : null;
    let maxD = 1;
    if (flow) for (const d of flow.dist) if (d < Infinity && d > maxD) maxD = d;
    for (let i = 0; i < B * H; i++) {
      const x = (i % B) * PX, y = Math.floor(i / B) * PX, k = f.kosten[i];
      ctx.fillStyle = !k ? "#1f2937" : k > 1 ? "#a3895b" : "#f5efe6";
      ctx.fillRect(x, y, PX, PX);
      if (!k) continue;
      if (flow) {
        const d = flow.dist[i];
        if (d < Infinity) { ctx.fillStyle = `hsla(${200 - (d / maxD) * 200} 80% 55% / 0.35)`; ctx.fillRect(x, y, PX, PX); }
      } else if (st.zustand[i] === ZUSTAND.FERTIG) { ctx.fillStyle = "rgba(139,92,246,0.35)"; ctx.fillRect(x, y, PX, PX); }
      else if (st.zustand[i] === ZUSTAND.OFFEN) { ctx.fillStyle = "rgba(56,189,248,0.55)"; ctx.fillRect(x, y, PX, PX); }
    }
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    for (let x = 0; x <= B; x++) { ctx.beginPath(); ctx.moveTo(x * PX, 0); ctx.lineTo(x * PX, H * PX); ctx.stroke(); }
    for (let y = 0; y <= H; y++) { ctx.beginPath(); ctx.moveTo(0, y * PX); ctx.lineTo(B * PX, y * PX); ctx.stroke(); }
    const mitte = (i: number) => [(i % B) * PX + PX / 2, Math.floor(i / B) * PX + PX / 2];
    if (flow) {
      ctx.strokeStyle = "rgba(15,23,42,0.55)";
      ctx.lineWidth = 1.2;
      for (let i = 0; i < B * H; i++) {
        const r = flow.richtung[i];
        if (r < 0) continue;
        const [cx, cy] = mitte(i), [dx, dy] = RICHTUNGEN[r], l = PX * 0.32 / Math.hypot(dx, dy);
        ctx.beginPath(); ctx.moveTo(cx - dx * l, cy - dy * l); ctx.lineTo(cx + dx * l, cy + dy * l); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + dx * l, cy + dy * l, 1.6, 0, Math.PI * 2); ctx.fillStyle = "rgba(15,23,42,0.55)"; ctx.fill();
      }
      ctx.fillStyle = "#e11d48";
      for (const p of figuren.current) { ctx.beginPath(); ctx.arc(p.x * PX, p.y * PX, 4, 0, Math.PI * 2); ctx.fill(); }
    } else {
      if (st.weg.length > 1) {
        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = 5;
        ctx.lineJoin = "round";
        ctx.beginPath();
        st.weg.forEach((i, n) => { const [x, y] = mitte(i); if (n) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke();
      }
      if (st.aktuell >= 0 && !st.gefunden) {
        const [x, y] = mitte(st.aktuell);
        ctx.strokeStyle = "#e11d48"; ctx.lineWidth = 3;
        ctx.strokeRect(x - PX / 2 + 1.5, y - PX / 2 + 1.5, PX - 3, PX - 3);
      }
    }
    ctx.font = `${PX - 3}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const [sx, sy] = mitte(start.current), [zx, zy] = mitte(ziel.current);
    if (!flow) ctx.fillText("🟢", sx, sy);
    ctx.fillText("🏁", zx, zy);
  };

  return (
    <Rahmen
      einstellungen={<>
        <div className="inline-flex rounded-lg border border-line p-0.5 bg-surface">
          {(["suche", "flow"] as const).map(m => (
            <button key={m} onClick={() => setModus(m)} className={`px-2.5 py-1 rounded-md text-sm font-bold ${modus === m ? "bg-accent text-accent-fg" : "text-muted"}`}>
              {m === "suche" ? "🔎 ein Weg" : "🌊 Flowfield"}
            </button>
          ))}
        </div>
        {modus === "suche" && (
          <label className="flex items-center gap-1">Verfahren
            <select value={art} onChange={e => setArt(e.target.value as Suche)} className={auswahl}>
              {(Object.keys(SUCHEN) as Suche[]).map(k => <option key={k} value={k}>{SUCHEN[k].name}</option>)}
            </select>
          </label>
        )}
        <span className="flex flex-wrap items-center gap-1">Malen:
          {PINSEL.map(p => (
            <button key={p.id} onClick={() => setPinsel(p.id)} className={`${knopf} py-1 ${pinsel === p.id ? "border-accent! bg-accent/15" : ""}`}>{p.name}</button>
          ))}
        </span>
      </>}
      vertiefung={
        <Vertiefung
          code={CODE_WEGE}
          hintergrund={<>
            <p>
              Edsger Dijkstra schrieb sein Verfahren 1956 in zwanzig Minuten in einem Café. A* kam 1968 dazu, für den Roboter »Shakey«.
              Bis heute laufen damit Figuren in fast jedem Spiel und die Routen im Navi.
            </p>
            <p>
              A* findet nur dann sicher den billigsten Weg, wenn die Schätzung h <b>nie zu hoch</b> ist. Die Luftlinie ist so eine ehrliche Schätzung.
              Mit <b>Gewicht</b> über 1 schätzt A* absichtlich zu hoch: Er wird schneller und gieriger, der Weg aber manchmal teurer.
              Viele Spiele nehmen das in Kauf.
            </p>
            <p>Mit »schräg gehen« kostet ein Schritt über Eck 1,4 (ungefähr √2). Ecken von Wänden werden nicht geschnitten, sonst würde man durch die Mauer schlüpfen.</p>
          </>}
          stellschrauben={<>
            <Regler label="Gewicht für h" wert={gewicht} min={0} max={5} schritt={0.25} setWert={v => { setGewicht(v); setArt("astar"); setModus("suche"); }} anzeige={gewicht.toString().replace(".", ",")} />
            <Hinweis>nur für A*: 0 = Dijkstra, 1 = klassisch, groß = fast wie Greedy</Hinweis>
            <Wahl label="Schätzung h" wert={heuristik} setWert={setHeuristik} optionen={[["manhattan", "Manhattan (Kästchen zählen)"], ["euklid", "Luftlinie (euklidisch)"], ["keine", "keine (h = 0)"]]} />
            <label className="flex items-center gap-1"><input type="checkbox" checked={diagonal} onChange={e => setDiagonal(e.target.checked)} /> auch schräg gehen</label>
            <Regler label="Sumpf kostet" wert={sumpf} min={2} max={20} setWert={setSumpf} />
            <Hinweis>teurer Sumpf: Dijkstra und A* laufen weite Umwege, Greedy stapft trotzdem hindurch</Hinweis>
          </>}
        />
      }
      buehne={<>
        <Buehne b={B * PX} h={H * PX} takt={`${ablauf.takt}-${flowTakt}-${version}`} zeichne={zeichne} klasse="touch-none cursor-crosshair" data-wegsuche
          onPointerDown={e => { malen.current = true; e.currentTarget.setPointerCapture(e.pointerId); male(e); }}
          onPointerMove={e => { if (malen.current && pinsel !== "start" && pinsel !== "ziel") male(e); }}
          onPointerUp={() => { malen.current = false; }} />
        {modus === "suche" ? <>
          <Notiz ablauf={ablauf} />
          <Steuerung ablauf={ablauf} seed={seed} setSeed={setSeed} />
        </> : (
          <div className="flex justify-center items-center gap-2 text-sm">
            <span className="text-muted">60 Figuren folgen den Pfeilen. Male Wände, das Feld rechnet sofort neu.</span>
            <button className={knopf} onClick={() => setSeed(seed + 1)}>🎲 neues Gelände</button>
          </div>
        )}
      </>}
      erklaerung={modus === "suche" ? <>
        <h3 className="font-black text-lg">{SUCHEN[art].name}</h3>
        <p>{SUCHEN[art].text}</p>
        <Legende eintraege={[["#1f2937", "Wand"], ["#a3895b", `Sumpf (kostet ${sumpf})`], ["rgba(56,189,248,0.55)", "offene Liste"], ["rgba(139,92,246,0.35)", "fertig untersucht"], ["#eab308", "Weg"]]} />
        <table className="text-xs w-full" data-vergleich>
          <thead><tr className="text-left text-muted"><th>Verfahren</th><th className="text-right">untersucht</th><th className="text-right">Kosten</th><th className="text-right">Felder</th></tr></thead>
          <tbody>
            {(Object.keys(SUCHEN) as Suche[]).map(k => {
              const z = vergleich.find(v => v.art === k);
              return (
                <tr key={k} className={`border-t border-line ${k === art ? "font-bold" : ""}`}>
                  <td>{SUCHEN[k].name}</td>
                  <td className="text-right font-mono">{z?.besucht ?? "–"}</td>
                  <td className="text-right font-mono">{z ? (z.kosten < 0 ? "kein Weg" : z.kosten) : "–"}</td>
                  <td className="text-right font-mono">{z?.laenge || "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Frage>Lass alle drei Verfahren laufen. Welches untersucht am wenigsten Felder? Welches findet den billigsten Weg? Male einen Sumpf quer über den direkten Weg: Was macht Greedy jetzt?</Frage>
      </> : <>
        <h3 className="font-black text-lg">Flowfield: einmal rechnen, alle laufen</h3>
        <p>
          In Strategiespielen wollen oft hundert Figuren zum selben Ziel. Für jede einzeln A* zu rechnen, wäre teuer.
          Stattdessen rechnet man <b>einmal rückwärts vom Ziel aus</b> (Dijkstra über das ganze Feld): Jedes Feld kennt dann seine Kosten bis zum Ziel (Farbe).
        </p>
        <p>Danach zeigt in jedem Feld ein Pfeil zum Nachbarn mit den kleinsten Kosten. Eine Figur schaut nur auf den Pfeil unter sich – egal, wo sie startet.</p>
        <Legende eintraege={[["hsla(200 80% 55% / 0.5)", "nah am Ziel"], ["hsla(0 80% 55% / 0.5)", "weit weg"], ["#e11d48", "Figur"]]} />
        <Frage>Mauere das Ziel fast ganz ein und lass eine Lücke. Wohin zeigen die Pfeile jetzt? Warum werden die Figuren im Sumpf langsamer, laufen aber trotzdem manchmal hindurch?</Frage>
      </>}
    />
  );
}
