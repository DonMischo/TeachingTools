"use client";
/**
 * Kl. 5/6 »Zufallsexperimente«: ein- und zweistufig durchführen, Ergebnisse
 * zählen, Baumdiagramm ohne Wahrscheinlichkeiten.
 * Kl. 7/8 »Zufallslabor«: sehr viele Wiederholungen, die relative
 * Häufigkeit läuft auf die Wahrscheinlichkeit zu (Gesetz der großen Zahlen).
 */
import { useContext, useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip } from "recharts";
import { ausgaenge, baum, blaetter, experimentName, simuliere, verlauf, type Experiment } from "@/lib/stochastik/zufall";
import { bt, prozent, summe, wert, zahl } from "@/lib/stochastik/zahlen";
import { Baum, Diagramm, Histogramm, StrichTabelle } from "./diagramme";
import { GeraetBild, radWinkel, useGeraet } from "./Geraete";
import { Chips, Kachel, Kasten, LektionsKopf, Navi, useMelden } from "./ui";

/** Kurze Beschriftung für Pfade: »r«, »b«, »K«, »3«. */
export function kurzVon(e: Experiment) {
  return (id: string) => (e.art === "urne" || e.art === "rad" ? id.slice(0, 1).toUpperCase() : id);
}

export function Experimente() {
  const g = useGeraet("muenze");
  const [stufen, setStufen] = useState(1);
  const [protokoll, setProtokoll] = useState<string[][]>([]);
  const [drehung, setDrehung] = useState(0);
  const melden = useMelden();
  const e = g.experiment;
  const schluessel = JSON.stringify(e) + stufen;
  useEffect(() => setProtokoll([]), [schluessel]);
  const wurzel = useMemo(() => (g.ok ? baum(e, stufen) : null), [schluessel, g.ok]); // eslint-disable-line react-hooks/exhaustive-deps
  const kurz = kurzVon(e);
  const letztes = protokoll[protokoll.length - 1];
  const moeglich = wurzel ? blaetter(wurzel).map(b => b.pfad.map(kurz).join("")) : [];
  const zeilen = moeglich.map(w => ({ wert: w, anzahl: protokoll.filter(p => p.map(kurz).join("") === w).length }));

  const los = (n: number) => {
    if (!g.ok) return;
    const neu = simuliere(e, stufen, n, Math.random);
    setProtokoll(p => [...p, ...neu]);
    const l = neu[neu.length - 1];
    if (e.art === "rad") setDrehung(d => radWinkel(e, l[l.length - 1], d));
    melden(s => ({ ...s, versuche: s.versuche + n }));
  };
  const zuViele = e.art === "urne" && !e.zuruecklegen && stufen > g.kugelZahl;

  return (
    <div className="flex flex-col gap-4">
      <LektionsKopf id="experimente">
        Ein <b>Zufallsexperiment</b> hat mehrere mögliche Ergebnisse, und man kann nicht vorhersagen, welches eintritt. Bei <b>zweistufigen</b> Experimenten
        passiert das zweimal nacheinander. Das <b>Baumdiagramm</b> zeigt alle Ergebnisse: Jeder Weg von links nach rechts ist eins.
      </LektionsKopf>
      <div className="grid lg:grid-cols-[1fr_1fr] gap-4 items-start">
        <div className="card p-4 flex flex-col gap-3">
          <h3 className="font-black">1 · Planen</h3>
          {g.einstellung}
          <div className="flex gap-1.5 items-center text-sm">
            <span className="text-muted">Stufen:</span>
            <Chips wahl={String(stufen)} setze={x => setStufen(Number(x))} optionen={[{ id: "1", label: "einstufig" }, { id: "2", label: "zweistufig" }]} />
          </div>
          {zuViele && <p className="text-bad text-sm">Ohne Zurücklegen reichen die Kugeln nicht für {stufen} Züge.</p>}
          <p className="text-sm text-muted">{experimentName(e)}, {stufen === 1 ? "einmal" : "zweimal nacheinander"}. Mögliche Ergebnisse: {moeglich.length}.</p>
        </div>
        <div className="card p-4 flex flex-col gap-3 items-center">
          <h3 className="font-black self-start">2 · Durchführen</h3>
          <div className="flex items-center gap-4 min-h-24">
            {(letztes ?? [undefined]).map((x, i) => <GeraetBild key={i} e={e} ergebnis={x} bisher={letztes?.slice(0, i) ?? []} drehung={drehung} />)}
          </div>
          <p className="text-lg font-black">{letztes ? `Ergebnis: ${letztes.map(x => ausgaenge(e).find(a => a.id === x)?.label ?? x).join(" – ")}` : "Noch nicht gestartet"}</p>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={!g.ok || zuViele} onClick={() => los(1)}>▶ Einmal</button>
            <button className="btn" disabled={!g.ok || zuViele} onClick={() => los(10)}>10-mal</button>
            <button className="btn" onClick={() => setProtokoll([])}>↺ Leeren</button>
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="card p-4 flex flex-col gap-2">
          <h3 className="font-black">3 · Baumdiagramm <span className="text-xs text-muted font-normal">(ohne Wahrscheinlichkeiten)</span></h3>
          {wurzel && !zuViele && <Baum wurzel={wurzel} kurz={kurz} an={letztes ? p => p.join() === letztes.join() : undefined} />}
        </div>
        <div className="card p-4 flex flex-col gap-2">
          <h3 className="font-black">4 · Ergebnisse zählen <span className="text-sm text-muted font-normal">({protokoll.length} Durchführungen)</span></h3>
          {moeglich.length <= 16 ? <StrichTabelle zeilen={zeilen} relativ={protokoll.length > 0} /> : <Diagramm art="saeulen" zeilen={zeilen} hoehe={200} />}
          <Kasten art="tipp" titel="Beobachte">
            <p>Kommen alle Ergebnisse gleich oft vor? Bei wenigen Durchführungen sieht es oft ungleich aus – im Zufallslabor (Kl. 7/8) wiederholst du tausendfach.</p>
          </Kasten>
        </div>
      </div>
    </div>
  );
}

