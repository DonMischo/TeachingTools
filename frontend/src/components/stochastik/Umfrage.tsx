"use client";
/**
 * Kl. 5/6: Eigene Umfrage – planen, mit Strichliste erfassen oder aus einer
 * TT-Umfrage übernehmen, dann auswerten (Tabelle, Diagrammwahl, Kenngrößen).
 *
 * Übernehmen: Für alle über die freigegebenen Ergebnisse (public-results);
 * die Lehrkraft der Umfrage zusätzlich über den Export. Freitextantworten
 * kommen in keinem Fall in die Sim (siehe lib/stochastik/umfrage.ts).
 */
import { useContext, useEffect, useRef, useState } from "react";
import { api, type BarometerSessionSummary } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { alleZahlen, ausErhebung, ausUmfrage, type Datensatz } from "@/lib/stochastik/umfrage";
import { kenngroessen, modalwerte } from "@/lib/stochastik/kenngroessen";
import { prozent, zahl } from "@/lib/stochastik/zahlen";
import { DIA_ARTEN, Diagramm, Boxplot, StrichTabelle, Striche, type DiaArt } from "./diagramme";
import { Chips, Kachel, Kasten, LektionsKopf, Navi, useMelden } from "./ui";

const VORLAGE = { frage: "Wie viele Stunden schläfst du in der Nacht vor einem Schultag?", optionen: ["7", "8", "9", "10"] };

export default function Umfrage() {
  const [quelle, setQuelle] = useState<"eigen" | "tt">("eigen");
  const [frage, setFrage] = useState(VORLAGE.frage);
  const [optionen, setOptionen] = useState<string[]>(VORLAGE.optionen);
  const [striche, setStriche] = useState<number[]>(VORLAGE.optionen.map(() => 0));
  const [neu, setNeu] = useState("");
  const [tt, setTt] = useState<{ titel: string; saetze: Datensatz[] } | null>(null);
  const [frageNr, setFrageNr] = useState(0);
  const melden = useMelden();
  const gemeldet = useRef(false);

  const zahlen = alleZahlen(optionen);
  const eigen = ausErhebung({ frage, optionen, striche, zahlen });
  const summe = striche.reduce((a, b) => a + b, 0);
  useEffect(() => {
    if (summe >= 10 && !gemeldet.current) { gemeldet.current = true; melden(s => ({ ...s, umfragen: s.umfragen + 1 })); }
  }, [summe, melden]);

  const satz: Datensatz | null = quelle === "eigen" ? (summe ? eigen : null) : tt?.saetze[frageNr] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <LektionsKopf id="umfrage">
        Eine eigene Erhebung in vier Schritten: <b>Frage stellen</b> (eindeutig, mit festen Antworten), <b>Daten erfassen</b> (Strichliste),
        <b> darstellen</b> (das passende Diagramm) und <b>auswerten</b> (Häufigkeiten, Kenngrößen, ein Satz als Ergebnis).
      </LektionsKopf>
      <Chips wahl={quelle} setze={setQuelle} optionen={[{ id: "eigen", label: "✏️ Eigene Erhebung" }, { id: "tt", label: "📊 Aus einer TT-Umfrage übernehmen" }]} />

      {quelle === "eigen" ? (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <div className="card p-4 flex flex-col gap-3">
            <h3 className="font-black">1 · Planen</h3>
            <label className="flex flex-col gap-1 text-sm"><span className="text-muted">Frage</span>
              <input className="input" value={frage} onChange={e => setFrage(e.target.value)} /></label>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-muted">Antwortmöglichkeiten {zahlen && <span className="text-ok">– alles Zahlen, also gibt es Kenngrößen</span>}</span>
              {optionen.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="input w-40" value={o} aria-label={`Antwort ${i + 1}`}
                    onChange={e => setOptionen(op => op.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button className="btn" aria-label={`Antwort ${o} entfernen`} onClick={() => { setOptionen(op => op.filter((_, j) => j !== i)); setStriche(st => st.filter((_, j) => j !== i)); }}>🗑</button>
                </div>
              ))}
              <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (neu.trim()) { setOptionen(op => [...op, neu.trim()]); setStriche(st => [...st, 0]); setNeu(""); } }}>
                <input className="input w-40" placeholder="neue Antwort" value={neu} onChange={e => setNeu(e.target.value)} />
                <button className="btn">＋</button>
              </form>
            </div>
            <Kasten art="tipp" titel="Gute Fragen">
              <p>Nur eine Sache auf einmal fragen. Antworten vorgeben, die sich nicht überschneiden, und an »sonstiges« denken. Niemanden bloßstellen – Umfragen bleiben anonym.</p>
            </Kasten>
          </div>
          <div className="card p-4 flex flex-col gap-3">
            <h3 className="font-black">2 · Erfassen <span className="text-sm text-muted font-normal">({summe} Antworten)</span></h3>
            <p className="text-sm text-muted">Für jede Antwort einmal tippen – wie ein Strich auf der Liste.</p>
            {optionen.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <button className="btn btn-primary min-w-28 justify-start" onClick={() => setStriche(st => st.map((x, j) => (j === i ? x + 1 : x)))}>＋ {o || "…"}</button>
                <button className="btn" aria-label={`einen Strich bei ${o} weg`} disabled={!striche[i]} onClick={() => setStriche(st => st.map((x, j) => (j === i ? Math.max(0, x - 1) : x)))}>−</button>
                <Striche n={striche[i] ?? 0} />
                <span className="font-black tabular-nums">{striche[i] ?? 0}</span>
              </div>
            ))}
            <div className="flex gap-2">
              <button className="btn" onClick={() => setStriche(optionen.map(() => 0))}>↺ Leeren</button>
              <button className="btn" onClick={() => setStriche(optionen.map(() => Math.floor(Math.random() * 9) + 1))}>🎲 Beispieldaten</button>
            </div>
          </div>
        </div>
      ) : (
        <TtUmfrage onDaten={(titel, saetze) => { setTt({ titel, saetze }); setFrageNr(0); melden(s => ({ ...s, umfragen: s.umfragen + 1 })); }} />
      )}

      {quelle === "tt" && tt && (
        <div className="card p-4 flex flex-col gap-2">
          <h3 className="font-black">📊 {tt.titel}</h3>
          {tt.saetze.length ? <Chips wahl={String(frageNr)} setze={x => setFrageNr(Number(x))} optionen={tt.saetze.map((s, i) => ({ id: String(i), label: `${i + 1}. ${s.titel.slice(0, 40)}${s.titel.length > 40 ? "…" : ""}` }))} />
            : <p className="text-sm text-muted">Diese Umfrage hat keine Fragen mit festen Antworten oder Zahlen.</p>}
        </div>
      )}

      {satz && <Auswertung key={quelle === "tt" ? `tt-${frageNr}` : "eigen"} satz={satz} />}
    </div>
  );
}

