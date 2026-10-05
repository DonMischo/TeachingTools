"use client";
/**
 * Kartenquiz für Schüler:innen und Gäste (per Code/QR).
 *   benennen — Nummern auf der Karte, Namen eintippen (oder aus der Wortbank wählen)
 *   finden   — Name gegeben, Objekt auf der Karte anklicken
 * Geprüft wird auf dem Server; die Karte kommt ohne Namen (api/routers/karten_quiz.py).
 * »Üben« (Lernhelfer): eine Aufgabe nach der anderen, was am wenigsten sitzt zuerst;
 * unsicher → Auswahl mit Ablenkern, sicher → freie Eingabe. Zählt nicht für Punkte.
 */
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { quizStil, type QuizAufgabe, type QuizLernen, type QuizSpiel, type QuizStand, type UebenAntwortOut, type UebenAufgabe } from "@/lib/karten/quiz";
import KartenAnsicht, { type Treffer } from "./KartenAnsicht";

type Meldung = { text: string; gut: boolean } | null;

export default function KartenQuizSpiel({ code, token }: { code: string; token?: string | null }) {
  const [spiel, setSpiel] = useState<QuizSpiel | null>(null);
  const [fehler, setFehler] = useState("");
  const [stand, setStand] = useState<QuizStand>({ antworten: {}, richtig: 0, erfolge: [] });
  const [eingaben, setEingaben] = useState<Record<number, string>>({});
  const [loesungen, setLoesungen] = useState<Record<number, string>>({});
  const [aktuell, setAktuell] = useState(0);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [neuerErfolg, setNeuerErfolg] = useState<string | null>(null);
  const [lernen, setLernen] = useState<QuizLernen | null>(null);
  const [ansicht, setAnsicht] = useState<"quiz" | "ueben">("quiz");
  const [uebung, setUebung] = useState<UebenAufgabe | null>(null);
  const [uebErgebnis, setUebErgebnis] = useState<UebenAntwortOut | null>(null);
  const [uebEingabe, setUebEingabe] = useState("");

  useEffect(() => {
    api.karten.quiz(code, token).then((s) => { setSpiel(s); setStand(s.stand); setLernen(s.lernen ?? null); })
      .catch((e: Error) => setFehler(e.message.includes("geschlossen") ? "Dieses Quiz ist geschlossen." : "Das Quiz konnte nicht geladen werden."));
  }, [code, token]);

  const aufgaben = useMemo(() => spiel?.spiel.aufgaben ?? [], [spiel]);
  const erledigt = (a: QuizAufgabe) => {
    const st = stand.antworten[String(a.nr)];
    return !!st && (st.richtig || st.versuche >= 2);
  };
  // finden: nächste offene Aufgabe
  const offene = aufgaben.filter((a) => !erledigt(a));
  const jetzt = spiel?.spiel.modus === "finden" ? offene[aktuell % Math.max(1, offene.length)] : undefined;

  // Aufgedeckte Lösungen (finden) als rote Umrandung — je Ebene die Tokens
  const hervor = useMemo(() => {
    const je: Record<string, string[]> = {};
    for (const a of aufgaben) {
      const t = loesungen[a.nr];
      if (t && spiel?.spiel.modus === "finden") (je[a.ebene] ??= []).push(t);
    }
    return je;
  }, [aufgaben, loesungen, spiel]);

  // Üben: gefragtes Objekt (benennen) bzw. Kandidaten (finden) umranden; nach der Antwort die Lösung
  const uebAnsicht = useMemo(() => {
    if (ansicht !== "ueben" || !uebung) return undefined;
    const tokens = uebErgebnis ? [uebErgebnis.token] : uebung.richtung === "benennen" ? [uebung.token ?? ""] : uebung.kandidaten ?? [];
    return { anker: uebung.richtung === "benennen" ? uebung.anker : null, ebene: uebung.ebene, hervor: { [uebung.ebene]: tokens } };
  }, [ansicht, uebung, uebErgebnis]);

  const stil = useMemo(() => (spiel ? quizStil(`/api/karten/quiz/${encodeURIComponent(code)}`, spiel, stand, hervor, uebAnsicht) : null),
    [code, spiel, stand, hervor, uebAnsicht]);

  const erfolgMelden = (ids: string[]) => {
    const erfolg = spiel?.erfolge.find((e) => ids.includes(e.id));
    if (erfolg) setNeuerErfolg(`${erfolg.icon} ${erfolg.name}`);
  };

  const naechsteUebung = async () => {
    setUebErgebnis(null); setUebEingabe(""); setMeldung(null);
    try { setUebung(await api.karten.uebenNaechste(code, token)); } catch { setMeldung({ text: "Üben geht gerade nicht.", gut: false }); }
  };
  const uebenSenden = async (antwort: string) => {
    if (!uebung || uebErgebnis) return;
    const r = await api.karten.uebenAntwort(code, { nr: uebung.nr, richtung: uebung.richtung, antwort }, token);
    setUebErgebnis(r); setStand(r.stand); setLernen(r.lernen);
    setMeldung(r.richtig ? { text: "Richtig! ✓", gut: true }
      : { text: uebung.richtung === "benennen" ? `Nicht ganz — das ist »${r.name}«.` : "Nicht ganz — die Lösung ist jetzt umrandet.", gut: false });
    erfolgMelden(r.neue_erfolge);
  };

  const sende = async (a: QuizAufgabe, antwort: string) => {
    const r = await api.karten.quizAntwort(code, a.nr, antwort, token);
    setStand(r.stand);
    if (r.loesung) setLoesungen((l) => ({ ...l, [a.nr]: r.loesung! }));
    if (r.lernen) setLernen(r.lernen);
    if (r.richtig) setMeldung({ text: "Richtig! ✓", gut: true });
    else if (r.loesung && spiel?.spiel.modus === "benennen") setMeldung({ text: `Leider nicht — richtig ist »${r.loesung}«.`, gut: false });
    else if (r.loesung) setMeldung({ text: "Leider nicht — die Lösung ist jetzt rot umrandet.", gut: false });
    else setMeldung({ text: "Noch nicht — versuch es noch einmal.", gut: false });
    erfolgMelden(r.neue_erfolge);
    return r.richtig;
  };

  const klick = (treffer: Treffer[]) => {
    if (ansicht === "ueben") {
      const t = uebung?.richtung === "finden" ? treffer.find((x) => x.ebene === uebung.ebene) : undefined;
      if (t) void uebenSenden(t.id);
      return;
    }
    if (!jetzt) return;
    const t = treffer.find((x) => x.ebene === jetzt.ebene);
    if (t) void sende(jetzt, t.id);
  };

  if (fehler) return <p className="p-6 text-center text-bad">{fehler}</p>;
  if (!spiel || !stil) return <p className="p-6 text-center text-muted">Das Quiz wird geladen …</p>;

  const fertig = offene.length === 0;
  const a = spiel.karte.ausschnitt;
  return (
    <div className="flex flex-col gap-4 p-3 sm:p-5 max-w-seite mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-black">🗺️ {spiel.titel}</h1>
        <div className="flex items-center gap-3">
          {spiel.einstellungen.ueben !== false && (
            <div className="flex rounded-lg border border-line overflow-hidden text-sm" role="tablist">
              {([["quiz", "Quiz"], ["ueben", "🎯 Üben"]] as const).map(([w, t]) => (
                <button key={w} role="tab" aria-selected={ansicht === w}
                  onClick={() => { setAnsicht(w); setMeldung(null); if (w === "ueben" && !uebung) void naechsteUebung(); }}
                  className={`px-3 py-1 font-bold ${ansicht === w ? "bg-accent text-accent-fg" : ""}`}>{t}</button>
              ))}
            </div>
          )}
          <div className="text-sm font-bold">✓ {stand.richtig} / {aufgaben.length}</div>
        </div>
      </div>

      {neuerErfolg && (
        <button onClick={() => setNeuerErfolg(null)} className="btn-primary px-4 py-2 text-left">
          🏆 Erfolg freigeschaltet: {neuerErfolg}
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
        <KartenAnsicht stil={stil} katalog={{ stand: "", ebenen: spiel.katalog }} namenZeigen={false} gastToken={token}
          projektion={spiel.karte.projektion ?? "equalearth"}
          onKlick={klick} ziel={a} blick={uebAnsicht?.anker ?? null} />

        <aside className="card p-4 flex flex-col gap-3 text-sm">
          {meldung && <p className={`font-bold ${meldung.gut ? "text-ok" : "text-bad"}`}>{meldung.text}</p>}

          {ansicht === "ueben" ? (
            <UebenPanel uebung={uebung} ergebnis={uebErgebnis} lernen={lernen} eingabe={uebEingabe} setEingabe={setUebEingabe}
              senden={uebenSenden} weiter={naechsteUebung} />
          ) : spiel.spiel.modus === "finden" ? (
            fertig ? <p className="font-black">Geschafft! 🎉</p> : jetzt && (
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wide text-muted">{jetzt.kategorie}</span>
                <p className="text-lg font-black">Finde: {jetzt.name}</p>
                <p className="text-xs text-muted">Tippe auf der Karte auf die richtige Stelle.</p>
                <button className="self-start text-xs underline text-muted" onClick={() => setAktuell((i) => i + 1)}>
                  überspringen
                </button>
              </div>
            )
          ) : (
            <ol className="flex flex-col gap-1.5">
              {aufgaben.map((auf) => {
                const st = stand.antworten[String(auf.nr)];
                return (
                  <li key={auf.nr} className="flex items-center gap-2">
                    <span className="w-8 text-right font-black text-bad">{auf.marke}</span>
                    {st?.richtig ? (
                      <span className="flex-1 text-ok font-bold">✓ richtig</span>
                    ) : loesungen[auf.nr] ? (
                      <span className="flex-1 text-muted">{loesungen[auf.nr]}</span>
                    ) : (
                      <form className="flex-1 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (eingaben[auf.nr]) void sende(auf, eingaben[auf.nr]); }}>
                        {spiel.spiel.wortbank ? (
                          <select value={eingaben[auf.nr] ?? ""} aria-label={`Name für ${auf.marke}`}
                            onChange={(e) => setEingaben((x) => ({ ...x, [auf.nr]: e.target.value }))}
                            className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-line bg-page">
                            <option value="">— wählen —</option>
                            {spiel.spiel.wortbank.map((w) => <option key={w}>{w}</option>)}
                          </select>
                        ) : (
                          <input value={eingaben[auf.nr] ?? ""} placeholder={auf.kategorie} aria-label={`Name für ${auf.marke}`}
                            onChange={(e) => setEingaben((x) => ({ ...x, [auf.nr]: e.target.value }))}
                            className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-line bg-page" />
                        )}
                        <button className="px-2 rounded-lg border border-line font-bold" aria-label={`${auf.marke} prüfen`}>✓</button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {spiel.erfolge.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-line">
              {spiel.erfolge.map((e) => {
                const hat = stand.erfolge.includes(e.id);
                return (
                  <span key={e.id} title={e.text ? `${e.name}: ${e.text}` : e.name} className={`px-2 py-0.5 rounded-full text-xs border border-line ${hat ? "" : "opacity-40 grayscale"}`}>
                    {e.icon} {e.name}
                  </span>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Seitenleiste im Übungsmodus: Aufgabe, Hilfe (Auswahl) oder freie Eingabe, Sicherheit. */
export function UebenPanel({ uebung, ergebnis, lernen, eingabe, setEingabe, senden, weiter }: {
  uebung: UebenAufgabe | null; ergebnis: UebenAntwortOut | null; lernen: QuizLernen | null;
  eingabe: string; setEingabe: (s: string) => void; senden: (antwort: string) => Promise<void>; weiter: () => Promise<void>;
}) {
  if (!uebung) return <p className="text-muted">Übung wird geladen …</p>;
  const sicherheit = ergebnis?.sicherheit ?? uebung.sicherheit;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-wide text-muted">{uebung.kategorie}</span>
      {uebung.richtung === "benennen"
        ? <p className="text-lg font-black">Wie heißt das markierte Objekt <span className="text-bad">?</span></p>
        : <p className="text-lg font-black">Finde: {uebung.name}</p>}
      {uebung.richtung === "finden" && !ergebnis && (
        <p className="text-xs text-muted">
          {uebung.hilfe === "auswahl" ? "Tipp: Es ist eines der umrandeten Objekte." : "Tippe auf der Karte auf die richtige Stelle."}
        </p>
      )}
      {uebung.richtung === "benennen" && !ergebnis && (uebung.optionen ? (
        <div className="grid grid-cols-2 gap-1.5">
          {uebung.optionen.map((o) => (
            <button key={o} onClick={() => void senden(o)}
              className="px-2 py-1.5 rounded-lg border border-line hover:bg-surface-hover font-bold text-left">{o}</button>
          ))}
        </div>
      ) : (
        <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); if (eingabe.trim()) void senden(eingabe); }}>
          <input value={eingabe} onChange={(e) => setEingabe(e.target.value)} aria-label="Name" autoFocus placeholder={uebung.kategorie}
            className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-line bg-page" />
          <button className="px-2 rounded-lg border border-line font-bold" aria-label="prüfen">✓</button>
        </form>
      ))}
      {ergebnis && (
        <button onClick={() => void weiter()} autoFocus
          className="btn-primary self-start px-3 py-1.5">Weiter →</button>
      )}
      <div className="flex items-center gap-2 text-xs text-muted" title="Wie sicher dieses Objekt sitzt (neuere Antworten zählen mehr)">
        Sicherheit
        <span className="flex-1 h-1.5 rounded-full bg-line overflow-hidden">
          <span className="block h-full bg-ok" style={{ width: `${Math.round(sicherheit * 100)}%` }} />
        </span>
      </div>
      {lernen && <p className="text-xs text-muted">Noch unsicher: {lernen.schwach} · geübt an {lernen.tage} Tag{lernen.tage === 1 ? "" : "en"}</p>}
    </div>
  );
}
