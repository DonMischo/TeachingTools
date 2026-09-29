"use client";
/**
 * Reiter 1: das Sprachmodell — vom Prompt zum fertigen Text, in vier Stationen.
 *
 *   1. Auftrag    Ein Satz, wie man ihn einer KI schreibt.
 *   2. Zerlegen   Der Satz wird zu Stücken und Nummern (siehe Zerleger.tsx).
 *   3. Schreiben  Das Wortnetz schlägt vor, die Klasse wählt (Wortnetz.tsx).
 *   4. Ergebnis   Der eigene Text, sein Fingerabdruck — und die Tafel der
 *                 ganzen Sitzung, sortiert nach Erwartbarkeit.
 *
 * Die Reihenfolge ist der Lehrgang: Text → Zahlen → Wahrscheinlichkeiten →
 * Würfel → Text. Wer sie einmal durchlaufen hat, hat gesehen, dass an keiner
 * Stelle jemand nachdenkt.
 */
import { useEffect, useMemo, useState } from "react";
import { erwartbarkeit, textAus, type Kandidat, type Netz, type Wort } from "@/lib/ki/wortnetz";
import { NETZE, netzMit } from "@/lib/ki/netze";
import { rng, signatur } from "@/lib/ki/rng";
import { zerlege } from "@/lib/ki/tokenizer";
import { wegeAnzahl, zahlwort } from "@/lib/ki/trainieren";
import { Zerleger } from "@/components/ki/Zerleger";
import { WortnetzBuehne } from "@/components/ki/Wortnetz";
import { Vergleich } from "@/components/ki/Vergleich";
import { Trainieren } from "@/components/ki/Trainieren";
import { Attention } from "@/components/ki/Attention";
import { Raten } from "@/components/ki/Raten";
import { Wissen } from "@/components/ki/Wissen";
import type { KiZugang } from "@/components/ki/KiWerkstatt";

type Station = "auftrag" | "zerlegen" | "schreiben" | "ergebnis" | "trainieren" | "attention" | "raten";

const STATIONEN: { id: Station; nr: number; titel: string }[] = [
  { id: "auftrag", nr: 1, titel: "Auftrag" },
  { id: "zerlegen", nr: 2, titel: "Zerlegen" },
  { id: "schreiben", nr: 3, titel: "Schreiben" },
  { id: "ergebnis", nr: 4, titel: "Ergebnis" },
];

/** Ein gewähltes Wort samt der Wahrscheinlichkeit, mit der es angeboten wurde. */
type Schritt = { wort: Wort; p: number };

const DANEBEN: { id: Station; titel: string }[] = [
  { id: "trainieren", titel: "🧪 Trainieren" },
  { id: "attention", titel: "🔎 Attention" },
  { id: "raten", titel: "🎯 Raten" },
];

