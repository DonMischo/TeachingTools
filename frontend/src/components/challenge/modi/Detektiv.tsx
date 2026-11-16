"use client";
/**
 * Detektiv im Film-noir-Stil: erst die Fallakte (Etappe = Fall, Verdächtige mit Foto), dann der dunkle Tatort mit Taschenlampe,
 * dann die Ermittlungswand: Verdächtige hängen mit ihrer Aussage an der Korkwand, Spuren aus dem Notizbuch werden an eine Aussage
 * geheftet (Klick oder Ziehen) und vorgelegt (= antworte). Eine widerlegte Aussage bekommt rote Fäden zu ihren Beweisen.
 */
import { useState } from "react";
import type { ChallengeAntwort, ChallengeAufgabe } from "@/lib/api";
import { BestenlisteKnopf } from "@/components/challenge/Bestenliste";
import Npc from "@/components/challenge/pixel/Npc";
import { useSpielwert } from "@/lib/challenge/useSpielwert";
import { useAblage } from "@/lib/challenge/useAblage";
import { hashText } from "@/lib/challenge/zufall";
import Papierkorb, { WegKnopf } from "@/components/challenge/Papierkorb";
import type { ModusProps } from "./typen";
import { Herzen, Frage, Inhalt, Treffermeldung } from "./teile";
import Tatort from "./detektiv/Tatort";
import { DetektivStil, VERDAECHTIGE, skizzeVon } from "./detektiv/hilfen";

type Geloest = { id: string; belege: string[] };
type Phase = "akte" | "tatort" | "wand";

