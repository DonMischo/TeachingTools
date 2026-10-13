"use client";
/**
 * Challenge für Schüler:innen und Gäste (per Code/QR), Normal-Modus:
 * Karte (Etappen, Wissen nachlesen) und Kampf (Fakten auf Challenges legen, Angreifen).
 * Geprüft und gewertet wird auf dem Server (api/routers/challenge.py); die Stufe bleibt verborgen.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ChallengeAntwort, type ChallengeBrett, type ChallengeFakt, type ChallengeInfo } from "@/lib/api";
import { Tex } from "@/components/Tex";

type Meldung = { text: string; gut: boolean } | null;

function Inhalt({ x }: { x: { text: string; image: string | null; formula: string | null } }) {
  return (
    <>
      <span>{x.text}</span>
      {x.image && <img src={x.image} alt="" className="max-h-24 mx-auto mt-1 rounded-lg object-contain" />}
      {x.formula && <Tex tex={x.formula} className="block mt-1" />}
    </>
  );
}

export default function ChallengeSpiel({ code, token }: { code: string; token?: string | null }) {
  const [info, setInfo] = useState<ChallengeInfo | null>(null);
  const [brett, setBrett] = useState<ChallengeBrett | null>(null);
  const [fehler, setFehler] = useState("");
  const [ansicht, setAnsicht] = useState<"karte" | "kampf" | "ende">("karte");
  const [hinweis, setHinweis] = useState("");
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [sende, setSende] = useState(false);
  const leseStart = useRef(0);
  const wahlStart = useRef<number | null>(null);

  const lade = useCallback(async () => {
    const b = await api.challenge.start(code, token);
    setBrett(b);
    return b;
  }, [code, token]);

  useEffect(() => {
    (async () => {
      try {
        const i = await api.challenge.info(code, token);
        setInfo(i);
        const b = await lade();
        if (b.fertig) setAnsicht("ende");
      } catch (e) {
        setFehler((e as Error).message.includes("geschlossen") ? "Diese Challenge ist geschlossen." : "Die Challenge konnte nicht geladen werden.");
      }
    })();
  }, [code, token, lade]);

  if (fehler) return <p className="p-6 text-center text-bad">{fehler}</p>;
  if (!brett || !info) return <p className="p-6 text-center text-muted">Lade…</p>;

  const fakten = new Map<string, ChallengeFakt>(brett.fakten.map((f) => [f.id, f]));
  const challenge = brett.challenges.find((c) => c.id === aktiv);
  const offene = brett.challenges.filter((c) => !c.erledigt);

  const waehle = (c: string) => {
    setAktiv(c); setAblage([]); setTipp(false); setMeldung(null);
    leseStart.current = performance.now(); wahlStart.current = null;
  };
  const legeAuf = (id: string) => {
    if (!challenge || ablage.includes(id)) return;
    if (wahlStart.current == null) wahlStart.current = performance.now();
    setAblage([...ablage, id]);
  };
  const nimmZurueck = (id: string) => setAblage(ablage.filter((x) => x !== id));

  const angreifen = async () => {
    if (!challenge || !ablage.length || sende) return;
    const jetzt = performance.now();
    const start = wahlStart.current ?? jetzt;
    setSende(true);
    try {
      const r: ChallengeAntwort = await api.challenge.antwort(code, {
        challenge_id: challenge.id, fakt_ids: ablage,
        lese_ms: Math.max(0, Math.round(start - leseStart.current)), wahl_ms: Math.max(0, Math.round(jetzt - start)), tipp,
      }, token);
      setAktiv(null); setAblage([]); setTipp(false);
      if (r.fertig) {
        setInfo(await api.challenge.info(code, token));
        setAnsicht("ende");
      } else if (r.zurueck_zur_karte) {
        setHinweis("Drei Fehlversuche – lies noch einmal nach."); setAnsicht("karte");
      } else if (r.etappe_geschafft) {
        setHinweis("🎉 Etappe geschafft!"); setAnsicht("karte");
      } else if (r.komplett) {
        setMeldung({ gut: true, text: `Treffer!${r.kombo ? " Kombo!" : ""} Schaden: ${r.schaden}${r.feedback ? ` – ${r.feedback}` : ""}` });
      } else if (r.treffer) {
        setMeldung({ gut: false, text: "Teiltreffer – da fehlt noch etwas oder es lag Falsches dabei" });
      } else {
        setMeldung({ gut: false, text: "Daneben" });
      }
      await lade();
    } catch {
      // z. B. 409 (schon erledigt): einfach das aktuelle Brett holen
      setAktiv(null); setAblage([]);
      await lade().catch(() => setFehler("Die Challenge konnte nicht geladen werden."));
    } finally {
      setSende(false);
    }
  };

  if (ansicht === "ende") {
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

  return (
    <div className="p-4 max-w-3xl mx-auto flex flex-col gap-4 text-sm">
      <h1 className="text-xl font-black">⚔️ {info.title}</h1>

      {ansicht === "karte" && (
        <>
          {hinweis && <p className="card p-3 font-bold">{hinweis}</p>}
          <ol className="flex flex-wrap items-center gap-2" aria-label="Etappen">
            {brett.etappen.map((e) => (
              <li key={e.nr} className={`chip ${e.nr === brett.etappe ? "chip-on" : ""} ${!e.erledigt && e.nr > brett.etappe ? "opacity-40" : ""}`}>
                {e.erledigt ? "✓ " : e.nr > brett.etappe ? "🔒 " : ""}{e.titel}
              </li>
            ))}
          </ol>
          <button className="btn-primary self-start" onClick={() => { setHinweis(""); setMeldung(null); setAnsicht("kampf"); }}>Los</button>
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
        <>
          <div className="flex items-center justify-between">
            <span aria-label={`${brett.leben} von 3 Leben`}>{[0, 1, 2].map((i) => (i < brett.leben ? "❤️" : "🖤")).join(" ")}</span>
            <button className="btn-secondary" onClick={() => setAnsicht("karte")}>Karte</button>
          </div>
          {meldung && <p className={`card p-3 font-bold ${meldung.gut ? "text-good" : "text-bad"}`} role="status">{meldung.text}</p>}

          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-2">
            {offene.map((c) => (
              <button key={c.id} onClick={() => waehle(c.id)} aria-pressed={c.id === aktiv}
                className={`card p-3 text-left ${c.id === aktiv ? "border-accent" : ""}`}>
                <Inhalt x={c} />
              </button>
            ))}
          </div>

          {challenge && (
            <div className="card p-3 flex flex-col gap-2">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); legeAuf(e.dataTransfer.getData("text/plain")); }}
                className="min-h-16 rounded-lg border-2 border-dashed border-line p-2 flex flex-wrap gap-2" aria-label="Ablage">
                {ablage.length === 0 && <span className="text-muted">Lege Fakten hierher.</span>}
                {ablage.map((id) => fakten.get(id) && (
                  <button key={id} onClick={() => nimmZurueck(id)} title="Zurücknehmen" className="card px-2 py-1"><Inhalt x={fakten.get(id)!} /></button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" disabled={!ablage.length || sende} onClick={angreifen}>Angreifen</button>
                {challenge.tip && (tipp
                  ? <span className="text-muted self-center">💡 {challenge.tip}</span>
                  : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
            {brett.fakten.filter((f) => !ablage.includes(f.id)).map((f) => (
              <button key={f.id} draggable disabled={!challenge}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", f.id)}
                onClick={() => legeAuf(f.id)} className="card p-2 text-left disabled:opacity-60">
                <Inhalt x={f} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
