"use client";
/** Kampf: Nachziehstapel, Hand in Reihen, Ablagestapel, Energie; Gegner zeigen ihre Absicht (offene Challenges). */
import { useState, type ReactNode } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import type { ModusProps } from "../typen";
import { Frage, Herzen, Inhalt, Treffermeldung } from "../teile";
import { heiltrank } from "@/lib/challenge/heiltrank";
import { LebensBalken } from "@/components/challenge/LebensBalken";
import { PixelMatrix } from "../../pixel/Matrix";
import { BestenlisteKnopf } from "../../Bestenliste";
import { useSpielwert } from "@/lib/challenge/useSpielwert";
import Karte from "./Karte";
import {
  ENERGIE, abwerfen, alleZurueck, mischen, ausgespielt, kampfStart, sterne, stapeln, zugBeenden, zuruecknehmen,
} from "./logik";

const SCHWERT = ["..#..", "..#..", "..#..", "..#..", ".###.", "..#.."];
const PAL_SCHWERT = { "#": "#9aa5b1" };
const Schwerter = ({ n }: { n: number }) => (
  <span className="inline-flex gap-0.5" role="img" aria-label={`Stärke ${n}`}>
    {Array.from({ length: Math.max(1, n) }, (_, i) => <PixelMatrix key={i} bild={SCHWERT} palette={PAL_SCHWERT} scale={3} />)}
  </span>
);