export default function Detektiv({ brett, theme, lauf, zurKarte }: ModusProps) {
  const [phase, setPhase] = useState<Phase>("akte");
  const [gefunden, setGefunden] = useState<string[]>([]);
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [ergebnis, setErgebnis] = useState<{ id: string; r: ChallengeAntwort } | null>(null);
  const [sende, setSende] = useState(false);
  const [geloest, setGeloest] = useState<Geloest[]>([]);
  const korb = useAblage(brett.etappe);

  useSpielwert(lauf, "detektiv", brett.etappe, gefunden.length, brett.fakten.length);

  const fall = brett.etappen.find((e) => e.nr === brett.etappe)?.titel || `Etappe ${brett.etappe}`;
  const aktenzeichen = `${1000 + (hashText(`${fall}:${brett.etappe}`) % 9000)}/${brett.etappe}`;
  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const verdaechtig = (c: ChallengeAufgabe) => VERDAECHTIGE[Math.max(0, brett.challenges.findIndex((x) => x.id === c.id)) % VERDAECHTIGE.length];
  const widerlegt = (id: string) => geloest.some((g) => g.id === id) || !!brett.challenges.find((c) => c.id === id)?.erledigt;
  const offene = brett.challenges.filter((c) => !widerlegt(c.id));
  const notizbuch = brett.fakten.filter((f) => gefunden.includes(f.id) && !ablage.includes(f.id) && !korb.istWeg(f.id));
  const gestempelt = brett.challenges.length > 0 && offene.length === 0;

  const waehle = (id: string) => {
    if (widerlegt(id) || sende) return;
    setAktiv(id); setAblage([]); setTipp(false); setErgebnis(null); lauf.waehle();
  };
  const hefte = (fid: string, an = aktiv) => {
    if (!an || an !== aktiv || ablage.includes(fid) || !gefunden.includes(fid) || korb.istWeg(fid) || !fakten.has(fid)) return;
    lauf.gelegt();
    setErgebnis(null);
    setAblage([...ablage, fid]);
  };
  const vorlegen = async () => {
    if (!aktiv || !ablage.length || sende) return;
    setSende(true);
    try {
      const r = await lauf.antworte(aktiv, ablage, tipp);
      setErgebnis({ id: aktiv, r });
      if (r.komplett) { setGeloest((g) => [...g, { id: aktiv, belege: ablage }]); setAktiv(null); }
      setAblage([]); setTipp(false);
    } catch { setAblage([]); }
    finally { setSende(false); }
  };

  const kopf = (
    <div className="flex items-center justify-between gap-2">
      <Herzen leben={brett.leben} />
      <span className="dt-schreib text-sm">Akte {aktenzeichen}</span>
      <button className="btn-secondary" onClick={zurKarte}>Karte</button>
    </div>
  );

  if (phase === "akte") {
    return (
      <div className="dt-noir rounded-lg p-4 flex flex-col gap-3">
        <DetektivStil />
        <div className="dt-regen" aria-hidden />
        {kopf}
        <div className="dt-akte relative rounded-sm p-4 flex flex-col gap-3" role="group" aria-label="Fallakte">
          <span className="dt-stempel-fest absolute right-3 top-3 border-4 border-red-700 text-red-700 font-black px-2 rotate-12" aria-hidden>VERTRAULICH</span>
          <p className="dt-schreib text-xs">POLIZEIPRÄSIDIUM · KRIMINALPOLIZEI · AKTENZEICHEN {aktenzeichen}</p>
          <h2 className="dt-schreib text-2xl font-black">Fall: »{fall}«</h2>
          <p className="dt-schreib text-sm leading-relaxed">
            Am Tatort sind {brett.fakten.length} Spuren zu sichern – nicht jede gehört zum Fall. {brett.challenges.length} {brett.challenges.length === 1 ? "Person hat" : "Personen haben"} ausgesagt.
            Jede Aussage hat einen Haken: Finden Sie die Beweise, die ihn aufdecken, und heften Sie sie an die Ermittlungswand.
            Falsche Anschuldigungen kosten Vertrauen ({brett.leben} {brett.leben === 1 ? "Chance" : "Chancen"}).
          </p>
          <div className="flex flex-wrap gap-3" role="group" aria-label="Beteiligte">
            {brett.challenges.map((c) => {
              const v = verdaechtig(c);
              return (
                <figure key={c.id} className="dt-foto flex flex-col items-center p-2 pb-1 -rotate-2 odd:rotate-2">
                  <Npc name={v.npc} scale={3} label={v.name} />
                  <figcaption className="dt-schreib text-xs mt-1">{v.name}</figcaption>
                </figure>
              );
            })}
          </div>
        </div>
        <button className="btn-primary self-start" onClick={() => setPhase(brett.fakten.length ? "tatort" : "wand")}>🔦 Zum Tatort</button>
      </div>
    );
  }

  if (phase === "tatort") {
    return (
      <div className="dt-noir rounded-lg p-3 flex flex-col gap-2">
        <DetektivStil />
        {kopf}
        <h2 className="dt-schreib font-bold">🔦 Tatort: {fall}</h2>
        <Tatort fakten={brett.fakten} theme={theme} seed={brett.etappe * 1009 + brett.stufe * 31 + brett.fakten.length}
          gefunden={gefunden} setGefunden={setGefunden} weiter={() => setPhase("wand")} onWegwerfen={korb.wegwerfen} />
        <Papierkorb weg={korb.weg} fakten={brett.fakten} onZurueck={korb.zurueckholen} />
      </div>
    );
  }

  return (
    <div className="dt-noir rounded-lg p-3 flex flex-col gap-3">
      <DetektivStil />
      {kopf}
      <h2 className="dt-schreib font-bold">📌 Ermittlungswand – {fall}</h2>
      <p className="text-sm opacity-80">Wähle eine Aussage, hefte Spuren aus dem Notizbuch daran (anklicken oder hinziehen) und lege sie vor.</p>

      <div className="dt-kork rounded-lg p-3 grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-4" role="group" aria-label="Ermittlungswand">
        {brett.challenges.map((c, i) => {
          const v = verdaechtig(c);
          const g = geloest.find((x) => x.id === c.id);
          const fertig = widerlegt(c.id);
          const ist = aktiv === c.id;
          const letztes = ergebnis?.id === c.id ? ergebnis.r : null;
          const grinst = !!letztes && !letztes.komplett;
          return (
            <div key={c.id} className={`dt-karte relative flex flex-col ${i % 2 ? "rotate-1" : "-rotate-1"} ${ist ? "dt-aktiv" : ""}`}
              onDragOver={(e) => { if (ist) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); hefte(e.dataTransfer.getData("text/plain"), c.id); }}>
              <span className="dt-nadel" aria-hidden />
              <button type="button" disabled={fertig || sende} onClick={() => waehle(c.id)} aria-pressed={ist}
                aria-label={`Aussage von ${v.name}: ${c.text}`} className="flex gap-2 items-start text-left p-2 disabled:cursor-default">
                <span className={`dt-foto shrink-0 p-1 ${grinst ? "dt-kopf" : ""}`}><Npc name={v.npc} scale={2} /></span>
                <span className="text-sm flex-1 min-w-0">
                  <strong className="dt-schreib block">{v.name}{grinst ? " 😏" : ""}</strong>
                  <Frage x={c} icon="💬" />
                </span>
              </button>
              {fertig && <span className="dt-stempel absolute right-2 bottom-2 border-4 border-red-700 text-red-700 bg-white/70 font-black px-2" role="status">WIDERLEGT</span>}
              {grinst && <p className="dt-schreib text-xs px-2 pb-1" aria-live="polite">»Beweisen Sie das erst mal!«{letztes!.treffer ? " – aber er wird nervös." : ""}</p>}
              {g && (
                <div className="flex flex-col px-2 pb-8">
                  <svg className="w-full h-6" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden>
                    {g.belege.map((_, k) => <line key={k} x1="50" y1="0" x2={((k + 0.5) / g.belege.length) * 100} y2="24" stroke="#c1121f" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
                  </svg>
                  <div className="flex flex-wrap gap-1 justify-around">
                    {g.belege.map((id) => <span key={id} className="dt-zettel text-xs p-1"><Inhalt x={fakten.get(id) ?? { text: id, image: null, formula: null }} /></span>)}
                  </div>
                </div>
              )}
              {ist && (
                <div className="flex flex-col gap-2 p-2 border-t border-dashed border-black/30" aria-label="Angeheftete Beweise">
                  <div className="flex flex-wrap gap-1 min-h-8">
                    {ablage.map((id) => (
                      <button key={id} className="dt-zettel text-xs p-1 text-left" title="Abnehmen" onClick={() => setAblage(ablage.filter((x) => x !== id))}>
                        <Inhalt x={fakten.get(id)!} />
                      </button>
                    ))}
                    {!ablage.length && <span className="text-xs italic opacity-70">Noch keine Spur angeheftet.</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-primary" disabled={!ablage.length || sende} onClick={vorlegen}>Beweis vorlegen</button>
                    {c.tip && (tipp ? <span className="text-xs self-center">💡 {c.tip}</span> : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {ergebnis && <Treffermeldung antwort={ergebnis.r} />}
      {gestempelt && (
        <div className="flex flex-col items-center gap-2" role="status">
          <span className="dt-stempel border-4 border-green-700 text-green-700 bg-white/80 font-black text-3xl px-3 rounded">FALL GELÖST!</span>
          <p className="dt-akte dt-schreib rounded-sm p-2 text-sm">Aktenvermerk {aktenzeichen}: Alle {brett.challenges.length} Aussagen widerlegt. Fall »{fall}« abgeschlossen.</p>
        </div>
      )}

      {!gestempelt && (
        <>
          <h3 className="dt-schreib font-bold">📓 Notizbuch</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
            {notizbuch.map((f) => (
              <div key={f.id} className="flex flex-col gap-1">
                <button draggable={!!aktiv} onDragStart={(e) => e.dataTransfer.setData("text/plain", f.id)} disabled={!aktiv} onClick={() => hefte(f.id)}
                  className="dt-zettel text-left text-sm p-2 relative disabled:opacity-80" aria-label={`Spur anheften: ${f.text}`}>
                  <span className="absolute right-1 top-0 text-lg" aria-hidden title="Skizze">{skizzeVon(f.id)}</span>
                  <Inhalt x={f} />
                </button>
                <WegKnopf fakt={f} onClick={() => korb.wegwerfen(f.id)} />
              </div>
            ))}
          </div>
          {!aktiv && notizbuch.length > 0 && <p className="text-xs opacity-80">Erst eine Aussage an der Wand wählen, dann Spuren anheften.</p>}
        </>
      )}
      <Papierkorb weg={korb.weg} fakten={brett.fakten} onZurueck={korb.zurueckholen} />
      {lauf.hatBestenliste && <div><BestenlisteKnopf lauf={lauf} spiel="detektiv" /></div>}
    </div>
  );
}
