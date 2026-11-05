"use client";
/**
 * Challenge für Schüler:innen und Gäste (per Code/QR): Rahmen mit Spielauswahl, Karte (Etappen, Wissen nachlesen),
 * Kampfansicht (Komponente der gewählten Spielart aus modi/) und Ende.
 * Geprüft und gewertet wird auf dem Server (api/routers/challenge.py); die Stufe bleibt verborgen.
 */
import { Suspense, useEffect, useRef, useState } from "react";
import { useChallengeLauf, sitzungsQuelle, type ChallengeLauf, type ChallengeQuelle } from "@/lib/challenge/useChallengeLauf";
import type { ChallengeAntwort } from "@/lib/api";
import { themeVon, bodenKachel } from "@/lib/challenge/themes";
import { SPIELARTEN } from "@/lib/challenge/spielarten";
import { MODI } from "./modi";
import { Kachelfeld, Sprite } from "./pixel/Sprite";
import { wenigerBewegung } from "@/lib/challenge/bewegung";
import { BestenlisteKnopf } from "./Bestenliste";

/** So lange bleibt das Ergebnis einer Antwort sichtbar, bevor der Rahmen zur Karte oder zum Ende umschaltet. */
const UMSCHALT_MS = 1600;

type Props = {
  code?: string; token?: string | null;
  /** Eigene Quelle (Boss-Folie im TaskCrawler); ohne sie läuft die Sitzung `code`. */
  quelle?: ChallengeQuelle;
  onAntwort?: (r: ChallengeAntwort) => void;
  /** Nur in der Einbettung: »Weiter« am Ende. */
  onFertig?: () => void;
};

