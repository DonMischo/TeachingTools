"use client";
/**
 * Kartenquiz für Schüler:innen und Gäste (per Code/QR).
 *   benennen — Nummern auf der Karte, Namen eintippen (oder aus der Wortbank wählen)
 *   finden   — Name gegeben, Objekt auf der Karte anklicken
 * Geprüft wird auf dem Server; die Karte kommt ohne Namen (api/routers/karten_quiz.py).
 */
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { quizStil, type QuizAufgabe, type QuizSpiel, type QuizStand } from "@/lib/karten/quiz";
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

  useEffect(() => {
    api.karten.quiz(code, token).then((s) => { setSpiel(s); setStand(s.stand); })
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

  const stil = useMemo(() => (spiel ? quizStil(code, spiel, stand, hervor) : null), [code, spiel, stand, hervor]);

  const sende = async (a: QuizAufgabe, antwort: string) => {
    const r = await api.karten.quizAntwort(code, a.nr, antwort, token);
    setStand(r.stand);
    if (r.loesung) setLoesungen((l) => ({ ...l, [a.nr]: r.loesung! }));
    if (r.richtig) setMeldung({ text: "Richtig! ✓", gut: true });
    else if (r.loesung && spiel?.spiel.modus === "benennen") setMeldung({ text: `Leider nicht — richtig ist »${r.loesung}«.`, gut: false });
    else if (r.loesung) setMeldung({ text: "Leider nicht — die Lösung ist jetzt rot umrandet.", gut: false });
    else setMeldung({ text: "Noch nicht — versuch es noch einmal.", gut: false });
    const erfolg = spiel?.erfolge.find((e) => r.neue_erfolge.includes(e.id));
    if (erfolg) setNeuerErfolg(`${erfolg.icon} ${erfolg.name}`);
    return r.richtig;
  };

  const klick = (treffer: Treffer[]) => {
    if (!jetzt) return;
    const t = treffer.find((x) => x.ebene === jetzt.ebene);
    if (t) void sende(jetzt, t.id);
  };

  if (fehler) return <p className="p-6 text-center text-[var(--red)]">{fehler}</p>;
  if (!spiel || !stil) return <p className="p-6 text-center text-[var(--text-muted)]">Das Quiz wird geladen …</p>;

  const fertig = offene.length === 0;
  const a = spiel.karte.ausschnitt;
  return (
    <div className="flex flex-col gap-4 p-3 sm:p-5 max-w-[var(--seite-breite)] mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-black">🗺️ {spiel.titel}</h1>
        <div className="text-sm font-bold">✓ {stand.richtig} / {aufgaben.length}</div>
      </div>

      {neuerErfolg && (
        <button onClick={() => setNeuerErfolg(null)} className="rounded-xl bg-[var(--accent)] text-[var(--accent-text,#111)] px-4 py-2 font-black text-left">
          🏆 Erfolg freigeschaltet: {neuerErfolg}
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
        <KartenAnsicht stil={stil} katalog={{ stand: "", ebenen: spiel.katalog }} namenZeigen={false} gastToken={token}
          onKlick={klick} ziel={a} />

        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3 text-sm">
          {meldung && <p className={`font-bold ${meldung.gut ? "text-[var(--green)]" : "text-[var(--red)]"}`}>{meldung.text}</p>}

          {spiel.spiel.modus === "finden" ? (
            fertig ? <p className="font-black">Geschafft! 🎉</p> : jetzt && (
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{jetzt.kategorie}</span>
                <p className="text-lg font-black">Finde: {jetzt.name}</p>
                <p className="text-xs text-[var(--text-muted)]">Tippe auf der Karte auf die richtige Stelle.</p>
                <button className="self-start text-xs underline text-[var(--text-muted)]" onClick={() => setAktuell((i) => i + 1)}>
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
                    <span className="w-8 text-right font-black text-[var(--red)]">{auf.marke}</span>
                    {st?.richtig ? (
                      <span className="flex-1 text-[var(--green)] font-bold">✓ richtig</span>
                    ) : loesungen[auf.nr] ? (
                      <span className="flex-1 text-[var(--text-muted)]">{loesungen[auf.nr]}</span>
                    ) : (
                      <form className="flex-1 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (eingaben[auf.nr]) void sende(auf, eingaben[auf.nr]); }}>
                        {spiel.spiel.wortbank ? (
                          <select value={eingaben[auf.nr] ?? ""} aria-label={`Name für ${auf.marke}`}
                            onChange={(e) => setEingaben((x) => ({ ...x, [auf.nr]: e.target.value }))}
                            className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                            <option value="">— wählen —</option>
                            {spiel.spiel.wortbank.map((w) => <option key={w}>{w}</option>)}
                          </select>
                        ) : (
                          <input value={eingaben[auf.nr] ?? ""} placeholder={auf.kategorie} aria-label={`Name für ${auf.marke}`}
                            onChange={(e) => setEingaben((x) => ({ ...x, [auf.nr]: e.target.value }))}
                            className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)]" />
                        )}
                        <button className="px-2 rounded-lg border border-[var(--border)] font-bold" aria-label={`${auf.marke} prüfen`}>✓</button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {spiel.erfolge.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--border)]">
              {spiel.erfolge.map((e) => {
                const hat = stand.erfolge.includes(e.id);
                return (
                  <span key={e.id} title={e.name} className={`px-2 py-0.5 rounded-full text-xs border border-[var(--border)] ${hat ? "" : "opacity-40 grayscale"}`}>
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
