"use client";
/**
 * Brückenbau (nach Poly Bridge / Bridge Constructor): Baumaterial (Fakten: Holz, Stein, Stahl, Seile) im Wald-Labyrinth suchen, dann eine Brücke Segment für Segment (je Challenge eins;
 * über 10 Segmente bis zu drei Brücken) bauen: Bretter auf beliebige Segmente legen, dann »Testfahrt«. Der Karren fährt vom Ufer über alle belegten
 * Segmente der Brücke und prüft sie der Reihe nach (je eins = antworte): am ersten falschen bricht die Brücke (Fallschirm, kommt zurück),
 * ein Teiltreffer biegt sich; dahinter liegende Segmente werden dann nicht geprüft.
 */
import { useEffect, useRef, useState } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import type { ModusProps } from "./typen";
import { BestenlisteKnopf } from "../Bestenliste";
import { useAblage } from "@/lib/challenge/useAblage";
import Papierkorb, { WegKnopf } from "@/components/challenge/Papierkorb";
import { Ablage, FaktKarte, Herzen, Frage, Treffermeldung } from "./teile";
import Holz from "./bruecke/Holz";
import Schlucht, { type Fahrt } from "./bruecke/Schlucht";
import { ausgang, materialVon, MATERIALIEN, segmentOrt, sterne, strecke, teileBruecken } from "@/lib/challenge/brueckeSpiel";
import { wenigerBewegung } from "@/lib/challenge/bewegung";
import { Konfetti } from "../Konfetti";

/** So lange feiert eine fertige Brücke, bevor es zur nächsten geht. */
export const FEIER_MS = 2000;