export default function ChallengeSpiel({ code = "", token, quelle, onAntwort, onFertig }: Props) {
  const lauf = useChallengeLauf(quelle ?? sitzungsQuelle(code, token));
  const { info, brett } = lauf;
  const [ansicht, setAnsicht] = useState<"karte" | "kampf" | "ende">("karte");
  const [hinweis, setHinweis] = useState("");
  const [waehlen, setWaehlen] = useState(false);
  const [wechselFehler, setWechselFehler] = useState("");
  const [wartet, setWartet] = useState(false);
  const uhr = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(uhr.current), []);

  if (lauf.fehler) return <p className="p-6 text-center text-bad">{lauf.fehler}</p>;
  if (lauf.laden || !info) return <p className="p-6 text-center text-muted">Lade…</p>;

  const theme = themeVon(info.settings.theme);
  const erlaubt = SPIELARTEN.filter((s) => info.settings.spiele.includes(s.id));
  const bg = theme.hintergrund;
  // Im TaskCrawler gelten dessen Farben und Schrift; nur die Szenen behalten ihren Himmel
  const stil = quelle ? undefined : { background: theme.farben.himmel, color: theme.farben.text };

  const wechsle = async (spiel: string) => {
    setWechselFehler("");
    const neu = !!brett && brett.spiel !== spiel;
    if (await lauf.spielWechseln(spiel)) { setWaehlen(false); setHinweis(neu ? "🔄 Spielart gewechselt – diese Etappe beginnt von vorn." : ""); setAnsicht("karte"); }
    else setWechselFehler("Die Spielart lässt sich jetzt nicht wechseln.");
  };

  // Mehrere Spielarten und noch kein Lauf (oder Wechsel gewünscht): erst wählen
  if (!brett || waehlen) {
    return (
      <div className="p-4 max-w-3xl mx-auto flex flex-col gap-4 text-sm">
        <h1 className="text-xl font-black">⚔️ {info.title}</h1>
        <p className="font-bold">Wie möchtest du spielen?</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-2">
          {erlaubt.map((s) => (
            <button key={s.id} onClick={() => wechsle(s.id)} aria-pressed={brett?.spiel === s.id}
              className={`card p-3 text-left ${brett?.spiel === s.id ? "border-accent" : ""}`}>
              <span className="text-2xl">{s.icon}</span> <b>{s.name}</b>
              <p className="text-muted">{s.text}</p>
            </button>
          ))}
        </div>
        {brett && <p className="text-muted">Beim Wechsel beginnt die aktuelle Etappe von vorn; geschaffte Etappen bleiben geschafft.</p>}
        {wechselFehler && <p className="text-bad" role="alert">{wechselFehler}</p>}
        {brett && <button className="btn-secondary self-start" onClick={() => setWaehlen(false)}>Zurück</button>}
      </div>
    );
  }

  const mitListe = info.settings.spiele.includes("huepfen");

  // Der Rahmen schaltet nach besonderen Ergebnissen selbst um, nachdem die Spielart ihr Ergebnis gezeigt hat
  const schalteUm = (text: string, ziel: "karte" | "ende") => {
    clearTimeout(uhr.current);
    const los = () => { setWartet(false); setHinweis(text); setAnsicht(ziel); };
    if (wenigerBewegung()) los();
    else { setWartet(true); uhr.current = setTimeout(los, UMSCHALT_MS); }
  };
  const rahmenLauf: ChallengeLauf = {
    ...lauf,
    antworte: async (...a) => {
      const r = await lauf.antworte(...a);
      onAntwort?.(r);
      if (r.fertig) schalteUm("", "ende");
      else if (r.zurueck_zur_karte) schalteUm("Drei Fehlversuche – lies noch einmal nach.", "karte");
      else if (r.etappe_geschafft) schalteUm("🎉 Etappe geschafft!", "karte");
      return r;
    },
  };

  if ((ansicht === "ende" || brett.fertig) && !wartet) {
    return (
      <div className="p-6 flex justify-center">
        <div className="card px-6 py-8 max-w-md text-center">
          <div className="text-4xl mb-2">🏆</div>
          {quelle ? (
            <>
              <h1 className="text-xl font-black">Boss besiegt! Alle Etappen geschafft</h1>
              {onFertig && <button className="btn-primary mt-4" onClick={onFertig}>Weiter</button>}
            </>
          ) : (
            <>
              <h1 className="text-xl font-black">Sieg! Alle Etappen geschafft</h1>
              <p className="text-2xl font-black mt-2">{Math.round(100 * (info.stand?.ergebnis ?? 0))} %</p>
              {mitListe && lauf.meineEdelsteine && <p className="mt-2 font-bold">💎 {lauf.meineEdelsteine.gesamt}/{lauf.meineEdelsteine.max}</p>}
              {mitListe && <div className="mt-3"><BestenlisteKnopf lauf={lauf} spiel="huepfen" /></div>}
            </>
          )}
        </div>
      </div>
    );
  }

  const nachlesen = brett.fakten.filter((f) => f.info);
  const Modus = (MODI[brett.spiel] ?? MODI.normal).komponente;

  return (
    <div className={`ch-buehne p-4 mx-auto flex flex-col gap-4 text-sm rounded-xl ${quelle ? "w-full" : "max-w-3xl"}`} style={stil} data-challenge-theme={info.settings.theme}>
      <h1 className="text-xl font-black">⚔️ {info.title}</h1>

      {ansicht === "karte" && (
        <>
          {hinweis && <p className="card p-3 font-bold">{hinweis}</p>}
          {bg && (
            <div className="relative overflow-hidden rounded-lg" style={{ background: theme.farben.boden }}>
              <Kachelfeld src={bg.src} tile={bg.tile} cols={bg.cols} scale={2}
                karte={[0, 1].map((y) => Array.from({ length: 24 }, (_, i) => bodenKachel(bg.muster.boden, i, y)))} />
              <Sprite src={theme.spieler.src} frame={theme.spieler.stehen} scale={2} className="absolute left-4 bottom-1" />
            </div>
          )}
          <ol className="flex flex-wrap items-center gap-2" aria-label="Etappen">
            {brett.etappen.map((e, i) => {
              const gesperrt = !e.erledigt && e.nr !== brett.etappe;
              return (
                <li key={e.nr} className={`chip ${e.nr === brett.etappe ? "chip-on" : ""} ${gesperrt ? "opacity-60" : ""}`}>
                  {e.erledigt ? "✓ " : gesperrt ? "🔒 " : ""}Etappe {i + 1} von {brett.etappen.length}: {e.titel}
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => { clearTimeout(uhr.current); setHinweis(""); setAnsicht("kampf"); }}>Los</button>
            {erlaubt.length > 1 && <button className="btn-secondary" onClick={() => setWaehlen(true)}>Spielart</button>}
            {mitListe && <BestenlisteKnopf lauf={lauf} spiel="huepfen" />}
          </div>
          {nachlesen.length > 0 && (
            <details className="card p-3">
              <summary className="cursor-pointer font-bold">Wissen nachlesen</summary>
              <ul className="flex flex-col gap-2 mt-2">
                {nachlesen.map((f) => (
                  <li key={f.id}>
                    <b>{f.text}</b>
                    <p className="text-muted">{f.info?.text}</p>
                    {f.info?.source?.url && (
                      <a href={f.info.source.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                        {f.info.source.label || f.info.source.url}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {ansicht === "kampf" && (
        <Suspense fallback={<p className="text-muted">Lade…</p>}>
          <Modus brett={brett} theme={theme} skin={info.settings.skin ?? "monster"} lauf={rahmenLauf}
            zurKarte={() => { clearTimeout(uhr.current); setWartet(false); setHinweis(""); setAnsicht("karte"); }}
            spielart={erlaubt.length > 1 ? () => { clearTimeout(uhr.current); setWartet(false); setWaehlen(true); } : undefined} />
        </Suspense>
      )}
    </div>
  );
}
