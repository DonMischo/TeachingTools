"use client";
/** Glücksrad: Rätselwand aus der Challenge, Buchstaben per Rad erdrehen, Wissen löst und bringt das Geld auf die Bank. */
import { useEffect, useRef, useState } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import { BestenlisteKnopf } from "@/components/challenge/Bestenliste";
import Papierkorb, { WegKnopf } from "@/components/challenge/Papierkorb";
import { wenigerBewegung } from "@/lib/challenge/bewegung";
import {
  BONUS_JE_BUCHSTABE, GALGEN_MAX, KONSONANTEN, MAX_JE_RAETSEL, RAD, VOKALE, VOKAL_PREIS,
  istRatbar, maskiere, verdeckte, zaehle,
} from "@/lib/challenge/gluecksrad";
import { useAblage } from "@/lib/challenge/useAblage";
import { useSpielwert } from "@/lib/challenge/useSpielwert";
import type { ModusProps } from "./typen";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import { Buehne, Galgen, GluecksradStil, Moderator, Rad, feldMitte } from "./gluecksrad/grafik";

const DREHZEIT = 3200;
type Raetsel = { buchstaben: string[]; falsch: number; geld: number; alles: boolean };
const leer = (): Raetsel => ({ buchstaben: [], falsch: 0, geld: 0, alles: false });

export default function Gluecksrad(props: ModusProps) {
  return <Spiel key={props.brett.etappe} {...props} />;
}