export default function Kampf({ brett, theme, lauf, zurKarte, seed, lagerKnopf, energie = ENERGIE }: Pick<ModusProps, "brett" | "theme" | "lauf" | "zurKarte"> & { seed: number; lagerKnopf?: ReactNode; energie?: number }) {
  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const [k, setK] = useState(() => kampfStart((brett.deck ?? []).filter((id) => fakten.has(id)), seed, energie));
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [erzielt, setErzielt] = useState(0);
  const [sende, setSende] = useState(false);
  const [wackel, setWackel] = useState(0);
  const [schlag, setSchlag] = useState(0);
  const [zahl, setZahl] = useState<{ n: number; wert: number; heil?: number } | null>(null);
  const [geheilt, setGeheilt] = useState(0); // Heiltränke nach falschen/unvollständigen Antworten
  const [gegnerZug, setGegnerZug] = useState(0);
  const [ablageOffen, setAblageOffen] = useState(false);
  const [gespielt, setGespielt] = useState(false);
  const [abwurf, setAbwurf] = useState<string[] | null>(null);

  const offene = brett.challenges.filter((c) => !c.erledigt);
  const challenge = offene.find((c) => c.id === aktiv);
  const gesamt = brett.challenges.reduce((s, c) => s + c.strength * 15, 0);
  const schonErledigt = brett.challenges.filter((c) => c.erledigt).reduce((s, c) => s + c.strength * 10, 0);
  const hp = offene.length ? Math.min(gesamt, Math.max(1, gesamt - Math.max(erzielt, schonErledigt) + geheilt)) : 0;

  // Spielwert: Sterne nach Zügen, sobald die erste Antwort gespielt ist
  useSpielwert(lauf, "karten", brett.etappe, gespielt ? sterne(k.zug, brett.challenges.length) : 0, 3);

  const waehle = (id: string) => {
    if (id === aktiv) return;
    setK((s) => alleZurueck(s)); setAktiv(id); setAntwort(null); lauf.waehle();
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
      setGespielt(true);
      setErzielt((e) => e + r.schaden);
      const h = heiltrank(r, gesamt, Math.max(erzielt + r.schaden, schonErledigt) - geheilt);
      setGeheilt((g) => g + h);
      if (r.schaden > 0) setSchlag((s) => s + 1);
      setZahl(r.schaden > 0 || h > 0 ? { n: Date.now(), wert: r.schaden, heil: h } : null);
      if (!r.treffer) setWackel((w) => w + 1);
      setAntwort(r);
    } catch { /* Brett wurde still neu geladen */ } finally {
      setK((s) => ausgespielt(s)); setAktiv(null); setSende(false);
    }
  };
  const beenden = () => {
    setK((s) => zugBeenden(s, seed)); setGegnerZug((g) => g + 1);
  };

  const markiere = (id: string) => setAbwurf((a) => (a ?? []).includes(id) ? (a ?? []).filter((x) => x !== id) : [...(a ?? []), id]);
  const wirfAb = () => { setK((s) => abwerfen(s, abwurf ?? [], seed + s.zug * 7 + s.ablage.length)); setAbwurf(null); };

  return (
    <>
      <div className="flex items-center justify-between">
        <Herzen leben={brett.leben} />
        <div className="flex items-center gap-2">{lagerKnopf}<button className="btn-secondary" onClick={zurKarte}>Karte</button></div>
      </div>

      <div className="card p-3 flex items-center gap-3" style={{ background: theme.farben.boden }}>
        <div key={`g${schlag}${wackel}`} className={`text-5xl ${schlag ? "kt-schlag" : ""} ${wackel ? "kt-wackel" : ""}`} aria-hidden>👹</div>
        <div className="flex-1 flex flex-col gap-1">
          <LebensBalken wert={hp} max={gesamt} label="Lebensbalken des Gegners" className="h-4 rounded-full border-2" />
          <div className="relative h-5 text-sm" aria-live="polite">
            {gegnerZug > 0 && <span key={gegnerZug} className="kt-wackel">Der Gegner holt aus … und stolpert. Nichts passiert.</span>}
            {zahl && zahl.wert > 0 && <span key={zahl.n} className="kt-zahl absolute right-2 top-0 font-bold text-bad">−{zahl.wert}</span>}
            {zahl?.heil ? <span key={`h${zahl.n}`} className="kt-zahl absolute right-14 top-0 font-bold text-ok">🧪 +{zahl.heil}</span> : null}
          </div>
        </div>
      </div>
      <Treffermeldung antwort={antwort} heil={zahl?.heil} />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-2" aria-label="Absichten des Gegners">
        {offene.map((c) => (
          <button key={c.id} onClick={() => waehle(c.id)} aria-pressed={c.id === aktiv}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (c.id !== aktiv) waehle(c.id); lege(id); }}
            className={`card p-3 text-left ${c.id === aktiv ? "border-accent ring-2 ring-accent" : ""}`}>
            <span className="text-xs text-muted">Absicht · </span><Schwerter n={c.strength} />
            <Frage x={c} />
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
          <span role="status" aria-label={`Energie ${k.energie} von ${k.max}`} className="font-bold">
            {Array.from({ length: k.max }, (_, i) => <span key={i} aria-hidden className={i < k.energie ? "" : "opacity-30"}>⚡</span>)} {k.energie}/{k.max}
          </span>
          <span title="Nachziehstapel">🂠 Stapel: {k.nachzieh.length}</span>
          <button className="underline" aria-expanded={ablageOffen} onClick={() => setAblageOffen(!ablageOffen)} title="Ablagestapel ansehen">🗑 Ablage: {k.ablage.length}</button>
          <span>Zug {k.zug}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {abwurf ? (
            <>
              <button className="btn-primary" disabled={!abwurf.length} onClick={wirfAb}>{abwurf.length} abwerfen &amp; nachziehen</button>
              <button className="btn-secondary" onClick={() => setAbwurf(null)}>Abbrechen</button>
            </>
          ) : (
            <button className="btn-secondary" disabled={!k.hand.length} onClick={() => setAbwurf([])}>Abwerfen</button>
          )}
          <button className="btn-secondary" disabled={!k.ablage.length} onClick={() => setK((s) => mischen(s, seed))}>Mischen</button>
          <button className="btn-secondary" onClick={beenden}>Zug beenden</button>
        </div>
      </div>
      {ablageOffen && (
        <div className="card p-2 flex flex-wrap gap-1" aria-label="Ablagestapel">
          {k.ablage.length === 0 && <span className="text-muted">Noch leer.</span>}
          {k.ablage.map((id, i) => <span key={`${id}${i}`} className="card px-2 py-0.5 text-xs max-w-48 truncate">{fakten.get(id)?.text}</span>)}
        </div>
      )}
      <div className="kt-fach" aria-label="Deine Hand">
        {k.hand.map((id) => (
          <Karte key={id} fakt={fakten.get(id)!} klasse="kt-zieh" gewaehlt={abwurf ? abwurf.includes(id) : undefined}
            disabled={abwurf ? false : !offene.length || k.energie < 1} onClick={() => (abwurf ? markiere(id) : lege(id))} />
        ))}
        {k.hand.length === 0 && <span className="text-muted">Hand leer – Zug beenden, um neu zu ziehen.</span>}
      </div>
      {lauf.hatBestenliste && <div><BestenlisteKnopf lauf={lauf} spiel="karten" /></div>}
    </>
  );
}
