"use client";
/**
 * Notruf üben: 112 (Feuerwehr und Rettungsdienst) oder 110 (Polizei) an der
 * Wählscheibe. Eine Leitstelle (Stimme des Browsers — echte Notrufe werden
 * aus Datenschutzgründen nicht veröffentlicht) fragt die W-Fragen ab.
 */
import { useEffect, useRef, useState } from "react";
import { ton } from "./ton";

export type NotrufNummer = "112" | "110";

const ABLAUF: Record<NotrufNummer, { meldung: string; fragen: { frage: string; tipp: string }[]; schluss: string }> = {
  "112": {
    meldung: "Feuerwehr und Rettungsdienst, Notruf. Wo genau ist der Notfallort?",
    fragen: [
      { frage: "Wo genau ist der Notfallort?", tipp: "Ort, Straße, Hausnummer — oder ein Merkpunkt wie »Schulhof, neben der Turnhalle«." },
      { frage: "Was ist passiert?", tipp: "Kurz: Unfall, Feuer, jemand ist umgekippt …" },
      { frage: "Wie viele Menschen sind verletzt oder betroffen?", tipp: "Eine Zahl reicht, auch geschätzt." },
      { frage: "Welche Verletzungen oder Beschwerden sehen Sie?", tipp: "Blutet jemand, ist jemand bewusstlos, atmet die Person?" },
    ],
    schluss: "Danke. Rettungsdienst ist unterwegs. Bleiben Sie bei der Person und legen Sie nicht auf, falls wir noch Fragen haben.",
  },
  "110": {
    meldung: "Polizei-Notruf. Was ist passiert?",
    fragen: [
      { frage: "Was ist passiert?", tipp: "Kurz und sachlich: Einbruch, Unfall, Streit, Diebstahl …" },
      { frage: "Wo genau sind Sie?", tipp: "Adresse oder Merkpunkt." },
      { frage: "Wie viele Personen sind beteiligt — und wie sehen sie aus?", tipp: "Kleidung, Größe, Richtung, in die jemand verschwunden ist." },
      { frage: "Ist jemand verletzt?", tipp: "Dann schickt die Polizei auch den Rettungsdienst." },
    ],
    schluss: "Danke. Eine Streife ist unterwegs. Bringen Sie sich nicht in Gefahr und bleiben Sie erreichbar.",
  },
};

function sprich(text: string, fertig?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) { fertig?.(); return; }
  const s = new SpeechSynthesisUtterance(text);
  s.lang = "de-DE"; s.rate = 1.0; s.pitch = 0.9;
  const stimme = window.speechSynthesis.getVoices().find(v => v.lang.startsWith("de"));
  if (stimme) s.voice = stimme;
  s.onend = () => fertig?.();
  s.onerror = () => fertig?.();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(s);
}

/** Deutsches Freizeichen (425 Hz, 1 s Ton, 4 s Pause) — hier verkürzt */
function freizeichen(mal: number) {
  for (let i = 0; i < mal; i++) ton(425, 1, i * 2, "sine", 0.1);
}

/** Martinshorn: zwei Töne (a′ und d″) im Wechsel */
function martinshorn() {
  for (let i = 0; i < 6; i++) ton(i % 2 ? 587 : 440, 0.7, i * 0.72, "sawtooth", 0.05);
}

export function Leitstelle({ nummer, auflegen, geschafft }: { nummer: NotrufNummer; auflegen: () => void; geschafft?: () => void }) {
  const ablauf = ABLAUF[nummer];
  const [phase, setPhase] = useState<"klingelt" | "gespraech" | "ende">("klingelt");
  const [schritt, setSchritt] = useState(0);
  const [antwort, setAntwort] = useState("");
  const [antworten, setAntworten] = useState<string[]>([]);
  const uhr = useRef<number | null>(null);

  useEffect(() => {
    freizeichen(2);
    uhr.current = window.setTimeout(() => { setPhase("gespraech"); sprich(ablauf.meldung); }, 3600);
    return () => { if (uhr.current) clearTimeout(uhr.current); if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, [ablauf]);

  const weiter = () => {
    if (!antwort.trim()) return;
    const neu = [...antworten, antwort.trim()];
    setAntworten(neu); setAntwort("");
    const naechste = schritt + 1;
    if (naechste < ablauf.fragen.length) {
      setSchritt(naechste);
      sprich(ablauf.fragen[naechste].frage);
    } else {
      setPhase("ende");
      sprich(ablauf.schluss, () => martinshorn());
      geschafft?.();
    }
  };
  // Die erste Frage steckt schon in der Meldung (112: wo, 110: was)
  const f = ablauf.fragen[schritt];
  return (
    <div className="rounded-xl border-2 border-bad/60 p-3 flex flex-col gap-2 text-sm bg-surface" role="region" aria-label={`Notruf ${nummer}`}>
      <div className="flex items-center justify-between gap-2">
        <b>🚨 Notruf {nummer} — {nummer === "112" ? "Feuerwehr und Rettungsdienst" : "Polizei"} (Übung)</b>
        <button className="btn-secondary py-1" onClick={() => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); auflegen(); }}>Auflegen</button>
      </div>
      {phase === "klingelt" && <p className="animate-pulse">📞 Tuuut … tuuut … Die Leitstelle nimmt gleich ab.</p>}
      {phase === "gespraech" && (
        <>
          <p>🎧 <b>Leitstelle:</b> {schritt === 0 ? ablauf.meldung : f.frage}</p>
          <form className="flex flex-wrap gap-1.5" onSubmit={e => { e.preventDefault(); weiter(); }}>
            <input className="input py-1 flex-1 min-w-48" value={antwort} maxLength={120} autoFocus onChange={e => setAntwort(e.target.value)} placeholder="Deine Antwort …" aria-label="Deine Antwort an die Leitstelle" />
            <button className="btn-primary py-1" disabled={!antwort.trim()}>Sagen</button>
          </form>
          <p className="text-xs text-muted">💡 {f.tipp} — Frage {schritt + 1} von {ablauf.fragen.length}</p>
        </>
      )}
      {phase === "ende" && (
        <>
          <p>🎧 <b>Leitstelle:</b> {ablauf.schluss}</p>
          <ol className="text-xs list-decimal pl-5">{ablauf.fragen.map((q, i) => <li key={i}><span className="text-muted">{q.frage}</span> <b>{antworten[i]}</b></li>)}</ol>
          <p className="text-xs">✅ Gut gemacht: Die W-Fragen beantworten — und dann <b>warten, bis die Leitstelle auflegt</b>.</p>
        </>
      )}
      <p className="text-[11px] text-muted">Nur geübt, es wird niemand angerufen. Echte Notrufe nur im Notfall — wer 110 oder 112 zum Spaß missbraucht, macht sich strafbar (§ 145 StGB) und blockiert die Leitung für Menschen in Not. Die 112 gilt in ganz Europa und funktioniert auch ohne SIM-Karte und Guthaben.</p>
    </div>
  );
}
