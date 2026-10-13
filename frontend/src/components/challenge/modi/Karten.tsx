"use client";
/** Kartenspiel: erst ein Deck aus Fakten bauen (Server merkt es sich), dann Karten auf Angriffskarten stapeln und ausspielen. */
import { useState } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import type { ModusProps } from "./typen";
import { FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import { PixelMatrix } from "../pixel/Matrix";

const HAND = 6;
const SCHWERT = ["..#..", "..#..", "..#..", "..#..", ".###.", "..#.."];
const Schwerter = ({ n }: { n: number }) => (
  <span className="inline-flex gap-0.5" role="img" aria-label={`Stärke ${n}`}>
    {Array.from({ length: Math.max(1, n) }, (_, i) => <PixelMatrix key={i} bild={SCHWERT} palette={{ "#": "#9aa5b1" }} scale={3} />)}
  </span>
);

export default function Karten({ brett, theme, lauf, zurKarte }: ModusProps) {
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [stapel, setStapel] = useState<string[]>([]);
  const [versatz, setVersatz] = useState(0);
  const [erzielt, setErzielt] = useState(0);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [wackel, setWackel] = useState(false);
  const [sende, setSende] = useState(false);

  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));

  if (!brett.deck) {
    const umschalten = (id: string) => setGewaehlt((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
    const fertig = async () => { try { await lauf.deckSetzen(gewaehlt); } catch { /* Brett bleibt wie es ist */ } };
    return (
      <>
        <div className="flex items-center justify-between">
          <Herzen leben={brett.leben} />
          <button className="btn-secondary" onClick={zurKarte}>Karte</button>
        </div>
        <h2 className="font-bold">Deck bauen: {gewaehlt.length} von {brett.fakten.length} Karten</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
          {brett.fakten.map((f) => (
            <button key={f.id} aria-pressed={gewaehlt.includes(f.id)} onClick={() => umschalten(f.id)}
              className={`card p-2 text-left ${gewaehlt.includes(f.id) ? "border-accent" : "opacity-70"}`}>
              <Inhalt x={f} />
            </button>
          ))}
        </div>
        <button className="btn-primary self-start" disabled={!gewaehlt.length} onClick={fertig}>Deck fertig</button>
      </>
    );
  }

  const offene = brett.challenges.filter((c) => !c.erledigt);
  const challenge = offene.find((c) => c.id === aktiv);
  const deck = brett.deck.filter((id) => fakten.has(id));
  const imDeck = deck.filter((id) => !stapel.includes(id));
  const start = imDeck.length ? versatz % imDeck.length : 0;
  const hand = [...imDeck.slice(start), ...imDeck.slice(0, start)].slice(0, HAND);

  const gesamt = brett.challenges.reduce((s, c) => s + c.strength * 15, 0);
  const schonErledigt = brett.challenges.filter((c) => c.erledigt).reduce((s, c) => s + c.strength * 10, 0);
  const hp = offene.length ? Math.max(1, gesamt - Math.max(erzielt, schonErledigt)) : 0;

  const waehle = (id: string) => { setAktiv(id); setStapel([]); setAntwort(null); lauf.waehle(id); };
  const lege = (id: string) => {
    if (!challenge || stapel.includes(id)) return;
    lauf.gelegt();
    setStapel([...stapel, id]);
  };
  const ausspielen = async () => {
    if (!challenge || !stapel.length || sende) return;
    setSende(true);
    try {
      const r = await lauf.antworte(challenge.id, stapel, false);
      setErzielt((e) => e + r.schaden);
      setAktiv(null); setStapel([]);
      if (!r.treffer) { setWackel(true); setTimeout(() => setWackel(false), 500); }
      setAntwort(r.etappe_geschafft || r.zurueck_zur_karte || r.fertig ? null : r);
    } catch {
      setAktiv(null); setStapel([]);
    } finally {
      setSende(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <Herzen leben={brett.leben} />
        <button className="btn-secondary" onClick={zurKarte}>Karte</button>
      </div>
      <div role="progressbar" aria-label="Lebensbalken des Gegners" aria-valuemin={0} aria-valuemax={gesamt} aria-valuenow={hp}
        className="h-4 rounded-full overflow-hidden border-2 border-line" style={{ background: theme.farben.boden }}>
        <div className="h-full bg-bad transition-all duration-500" style={{ width: `${gesamt ? (100 * hp) / gesamt : 0}%` }} />
      </div>
      <Treffermeldung antwort={antwort} />

      <div className={`grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-2 ${wackel ? "animate-pulse" : ""}`}>
        {offene.map((c) => (
          <button key={c.id} onClick={() => waehle(c.id)} aria-pressed={c.id === aktiv}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (c.id !== aktiv) waehle(c.id); lege(e.dataTransfer.getData("text/plain")); }}
            className={`card p-3 text-left ${c.id === aktiv ? "border-accent" : ""}`}>
            <Schwerter n={c.strength} />
            <div><Inhalt x={c} /></div>
          </button>
        ))}
      </div>

      {challenge && (
        <div className="card p-3 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2 min-h-12" aria-label="Kombo-Stapel">
            {stapel.length === 0 && <span className="text-muted">Lege Karten aus deiner Hand auf den Angriff.</span>}
            {stapel.map((id, i) => (
              <button key={id} onClick={() => setStapel(stapel.filter((x) => x !== id))} title="Zurücknehmen"
                className="card px-2 py-1" style={{ marginLeft: i ? -8 : 0 }}><Inhalt x={fakten.get(id)!} /></button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!stapel.length || sende} onClick={ausspielen}>Ausspielen</button>
            {challenge.tip && <span className="text-muted self-center">💡 {challenge.tip}</span>}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-bold">Deine Hand</h2>
        {imDeck.length > HAND && <button className="btn-secondary" onClick={() => setVersatz(versatz + HAND)}>Hand mischen</button>}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
        {hand.map((id) => <FaktKarte key={id} fakt={fakten.get(id)!} disabled={!challenge} onClick={() => lege(id)} />)}
      </div>
    </>
  );
}
