"use client";
/**
 * Station »Trainieren« — das Netz aus einem Text zählen.
 *
 * Die Station beantwortet die Frage, die das fertige Wortnetz offen lässt:
 * woher kommen die Zahlen? Sie steht deshalb für sich und lässt sich auch
 * allein benutzen — man muss nicht erst einen Text schreiben, um hierher zu
 * kommen, und kann von hier aus weiterschreiben, wenn man will.
 *
 * Drei Dinge sind zu sehen:
 *   ▸ **Zählen.** Der Text läuft durch, die Paare werden gezählt, das Netz
 *     wächst. Mehr passiert beim Trainieren eines n-Gramm-Modells nicht.
 *   ▸ **Rückblick.** Derselbe Text, einmal mit 1, 2 und 3 Wörtern Rückblick —
 *     Wortsalat, brauchbar, auswendig gelernt.
 *   ▸ **Korpus.** Wer den Text stellt, bestimmt, was das Modell sagen kann.
 *     Mit dem Klassenkorpus schreibt die Klasse ihn selbst.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type SimBeitragOut } from "@/lib/api";
import { trainiere } from "@/lib/ki/trainieren";
import { KORPORA } from "@/lib/ki/korpora";
import { kandidaten, maschinenwahl, textAus, type Netz, type Wort } from "@/lib/ki/wortnetz";
import { rng } from "@/lib/ki/rng";
import { Wissen } from "@/components/ki/Wissen";
import type { KiZugang } from "@/components/ki/KiWerkstatt";

type Quelle =
  | { art: "mitgeliefert"; slug: string }
  | { art: "eigen" }
  | { art: "klasse" };

/** Eine Probe, die das Netz gerade selbst schreibt — zwei Sätze reichen. */
function probe(netz: Netz, seed: number): string {
  const wuerfel = rng(seed);
  const verlauf: Wort[] = [];
  let saetze = 0;
  for (let i = 0; i < 60 && saetze < 2; i++) {
    const ks = kandidaten(netz, verlauf, 5);
    if (!ks.length) break;
    const wort = maschinenwahl(ks, wuerfel).wort;
    verlauf.push(wort);
    if (wort.art === "punkt") saetze++;
  }
  return textAus(verlauf);
}

function Knopf({ an, onClick, children, klein, aus }: {
  an?: boolean; onClick: () => void; children: React.ReactNode; klein?: boolean; aus?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={aus}
      className={`rounded-xl border font-bold transition-colors disabled:opacity-40
        ${klein ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} ${
        an
          ? "border-(--accent) bg-(--accent) text-(--accent-text)"
          : "border-(--border) bg-(--surface) hover:bg-(--surface-hover)"
      }`}
    >
      {children}
    </button>
  );
}

