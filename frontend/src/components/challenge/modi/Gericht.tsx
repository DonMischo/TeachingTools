"use client";
/** Gericht (nach Ace Attorney): Kreuzverhör. Aussagen = falsche Behauptungen; mit Beweisen aus der Gerichtsakte »Einspruch!« erheben. */
import { useEffect, useRef, useState } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import { themeVon } from "@/lib/challenge/themes";
import { BestenlisteKnopf } from "@/components/challenge/Bestenliste";
import { Buehne } from "@/components/challenge/pixel/Buehne";
import Npc from "@/components/challenge/pixel/Npc";
import { useSpielwert } from "@/lib/challenge/useSpielwert";
import type { ModusProps } from "./typen";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import { GerichtStil } from "./gericht/hilfen";

const ZEUGEN_SPRUCH = [
  "Äh … ja, genau das habe ich gesagt!", "Das ist die reine Wahrheit, Euer Ehren!", "Daran gibt es nichts zu rütteln!",
  "Ich war ganz sicher dabei!", "Fragen Sie, wen Sie wollen – es stimmt!",
];

export default function Gericht({ brett, lauf, zurKarte }: ModusProps) {
  const saal = themeVon("antike");
  const [akte, setAkte] = useState(true);
  const [seite, setSeite] = useState(0);
  const [idx, setIdx] = useState(0);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [ergebnis, setErgebnis] = useState<ChallengeAntwort | null>(null);
  const [sende, setSende] = useState(false);
  const [nachgehakt, setNachgehakt] = useState<string[]>([]);
  // Spielpunkte: Aussagen, die ohne abgelehnten Einspruch widerlegt wurden (Nachhaken zählt nicht, das ließe sich erklicken)
  const [abgelehnt, setAbgelehnt] = useState<string[]>([]);
  const [sauber, setSauber] = useState<string[]>([]);
  const [burst, setBurst] = useState(false);
  const [hammer, setHammer] = useState(false);
  const uhr = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => uhr.current.forEach(clearTimeout), []);
  const kurz = (set: (b: boolean) => void, ms: number) => { set(true); uhr.current.push(setTimeout(() => set(false), ms)); };

  useSpielwert(lauf, "gericht", brett.etappe, sauber.length, brett.challenges.length);

  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const offene = brett.challenges.filter((c) => !c.erledigt);
  const aussage = offene[Math.min(idx, offene.length - 1)];
  const aussageId = aussage?.id;
  useEffect(() => { if (!akte && aussageId) lauf.waehle(); }, [akte, aussageId]); // eslint-disable-line react-hooks/exhaustive-deps

  const blaettere = (d: number) => { setIdx((idx + d + offene.length) % offene.length); setAblage([]); setTipp(false); setErgebnis(null); };
  const lege = (id: string) => {
    if (ablage.includes(id) || !fakten.has(id) || ergebnis) return;
    lauf.gelegt();
    setAblage([...ablage, id]);
  };
  const hake = () => { if (aussage && !nachgehakt.includes(aussage.id)) setNachgehakt([...nachgehakt, aussage.id]); };
  const einspruch = async () => {
    if (!aussage || !ablage.length || sende) return;
    setSende(true);
    kurz(setBurst, 1000);
    try {
      const r = await lauf.antworte(aussage.id, ablage, tipp);
      if (r.komplett && !abgelehnt.includes(aussage.id)) setSauber((x) => [...x, aussage.id]);
      if (!r.komplett) setAbgelehnt((x) => (x.includes(aussage.id) ? x : [...x, aussage.id]));
      setErgebnis(r);
      kurz(setHammer, 1300);
    } catch { setAblage([]); }
    finally { setSende(false); }
  };

  const kopf = (
    <div className="flex items-center justify-between">
      <Herzen leben={brett.leben} />
      <button className="btn-secondary" onClick={zurKarte}>Karte</button>
    </div>
  );

  if (akte) {
    const s = Math.min(seite, brett.fakten.length - 1);
    const f = brett.fakten[s];
    return (
      <>
        {kopf}
        <h2 className="font-bold">📁 Die Gerichtsakte</h2>
        {f ? (
          <div className="card p-3" role="group" aria-label="Aktenseite">
            <p className="text-muted">📎 Beweis {s + 1} von {brett.fakten.length}</p>
            <Inhalt x={f} />
            {f.info && <p className="text-muted mt-1">{f.info.text}</p>}
          </div>
        ) : <p className="text-muted">Die Akte ist leer.</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={s <= 0} onClick={() => setSeite(s - 1)}>◀ Zurück</button>
          <button className="btn-secondary" disabled={s >= brett.fakten.length - 1} onClick={() => setSeite(s + 1)}>Weiter ▶</button>
          <button className="btn-primary" onClick={() => { setAkte(false); kurz(setHammer, 1300); }}>Zur Verhandlung</button>
        </div>
      </>
    );
  }

  const inventar = brett.fakten.filter((f) => !ablage.includes(f.id));
  const komplett = !!ergebnis?.komplett;
  const daneben = !!ergebnis && !ergebnis.treffer;
  const gesamt = brett.challenges.length;
  const erledigt = brett.challenges.filter((c) => c.erledigt).length;
  const stufe = gesamt ? (erledigt >= gesamt ? 3 : Math.floor((erledigt * 3) / gesamt)) : 0;
  const hakt = !!aussage && nachgehakt.includes(aussage.id);
  const musik = komplett ? "♪ Überführt – Fanfare" : daneben ? "♪ Verhör – Moderato (gedämpft)" : "♪ Verhör – Allegro";
  return (
    <>
      {kopf}
      <GerichtStil />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2" role="img" aria-label={`Glaubwürdigkeit: ${brett.leben} von 3`}>
          <span className="font-bold text-sm">Glaubwürdigkeit</span>
          <div className="h-3 w-32 rounded-full bg-surface-hover border border-line overflow-hidden" aria-hidden>
            <div className="h-full bg-good transition-all" style={{ width: `${Math.max(0, Math.min(3, brett.leben)) / 3 * 100}%` }} />
          </div>
        </div>
        <span className="text-muted text-sm" aria-live="polite">{musik}</span>
      </div>
      <div className={`relative ${burst ? "gr-schuettel" : ""}`}>
        <Buehne wand bg={saal.hintergrund} farbe={saal.farben.boden} label="Gerichtssaal">
          <Npc name="king" scale={4} label="Richter" className={`absolute left-1/2 -translate-x-1/2 top-2 ${daneben ? "gr-zittern" : ""}`} />
          <span className={`absolute left-[58%] top-14 text-3xl origin-bottom-right ${hammer ? "gr-hammer" : ""}`} style={{ transform: hammer ? undefined : "rotate(-40deg)" }} aria-hidden>🔨</span>
          {hammer && <span className="absolute left-[64%] top-20 font-black text-lg" aria-hidden>TOCK!</span>}
          <Npc name="townsfolk_m" scale={4} label="Zeuge"
            className={`absolute left-[12%] bottom-0 transition-transform ${stufe === 2 ? "gr-zittern" : ""}`} />
          <span className="absolute left-[12%] bottom-24 text-2xl" aria-hidden>
            {stufe === 1 && <span className="gr-tropf inline-block">💦</span>}
            {stufe === 2 && "😰"}
            {stufe === 3 && "😵"}
          </span>
          <span className="absolute left-[8%] bottom-28 text-xs font-bold bg-white text-black rounded px-1" role="status">
            {["Selbstsicher", "Schwitzt", "Zittert", "Bricht zusammen!"][stufe]}
          </span>
        </Buehne>
        {burst && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" role="alert">
            <svg viewBox="0 0 300 180" className="w-[80%] max-w-md gr-burst" aria-hidden>
              <polygon fill="#ffe14a" stroke="#d11" strokeWidth="6"
                points="150,4 178,40 222,14 220,60 280,50 250,90 296,120 240,130 252,176 198,150 170,176 150,140 128,176 102,150 48,176 60,130 4,120 50,90 20,50 80,60 78,14 122,40" />
              <text x="150" y="104" textAnchor="middle" fontSize="38" fontWeight="900" fill="#d11" stroke="#fff" strokeWidth="2" fontFamily="Impact, sans-serif">EINSPRUCH!</text>
            </svg>
            <span className="sr-only">EINSPRUCH!</span>
          </div>
        )}
      </div>

      {aussage ? (
        <>
          <div className="card p-3 relative" role="group" aria-label="Aussage des Zeugen">
            <p className="text-muted">Aussage {Math.min(idx, offene.length - 1) + 1} von {offene.length}</p>
            <div className="font-bold">»<Inhalt x={aussage} />«</div>
            {hakt && (
              <div className="mt-2 text-sm border-l-4 border-line pl-2" role="status">
                <p>Zeuge: {ZEUGEN_SPRUCH[offene.indexOf(aussage) % ZEUGEN_SPRUCH.length]}</p>
                <p className="text-muted">Richter: Der Zeuge hat ausgesagt, die Verteidigung möge genau hinhören.</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" disabled={offene.length < 2} onClick={() => blaettere(-1)}>◀ Vorherige Aussage</button>
            <button className="btn-secondary" disabled={offene.length < 2} onClick={() => blaettere(1)}>Nächste Aussage ▶</button>
            <button className="btn-secondary" disabled={hakt || !!ergebnis} onClick={hake}>Nachhaken!</button>
          </div>
          {ergebnis ? (
            <>
              <Treffermeldung antwort={ergebnis} />
              <p className="text-muted" aria-live="polite">
                {komplett ? "Der Zeuge bricht unter dem Beweis zusammen!" : daneben ? "Richter: Einspruch abgelehnt!" : "Richter: Das reicht noch nicht ganz …"}
              </p>
              <button className="btn-primary self-start" onClick={() => { setErgebnis(null); setAblage([]); setTipp(false); }}>Weiter</button>
            </>
          ) : (
            <div className="card p-3 flex flex-col gap-2">
              <Ablage karten={ablage.map((id) => fakten.get(id)!)} leer="Lege Beweise aus der Akte auf die Aussage."
                onLege={lege} onNimm={(id) => setAblage(ablage.filter((x) => x !== id))} />
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" disabled={!ablage.length || sende} onClick={einspruch}>Einspruch!</button>
                {aussage.tip && (tipp ? <span className="text-muted self-center">💡 {aussage.tip}</span>
                  : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
              </div>
            </div>
          )}
          {!ergebnis && (
            <>
              <h2 className="font-bold">📁 Gerichtsakte</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
                {inventar.map((f) => (
                  <div key={f.id} className="flex flex-col"><span className="text-xs text-muted" aria-hidden>📎 Beweisstück</span>
                    <FaktKarte fakt={f} onClick={() => lege(f.id)} /></div>
                ))}
              </div>
            </>
          )}
        </>
      ) : <p className="card p-3">Keine offenen Aussagen mehr – der Zeuge hat gestanden!</p>}
      {lauf.hatBestenliste && <div><BestenlisteKnopf lauf={lauf} spiel="gericht" /></div>}
    </>
  );
}