function Spiel({ brett, lauf, zurKarte }: ModusProps) {
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [raetsel, setRaetsel] = useState<Record<string, Raetsel>>({});
  const [bank, setBank] = useState(0);
  const [geloest, setGeloest] = useState<string[]>([]);
  const [phase, setPhase] = useState<"frei" | "dreht" | "konsonant">("frei");
  const [betrag, setBetrag] = useState(0);
  const [drehung, setDrehung] = useState(0);
  const [dauer, setDauer] = useState(0);
  const [meldung, setMeldung] = useState("Dreh das Rad!");
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [ergebnis, setErgebnis] = useState<ChallengeAntwort | null>(null);
  const [sende, setSende] = useState(false);
  const korb = useAblage(brett.etappe);
  const uhr = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(uhr.current), []);

  const challenge = brett.challenges.find((c) => c.id === aktiv) ?? brett.challenges.find((c) => !c.erledigt) ?? brett.challenges[0];
  const id = challenge?.id;
  const fertig = !!challenge && (challenge.erledigt || geloest.includes(challenge.id));
  const r = (id && raetsel[id]) || leer();
  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));

  const maxWert = Math.max(1, MAX_JE_RAETSEL * brett.challenges.length);
  useSpielwert(lauf, "gluecksrad", brett.etappe, Math.min(bank, maxWert), maxWert);
  useEffect(() => { if (id && !fertig) lauf.waehle(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setze = (aenderung: (alt: Raetsel) => Raetsel) => { if (id) setRaetsel((m) => ({ ...m, [id]: aenderung(m[id] ?? leer()) })); };
  const wechsle = (neu: string) => {
    if (phase === "dreht") return;
    setAktiv(neu); setPhase("frei"); setAblage([]); setTipp(false); setErgebnis(null); setMeldung("Dreh das Rad!");
  };

  const drehe = () => {
    if (!id || phase !== "frei" || r.alles || fertig) return;
    const i = Math.floor(Math.random() * RAD.length);
    const ziel = (360 - feldMitte(i)) % 360;
    const weiter = (((ziel - (drehung % 360)) % 360) + 360) % 360;
    const ende = () => {
      const f = RAD[i];
      if (f.art === "betrag") { setBetrag(f.betrag); setPhase("konsonant"); setMeldung(`${f.betrag}! Wähle einen Konsonanten.`); }
      else if (f.art === "bankrott") { setze((a) => ({ ...a, geld: 0 })); setPhase("frei"); setMeldung("Bankrott! Das Rundengeld ist weg."); }
      else { setPhase("frei"); setMeldung("Aussetzen – nichts passiert. Dreh noch einmal."); }
    };
    setPhase("dreht"); setMeldung("Das Rad dreht sich …");
    if (wenigerBewegung()) { setDauer(0); setDrehung(drehung + 360 + weiter); ende(); return; }
    setDauer(DREHZEIT); setDrehung(drehung + 360 * 5 + weiter);
    uhr.current = setTimeout(ende, DREHZEIT + 100);
  };

  const rate = (b: string) => {
    if (!challenge || fertig || r.alles || r.buchstaben.includes(b)) return;
    if (phase === "konsonant" && KONSONANTEN.includes(b)) {
      const n = zaehle(challenge.text, b);
      setPhase("frei");
      if (n > 0) {
        setze((a) => ({ ...a, buchstaben: [...a.buchstaben, b], geld: a.geld + betrag * n }));
        setMeldung(`${n}× »${b.toUpperCase()}« – ${betrag * n} Münzen!`);
      } else {
        const falsch = r.falsch + 1;
        const voll = falsch >= GALGEN_MAX;
        setze((a) => ({ ...a, buchstaben: [...a.buchstaben, b], falsch, ...(voll ? { geld: 0, alles: true } : {}) }));
        setMeldung(voll ? "Der Galgen ist voll – das Rundengeld ist weg, aber das Rätsel bleibt lösbar." : `Kein »${b.toUpperCase()}« im Rätsel – ein Teil mehr am Galgen.`);
      }
    } else if (phase === "frei" && VOKALE.includes(b) && r.geld >= VOKAL_PREIS) {
      setze((a) => ({ ...a, buchstaben: [...a.buchstaben, b], geld: a.geld - VOKAL_PREIS }));
      setMeldung(`Vokal »${b.toUpperCase()}« gekauft (−${VOKAL_PREIS}).`);
    }
  };
  const rateRef = useRef(rate);
  rateRef.current = rate;
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      rateRef.current(e.key.toLowerCase());
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);

  const aufdecken = () => {
    if (!id || fertig) return;
    setze((a) => ({ ...a, alles: true, geld: 0 })); setPhase("frei"); setMeldung("Aufgedeckt – jetzt zählt dein Wissen.");
  };
  const lege = (fid: string) => {
    if (fertig || ablage.includes(fid) || !fakten.has(fid)) return;
    lauf.gelegt();
    setAblage([...ablage, fid]);
  };
  const loese = async () => {
    if (!id || !ablage.length || sende || phase === "dreht") return;
    setSende(true);
    try {
      const a = await lauf.antworte(id, ablage, tipp);
      setErgebnis(a);
      if (a.komplett) {
        const summe = r.geld + verdeckte(challenge.text, r.buchstaben, r.alles) * BONUS_JE_BUCHSTABE;
        setBank((b) => b + summe);
        setGeloest((g) => [...g, id]);
        setze((x) => ({ ...x, alles: true, geld: 0 }));
        setMeldung(`Gelöst! ${summe} Münzen auf der Bank.`);
      } else if (!a.treffer) { setze((x) => ({ ...x, geld: 0 })); setMeldung("Falsch gelöst – das Rundengeld ist weg."); }
      setAblage([]); setTipp(false);
    } catch { setAblage([]); }
    finally { setSende(false); }
  };

  const inventar = brett.fakten.filter((f) => !ablage.includes(f.id) && !korb.istWeg(f.id));
  const wand = challenge ? maskiere(challenge.text, r.buchstaben, r.alles || fertig) : [];
  const taste = (b: string, kosten?: number) => {
    const darf = !fertig && !r.alles && !r.buchstaben.includes(b) && (kosten === undefined ? phase === "konsonant" : phase === "frei" && r.geld >= kosten);
    return (
      <button key={b} className="btn-secondary px-2 py-1 min-w-9 font-bold uppercase" disabled={!darf} onClick={() => rate(b)}
        aria-label={kosten === undefined ? `Konsonant ${b.toUpperCase()}` : `Vokal ${b.toUpperCase()} kaufen`}>{b}</button>
    );
  };

  return (
    <>
      <GluecksradStil />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Herzen leben={brett.leben} />
        <span className="font-bold" aria-live="polite">🏦 Bank: {bank}</span>
        <div className="flex gap-2">
          <BestenlisteKnopf lauf={lauf} spiel="gluecksrad" rechts />
          <button className="btn-secondary" onClick={zurKarte}>Karte</button>
        </div>
      </div>

      {brett.challenges.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Rätsel">
          {brett.challenges.map((c, i) => (
            <button key={c.id} role="tab" aria-selected={c.id === id} disabled={phase === "dreht"}
              className={`btn-secondary ${c.id === id ? "border-accent" : ""}`} onClick={() => wechsle(c.id)}>
              {c.erledigt || geloest.includes(c.id) ? "✅" : "🎡"} Rätsel {i + 1}
            </button>
          ))}
        </div>
      )}

      {!challenge ? <p className="card p-3">Keine Rätsel in dieser Etappe.</p> : (
        <>
          <Buehne>
            <div className="flex flex-wrap items-center justify-center gap-3" role="group" aria-label="Rätselwand">
              {wand.map((wort, w) => (
                <div key={w} className="gl-wort">
                  {wort.map((k, i) => (istRatbar(k.zeichen) ? (
                    <span key={i} className="gl-kachel" data-offen={!k.verdeckt} role="img" aria-label={k.verdeckt ? "verdeckt" : k.zeichen}>
                      <span className="gl-hinten" />
                      <span className="gl-vorn">{k.verdeckt ? "" : k.zeichen.toUpperCase()}</span>
                    </span>
                  ) : <span key={i} className="gl-sonder">{k.zeichen}</span>))}
                </div>
              ))}
            </div>
            {(challenge.image || challenge.formula) && (
              <div className="bg-surface text-main rounded-lg p-2 text-center"><Inhalt x={{ text: "", image: challenge.image, formula: challenge.formula }} /></div>
            )}
            <div className="flex items-end justify-between gap-2">
              <Moderator />
              <p className="text-sm font-bold text-center flex-1" role="status">{meldung}</p>
              <Galgen stufe={r.falsch} />
            </div>
          </Buehne>

          {!fertig && (
            <div className="grid gap-3 md:grid-cols-[minmax(0,16rem)_1fr] items-start">
              <div className="flex flex-col gap-2">
                <Rad drehung={drehung} dauer={dauer} />
                <button className="btn-primary" disabled={phase !== "frei" || r.alles} onClick={drehe}>Drehen</button>
                <p className="text-sm">Rundengeld: <strong>{r.geld}</strong>{phase === "konsonant" && <> · Feld: <strong>{betrag}</strong></>}</p>
                <button className="btn-secondary" disabled={r.alles} onClick={aufdecken}>Aufdecken (ohne Geld)</button>
              </div>
              <div className="flex flex-col gap-2">
                <div><p className="text-sm font-bold">Konsonanten</p><div className="flex flex-wrap gap-1">{KONSONANTEN.map((b) => taste(b))}</div></div>
                <div><p className="text-sm font-bold">Vokal kaufen ({VOKAL_PREIS})</p><div className="flex flex-wrap gap-1">{VOKALE.map((b) => taste(b, VOKAL_PREIS))}</div></div>
              </div>
            </div>
          )}

          <Treffermeldung antwort={ergebnis} />
          {!fertig && (
            <>
              <div className="card p-3 flex flex-col gap-2">
                <p className="text-sm font-bold">Lösen: Lege Fakten auf das Rätsel.</p>
                <Ablage karten={ablage.map((fid) => fakten.get(fid)!)} leer="Lege Fakten aus dem Inventar hierher."
                  onLege={lege} onNimm={(fid) => setAblage(ablage.filter((x) => x !== fid))} />
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" disabled={!ablage.length || sende || phase === "dreht"} onClick={loese}>Lösen</button>
                  {challenge.tip && (tipp ? <span className="text-muted self-center">💡 {challenge.tip}</span>
                    : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
                </div>
              </div>
              <h2 className="font-bold">🎒 Inventar</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
                {inventar.map((f) => (
                  <div key={f.id} className="flex flex-col">
                    <FaktKarte fakt={f} onClick={() => lege(f.id)} />
                    <WegKnopf fakt={f} onClick={() => korb.wegwerfen(f.id)} />
                  </div>
                ))}
              </div>
              <Papierkorb weg={korb.weg} fakten={brett.fakten} onZurueck={korb.zurueckholen} />
            </>
          )}
        </>
      )}
    </>
  );
}