function Schritte({ station, lehrgang, auf }: {
  station: Station;
  /** Die zuletzt besuchte Station des Lehrgangs — dorthin führt »Prompt« zurück. */
  lehrgang: Station;
  auf: (s: Station) => void;
}) {
  const imLehrgang = STATIONEN.some(s => s.id === station);
  const chip = (aktiv: boolean) => `px-2.5 py-1 rounded-lg border font-bold ${
    aktiv
      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]"
      : "border-[var(--border)] bg-[var(--surface)]"
  }`;
  return (
    <ol className="flex flex-wrap items-center gap-1 text-xs">
      {/* Prompt ist der Lehrgang 1–4; Trainieren, Attention und Raten stehen
          daneben, nicht darin: sie lassen sich jederzeit öffnen. */}
      <li className="flex items-center gap-1 mr-1">
        <button type="button" onClick={() => auf(lehrgang)} className={chip(imLehrgang)}>
          💬 Prompt
        </button>
        {DANEBEN.map(d => (
          <button key={d.id} type="button" onClick={() => auf(d.id)} className={chip(station === d.id)}>
            {d.titel}
          </button>
        ))}
        <span className="text-[var(--text-muted)]">|</span>
      </li>
      {STATIONEN.map((s, i) => {
        const aktiv = s.id === station;
        const erledigt = STATIONEN.findIndex(x => x.id === lehrgang) >= i && !aktiv;
        return (
          <li key={s.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => (erledigt ? auf(s.id) : undefined)}
              disabled={!erledigt}
              className={`px-2.5 py-1 rounded-lg border font-bold ${
                aktiv
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]"
                  : erledigt
                    ? "border-[var(--border)] bg-[var(--surface)]"
                    : "border-dashed border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed"
              }`}
            >
              {s.nr}. {s.titel}
            </button>
            {i < STATIONEN.length - 1 && <span className="text-[var(--text-muted)]">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Der Text, wie er wächst — antippen nimmt ab hier alles zurück. */
function Textband({ schritte, onZurueck }: { schritte: Schritt[]; onZurueck: (n: number) => void }) {
  if (!schritte.length) {
    return <p className="text-sm text-[var(--text-muted)]">Noch kein Wort gewählt.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {schritte.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onZurueck(i)}
          title={`${Math.round(s.p * 100)} % — antippen nimmt ab hier zurück`}
          className="px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)]
            hover:border-[var(--red)] text-sm font-bold"
        >
          {s.wort.text}
          <span className="ml-1 text-[10px] font-normal text-[var(--text-muted)]">
            {Math.round(s.p * 100)}%
          </span>
        </button>
      ))}
    </div>
  );
}

export function Sprachmodell({ zugang, onSignatur }: {
  zugang?: KiZugang;
  /** Der Fingerabdruck wandert in den Bilder-Reiter und wird dort zum Seed. */
  onSignatur: (sig: string) => void;
}) {
  const [station, setStation] = useState<Station>("auftrag");
  const [lehrgang, setLehrgang] = useState<Station>("auftrag");
  useEffect(() => { if (STATIONEN.some(s => s.id === station)) setLehrgang(station); }, [station]);
  const [thema, setThema] = useState(NETZE[0].slug);
  const [schritte, setSchritte] = useState<Schritt[]>([]);
  const [mut, setMut] = useState(3);
  const [quote, setQuote] = useState<number | null>(null);
  // Ein selbst gezähltes Netz ersetzt das kuratierte, solange es da ist.
  const [gelernt, setGelernt] = useState<Netz | null>(null);

  const netz: Netz = useMemo(() => gelernt ?? netzMit(thema), [gelernt, thema]);
  // Der Verlauf als reine Wortliste — so weit zurück, wie das Netz schaut.
  const verlauf = useMemo(() => schritte.map(s => s.wort), [schritte]);
  const letztes = schritte.length ? schritte[schritte.length - 1].wort : null;
  const saetze = schritte.filter(s => s.wort.art === "punkt").length;
  const fertigMoeglich = letztes?.art === "punkt";

  // Ein eigener Würfel je Durchgang, damit »Maschine wählt« nicht bei allen
  // Geräten dieselbe Folge nimmt.
  const wuerfel = useMemo(() => rng(Math.floor(Math.random() * 2 ** 31)), [thema]);

  const woerter = schritte.filter(s => s.wort.art !== "punkt");
  const wert = erwartbarkeit(schritte.map(s => s.p));
  const text = textAus(schritte.map(s => s.wort));
  const sig = useMemo(() => signatur(schritte.map(s => s.wort.id)), [schritte]);

  useEffect(() => { if (schritte.length) onSignatur(sig); }, [sig, schritte.length, onSignatur]);

  function waehlen(k: Kandidat) {
    setSchritte(alt => [...alt, { wort: k.wort, p: k.p }]);
  }

  function neu() {
    setSchritte([]);
    setQuote(null);
    setStation("auftrag");
  }

  return (
    <div className="flex flex-col gap-5">
      <Schritte station={station} lehrgang={lehrgang} auf={setStation} />

      {station === "auftrag" && (
        <div className="flex flex-col gap-4">
          <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
              Dein Auftrag an die Maschine
            </div>
            <p className="text-lg font-bold">»{netz.prompt}«</p>
          </div>

          {NETZE.length > 1 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="font-bold">Thema</span>
              <select
                value={thema}
                onChange={e => { setThema(e.target.value); setSchritte([]); }}
                className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]"
              >
                {NETZE.map(n => (
                  <option key={n.slug} value={n.slug}>{n.icon} {n.titel}</option>
                ))}
              </select>
            </label>
          )}

          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Diesen Satz bekommt gleich niemand zu lesen. Er wird erst in Stücke geschnitten, die
            Stücke werden zu Nummern, und aus den Nummern sucht ein Netz aus Wahrscheinlichkeiten
            das nächste Wort. Du übernimmst dabei den letzten Schritt: das Würfeln.
          </p>

          <div>
            <button
              type="button"
              onClick={() => setStation("zerlegen")}
              className="px-4 py-2 rounded-xl font-black bg-[var(--accent)] text-[var(--accent-text)]"
            >
              Los →
            </button>
          </div>

          <Wissen thema="auftrag" />
        </div>
      )}

      {station === "trainieren" && (
        <Trainieren
          zugang={zugang}
          aktiv={gelernt}
          onNetz={n => { setGelernt(n); setSchritte([]); setStation("schreiben"); }}
        />
      )}

      {station === "attention" && <Attention />}

      {station === "raten" && <Raten />}

      {station === "zerlegen" && (
        <div className="flex flex-col gap-4">
          <Zerleger
            text={netz.prompt}
            onWeiter={q => { setQuote(q); setStation("schreiben"); }}
          />
          <Wissen thema="zerlegen" />
        </div>
      )}

      {station === "schreiben" && (
        <div className="flex flex-col gap-4">
          {gelernt && (
            <div className="flex items-center gap-2 flex-wrap text-sm p-3 rounded-2xl
              border border-[var(--accent)] bg-[var(--surface)]">
              <span aria-hidden>🧪</span>
              <span>
                Du schreibst mit einem <b>selbst gezählten</b> Netz:
                {" "}{gelernt.quelle}, Rückblick {gelernt.n}.
              </span>
              <button
                type="button"
                onClick={() => { setGelernt(null); setSchritte([]); }}
                className="px-2.5 py-1 rounded-lg border border-[var(--border)]
                  bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-xs font-bold"
              >
                zurück zum fertigen Netz
              </button>
            </div>
          )}

          <WortnetzBuehne
            netz={netz}
            verlauf={verlauf}
            mut={mut}
            onMut={setMut}
            onWaehlen={waehlen}
            wuerfel={wuerfel}
          />

          <div className="flex flex-col gap-3">
            <Wissen thema="netz" />
            <Wissen thema="auswahl" />
          </div>

          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Dein Text ({woerter.length} {woerter.length === 1 ? "Wort" : "Wörter"},
                {" "}{saetze} {saetze === 1 ? "Satz" : "Sätze"})
              </span>
              {schritte.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSchritte(alt => alt.slice(0, -1))}
                  className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  ↶ letztes Wort zurück
                </button>
              )}
            </div>
            <Textband schritte={schritte} onZurueck={i => setSchritte(alt => alt.slice(0, i))} />
            <p className="text-lg font-bold leading-relaxed">{text || "…"}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!fertigMoeglich}
              onClick={() => setStation("ergebnis")}
              className="px-4 py-2 rounded-xl font-black bg-[var(--accent)] text-[var(--accent-text)]
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✓ Fertig
            </button>
            {!fertigMoeglich && (
              <span className="text-xs text-[var(--text-muted)]">
                Fertig wird möglich, sobald ein Satz mit einem Punkt endet.
              </span>
            )}
          </div>
        </div>
      )}

      {station === "ergebnis" && (
        <Ergebnis
          netz={netz}
          text={text}
          wert={wert}
          mut={mut}
          sig={sig}
          quote={quote}
          zugang={zugang}
          onNochmal={neu}
          onWeiterschreiben={() => setStation("schreiben")}
        />
      )}

      {station === "ergebnis" && <Wissen thema="ergebnis" />}
    </div>
  );
}