export function Trainieren({ zugang, onNetz, aktiv }: {
  zugang?: KiZugang;
  /** Übergibt das gezählte Netz an die Schreibstation. */
  onNetz: (netz: Netz) => void;
  /** Das gerade zum Schreiben benutzte gelernte Netz, falls es eines gibt. */
  aktiv: Netz | null;
}) {
  const [quelle, setQuelle] = useState<Quelle>({ art: "mitgeliefert", slug: KORPORA[0].slug });
  const [eigener, setEigener] = useState("");
  const [rueckblick, setRueckblick] = useState(2);
  const [netz, setNetz] = useState<Netz | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [gelesen, setGelesen] = useState(0);
  const [probeSeed, setProbeSeed] = useState(1);

  // Klassenkorpus
  const [saetze, setSaetze] = useState<SimBeitragOut[]>([]);
  const [eigenerSatz, setEigenerSatz] = useState("");
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  const text = useMemo(() => {
    if (quelle.art === "eigen") return eigener;
    if (quelle.art === "klasse") return saetze.map(s => s.text).join(" ");
    return KORPORA.find(k => k.slug === quelle.slug)?.text ?? "";
  }, [quelle, eigener, saetze]);

  const titel = quelle.art === "eigen" ? "eigener Text"
    : quelle.art === "klasse" ? "Klassenkorpus"
    : KORPORA.find(k => k.slug === quelle.slug)?.titel ?? "Text";

  const woerterImText = text.trim() ? text.trim().split(/\s+/).length : 0;

  async function korpusLaden() {
    if (!zugang?.code) return;
    try {
      setSaetze(await api.toolSessions.beitraege(zugang.code, zugang.token, "korpus"));
    } catch { /* ohne Sitzung bleibt die Liste leer */ }
  }

  useEffect(() => {
    if (quelle.art === "klasse") void korpusLaden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quelle.art, zugang?.code]);

  async function satzAbgeben() {
    const satz = eigenerSatz.trim();
    if (!zugang?.code || !satz) return;
    setSendet(true);
    setFehler(null);
    try {
      await api.toolSessions.beitragAbgeben(zugang.code, {
        name: zugang.name ?? "Jemand",
        thema: "korpus",
        // Ohne Punkt am Ende hinge der Satz am nächsten — das Netz braucht die
        // Satzgrenze, um überhaupt Satzanfänge zu kennen.
        text: /[.!?]$/.test(satz) ? satz : `${satz}.`,
        wert: 0, mut: 0, signatur: "", art: "korpus",
      }, zugang.token);
      setEigenerSatz("");
      await korpusLaden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      setSendet(false);
    }
  }

  /** Zählen — sichtbar langsam, damit man dem Netz beim Wachsen zusieht. */
  function zaehlen() {
    if (!text.trim()) return;
    const gesamt = woerterImText;
    setLaeuft(true);
    setGelesen(0);
    setNetz(null);
    if (timer.current) window.clearInterval(timer.current);
    const start = Date.now();
    const dauer = 1400;
    timer.current = window.setInterval(() => {
      const anteil = Math.min(1, (Date.now() - start) / dauer);
      setGelesen(Math.round(anteil * gesamt));
      if (anteil >= 1) {
        if (timer.current) window.clearInterval(timer.current);
        timer.current = null;
        // Immer mit dem vollen Rückblick zählen: die kürzeren Zählungen sind
        // darin enthalten, der Regler schaltet nur um.
        setNetz(trainiere(text, 3, titel));
        setLaeuft(false);
      }
    }, 60);
  }

  // Der Regler ändert kein Zählen, nur die Sicht darauf: das Netz enthält alle
  // drei Rückblicke, `n` sagt, welcher gefragt wird.
  const sicht = useMemo(
    () => (netz ? { ...netz, n: rueckblick, slug: `gelernt-${rueckblick}` } : null),
    [netz, rueckblick],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 rounded-2xl border border-(--border) bg-(--surface) flex flex-col gap-3">
        <h2 className="font-black">🧪 Woher kommen die Zahlen?</h2>
        <p className="text-sm text-(--text-muted) leading-relaxed">
          Das fertige Wortnetz hat jemand von Hand eingetragen. Hier machst du es selbst — und zwar
          genau so, wie eine Maschine es macht: einen Text lesen und mitzählen, welches Wort auf
          welches folgt. Mehr ist Training nicht.
        </p>

        <div className="flex flex-wrap gap-2">
          {KORPORA.map(k => (
            <Knopf
              key={k.slug}
              an={quelle.art === "mitgeliefert" && quelle.slug === k.slug}
              onClick={() => setQuelle({ art: "mitgeliefert", slug: k.slug })}
            >
              {k.icon} {k.titel}
            </Knopf>
          ))}
          <Knopf an={quelle.art === "eigen"} onClick={() => setQuelle({ art: "eigen" })}>
            ✍️ Eigener Text
          </Knopf>
          <Knopf an={quelle.art === "klasse"} onClick={() => setQuelle({ art: "klasse" })}>
            👥 Klassenkorpus
          </Knopf>
        </div>

        {quelle.art === "mitgeliefert" && text && (
          <details className="rounded-xl border border-(--border) bg-(--bg)">
            <summary className="cursor-pointer px-3 py-2 text-sm font-bold">
              📄 Der Text ({woerterImText} Wörter)
            </summary>
            <p className="px-3 pb-3 text-sm leading-relaxed whitespace-pre-line text-(--text-muted)">
              {text}
            </p>
          </details>
        )}

        {quelle.art === "eigen" && (
          <textarea
            value={eigener}
            onChange={e => setEigener(e.target.value)}
            rows={5}
            placeholder="Hier einen Text einfügen — ein Kapitel, ein Liedtext, ein Aufsatz. Je mehr, desto besser; unter 100 Wörtern plappert das Netz nur nach."
            className="w-full rounded-xl border border-(--border) bg-(--bg) p-3 text-sm"
          />
        )}

        {quelle.art === "klasse" && (
          <div className="flex flex-col gap-2">
            {!zugang?.code ? (
              <p className="text-sm text-(--text-muted)">
                Den Klassenkorpus gibt es in einer Sitzung: Über »Zum Mitmachen« den Code ausgeben,
                dann schreibt jede und jeder einen Satz dazu.
              </p>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap">
                  <input
                    value={eigenerSatz}
                    onChange={e => setEigenerSatz(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void satzAbgeben(); }}
                    maxLength={200}
                    placeholder="Dein Satz für das Klassenmodell"
                    className="flex-1 min-w-48 rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-sm"
                  />
                  <Knopf onClick={() => void satzAbgeben()} aus={sendet || !eigenerSatz.trim()}>
                    ＋ Beitragen
                  </Knopf>
                  <Knopf klein onClick={() => void korpusLaden()}>↻</Knopf>
                </div>
                {fehler && <p className="text-xs text-(--red)">{fehler}</p>}
                <p className="text-xs text-(--text-muted)">
                  {saetze.length === 0
                    ? "Noch kein Satz. Jede und jeder gibt einen ab — dann wird gezählt."
                    : `${saetze.length} ${saetze.length === 1 ? "Satz" : "Sätze"}, zusammen ${woerterImText} Wörter.`}
                </p>
                {saetze.length > 0 && (
                  <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto text-sm">
                    {saetze.map(s => (
                      <li key={s.id} className="flex gap-2">
                        <span className="text-(--text-muted) shrink-0">{s.name}:</span>
                        <span>{s.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <Knopf an onClick={zaehlen} aus={laeuft || !text.trim()}>
            {laeuft ? "zählt …" : "▶︎ Zählen"}
          </Knopf>
          <span className="text-xs text-(--text-muted)">
            {laeuft
              ? `${gelesen} von ${woerterImText} Wörtern gelesen`
              : `${woerterImText} Wörter im Text`}
          </span>
        </div>

        {laeuft && (
          <div className="h-1.5 rounded-full bg-(--surface-hover) overflow-hidden">
            <div
              className="h-full bg-(--accent) transition-all duration-75"
              style={{ width: `${woerterImText ? (gelesen / woerterImText) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>

      {sicht && netz && (
        <div className="p-4 rounded-2xl border border-(--border) bg-(--surface) flex flex-col gap-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span><b>{netz.statistik!.woerter}</b> Wörter gelesen</span>
            <span><b>{netz.statistik!.verschiedene}</b> verschiedene</span>
            <span><b>{netz.statistik!.uebergaenge}</b> Übergänge gezählt</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold">🔭 Rückblick</span>
              <input
                type="range" min={1} max={3} step={1}
                value={rueckblick}
                onChange={e => setRueckblick(Number(e.target.value))}
                className="flex-1 min-w-32 accent-(--accent)"
                aria-label="Rückblick"
              />
              <span className="text-xs text-(--text-muted)">
                {rueckblick === 1 ? "gar keiner" : rueckblick === 2 ? "ein Wort" : "zwei Wörter"}
              </span>
            </div>
            <p className="text-xs text-(--text-muted) leading-relaxed">
              {rueckblick === 1
                ? "Ohne Rückblick würfelt das Netz nur nach Worthäufigkeit — Wortsalat."
                : rueckblick === 2
                  ? "Ein Wort Rückblick: die Wörter passen zusammen, der Satz läuft trotzdem oft ins Leere."
                  : "Zwei Wörter Rückblick: klingt am besten — und sagt bei so wenig Text den Korpus fast auswendig auf."}
            </p>
          </div>

          <div className="p-3 rounded-xl border border-(--border) bg-(--bg)">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs uppercase tracking-wide text-(--text-muted)">
                So schreibt dein Netz
              </span>
              <Knopf klein onClick={() => setProbeSeed(s => s + 1)}>🎲 noch mal</Knopf>
            </div>
            <p className="text-sm leading-relaxed">{probe(sicht, probeSeed)}</p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Knopf an onClick={() => onNetz(sicht)}>Mit diesem Netz schreiben →</Knopf>
            {aktiv && (
              <span className="text-xs text-(--text-muted)">
                In der Schreibstation liegt gerade: {aktiv.quelle} (Rückblick {aktiv.n})
              </span>
            )}
          </div>
        </div>
      )}

      <Wissen thema="trainieren" />
      {netz && <Wissen thema="rueckblick" />}
      {quelle.art === "klasse" && <Wissen thema="korpus" />}
    </div>
  );
}
