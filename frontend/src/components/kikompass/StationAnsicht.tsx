"use client";
/**
 * Eine Station des KI-Führerscheins: Erklärung → Auftrag → AIS.chat (falls
 * vorhanden) → Selbst-Check → Reflexion. Die Reflexion landet im Portfolio.
 */
import { useState } from "react";
import Link from "next/link";
import { BEREICHE, KANN_SAETZE } from "@/lib/kikompass/raster";
import {
  QUIZ_SCHWELLE, REFLEXION_MAX, REFLEXION_MIN, quizBestanden, reflexionFertig, stationFertig,
  type Station, type StationStand,
} from "@/lib/kikompass/stationen";
import { heute } from "./Raster";

export function StationAnsicht({ station, stand, onChange, onZurueck }: {
  station: Station;
  stand: StationStand | undefined;
  onChange: (neu: StationStand) => void;
  onZurueck: () => void;
}) {
  const bereich = BEREICHE.find(b => b.id === station.modul)!;
  const [antworten, setAntworten] = useState<(number | null)[]>(() => station.quiz.map(() => null));
  const [geprueft, setGeprueft] = useState(false);
  const [texte, setTexte] = useState<string[]>(() => station.reflexion.map((_, i) => stand?.reflexion?.[i] ?? ""));

  const richtig = antworten.filter((a, i) => a === station.quiz[i].richtig).length;
  const besterQuiz = Math.max(stand?.quiz ?? 0, geprueft ? richtig : 0);

  function melden(quiz: number, reflexion: string[]) {
    const neu: StationStand = { quiz, reflexion };
    neu.erledigt_am = stationFertig(station, neu) ? (stand?.erledigt_am ?? heute()) : undefined;
    onChange(neu);
  }

  function pruefen() {
    setGeprueft(true);
    melden(Math.max(stand?.quiz ?? 0, richtig), texte);
  }

  function nochmal() {
    setAntworten(station.quiz.map(() => null));
    setGeprueft(false);
  }

  function reflexionSpeichern() {
    melden(besterQuiz, texte.map(t => t.slice(0, REFLEXION_MAX)));
  }

  const fertig = stationFertig(station, stand);

  return (
    <article className="flex flex-col gap-4 max-w-3xl">
      <button className="btn-secondary self-start" onClick={onZurueck}>← Alle Stationen</button>
      <header>
        <p className="text-sm" style={{ color: bereich.farbe }}>{bereich.icon} Modul {bereich.name} · Stufe {station.stufe} · ca. {station.minuten} min</p>
        <h2 className="text-2xl font-bold">{station.icon} {station.titel} {fertig && "✅"}</h2>
        <ul className="text-xs text-muted mt-1">
          {station.kann.map(id => <li key={id}>🎯 {KANN_SAETZE.find(k => k.id === id)?.text}</li>)}
        </ul>
      </header>

      <section className="card p-4 flex flex-col gap-2">
        <h3 className="font-semibold">📖 Worum geht es?</h3>
        {station.erklaerung.map((t, i) => <p key={i}>{t}</p>)}
      </section>

      <section className="card p-4 flex flex-col gap-2">
        <h3 className="font-semibold">✋ Auftrag</h3>
        <ol className="list-decimal pl-5 flex flex-col gap-1">{station.auftrag.map((t, i) => <li key={i}>{t}</li>)}</ol>
        {station.sim && (
          <Link href={station.sim.href} target="_blank" className="btn-secondary self-start">🔬 {station.sim.titel} öffnen</Link>
        )}
        {station.link && (
          <p className="text-sm">
            🔗 <a href={station.link.url} target="_blank" rel="noreferrer" className="underline">{station.link.titel}</a>
            <span className="text-muted"> (von {station.link.quelle})</span>
          </p>
        )}
      </section>

      {station.ais && (
        <section className="card p-4 flex flex-col gap-2">
          <h3 className="font-semibold">🤖 Mit AIS.chat</h3>
          <p className="text-sm text-muted">Deine Lehrkraft zeigt dir einen QR-Code oder Link zu AIS.chat. Ein eigenes Konto brauchst du nicht.</p>
          <ol className="list-decimal pl-5 flex flex-col gap-1">{station.ais.schritte.map((t, i) => <li key={i}>{t}</li>)}</ol>
          {station.ais.prompts && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Prompts zum Ausprobieren:</p>
              {station.ais.prompts.map(p => (
                <code key={p} className="block text-sm rounded p-2 bg-surface-hover">{p}</code>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-semibold">✅ Selbst-Check {stand && quizBestanden(station, stand.quiz) && <span className="text-ok">(bestanden)</span>}</h3>
        {station.quiz.map((f, i) => (
          <fieldset key={i} className="flex flex-col gap-1">
            <legend className="font-medium">{i + 1}. {f.frage}</legend>
            {f.antworten.map((a, j) => {
              const gewaehlt = antworten[i] === j;
              const farbe = geprueft && gewaehlt ? (j === f.richtig ? "text-ok" : "text-bad") : "";
              return (
                <label key={j} className={`flex items-center gap-2 text-sm cursor-pointer ${farbe}`}>
                  <input type="radio" name={`${station.id}-${i}`} checked={gewaehlt} disabled={geprueft}
                    onChange={() => setAntworten(alt => alt.map((x, k) => (k === i ? j : x)))} />
                  {a}
                </label>
              );
            })}
            {geprueft && <p className="text-xs text-muted">💡 {f.warum}</p>}
          </fieldset>
        ))}
        {!geprueft ? (
          <button className="btn-primary self-start" disabled={antworten.some(a => a === null)} onClick={pruefen}>Prüfen</button>
        ) : (
          <div className="flex items-center gap-3">
            <span className={quizBestanden(station, richtig) ? "text-ok font-medium" : "text-bad font-medium"}>
              {richtig} von {station.quiz.length} richtig
              {quizBestanden(station, richtig) ? " – geschafft!" : ` – du brauchst ${Math.ceil(QUIZ_SCHWELLE * station.quiz.length)}.`}
            </span>
            <button className="btn-secondary" onClick={nochmal}>Nochmal</button>
          </div>
        )}
      </section>

      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-semibold">📝 Reflexion fürs Portfolio</h3>
        <p className="text-xs text-muted">
          Schreib in eigenen Worten (mindestens {REFLEXION_MIN} Zeichen je Antwort). Kopiere keine KI-Antworten hier hinein
          und schreib keine Namen. Deine Lehrkraft kann deine Reflexion lesen.
        </p>
        {station.reflexion.map((frage, i) => (
          <label key={i} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{frage}</span>
            <textarea className="input min-h-20" maxLength={REFLEXION_MAX} value={texte[i]}
              onChange={e => setTexte(alt => alt.map((t, k) => (k === i ? e.target.value : t)))} />
            <span className="text-xs text-muted">{texte[i].trim().length} Zeichen</span>
          </label>
        ))}
        <button className="btn-primary self-start" onClick={reflexionSpeichern}
          disabled={texte.join("|") === (stand?.reflexion ?? []).join("|")}>
          Reflexion speichern
        </button>
        {!reflexionFertig(station, texte) && <p className="text-xs text-muted">Noch nicht lang genug für den Führerschein.</p>}
      </section>
    </article>
  );
}
