"use client";
/** Gerichtssaal: Die Challenges sind falsche Behauptungen; Beweise aus der Akte legen, dann »Einspruch!«. */
import { useEffect, useState } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import { themeVon } from "@/lib/challenge/themes";
import type { ModusProps } from "./typen";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import { Buehne, ModusStil } from "./turm/Buehne";
import Npc from "./gericht/Npc";

export default function Gericht({ brett, lauf, zurKarte }: ModusProps) {
  const saal = themeVon("antike");
  const [akte, setAkte] = useState(true);
  const [seite, setSeite] = useState(0);
  const [idx, setIdx] = useState(0);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [ergebnis, setErgebnis] = useState<ChallengeAntwort | null>(null);
  const [sende, setSende] = useState(false);

  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const offene = brett.challenges.filter((c) => !c.erledigt);
  const aussage = offene[Math.min(idx, offene.length - 1)];
  const aussageId = aussage?.id;
  useEffect(() => { if (!akte && aussageId) lauf.waehle(aussageId); }, [akte, aussageId]); // eslint-disable-line react-hooks/exhaustive-deps

  const blaettere = (d: number) => { setIdx((idx + d + offene.length) % offene.length); setAblage([]); setTipp(false); setErgebnis(null); };
  const lege = (id: string) => {
    if (ablage.includes(id) || !fakten.has(id) || ergebnis) return;
    lauf.gelegt();
    setAblage([...ablage, id]);
  };
  const einspruch = async () => {
    if (!aussage || !ablage.length || sende) return;
    setSende(true);
    try { setErgebnis(await lauf.antworte(aussage.id, ablage, tipp)); }
    catch { setAblage([]); }
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
        <h2 className="font-bold">📁 Die Akte</h2>
        {f ? (
          <div className="card p-3" role="group" aria-label="Aktenseite">
            <p className="text-muted">Beweis {s + 1} von {brett.fakten.length}</p>
            <Inhalt x={f} />
            {f.info && <p className="text-muted mt-1">{f.info.text}</p>}
          </div>
        ) : <p className="text-muted">Die Akte ist leer.</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={s <= 0} onClick={() => setSeite(s - 1)}>◀ Zurück</button>
          <button className="btn-secondary" disabled={s >= brett.fakten.length - 1} onClick={() => setSeite(s + 1)}>Weiter ▶</button>
          <button className="btn-primary" onClick={() => setAkte(false)}>Zur Verhandlung</button>
        </div>
      </>
    );
  }

  const inventar = brett.fakten.filter((f) => !ablage.includes(f.id));
  const komplett = !!ergebnis?.komplett;
  const daneben = !!ergebnis && !ergebnis.treffer;
  return (
    <>
      {kopf}
      <ModusStil />
      <Buehne bg={saal.hintergrund} farbe={saal.farben.boden} wand label="Gerichtssaal">
        <Npc name="king" scale={4} label="Richter" className={`absolute left-1/2 -translate-x-1/2 top-2 ${daneben ? "ch-an ch-taumel" : ""}`} />
        <Npc name="townsfolk_m" scale={4} label="Zeuge" className={`absolute left-[12%] bottom-0 ${komplett ? "ch-an ch-wackel" : ""}`} />
        {komplett && <span className="absolute left-[12%] bottom-24 text-2xl" aria-hidden>💦</span>}
        {komplett && (
          <span className="ch-an ch-stempel absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-black text-red-600 whitespace-nowrap"
            style={{ WebkitTextStroke: "2px #fff" }} role="status">EINSPRUCH!</span>
        )}
      </Buehne>

      {aussage ? (
        <>
          <div className="card p-3 relative" role="group" aria-label="Aussage des Zeugen">
            <p className="text-muted">Aussage {Math.min(idx, offene.length - 1) + 1} von {offene.length}</p>
            <div className="font-bold">»<Inhalt x={aussage} />«</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" disabled={offene.length < 2} onClick={() => blaettere(-1)}>◀ Vorherige Aussage</button>
            <button className="btn-secondary" disabled={offene.length < 2} onClick={() => blaettere(1)}>Nächste Aussage ▶</button>
          </div>
          {ergebnis ? (
            <>
              <Treffermeldung antwort={ergebnis} />
              <button className="btn-primary self-start" onClick={() => { setErgebnis(null); setAblage([]); setTipp(false); }}>Weiter</button>
            </>
          ) : (
            <div className="card p-3 flex flex-col gap-2">
              <Ablage karten={ablage.map((id) => fakten.get(id)!)} leer="Lege Beweise auf die Aussage."
                onLege={lege} onNimm={(id) => setAblage(ablage.filter((x) => x !== id))} />
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" disabled={!ablage.length || sende} onClick={einspruch}>Einspruch!</button>
                {aussage.tip && (tipp ? <span className="text-muted self-center">💡 {aussage.tip}</span>
                  : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
              </div>
            </div>
          )}
          {!ergebnis && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
              {inventar.map((f) => <FaktKarte key={f.id} fakt={f} onClick={() => lege(f.id)} />)}
            </div>
          )}
        </>
      ) : <p className="card p-3">Keine offenen Aussagen mehr.</p>}
    </>
  );
}
