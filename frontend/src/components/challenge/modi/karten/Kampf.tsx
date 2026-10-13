"use client";
/** Kampf: Nachziehstapel, Hand im Fächer, Ablagestapel, Energie; Gegner zeigen ihre Absicht (offene Challenges). */
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import type { ModusProps } from "../typen";
import { Herzen, Inhalt, Treffermeldung } from "../teile";
import { PixelMatrix } from "../../pixel/Matrix";
import Bestenliste from "../../Bestenliste";
import Karte from "./Karte";
import {
  ENERGIE, alleZurueck, ausgespielt, kampfStart, sterne, stapeln, zugBeenden, zuruecknehmen,
} from "./logik";

const SCHWERT = ["..#..", "..#..", "..#..", "..#..", ".###.", "..#.."];
const Schwerter = ({ n }: { n: number }) => (
  <span className="inline-flex gap-0.5" role="img" aria-label={`Stärke ${n}`}>
    {Array.from({ length: Math.max(1, n) }, (_, i) => <PixelMatrix key={i} bild={SCHWERT} palette={{ "#": "#9aa5b1" }} scale={3} />)}
  </span>
);

export default function Kampf({ brett, theme, lauf, zurKarte, seed, lagerKnopf }: Pick<ModusProps, "brett" | "theme" | "lauf" | "zurKarte"> & { seed: number; lagerKnopf?: ReactNode }) {
  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const [k, setK] = useState(() => kampfStart((brett.deck ?? []).filter((id) => fakten.has(id)), seed));
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [erzielt, setErzielt] = useState(0);
  const [sende, setSende] = useState(false);
  const [wackel, setWackel] = useState(0);
  const [schlag, setSchlag] = useState(0);
  const [zahl, setZahl] = useState<{ n: number; wert: number } | null>(null);
  const [gegnerZug, setGegnerZug] = useState(0);
  const [ablageOffen, setAblageOffen] = useState(false);

  const offene = brett.challenges.filter((c) => !c.erledigt);
  const challenge = offene.find((c) => c.id === aktiv);
  const gesamt = brett.challenges.reduce((s, c) => s + c.strength * 15, 0);
  const schonErledigt = brett.challenges.filter((c) => c.erledigt).reduce((s, c) => s + c.strength * 10, 0);
  const hp = offene.length ? Math.max(1, gesamt - Math.max(erzielt, schonErledigt)) : 0;

  // Spielwert (Sterne nach Zügen), gedrosselt: nach jeder Antwort und beim Abbau.
  const stand = useRef({ zug: k.zug, n: brett.challenges.length, etappe: brett.etappe, gespielt: false, lauf });
  stand.current = { ...stand.current, zug: k.zug, n: brett.challenges.length, etappe: brett.etappe, lauf };
  const melde = () => {
    const s = stand.current;
    if (s.gespielt) void s.lauf.spielwert?.("karten", s.etappe, sterne(s.zug, s.n), 3);
  };
  useEffect(() => () => melde(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const waehle = (id: string) => {
    if (id === aktiv) return;
    setK((s) => alleZurueck(s)); setAktiv(id); setAntwort(null); lauf.waehle(id);
  };
  const lege = (id: string) => {
    if (!fakten.has(id)) return;
    const ziel = challenge ?? offene[0];
    if (!ziel || k.energie < 1 || !k.hand.includes(id)) return;
    if (!challenge) waehle(ziel.id);
    lauf.gelegt();
    setK((s) => stapeln(s, id));
  };
  const ausspielen = async () => {
    if (!challenge || !k.stapel.length || sende) return;
    setSende(true);
    const karten = k.stapel;
    try {
      const r = await lauf.antworte(challenge.id, karten, false);
      stand.current.gespielt = true;
      setErzielt((e) => e + r.schaden);
      if (r.schaden > 0) { setSchlag((s) => s + 1); setZahl({ n: Date.now(), wert: r.schaden }); }
      if (!r.treffer) setWackel((w) => w + 1);
      setAntwort(r.etappe_geschafft || r.zurueck_zur_karte || r.fertig ? null : r);
      melde();
    } catch { /* Brett wurde still neu geladen */ } finally {
      setK((s) => ausgespielt(s)); setAktiv(null); setSende(false);
    }
  };
  const beenden = () => {
    setK((s) => zugBeenden(s, seed)); setGegnerZug((g) => g + 1);
  };

  const drehung = (i: number) => (i - (k.hand.length - 1) / 2) * 4;

  return (
    <>
      <div className="flex items-center justify-between">
        <Herzen leben={brett.leben} />
        <div className="flex items-center gap-2">{lagerKnopf}<button className="btn-secondary" onClick={zurKarte}>Karte</button></div>
      </div>

      <div className="card p-3 flex items-center gap-3" style={{ background: theme.farben.boden }}>
        <div key={`g${schlag}${wackel}`} className={`text-5xl ${schlag ? "kt-schlag" : ""} ${wackel ? "kt-wackel" : ""}`} aria-hidden>👹</div>
        <div className="flex-1 flex flex-col gap-1">
          <div role="progressbar" aria-label="Lebensbalken des Gegners" aria-valuemin={0} aria-valuemax={gesamt} aria-valuenow={hp}
            className="h-4 rounded-full overflow-hidden border-2 border-line bg-surface">
            <div className="h-full bg-bad transition-all duration-500" style={{ width: `${gesamt ? (100 * hp) / gesamt : 0}%` }} />
          </div>
          <div className="relative h-5 text-sm" aria-live="polite">
            {gegnerZug > 0 && <span key={gegnerZug} className="kt-wackel">Der Gegner holt aus … und stolpert. Nichts passiert.</span>}
            {zahl && <span key={zahl.n} className="kt-zahl absolute right-2 top-0 font-bold text-bad">−{zahl.wert}</span>}
          </div>
        </div>
      </div>
      <Treffermeldung antwort={antwort} />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-2" aria-label="Absichten des Gegners">
        {offene.map((c) => (
          <button key={c.id} onClick={() => waehle(c.id)} aria-pressed={c.id === aktiv}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (c.id !== aktiv) waehle(c.id); lege(id); }}
            className={`card p-3 text-left ${c.id === aktiv ? "border-accent ring-2 ring-accent" : ""}`}>
            <span className="text-xs text-muted">Absicht · </span><Schwerter n={c.strength} />
            <div><Inhalt x={c} /></div>
          </button>
        ))}
      </div>

      {challenge && (
        <div className="card p-3 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2 min-h-12 items-center" aria-label="Kombo-Stapel">
            {k.stapel.length === 0 && <span className="text-muted">Lege Karten aus deiner Hand auf den Angriff.</span>}
            {k.stapel.map((id, i) => (
              <button key={id} onClick={() => setK((s) => zuruecknehmen(s, id))} title="Zurücknehmen"
                className="card px-2 py-1" style={{ marginLeft: i ? -8 : 0 }}><Inhalt x={fakten.get(id)!} /></button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!k.stapel.length || sende} onClick={ausspielen}>Ausspielen</button>
            {challenge.tip && <span className="text-muted self-center">💡 {challenge.tip}</span>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-sm">
          <span role="status" aria-label={`Energie ${k.energie} von ${ENERGIE}`} className="font-bold">
            {Array.from({ length: ENERGIE }, (_, i) => <span key={i} aria-hidden className={i < k.energie ? "" : "opacity-30"}>⚡</span>)} {k.energie}/{ENERGIE}
          </span>
          <span title="Nachziehstapel">🂠 Stapel: {k.nachzieh.length}</span>
          <button className="underline" aria-expanded={ablageOffen} onClick={() => setAblageOffen(!ablageOffen)} title="Ablagestapel ansehen">🗑 Ablage: {k.ablage.length}</button>
          <span>Zug {k.zug}</span>
        </div>
        <button className="btn-secondary" onClick={beenden}>Zug beenden</button>
      </div>
      {ablageOffen && (
        <div className="card p-2 flex flex-wrap gap-1" aria-label="Ablagestapel">
          {k.ablage.length === 0 && <span className="text-muted">Noch leer.</span>}
          {k.ablage.map((id, i) => <span key={`${id}${i}`} className="card px-2 py-0.5 text-xs max-w-48 truncate">{fakten.get(id)?.text}</span>)}
        </div>
      )}
      <div className="kt-fach" aria-label="Deine Hand">
        {k.hand.map((id, i) => (
          <Karte key={id} fakt={fakten.get(id)!} drehung={drehung(i)} klasse="kt-zieh"
            disabled={!offene.length || k.energie < 1} onClick={() => lege(id)} />
        ))}
        {k.hand.length === 0 && <span className="text-muted">Hand leer – Zug beenden, um neu zu ziehen.</span>}
      </div>
      {lauf.hatBestenliste && (
        <details className="card p-2"><summary className="cursor-pointer font-bold">Bestenliste (Sterne)</summary>
          <Bestenliste laden={lauf.bestenliste} spiel="karten" /></details>
      )}
    </>
  );
}