function TtUmfrage({ onDaten }: { onDaten: (titel: string, saetze: Datensatz[]) => void }) {
  const { auth } = useAuth();
  const lehrkraft = auth?.user_type === "teacher";
  const [code, setCode] = useState("");
  const [eigene, setEigene] = useState<BarometerSessionSummary[]>([]);
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(false);
  useEffect(() => {
    if (lehrkraft) api.barometer.list().then(l => setEigene(l.filter(s => s.created_by === auth?.teacher?.id))).catch(() => setEigene([]));
  }, [lehrkraft, auth?.teacher?.id]);

  const hole = async (c: string) => {
    const k = c.trim().toUpperCase();
    if (!k) return;
    setLaedt(true); setFehler("");
    try {
      // Lehrkraft der Umfrage: Export (auch ohne Freigabe). Alle anderen: nur freigegebene Ergebnisse.
      // Ein Schülerkonto ruft den Export nie auf – das Konto würde sonst abgemeldet (401).
      const eigene_ = lehrkraft && eigene.some(s => s.code === k);
      const roh = eigene_ ? await api.barometer.exportResults(k) : await api.barometer.publicResults(k);
      const r = roh as { title?: string; questions?: unknown[] };
      onDaten(r.title ?? k, ausUmfrage(r as Parameters<typeof ausUmfrage>[0]));
    } catch {
      setFehler(lehrkraft
        ? "Nicht gefunden oder nicht freigegeben. Eigene Umfragen stehen in der Liste; fremde nur, wenn deren Ergebnisse freigegeben sind."
        : "Nicht gefunden oder nicht freigegeben. Deine Lehrkraft muss in der Umfrage die Ergebnisse freigeben.");
    } finally { setLaedt(false); }
  };

  return (
    <div className="card p-4 flex flex-col gap-3">
      <p className="text-sm">Hat eure Klasse eine Umfrage im TT gemacht? Dann wertet ihr sie hier selbst aus. Übernommen werden Auswahl-, Skalen- und Zahlfragen – <b>Freitext bleibt bei der Lehrkraft</b>.</p>
      <form className="flex flex-wrap gap-2 items-center" onSubmit={e => { e.preventDefault(); hole(code); }}>
        <input className="input w-40 uppercase font-mono" placeholder="Umfrage-Code" value={code} onChange={e => setCode(e.target.value)} aria-label="Umfrage-Code" />
        <button className="btn btn-primary" disabled={laedt || !code.trim()}>{laedt ? "lädt …" : "Übernehmen"}</button>
      </form>
      {lehrkraft && eigene.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted">Deine Umfragen:</span>
          {eigene.slice(0, 12).map(s => <button key={s.code} className="chip" onClick={() => { setCode(s.code); hole(s.code); }}>{s.title} <span className="font-mono text-muted ml-1">{s.code}</span></button>)}
        </div>
      )}
      {lehrkraft && <p className="text-xs text-muted">Damit die Klasse selbst auswerten kann: in der Umfrage »Ergebnisse freigeben« einschalten und den Code nennen.</p>}
      {fehler && <p className="text-sm text-bad font-bold">{fehler}</p>}
    </div>
  );
}

