"use client";
/**
 * Brückenbau (nach Poly Bridge / Bridge Constructor): Bretter (Fakten) im Wald-Labyrinth suchen, dann je Lücke
 * Bretter legen und »Testfahrt« (= antworte). Der Karren fährt: hält / biegt sich / bricht (Fallschirm, kommt zurück).
 */
import { useEffect, useState } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import type { ModusProps } from "./typen";
import Bestenliste from "../Bestenliste";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import Holz from "./bruecke/Holz";
import Schlucht, { type Fahrt } from "./bruecke/Schlucht";
import { ausgang, sterne } from "@/lib/challenge/brueckeSpiel";

export default function Bruecke({ brett, theme, lauf, zurKarte }: ModusProps) {
  const seed = brett.etappe * 131 + brett.fakten.length * 7 + 3;
  const [gesammelt, setGesammelt] = useState<string[]>([]);
  const [bau, setBau] = useState(false);
  const [luecken] = useState(() => brett.challenges.filter((c) => !c.erledigt));
  const [fertig, setFertig] = useState<string[]>([]);
  const [ablagen, setAblagen] = useState<Record<string, string[]>>({});
  const [sel, setSel] = useState<number | null>(null);
  const [fahrt, setFahrt] = useState<Fahrt | null>(null);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [sende, setSende] = useState(false);
  const [verschwendet, setVerschwendet] = useState(0);
  const [liste, setListe] = useState(false);

  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const offeneIdx = luecken.map((c, i) => i).filter((i) => !fertig.includes(luecken[i].id));
  const idx = sel !== null && offeneIdx.includes(sel) ? sel : (offeneIdx[0] ?? Math.max(0, luecken.length - 1));
  const c = luecken[idx];
  const ablage = c ? (ablagen[c.id] ?? []) : [];
  const setAblage = (a: string[]) => c && setAblagen((m) => ({ ...m, [c.id]: a }));

  const aktivId = bau && !fertig.includes(c?.id ?? "") ? c?.id : undefined;
  useEffect(() => { if (aktivId) lauf.waehle(aktivId); }, [aktivId]); // eslint-disable-line react-hooks/exhaustive-deps

  const kopf = (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <Herzen leben={brett.leben} />
      {bau && <span aria-label="Sterne" className="text-lg">{"★".repeat(sterne(verschwendet))}<span className="opacity-30">{"★".repeat(3 - sterne(verschwendet))}</span></span>}
      <div className="flex gap-2">
        {lauf.hatBestenliste && <button className="btn-secondary" aria-expanded={liste} onClick={() => setListe(!liste)}>🏆 Bestenliste</button>}
        <button className="btn-secondary" onClick={zurKarte}>Karte</button>
      </div>
    </div>
  );
  const bestenliste = liste && <div className="card p-3" role="dialog" aria-label="Bestenliste"><Bestenliste laden={lauf.bestenliste} spiel="bruecke" /></div>;

  if (!bau) {
    return (
      <>
        {kopf}{bestenliste}
        <h2 className="font-bold">Holz sammeln</h2>
        <Holz fakten={brett.fakten} theme={theme} seed={seed} gefunden={gesammelt}
          setGefunden={(f) => setGesammelt(f)} weiter={() => setBau(true)} />
      </>
    );
  }

  const waehle = (i: number) => { setSel(i); setAntwort(null); };
  const lege = (id: string) => {
    if (!c || ablage.includes(id) || !gesammelt.includes(id) || !fakten.has(id)) return;
    if (!ablage.length) lauf.gelegt();
    setAblage([...ablage, id]);
  };

  const testfahrt = async () => {
    if (!c || !ablage.length || sende || fahrt) return;
    setSende(true);
    try {
      const r = await lauf.antworte(c.id, ablage, false);
      const art = ausgang(r);
      const verlust = art === "bricht" ? verschwendet + ablage.length : verschwendet;
      setAntwort(r);
      setFahrt({ idx, art, bretter: ablage.length });
      if (r.komplett) {
        setFertig((f) => [...f, c.id]);
        if (fertig.length + 1 >= luecken.length || r.etappe_geschafft || r.fertig) void lauf.spielwert?.("bruecke", brett.etappe, sterne(verlust), 3);
      }
      setVerschwendet(verlust);
    } catch {
      setAblage([]);
    } finally {
      setSende(false);
    }
  };
  const fahrtEnde = () => {
    if (fahrt?.art === "bricht" && c) setAblage([]); // gebrochene Bretter sind weg; die Fakten bleiben im Inventar
    if (fahrt?.art === "haelt") setSel(null);
    setFahrt(null);
  };

  const inventar = brett.fakten.filter((f) => gesammelt.includes(f.id) && !ablage.includes(f.id));
  const alleFertig = luecken.length > 0 && fertig.length >= luecken.length;
  const schlucht = luecken.map((l) => ({ id: l.id, bretter: (fahrt && luecken[fahrt.idx]?.id === l.id) ? fahrt.bretter : (ablagen[l.id]?.length ?? 0), fertig: fertig.includes(l.id) }));

  return (
    <>
      {kopf}{bestenliste}
      <Treffermeldung antwort={antwort} />
      {alleFertig && <p className="card p-3 font-bold text-good" role="status">Alle Brücken stehen! {"★".repeat(sterne(verschwendet))}</p>}
      <Schlucht luecken={schlucht} aktiv={idx} fahrt={fahrt} onEnde={fahrtEnde} />

      {luecken.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Lücken">
          {luecken.map((l, i) => (
            <button key={l.id} className="btn-secondary" aria-pressed={i === idx && !fertig.includes(l.id)} disabled={fertig.includes(l.id) || !!fahrt} onClick={() => waehle(i)}>
              {fertig.includes(l.id) ? "✔ " : ""}Lücke {i + 1}
            </button>
          ))}
        </div>
      )}

      {c && !alleFertig && (
        <div className="card p-3 flex flex-col gap-2" aria-label="Lücke bauen">
          <div className="font-bold"><Inhalt x={c} /></div>
          <Ablage karten={ablage.map((id) => fakten.get(id)!)} onLege={lege} onNimm={(id) => setAblage(ablage.filter((x) => x !== id))}
            leer="Lege Bretter in die Lücke." />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!ablage.length || sende || !!fahrt} onClick={testfahrt}>Testfahrt</button>
            {c.tip && <span className="text-muted self-center">💡 {c.tip}</span>}
          </div>
        </div>
      )}

      {!alleFertig && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
          {inventar.map((f) => <FaktKarte key={f.id} fakt={f} disabled={!c || !!fahrt} onClick={() => lege(f.id)} />)}
        </div>
      )}
    </>
  );
}
