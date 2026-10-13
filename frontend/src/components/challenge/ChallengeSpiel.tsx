"use client";
/**
 * Challenge für Schüler:innen und Gäste (per Code/QR): Rahmen mit Spielauswahl, Karte (Etappen, Wissen nachlesen),
 * Kampfansicht (Komponente der gewählten Spielart aus modi/) und Ende.
 * Geprüft und gewertet wird auf dem Server (api/routers/challenge.py); die Stufe bleibt verborgen.
 */
import { Suspense, useState } from "react";
import { useChallengeLauf, type ChallengeLauf } from "@/lib/challenge/useChallengeLauf";
import { themeVon } from "@/lib/challenge/themes";
import { SPIELARTEN } from "@/lib/challenge/spielarten";
import { MODI } from "./modi";
import { Kachelfeld, Sprite } from "./pixel/Sprite";

export default function ChallengeSpiel({ code, token }: { code: string; token?: string | null }) {
  const lauf = useChallengeLauf(code, token);
  const { info, brett } = lauf;
  const [ansicht, setAnsicht] = useState<"karte" | "kampf" | "ende">("karte");
  const [hinweis, setHinweis] = useState("");
  const [waehlen, setWaehlen] = useState(false);
  const [wechselFehler, setWechselFehler] = useState("");

  if (lauf.fehler) return <p className="p-6 text-center text-bad">{lauf.fehler}</p>;
  if (lauf.laden || !info) return <p className="p-6 text-center text-muted">Lade…</p>;

  const theme = themeVon(info.settings.theme);
  const erlaubt = SPIELARTEN.filter((s) => info.settings.spiele.includes(s.id));
  const bg = theme.hintergrund;
  const stil = { background: theme.farben.himmel, color: theme.farben.text };

  const wechsle = async (spiel: string) => {
    setWechselFehler("");
    if (await lauf.spielWechseln(spiel)) { setWaehlen(false); setHinweis(""); setAnsicht("karte"); }
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
        {wechselFehler && <p className="text-bad" role="alert">{wechselFehler}</p>}
        {brett && <button className="btn-secondary self-start" onClick={() => setWaehlen(false)}>Zurück</button>}
      </div>
    );
  }

  // Der Rahmen schaltet nach besonderen Ergebnissen selbst um
  const rahmenLauf: ChallengeLauf = {
    ...lauf,
    antworte: async (...a) => {
      const r = await lauf.antworte(...a);
      if (r.fertig) setAnsicht("ende");
      else if (r.zurueck_zur_karte) { setHinweis("Drei Fehlversuche – lies noch einmal nach."); setAnsicht("karte"); }
      else if (r.etappe_geschafft) { setHinweis("🎉 Etappe geschafft!"); setAnsicht("karte"); }
      return r;
    },
  };

  if (ansicht === "ende" || brett.fertig) {
    return (
      <div className="p-6 flex justify-center">
        <div className="card px-6 py-8 max-w-md text-center">
          <div className="text-4xl mb-2">🏆</div>
          <h1 className="text-xl font-black">Geschafft!</h1>
          <p className="text-2xl font-black mt-2">{Math.round(100 * (info.stand?.ergebnis ?? 0))} %</p>
        </div>
      </div>
    );
  }

  const nachlesen = brett.fakten.filter((f) => f.info);
  const Modus = (MODI[brett.spiel] ?? MODI.normal).komponente;

  return (
    <div className="p-4 max-w-3xl mx-auto flex flex-col gap-4 text-sm rounded-xl" style={stil} data-theme={info.settings.theme}>
      <h1 className="text-xl font-black">⚔️ {info.title}</h1>

      {ansicht === "karte" && (
        <>
          {hinweis && <p className="card p-3 font-bold">{hinweis}</p>}
          {bg && (
            <div className="relative overflow-hidden rounded-lg" style={{ background: theme.farben.boden }}>
              <Kachelfeld src={bg.src} tile={bg.tile} cols={bg.cols} scale={2}
                karte={[Array.from({ length: 24 }, (_, i) => bg.muster.boden[i % bg.muster.boden.length])]} />
              <Sprite src={theme.spieler.src} frame={theme.spieler.stehen} scale={2} className="absolute left-4 bottom-1" />
            </div>
          )}
          <ol className="flex flex-wrap items-center gap-2" aria-label="Etappen">
            {brett.etappen.map((e) => (
              <li key={e.nr} className={`chip ${e.nr === brett.etappe ? "chip-on" : ""} ${!e.erledigt && e.nr > brett.etappe ? "opacity-40" : ""}`}>
                {e.erledigt ? "✓ " : e.nr > brett.etappe ? "🔒 " : ""}{e.titel}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => { setHinweis(""); setAnsicht("kampf"); }}>Los</button>
            {erlaubt.length > 1 && <button className="btn-secondary" onClick={() => setWaehlen(true)}>Spielart</button>}
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
            zurKarte={() => { setHinweis(""); setAnsicht("karte"); }} />
        </Suspense>
      )}
    </div>
  );
}