// ── Zufallslabor ─────────────────────────────────────────────────────────

const ANZAHLEN = [10, 100, 1000, 10000];

export function Labor() {
  const { niveau } = useContext(Navi);
  const g = useGeraet("wuerfel");
  const melden = useMelden();
  const e = g.experiment;
  const opts = g.ok ? ausgaenge(e) : [];
  const [ziel, setZiel] = useState<string[]>([]);
  const [laeufe, setLaeufe] = useState<string[]>([]);
  const [schaetzung, setSchaetzung] = useState(50);
  const schluessel = JSON.stringify(e);
  useEffect(() => { setLaeufe([]); setZiel(opts.length ? [opts[opts.length - 1].id] : []); }, [schluessel]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = opts.filter(o => ziel.includes(o.id)).reduce((a, o) => a + wert(o.p), 0);
  const treffer = laeufe.map(x => ziel.includes(x));
  const kurve = useMemo(() => verlauf(treffer), [laeufe, ziel]); // eslint-disable-line react-hooks/exhaustive-deps
  const h = treffer.length ? treffer.filter(Boolean).length / treffer.length : 0;
  const zeilen = opts.map(o => ({ wert: o.label, anzahl: laeufe.filter(x => x === o.id).length }));

  const los = (n: number) => {
    if (!g.ok) return;
    const neu = simuliere(e.art === "urne" ? { ...e, zuruecklegen: true } : e, 1, n, Math.random).map(x => x[0]);
    setLaeufe(l => [...l, ...neu].slice(-200000));
    melden(s => ({ ...s, versuche: s.versuche + n }));
  };

  return (
    <div className="flex flex-col gap-4">
      <LektionsKopf id="labor">
        Die <b>Wahrscheinlichkeit</b> eines Ereignisses ist die relative Häufigkeit, die man bei <b>sehr vielen</b> Wiederholungen erwartet.
        Wiederhole oft genug – die Kurve der relativen Häufigkeit pendelt sich ein (<b>Gesetz der großen Zahlen</b>).
      </LektionsKopf>
      <div className="grid lg:grid-cols-[1fr_2fr] gap-4 items-start">
        <div className="card p-4 flex flex-col gap-3">
          {g.einstellung}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Ereignis: Treffer ist …</span>
            <div className="flex flex-wrap gap-1.5">
              {opts.map(o => (
                <button key={o.id} className={`chip ${ziel.includes(o.id) ? "chip-on" : ""}`} aria-pressed={ziel.includes(o.id)}
                  onClick={() => { setZiel(z => (z.includes(o.id) ? z.filter(x => x !== o.id) : [...z, o.id])); }}>
                  <span className="inline-block w-2.5 h-2.5 rounded-full mr-1" style={{ background: o.farbe }} />{o.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Deine Schätzung vorher: <b className="text-fg">{schaetzung} %</b></span>
            <input type="range" min={0} max={100} value={schaetzung} onChange={e => setSchaetzung(Number(e.target.value))} />
          </label>
          <div className="flex flex-wrap gap-2">
            {ANZAHLEN.map(n => <button key={n} className={n === 10 ? "btn btn-primary" : "btn"} disabled={!g.ok} onClick={() => los(n)}>＋{n.toLocaleString("de-DE")}</button>)}
            <button className="btn" onClick={() => setLaeufe([])}>↺</button>
          </div>
        </div>
        <div className="card p-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Kachel label="Versuche" wert={laeufe.length.toLocaleString("de-DE")} />
            <Kachel label="Treffer" wert={treffer.filter(Boolean).length.toLocaleString("de-DE")} />
            <Kachel label="relative Häufigkeit" wert={laeufe.length ? prozent(h) : "–"} farbe="#3b82f6" />
            <Kachel label="deine Schätzung" wert={`${schaetzung} %`} farbe="#a855f7" />
            {laeufe.length >= 1000 && <Kachel label="Wahrscheinlichkeit" wert={bt(summe(opts.filter(o => ziel.includes(o.id)).map(o => o.p)))} farbe="#22c55e" hinweis={`≈ ${prozent(p)} – jetzt aufgedeckt`} />}
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kurve} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="n" type="number" scale={laeufe.length > 200 ? "log" : "auto"} domain={[1, "dataMax"]} allowDataOverflow
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickFormatter={v => Number(v).toLocaleString("de-DE")} />
                <YAxis domain={[0, 1]} tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickFormatter={v => `${Math.round(Number(v) * 100)} %`} />
                <Tooltip formatter={v => prozent(Number(v))} labelFormatter={v => `nach ${Number(v).toLocaleString("de-DE")} Versuchen`}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }} />
                <ReferenceLine y={schaetzung / 100} stroke="#a855f7" strokeDasharray="6 4" />
                {laeufe.length >= 1000 && <ReferenceLine y={p} stroke="#22c55e" strokeWidth={2} />}
                <Line type="monotone" dataKey="h" stroke="#3b82f6" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted">Blau: relative Häufigkeit nach n Versuchen{laeufe.length > 200 ? " (Achse logarithmisch)" : ""}. Lila: deine Schätzung. Grün (ab 1 000 Versuchen): die Wahrscheinlichkeit.</p>
        </div>
      </div>
      {niveau !== "H" && laeufe.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <div className="card p-4 flex flex-col gap-2">
            <h3 className="font-black">Zufallsdaten als Tabelle <span className="text-xs text-muted font-normal">(G: auch mit digitalem Werkzeug)</span></h3>
            <StrichTabelle zeilen={zeilen.slice(0, 12)} relativ />
          </div>
          <div className="card p-4 flex flex-col gap-2">
            <h3 className="font-black">… und als Diagramm</h3>
            <Histogramm werte={opts.map(o => ({ x: Number.isFinite(Number(o.id)) ? Number(o.id) : opts.indexOf(o) + 1, p: laeufe.filter(x => x === o.id).length / laeufe.length }))}
              markiert={x => ziel.includes(Number.isFinite(Number(opts[0]?.id)) ? String(x) : opts[x - 1]?.id ?? "")} />
            {!Number.isFinite(Number(opts[0]?.id)) && <p className="text-xs text-muted">{opts.map((o, i) => `${i + 1} = ${o.label}`).join(", ")}</p>}
          </div>
        </div>
      )}
      <Kasten art="merk" titel="Gesetz der großen Zahlen">
        <p>Je öfter man ein Zufallsexperiment wiederholt, desto weniger schwankt die relative Häufigkeit – sie stabilisiert sich bei der Wahrscheinlichkeit. Nach 10 Würfen kann alles passieren, nach 10 000 kaum noch. Mit einer Simulation kann man so Wahrscheinlichkeiten <b>schätzen</b>, die man nicht ausrechnen kann.</p>
        <p className="text-muted">Bei der Urne wird hier immer zurückgelegt, damit jeder Zug unter gleichen Bedingungen läuft. Letzter Wert: {zahl(h, 4)}.</p>
      </Kasten>
    </div>
  );
}
