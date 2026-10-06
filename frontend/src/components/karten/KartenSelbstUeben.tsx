"use client";
/**
 * Üben ohne Sitzungscode: ein geteilter Kartensatz, Aufgabe für Aufgabe vom
 * Lernhelfer gestellt (api/routers/karten_quiz.py, /ueben/{satz_id}).
 * Gleiches Übungspanel wie im Quiz; Lern-Erfolge bleiben im Lernstand.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { quizStil, type QuizLernen, type SelbstUebenSatz, type UebenAufgabe, type UebenAntwortOut } from "@/lib/karten/quiz";
import KartenAnsicht, { type Treffer } from "./KartenAnsicht";
import { UebenPanel } from "./KartenQuizSpiel";

const LEER = { antworten: {}, richtig: 0, erfolge: [] };

export default function KartenSelbstUeben({ satzId }: { satzId: number }) {
  const [satz, setSatz] = useState<SelbstUebenSatz | null>(null);
  const [fehler, setFehler] = useState("");
  const [uebung, setUebung] = useState<UebenAufgabe | null>(null);
  const [ergebnis, setErgebnis] = useState<UebenAntwortOut | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [lernen, setLernen] = useState<QuizLernen | null>(null);
  const [erreicht, setErreicht] = useState<string[]>([]);
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  // Gewählte Antwort, solange der Server prüft — sofort sichtbar, und kein zweites Senden
  const [wartet, setWartet] = useState<string | null>(null);
  // Die nächste Aufgabe wird schon geholt, während die Lösung zu sehen ist
  const vorab = useRef<Promise<UebenAufgabe> | null>(null);

  const naechste = async () => {
    const kommt = vorab.current ?? api.karten.selbstNaechste(satzId);
    vorab.current = null;
    try {
      const neu = await kommt;
      setErgebnis(null); setEingabe(""); setMeldung(null); setUebung(neu);
    } catch { setMeldung({ text: "Üben geht gerade nicht.", gut: false }); }
  };
  useEffect(() => {
    api.karten.selbstSatz(satzId).then((s) => { setSatz(s); setLernen(s.lernen); setErreicht(s.erreicht); void naechste(); })
      .catch(() => setFehler("Dieser Kartensatz ist nicht (mehr) zum Üben freigegeben."));
  }, [satzId]); // eslint-disable-line react-hooks/exhaustive-deps

  const senden = async (antwort: string) => {
    if (!uebung || ergebnis || wartet !== null) return;
    setWartet(antwort);
    let r: Awaited<ReturnType<typeof api.karten.selbstAntwort>>;
    try { r = await api.karten.selbstAntwort(satzId, { nr: uebung.nr, richtung: uebung.richtung, antwort }); }
    catch { setMeldung({ text: "Antwort kam nicht an — bitte noch einmal.", gut: false }); return; }
    finally { setWartet(null); }
    vorab.current = api.karten.selbstNaechste(satzId);
    vorab.current.catch(() => { vorab.current = null; });
    setErgebnis(r); setLernen(r.lernen); setErreicht(r.erreicht);
    const neu = satz?.erfolge.find((e) => r.neue_erfolge.includes(e.id));
    setMeldung(neu ? { text: `🏆 Erfolg: ${neu.icon} ${neu.name}`, gut: true }
      : r.richtig ? { text: "Richtig! ✓", gut: true }
      : { text: uebung.richtung === "benennen" ? `Nicht ganz — das ist »${r.name}«.` : "Nicht ganz — die Lösung ist jetzt umrandet.", gut: false });
  };

  const ansicht = useMemo(() => {
    if (!uebung) return undefined;
    const tokens = ergebnis ? [ergebnis.token] : uebung.richtung === "benennen" ? [uebung.token ?? ""] : uebung.kandidaten ?? [];
    return { anker: uebung.richtung === "benennen" ? uebung.anker : null, ebene: uebung.ebene, hervor: { [uebung.ebene]: tokens } };
  }, [uebung, ergebnis]);
  const stil = useMemo(() => (satz ? quizStil(`/api/karten/quiz/ueben/${satzId}`, satz, LEER, {}, ansicht) : null), [satz, satzId, ansicht]);

  const klick = (treffer: Treffer[]) => {
    const t = uebung?.richtung === "finden" ? treffer.find((x) => x.ebene === uebung.ebene) : undefined;
    if (t) void senden(t.id);
  };

  if (fehler) return <p className="p-6 text-center text-bad">{fehler}</p>;
  if (!satz || !stil) return <p className="p-6 text-center text-muted">Wird geladen …</p>;
  return (
    <div className="flex flex-col gap-4 p-3 sm:p-5 max-w-seite mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-black">🎯 {satz.titel}</h1>
        <Link href="/aktivitaeten/karten" className="text-sm underline text-muted">← Karten</Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
        <KartenAnsicht stil={stil} katalog={{ stand: "", ebenen: satz.katalog }} namenZeigen={false} onKlick={klick}
          ziel={satz.karte.ausschnitt} blick={ansicht?.anker ?? null} projektion={satz.karte.projektion ?? "equalearth"} />
        <aside className="card p-4 flex flex-col gap-3 text-sm">
          {meldung && <p className={`font-bold ${meldung.gut ? "text-ok" : "text-bad"}`}>{meldung.text}</p>}
          <UebenPanel uebung={uebung} ergebnis={ergebnis} lernen={lernen} eingabe={eingabe} setEingabe={setEingabe} senden={senden} weiter={naechste}
            wartet={wartet} />
          {satz.erfolge.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-line">
              {satz.erfolge.map((e) => (
                <span key={e.id} title={e.text ? `${e.name}: ${e.text}` : e.name}
                  className={`px-2 py-0.5 rounded-full text-xs border border-line ${erreicht.includes(e.id) ? "" : "opacity-40 grayscale"}`}>
                  {e.icon} {e.name}
                </span>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
