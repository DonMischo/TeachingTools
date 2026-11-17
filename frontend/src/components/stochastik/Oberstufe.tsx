"use client";
/** Kl. 9/10: Vierfeldertafel und bedingte Wahrscheinlichkeit, Kombinatorik, Zufallsgrößen. */
import { useContext, useMemo, useState } from "react";
import { ausBaum, unabhaengig, voll, zuBaumA, zuBaumB, type FeldName, type Tafel } from "@/lib/stochastik/vierfelder";
import { anzahl, aufzaehlen, augensumme, erwartungswert, faktoren, fakultaet, pSumme, summenTerm, verteilung, type Wert, type Ziehart } from "@/lib/stochastik/kombinatorik";
import { bruch, bt, prozent, wert, zahl, type Bruch } from "@/lib/stochastik/zahlen";
import type { Knoten } from "@/lib/stochastik/zufall";
import { Baum, Histogramm, TafelAnsicht } from "./diagramme";
import { Chips, Kachel, Kasten, LektionsKopf, Navi, useMelden } from "./ui";

// ── Vierfeldertafel ──────────────────────────────────────────────────────

/** »P_A(B)« mit echtem Index schreiben. */
function P({ t }: { t: string }) {
  return <>{t.split(/(P_[^(]+)/).map((s, i) => (s.startsWith("P_") ? <span key={i}>P<sub>{s.slice(2)}</sub></span> : s))}</>;
}

const SZENARIEN = [
  { id: "rad", a: "Mädchen", nA: "Junge", b: "fährt Rad", nB: "fährt nicht Rad", t: { ab: 54, aNb: 66, nAb: 72, nAnB: 48 }, text: "240 Kinder einer Schule (erfundene Zahlen)." },
  { id: "test", a: "infiziert", nA: "gesund", b: "Test positiv", nB: "Test negativ", t: { ab: 19, aNb: 1, nAb: 49, nAnB: 931 }, text: "1 000 Personen, ein Schnelltest (erfundene Zahlen, Größenordnung wie echte Tests)." },
  { id: "unab", a: "Brillenträger·in", nA: "keine Brille", b: "Linkshänder·in", nB: "Rechtshänder·in", t: { ab: 6, aNb: 24, nAb: 14, nAnB: 56 }, text: "100 Befragte – hier ist das eine vom anderen unabhängig." },
];
type BedId = "BA" | "BnA" | "AB" | "AnB";

function baumKnoten(p1: number, p2: number, p2n: number, a: string, b: string): Knoten {
  const br = (x: number): Bruch => bruch(Math.round(x * 10000), 10000);
  const blatt = (pfad: string[], p: number, pp: number, id: string, farbe: string): Knoten => ({ pfad, p: br(p), pPfad: br(pp), ausgang: { id, label: id, farbe, p: br(p) }, kinder: [] });
  const ast = (id: string, farbe: string, p: number, q: number): Knoten => ({
    pfad: [id], p: br(p), pPfad: br(p), ausgang: { id, label: id, farbe, p: br(p) },
    kinder: [blatt([id, b], q, p * q, b, "#22c55e"), blatt([id, `${b}̄`], 1 - q, p * (1 - q), `${b}̄`, "#64748b")],
  });
  return { pfad: [], p: br(1), pPfad: br(1), kinder: [ast(a, "#3b82f6", p1, p2), ast(`${a}̄`, "#64748b", 1 - p1, p2n)] };
}

export function Vierfelder() {
  const { niveau } = useContext(Navi);
  const gym = niveau !== "R" && niveau !== "H";
  const [sid, setSid] = useState("rad");
  const sz = SZENARIEN.find(s => s.id === sid)!;
  const [t, setT] = useState<Tafel>(sz.t);
  const [format, setFormat] = useState<"anzahl" | "prozent">("anzahl");
  const [bed, setBed] = useState<BedId>("BA");
  const [richtung, setRichtung] = useState<"A" | "B">("A");
  const v = voll(t);
  const rel = { ab: t.ab / v.ges, aNb: t.aNb / v.ges, nAb: t.nAb / v.ges, nAnB: t.nAnB / v.ges };
  const ba = zuBaumA(t), bb = zuBaumB(t);
  const BED: Record<BedId, { sym: string; wort: string; z: FeldName; n: FeldName; w: number }> = {
    BA: { sym: "P_A(B)", wort: `Anteil »${sz.b}« unter »${sz.a}«`, z: "ab", n: "a", w: ba.p2 },
    BnA: { sym: "P_Ā(B)", wort: `Anteil »${sz.b}« unter »${sz.nA}«`, z: "nAb", n: "nA", w: ba.p2n },
    AB: { sym: "P_B(A)", wort: `Anteil »${sz.a}« unter »${sz.b}«`, z: "ab", n: "b", w: bb.p2 },
    AnB: { sym: "P_B̄(A)", wort: `Anteil »${sz.a}« unter »${sz.nB}«`, z: "aNb", n: "nB", w: bb.p2n },
  };
  const b = BED[bed];
  const zelle = (k: keyof Tafel) => (
    <input type="number" min={0} max={9999} className="input w-20 text-center" value={t[k]} aria-label={k}
      onChange={e => setT(x => ({ ...x, [k]: Math.max(0, Math.min(9999, Math.round(Number(e.target.value) || 0))) }))} />
  );
  const unab = unabhaengig(t, 0.0005);
  return (
    <div className="flex flex-col gap-4">
      <LektionsKopf id="vierfelder">
        Zwei Merkmale, vier Kombinationen: Die <b>Vierfeldertafel</b> ordnet Anzahlen oder Wahrscheinlichkeiten so, dass sich jede Zeile und Spalte zur Randsumme addiert.
        Eine <b>bedingte Wahrscheinlichkeit</b> P_A(B) fragt: Wie wahrscheinlich ist B, <i>wenn man schon weiß</i>, dass A eingetreten ist?
      </LektionsKopf>
      <div className="card p-4 flex flex-col gap-3">
        <Chips wahl={sid} setze={x => { setSid(x); setT(SZENARIEN.find(s => s.id === x)!.t); }} optionen={SZENARIEN.map(s => ({ id: s.id, label: s.id === "rad" ? "🚲 Radfahren" : s.id === "test" ? "🧪 Schnelltest" : "👓 Brille & Hand" }))} />
        <p className="text-sm text-muted">{sz.text} Die vier inneren Felder kannst du ändern.</p>
        <div className="flex flex-wrap gap-4 items-start">
          <TafelAnsicht tafel={format === "anzahl" ? t : rel} a={sz.a} b={sz.b} nA={sz.nA} nB={sz.nB} format={format}
            zeigen={format === "anzahl" ? ["a", "nA", "b", "nB", "ges"] : undefined} eingabe={k => zelle(k as keyof Tafel)} markiert={[b.z, b.n]} />
          <div className="flex flex-col gap-2">
            <Chips wahl={format} setze={setFormat} optionen={[{ id: "anzahl", label: "absolute Häufigkeiten" }, { id: "prozent", label: "relativ / Wahrscheinlichkeit" }]} />
            <div className="flex flex-wrap gap-2">
              <Kachel label={`P(${sz.a} ∩ ${sz.b})`} wert={prozent(rel.ab)} />
              <Kachel label={`P(${sz.a} ∪ ${sz.b})`} wert={prozent(rel.ab + rel.aNb + rel.nAb)} hinweis="alles außer »weder noch«" />
            </div>
          </div>
        </div>
      </div>
      {niveau === "H" ? (
        <Kasten art="tipp" titel="Hauptschulniveau">
          <p>Vierfeldertafeln und bedingte Wahrscheinlichkeiten gehören zum Realschul- und Gymnasialniveau. Im Hauptschulniveau ermittelst du in Kl. 9 Wahrscheinlichkeiten einfacher Experimente – auch mit der Simulation im Zufallslabor.</p>
        </Kasten>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <div className="card p-4 flex flex-col gap-3">
            <h3 className="font-black">Bedingte Wahrscheinlichkeit</h3>
            <div className="flex flex-wrap gap-1.5">{(Object.keys(BED) as BedId[]).map(k => <button key={k} className={`chip ${bed === k ? "chip-on" : ""}`} onClick={() => setBed(k)}>{gym ? <P t={BED[k].sym} /> : BED[k].wort}</button>)}</div>
            <p className="text-sm">{b.wort}: Nur die markierte {b.n === "a" || b.n === "nA" ? "Zeile" : "Spalte"} zählt.</p>
            <p className="font-mono">{gym && <><P t={b.sym} /> = </>}{v[b.z]} : {v[b.n]} = <b>{prozent(b.w)}</b></p>
            {gym && <p className="text-xs text-muted">Allgemein: <P t="P_A(B)" /> = P(A ∩ B) : P(A)</p>}
            {sid === "test" && <p className="text-sm rounded-xl bg-surface-hover px-3 py-2">Überraschung: Ist der Test positiv, ist man nur mit {prozent(bb.p2)} wirklich infiziert – weil es viel mehr Gesunde gibt, sind auch wenige Fehlalarme zusammen viele.</p>}
            {niveau === "R" && <p className="text-xs text-muted">Kl. 10 (R): Erkenne im Alltag, wann nach einem Anteil <i>innerhalb einer Gruppe</i> gefragt ist – das ist eine bedingte Wahrscheinlichkeit.</p>}
          </div>
          <div className="card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-black flex-1">Baum ↔ Tafel</h3>
              <Chips wahl={richtung} setze={setRichtung} optionen={[{ id: "A", label: `erst ${sz.a}` }, { id: "B", label: `erst ${sz.b} (umgekehrt)` }]} />
            </div>
            {richtung === "A"
              ? <Baum wurzel={baumKnoten(ba.p1, ba.p2, ba.p2n, "A", "B")} mitP format="prozent" />
              : <Baum wurzel={baumKnoten(bb.p1, bb.p2, bb.p2n, "B", "A")} mitP format="prozent" />}
            <p className="text-xs text-muted">Die Pfadwahrscheinlichkeiten am Ende sind genau die vier inneren Felder der Tafel (relativ). Die Äste der zweiten Stufe sind bedingte Wahrscheinlichkeiten.</p>
          </div>
        </div>
      )}
      {gym && (
        <div className="card p-4 flex flex-col gap-2">
          <h3 className="font-black">Stochastische Unabhängigkeit <span className="text-xs text-muted font-normal">(G)</span></h3>
          <p className="font-mono text-sm">P(A ∩ B) = {zahl(rel.ab, 4)} {unab ? "=" : "≠"} P(A) · P(B) = {zahl(v.a / v.ges, 4)} · {zahl(v.b / v.ges, 4)} = {zahl((v.a / v.ges) * (v.b / v.ges), 4)}</p>
          <p className={`font-black ${unab ? "text-ok" : "text-bad"}`}>{unab ? "A und B sind stochastisch unabhängig: Zu wissen, dass A eingetreten ist, ändert nichts an B." : "A und B sind abhängig: Zu wissen, ob A eingetreten ist, ändert die Wahrscheinlichkeit für B."}</p>
          <p className="text-sm">Inhaltlich: <P t="P_A(B)" /> = {prozent(ba.p2)}, <P t="P_Ā(B)" /> = {prozent(ba.p2n)} – {Math.abs(ba.p2 - ba.p2n) < 0.005 ? "gleich" : "verschieden"}.</p>
          <button className="btn self-start" onClick={() => { const z = ausBaum(ba.p1, ba.p2, ba.p2); const s = v.ges; setT({ ab: Math.round(z.ab * s), aNb: Math.round(z.aNb * s), nAb: Math.round(z.nAb * s), nAnB: Math.round(z.nAnB * s) }); }}>B unabhängig von A machen</button>
        </div>
      )}
    </div>
  );
}

// ── Kombinatorik ─────────────────────────────────────────────────────────

const DINGE = ["🍎", "🍌", "🍇", "🍓", "🍊", "🥝", "🍐", "🍒"];
const ARTEN: { id: Ziehart; label: string; bsp: string }[] = [
  { id: "mitZ", label: "mit Zurücklegen, mit Reihenfolge", bsp: "Zahlenschloss, PIN, mehrmals würfeln" },
  { id: "ohneZ", label: "ohne Zurücklegen, mit Reihenfolge", bsp: "Siegerpodest, Sitzordnung, Reihenfolge beim Vortrag" },
  { id: "griff", label: "mit einem Griff (ohne Reihenfolge)", bsp: "Tischdienst auslosen, Lotto, Karten auf die Hand" },
];

export function Kombinatorik() {
  const [n, setN] = useState(4);
  const [k, setK] = useState(2);
  const [art, setArt] = useState<Ziehart>("ohneZ");
  const kk = art === "mitZ" ? k : Math.min(k, n);
  const f = faktoren(n, kk, art);
  const a = anzahl(n, kk, art);
  const liste = a <= 120 ? aufzaehlen(DINGE.slice(0, n), kk, art) : [];
  return (
    <div className="flex flex-col gap-4">
      <LektionsKopf id="kombinatorik">
        Wie viele Möglichkeiten gibt es? Du ziehst <b>k</b>-mal aus <b>n</b> Dingen. Entscheidend: Wird <b>zurückgelegt</b>? Zählt die <b>Reihenfolge</b>?
      </LektionsKopf>
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">{ARTEN.map(x => <button key={x.id} className={`chip ${art === x.id ? "chip-on" : ""}`} onClick={() => setArt(x.id)}>{x.label}</button>)}</div>
        <p className="text-sm text-muted">Beispiele: {ARTEN.find(x => x.id === art)!.bsp}</p>
        <div className="flex flex-wrap gap-6 items-center">
          <label className="flex items-center gap-2 text-sm">n = <b>{n}</b><input type="range" min={2} max={8} value={n} onChange={e => setN(Number(e.target.value))} /></label>
          <label className="flex items-center gap-2 text-sm">k = <b>{kk}</b><input type="range" min={1} max={art === "mitZ" ? 5 : n} value={kk} onChange={e => setK(Number(e.target.value))} /></label>
          <span className="text-2xl">{DINGE.slice(0, n).join(" ")}</span>
        </div>
      </div>
      <div className="grid lg:grid-cols-[1fr_2fr] gap-4 items-start">
        <div className="card p-4 flex flex-col gap-2">
          <h3 className="font-black">Zählen</h3>
          {art === "mitZ" && <p className="font-mono">{f.join(" · ")} = {n}<sup>{kk}</sup> = <b className="text-xl">{zahl(a)}</b></p>}
          {art === "ohneZ" && <p className="font-mono">{f.join(" · ")} = <b className="text-xl">{zahl(a)}</b></p>}
          {art === "griff" && <>
            <p className="font-mono">({f.join(" · ")}) : ({Array.from({ length: kk }, (_, i) => kk - i).join(" · ")}) = {zahl(f.reduce((x, y) => x * y, 1))} : {fakultaet(kk)} = <b className="text-xl">{zahl(a)}</b></p>
            <p className="text-xs text-muted">Jede Gruppe aus {kk} Dingen taucht in der geordneten Zählung {fakultaet(kk)}-mal auf (so viele Reihenfolgen hat sie) – deshalb wird geteilt.</p>
          </>}
          <Kasten art="merk" titel="Produktregel">
            <p>Für jede Stufe die Anzahl der Möglichkeiten aufschreiben und multiplizieren – wie die Äste im Baumdiagramm. {art !== "mitZ" && "Ohne Zurücklegen wird es bei jeder Stufe eins weniger."}</p>
          </Kasten>
          {art === "griff" && <p className="text-xs text-muted">Ausblick Kl. 11/12: Dafür gibt es den Binomialkoeffizienten. Lotto 6 aus 49: {zahl(anzahl(49, 6, "griff"))} Möglichkeiten.</p>}
        </div>
        <div className="card p-4 flex flex-col gap-2">
          <h3 className="font-black">Alle Möglichkeiten {liste.length ? `(${liste.length})` : ""}</h3>
          {liste.length ? (
            <div className="flex flex-wrap gap-1.5 max-h-80 overflow-auto">
              {liste.map((m, i) => <span key={i} className="rounded-lg border border-line px-1.5 py-0.5 text-lg">{m.join("")}</span>)}
            </div>
          ) : <p className="text-sm text-muted">{zahl(a)} Möglichkeiten – zu viele zum Aufschreiben.</p>}
        </div>
      </div>
    </div>
  );
}

// ── Zufallsgrößen ────────────────────────────────────────────────────────

function muenzKopf(n: number): Wert[] {
  const paare: { x: number; p: Bruch }[] = [];
  for (let m = 0; m < 2 ** n; m++) {
    let k = 0;
    for (let i = 0; i < n; i++) if (m & (1 << i)) k++;
    paare.push({ x: k, p: bruch(1, 2 ** n) });
  }
  return verteilung(paare);
}

export function Zufallsgroessen() {
  const [sz, setSz] = useState<"summe" | "kopf" | "spiel">("spiel");
  const [nM, setNM] = useState(4);
  const [plan, setPlan] = useState([{ felder: 1, gewinn: 10 }, { felder: 3, gewinn: 2 }, { felder: 6, gewinn: 0 }]);
  const [einsatz, setEinsatz] = useState(2);
  const [an, setAn] = useState<number[]>([]);
  const [sim, setSim] = useState<{ n: number; schnitt: number } | null>(null);
  const melden = useMelden();
  const ges = plan.reduce((a, p) => a + p.felder, 0);
  const v: Wert[] = useMemo(() => (sz === "summe" ? augensumme() : sz === "kopf" ? muenzKopf(nM)
    : verteilung(plan.map(p => ({ x: p.gewinn - einsatz, p: bruch(p.felder, ges) })))), [sz, nM, plan, einsatz, ges]);
  const E = erwartungswert(v);
  const pAn = pSumme(v, x => an.includes(x));
  const X = sz === "summe" ? "Augensumme" : sz === "kopf" ? "Anzahl Kopf" : "Gewinn − Einsatz (€)";
  const spiele = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) {
      let r = Math.random();
      const w = v.find(x => (r -= wert(x.p)) < 0) ?? v[v.length - 1];
      s += w.x;
    }
    setSim(alt => { const m = (alt?.n ?? 0) + n; return { n: m, schnitt: ((alt?.schnitt ?? 0) * (alt?.n ?? 0) + s) / m }; });
    melden(st => ({ ...st, versuche: st.versuche + n }));
  };
  return (
    <div className="flex flex-col gap-4">
      <LektionsKopf id="zufallsgroessen">
        Eine <b>Zufallsgröße X</b> ordnet jedem Ergebnis eine Zahl zu (Augensumme, Gewinn …). Ihre <b>Verteilung</b> sagt, mit welcher Wahrscheinlichkeit welcher Wert kommt.
        Der <b>Erwartungswert</b> E(X) = Σ xᵢ · P(X = xᵢ) ist der Mittelwert auf lange Sicht.
      </LektionsKopf>
      <div className="card p-4 flex flex-col gap-3">
        <Chips wahl={sz} setze={x => { setSz(x); setAn([]); setSim(null); }} optionen={[{ id: "spiel", label: "🎡 Glücksspiel" }, { id: "summe", label: "🎲🎲 Augensumme" }, { id: "kopf", label: "🪙 Anzahl Kopf" }]} />
        {sz === "kopf" && <label className="flex items-center gap-2 text-sm">Münzen: <b>{nM}</b><input type="range" min={1} max={8} value={nM} onChange={e => { setNM(Number(e.target.value)); setAn([]); setSim(null); }} /></label>}
        {sz === "spiel" && (
          <div className="flex flex-wrap gap-4 items-end text-sm">
            {plan.map((p, i) => (
              <div key={i} className="flex flex-col gap-1 rounded-xl border border-line p-2">
                <label className="flex items-center gap-1">Felder <input type="number" className="input w-14" min={1} max={20} value={p.felder} onChange={e => { setPlan(pl => pl.map((q, j) => (j === i ? { ...q, felder: Math.max(1, Math.min(20, Number(e.target.value) || 1)) } : q))); setSim(null); }} /></label>
                <label className="flex items-center gap-1">Auszahlung <input type="number" className="input w-16" min={0} max={100} value={p.gewinn} onChange={e => { setPlan(pl => pl.map((q, j) => (j === i ? { ...q, gewinn: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : q))); setSim(null); }} /> €</label>
              </div>
            ))}
            <label className="flex items-center gap-1">Einsatz <input type="number" className="input w-16" min={0} max={50} value={einsatz} onChange={e => { setEinsatz(Math.max(0, Math.min(50, Number(e.target.value) || 0))); setSim(null); }} /> €</label>
          </div>
        )}
      </div>
      <div className="grid lg:grid-cols-[3fr_2fr] gap-4 items-start">
        <div className="card p-4 flex flex-col gap-2">
          <h3 className="font-black">Histogramm von X = {X}</h3>
          <Histogramm werte={v} erwartung={wert(E)} markiert={x => an.includes(x)} />
          <div className="flex flex-wrap gap-1 items-center text-xs">
            <span className="text-muted">Werte anklicken für P(X ∈ …):</span>
            {v.map(w => <button key={w.x} className={`chip ${an.includes(w.x) ? "chip-on" : ""}`} onClick={() => setAn(a => (a.includes(w.x) ? a.filter(y => y !== w.x) : [...a, w.x]))}>{zahl(w.x)}</button>)}
          </div>
          {an.length > 0 && <p className="text-sm">P(X ∈ {`{${[...an].sort((a, b) => a - b).map(x => zahl(x)).join("; ")}}`}) = Summe der markierten Säulen = <b>{bt(pAn)}</b> ≈ {prozent(wert(pAn))}</p>}
        </div>
        <div className="flex flex-col gap-3">
          <div className="card p-4 flex flex-col gap-2">
            <h3 className="font-black">Tabelle und Erwartungswert</h3>
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse">
                <tbody>
                  <tr><th className="px-2 py-1 border border-line text-left">xᵢ</th>{v.map(w => <td key={w.x} className="px-2 py-1 border border-line text-center tabular-nums">{zahl(w.x)}</td>)}</tr>
                  <tr><th className="px-2 py-1 border border-line text-left">P(X = xᵢ)</th>{v.map(w => <td key={w.x} className="px-2 py-1 border border-line text-center tabular-nums">{bt(w.p)}</td>)}</tr>
                </tbody>
              </table>
            </div>
            <p className="font-mono text-xs break-words">E(X) = Σ xᵢ · P(X = xᵢ) = {summenTerm(v, bt)}</p>
            <Kachel label="E(X)" wert={`${bt(E)}${E.n !== 1 ? ` ≈ ${zahl(wert(E), 2)}` : ""}`} farbe="#ef4444" hinweis={sz === "spiel" ? (wert(E) === 0 ? "faires Spiel" : wert(E) > 0 ? "günstig für Spielende" : "günstig für die Bank") : undefined} />
          </div>
          <div className="card p-4 flex flex-col gap-2">
            <h3 className="font-black">Auf lange Sicht</h3>
            <div className="flex gap-2">{[10, 100, 1000].map(n => <button key={n} className="btn" onClick={() => spiele(n)}>{n}-mal</button>)}<button className="btn" onClick={() => setSim(null)}>↺</button></div>
            {sim && <p className="text-sm">Mittelwert nach {sim.n.toLocaleString("de-DE")} Runden: <b>{zahl(sim.schnitt, 3)}</b> – E(X) = {zahl(wert(E), 3)}</p>}
          </div>
        </div>
      </div>
      <Kasten art="tipp" titel="Summenzeichen">
        <p>Σ (Sigma) heißt »addiere alle«: Σ xᵢ · P(X = xᵢ) bedeutet x₁ · P(X = x₁) + x₂ · P(X = x₂) + … für alle Werte. Alle P(X = xᵢ) zusammen ergeben 1.</p>
        <p className="text-muted">Ausblick Kl. 11/12: Standardabweichung (wie stark X um E(X) streut) und die Bernoulli-Formel.</p>
      </Kasten>
    </div>
  );
}