function Ergebnis({ netz, text, wert, mut, sig, quote, zugang, onNochmal, onWeiterschreiben }: {
  netz: Netz;
  text: string;
  wert: number;
  mut: number;
  sig: string;
  quote: number | null;
  zugang?: KiZugang;
  onNochmal: () => void;
  onWeiterschreiben: () => void;
}) {
  const tokens = useMemo(() => zerlege(text), [text]);
  // Wie viele Texte dieser Länge das Netz überhaupt schreiben könnte — die
  // Antwort auf »würfelt das nicht immer dasselbe?«.
  const woerterAnzahl = text.trim() ? text.trim().split(/\s+/).length : 0;
  const moeglich = useMemo(() => wegeAnzahl(netz, Math.max(1, woerterAnzahl)), [netz, woerterAnzahl]);

  return (
    <div className="flex flex-col gap-5">
      <div className="p-5 rounded-2xl border border-[var(--accent)] bg-[var(--surface)]">
        <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Dein Text</div>
        <p className="text-xl font-bold leading-relaxed">{text}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <Kachel titel="Erwartbarkeit" wert={`${Math.round(wert * 100)} %`}
          hinweis="Wie sehr die Maschine diesen Text selbst geschrieben hätte" />
        <Kachel titel="Auswahl" wert={`${mut + 1}`} hinweis="So viele Vorschläge standen je Wort zur Wahl" />
        <Kachel titel="Fingerabdruck" wert={sig} hinweis="Aus deiner Wortwahl gerechnet — er startet gleich das Bild" />
        <Kachel titel="Tokens" wert={`${tokens.length}`} hinweis="So viele Stücke sieht die Maschine" />
      </div>

      <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-2">
        <p className="text-sm">
          🎲 Dein Text ist <b>{woerterAnzahl}</b> {woerterAnzahl === 1 ? "Wort" : "Wörter"} lang.
          {" "}Genauso lange Texte könnte dieses Netz <b>{zahlwort(moeglich)}</b> verschiedene
          schreiben — und du hast einen davon ausgesucht.
        </p>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          So entsteht der Eindruck, die Maschine denke sich etwas aus: Bei jedem Wort verzweigt
          sich der Weg, und schon nach wenigen Wörtern gibt es mehr Möglichkeiten als Menschen
          auf der Erde. Gewählt wird trotzdem nur — nach Häufigkeit, mit einem Würfel.
        </p>
      </div>

      <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-2">
        <p className="text-sm">
          ⚠️ <b>Sicher heißt nicht wahr.</b> Die Erwartbarkeit sagt nur, wie gewöhnlich dein Text
          klingt. Ob etwas davon stimmt, hat das Netz nie geprüft — es hat keine Stelle, an der so
          etwas geprüft würde.
        </p>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Genau das steckt hinter dem Wort »Halluzination«: Ein Sprachmodell schreibt einen
          falschen Satz mit derselben Selbstsicherheit wie einen richtigen, weil beide gleich
          wahrscheinlich klingen. Wer eine KI nach Tatsachen fragt, muss sie nachschlagen.
        </p>
      </div>

      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        🔎 <b>Erwartbarkeit</b> ist der Durchschnitt der Wahrscheinlichkeiten, die deine Wörter
        hatten. Hoch heißt: naheliegend, wie aus dem Lehrbuch — genau das, was ein Sprachmodell von
        allein schreibt. Niedrig heißt: überraschend. Beides ist weder richtig noch falsch, aber es
        erklärt, warum KI-Texte oft so glatt und ähnlich klingen.
        {" Bei »Auswahl 1« schreiben übrigens alle denselben Text — probiert es aus."}
        {quote !== null && ` Beim Zerlegen hattest du ${quote} % der Schnitte richtig.`}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onWeiterschreiben}
          className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-bold"
        >
          ✎ Weiterschreiben
        </button>
        <button
          type="button"
          onClick={onNochmal}
          className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-bold"
        >
          ↺ Neuer Durchgang
        </button>
      </div>

      <Vergleich zugang={zugang} thema={netz.slug} text={text} wert={wert} mut={mut} signatur={sig} />
    </div>
  );
}

function Kachel({ titel, wert, hinweis }: { titel: string; wert: string; hinweis: string }) {
  return (
    <div className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]" title={hinweis}>
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{titel}</div>
      <div className="text-lg font-black break-words">{wert}</div>
    </div>
  );
}