function Auswertung({ satz }: { satz: Datensatz }) {
  const { niveau } = useContext(Navi);
  const [art, setArt] = useState<DiaArt>(satz.art === "zahl" ? "saeulen" : "kreis");
  const [relativ, setRelativ] = useState(false);
  const ges = satz.zeilen.reduce((a, z) => a + z.anzahl, 0);
  const k = satz.art === "zahl" && satz.zahlen?.length ? kenngroessen(satz.zahlen) : null;
  const top = [...satz.zeilen].sort((a, b) => b.anzahl - a.anzahl)[0];
  const modal = modalwerte(satz.zeilen.flatMap(z => Array.from({ length: z.anzahl }, () => z.wert)));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid lg:grid-cols-[1fr_2fr] gap-4 items-start">
        <div className="card p-4 flex flex-col gap-2">
          <h3 className="font-black">3 · Tabelle</h3>
          <StrichTabelle zeilen={satz.zeilen} relativ />
          {satz.hinweis && <p className="text-xs text-muted">{satz.hinweis} ({satz.personen} Personen)</p>}
        </div>
        <div className="card p-4 flex flex-col gap-3">
          <h3 className="font-black">4 · Darstellen</h3>
          <Chips wahl={art} setze={setArt} optionen={DIA_ARTEN.filter(d => d.id !== "strichliste")} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={relativ} onChange={e => setRelativ(e.target.checked)} /> in Prozent</label>
          {satz.personen !== undefined && (art === "kreis" || art === "ring") && <p className="text-xs text-bad font-bold">Achtung: Bei Mehrfachauswahl ergeben die Teile nicht ein Ganzes – ein Kreisdiagramm passt hier nicht.</p>}
          <Diagramm art={art} zeilen={satz.zeilen} relativ={relativ} titel={satz.titel} />
        </div>
      </div>
      <div className="card p-4 flex flex-col gap-3">
        <h3 className="font-black">5 · Auswerten</h3>
        <div className="flex flex-wrap gap-2">
          <Kachel label="Antworten" wert={ges} />
          <Kachel label="Modalwert" wert={modal.length > 3 ? "–" : modal.join(", ")} />
          {k && <>
            <Kachel label="Minimum" wert={zahl(k.min)} /><Kachel label="Maximum" wert={zahl(k.max)} />
            <Kachel label="Spannweite" wert={zahl(k.spannweite)} /><Kachel label="Median" wert={zahl(k.median)} />
            <Kachel label="Mittel" wert={zahl(k.mittel, 2)} />
            {niveau !== "H" && <Kachel label="Quartile" wert={`${zahl(k.q1)} | ${zahl(k.q3)}`} />}
          </>}
        </div>
        {k && niveau !== "H" && <Boxplot reihen={[{ name: "Antworten", zahlen: satz.zahlen! }]} einheit={satz.einheit} />}
        {top && ges > 0 && (
          <p className="text-sm rounded-xl bg-surface-hover px-3 py-2">
            <b>Ergebnissatz:</b> Am häufigsten wurde »{top.wert}« genannt ({top.anzahl}-mal, {prozent(top.anzahl / ges)}).
            {k && <> Die Hälfte der Antworten liegt bei höchstens {zahl(k.median)}{satz.einheit ? ` ${satz.einheit}` : ""}, im Mittel sind es {zahl(k.mittel, 1)}.</>}
          </p>
        )}
      </div>
    </div>
  );
}