export default function Bruecke({ brett, theme, lauf, zurKarte }: ModusProps) {
  const korb = useAblage(brett.etappe);
  const seed = brett.etappe * 131 + brett.fakten.length * 7 + 3;
  const [gesammelt, setGesammelt] = useState<string[]>([]);
  const [bau, setBau] = useState(false);
  const [luecken] = useState(() => brett.challenges);
  const [fertig, setFertig] = useState<string[]>(() => brett.challenges.filter((c) => c.erledigt).map((c) => c.id));
  const teile = teileBruecken(luecken.length);
  const [ablagen, setAblagen] = useState<Record<string, string[]>>({});
  const [sel, setSel] = useState<number | null>(null);
  const [fahrt, setFahrt] = useState<Fahrt | null>(null);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [sende, setSende] = useState(false);
  const [verschwendet, setVerschwendet] = useState(0);
  const [bericht, setBericht] = useState<string | null>(null);
  const [feier, setFeier] = useState<number | null>(null); // Nummer der gerade fertigen Brücke
  const feierUhr = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const feiernNach = useRef<number | null>(null); // diese Brücke feiern, sobald der Karren drüben ist
  useEffect(() => () => clearTimeout(feierUhr.current), []);

  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const offeneIdx = luecken.map((c, i) => i).filter((i) => !fertig.includes(luecken[i].id));
  const idx = sel !== null && offeneIdx.includes(sel) ? sel : (offeneIdx[0] ?? Math.max(0, luecken.length - 1));
  const c = luecken[idx];
  const ablage = c ? (ablagen[c.id] ?? []) : [];
  const setAblage = (a: string[]) => c && setAblagen((m) => ({ ...m, [c.id]: a }));

  const aktivId = bau && !fertig.includes(c?.id ?? "") ? c?.id : undefined;
  useEffect(() => { if (aktivId) lauf.waehle(); }, [aktivId]); // eslint-disable-line react-hooks/exhaustive-deps

  const kopf = (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <Herzen leben={brett.leben} />
      {bau && <span aria-label="Sterne" className="text-lg">{"★".repeat(sterne(verschwendet))}<span className="opacity-30">{"★".repeat(3 - sterne(verschwendet))}</span></span>}
      <div className="flex gap-2">
        <BestenlisteKnopf lauf={lauf} spiel="bruecke" rechts />
        <button className="btn-secondary" onClick={zurKarte}>Karte</button>
      </div>
    </div>
  );

  if (!bau) {
    return (
      <>
        {kopf}
        <h2 className="font-bold">Baumaterial sammeln</h2>
        <Holz fakten={brett.fakten} theme={theme} seed={seed} gefunden={gesammelt}
          setGefunden={(f) => setGesammelt(f)} weiter={() => setBau(true)} onWegwerfen={korb.wegwerfen} />
      </>
    );
  }

  const waehle = (i: number) => { setSel(i); setAntwort(null); };
  // Ein Brett liegt an genau einer Stelle: Fakten auf offenen Segmenten fehlen im Inventar
  const verbaut = new Set(luecken.filter((l) => !fertig.includes(l.id)).flatMap((l) => ablagen[l.id] ?? []));
  const lege = (id: string) => {
    if (!c || verbaut.has(id) || !gesammelt.includes(id) || korb.istWeg(id) || !fakten.has(id)) return;
    if (!ablage.length) lauf.gelegt();
    setAblage([...ablage, id]);
  };

  // Die Testfahrt startet am Ufer der Brücke, auf der das gewählte Segment liegt
  const offenAufBruecke = strecke(segmentOrt(idx, teile).bruecke, teile).filter((i) => !fertig.includes(luecken[i].id));
  const erste = offenAufBruecke[0];
  const ersteBelegt = erste !== undefined && (ablagen[luecken[erste].id]?.length ?? 0) > 0;

  const testfahrt = async () => {
    if (!ersteBelegt || sende || fahrt) return;
    setSende(true);
    setBericht(null);
    let verlust = verschwendet, gehalten = 0;
    const neuFertig = [...fertig];
    let letzte: { i: number; r: ChallengeAntwort; teile: string[] } | null = null;
    let jetzt = -1;
    try {
      for (const i of offenAufBruecke) {
        const l = luecken[i];
        const a = ablagen[l.id] ?? [];
        if (!a.length) break; // Lücke: hier endet die Fahrt
        jetzt = i;
        const r = await lauf.antworte(l.id, a, false);
        letzte = { i, r, teile: a };
        if (ausgang(r) === "bricht") verlust += a.length;
        if (r.komplett) { neuFertig.push(l.id); gehalten++; }
        if (!r.komplett || r.zurueck_zur_karte || r.etappe_geschafft || r.fertig) break;
      }
    } catch {
      if (jetzt >= 0) setAblagen((m) => ({ ...m, [luecken[jetzt].id]: [] }));
    } finally {
      setSende(false);
    }
    if (!letzte) return;
    const art = ausgang(letzte.r);
    setFertig(neuFertig);
    setAntwort(letzte.r);
    setVerschwendet(verlust);
    // Fertige Brücke: der Karren fährt bis aufs andere Ufer, dann wird gefeiert (das Etappenende feiert der Rahmen)
    const b = segmentOrt(letzte.i, teile).bruecke;
    const ueber = art === "haelt" && strecke(b, teile).every((i) => neuFertig.includes(luecken[i].id));
    setFahrt({ idx: letzte.i, art, teile: letzte.teile.map(materialVon), ueber: ueber || undefined });
    feiernNach.current = ueber && !letzte.r.etappe_geschafft && !letzte.r.fertig ? b : null;
    const nr = letzte.i + 1;
    setBericht(gehalten + (art === "haelt" ? 0 : 1) > 1
      ? `Testfahrt: ${gehalten} ${gehalten === 1 ? "Segment hält" : "Segmente halten"}${art === "bricht" ? `, Segment ${nr} bricht` : art === "biegt" ? `, Segment ${nr} biegt sich` : ""}.`
      : null);
    if (neuFertig.length >= luecken.length || letzte.r.etappe_geschafft || letzte.r.fertig) void lauf.spielwert("bruecke", brett.etappe, sterne(verlust), 3);
  };
  const fahrtEnde = () => {
    // gebrochene Teile sind weg; die Fakten kommen zurück ins Inventar
    if (fahrt?.art === "bricht") { const id = luecken[fahrt.idx].id; setAblagen((m) => ({ ...m, [id]: [] })); }
    const weiter = () => { setFeier(null); if (fahrt?.art === "haelt") setSel(null); setFahrt(null); };
    // Brücke fertig: kurz feiern, erst dann schwenkt die Kamera zur nächsten
    const b = feiernNach.current;
    feiernNach.current = null;
    if (b !== null && !wenigerBewegung()) { setFeier(b); clearTimeout(feierUhr.current); feierUhr.current = setTimeout(weiter, FEIER_MS); }
    else weiter();
  };

  const inventar = brett.fakten.filter((f) => gesammelt.includes(f.id) && !verbaut.has(f.id) && !korb.istWeg(f.id));
  const alleFertig = luecken.length > 0 && fertig.length >= luecken.length;
  const ort = segmentOrt(idx, teile);
  const schlucht = luecken.map((l) => ({ id: l.id, teile: (fahrt && luecken[fahrt.idx]?.id === l.id) ? fahrt.teile : (ablagen[l.id] ?? []).map(materialVon), fertig: fertig.includes(l.id) }));

  return (
    <>
      {kopf}
      <Treffermeldung antwort={antwort} />
      {bericht && <p className="text-muted" role="status">{bericht}</p>}
      {alleFertig && <p className="card p-3 font-bold text-good" role="status">Alle Brücken stehen! {"★".repeat(sterne(verschwendet))}</p>}
      <div className="relative">
        <Schlucht luecken={schlucht} teile={teile} aktiv={idx} fahrt={fahrt} onEnde={fahrtEnde} />
        {feier !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" role="status">
            <Konfetti anzahl={40} seed={feier + 1} />
            <span className="card px-3 py-2 font-black text-lg">🎉 Brücke {feier + 1} steht!</span>
          </div>
        )}
      </div>

      <p className="text-muted" role="status">Segment {idx + 1} von {luecken.length} · Brücke {ort.bruecke + 1} von {teile.length}</p>

      {luecken.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Segmente">
          {luecken.map((l, i) => (
            <button key={l.id} className="btn-secondary" title={l.text} aria-pressed={i === idx && !fertig.includes(l.id)} disabled={fertig.includes(l.id) || !!fahrt} onClick={() => waehle(i)}>
              {fertig.includes(l.id) ? "✔ " : ""}{i + 1}{!fertig.includes(l.id) && ablagen[l.id]?.length ? " 🪵" : ""}
            </button>
          ))}
        </div>
      )}

      {c && !alleFertig && (
        <div className="card p-3 flex flex-col gap-2" aria-label="Segment bauen">
          <Frage x={c} />
          <Ablage karten={ablage.map((id) => fakten.get(id)!)} onLege={lege} onNimm={(id) => setAblage(ablage.filter((x) => x !== id))}
            leer="Lege Baumaterial auf das Segment." />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!ersteBelegt || sende || !!fahrt} onClick={testfahrt}>Testfahrt</button>
            {c.tip && <span className="text-muted self-center">💡 {c.tip}</span>}
          </div>
          {!ersteBelegt && erste !== undefined && erste !== idx && (
            <p className="text-muted text-sm">Die Testfahrt startet am Ufer: lege zuerst Baumaterial auf Segment {erste + 1}.</p>
          )}
        </div>
      )}

      {!alleFertig && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
          {inventar.map((f) => (
            <div key={f.id} className="flex flex-col gap-1">
              <span className="text-xs text-muted">{MATERIALIEN[materialVon(f.id)].icon} {MATERIALIEN[materialVon(f.id)].name}</span>
              <FaktKarte fakt={f} disabled={!c || !!fahrt} onClick={() => lege(f.id)} />
              <WegKnopf fakt={f} onClick={() => korb.wegwerfen(f.id)} />
            </div>
          ))}
        </div>
      )}
      <Papierkorb weg={korb.weg} fakten={brett.fakten} onZurueck={korb.zurueckholen} />
    </>
  );
}
