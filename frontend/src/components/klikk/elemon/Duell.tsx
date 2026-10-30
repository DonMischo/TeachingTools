"use client";
/**
 * Elemon-Duelle gegen Mitschüler·innen derselben Klikk-Sitzung: Herausforderung
 * stellen oder annehmen, dann Lockstep über den Server. Beide Handys rechnen
 * mit denselben Regeln und demselben Startwert — der Server reicht nur Züge weiter.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type DuellElemon, type KlikkDuell, type KlikkDuelle } from "@/lib/api";
import { ART } from "@/lib/klikk/elemon/daten";
import { maxKp, neuerKampf, runde, type Elemon, type Kampf, type Zug } from "@/lib/klikk/elemon/kampf";
import type { ElemonStand } from "@/lib/klikk/elemon/spiel";
import { NAME_MUSTER } from "@/lib/klikk/klasse";
import type { Stand } from "@/lib/klikk/typen";
import type { Online } from "../spiele/SpieleApp";
import KampfAnsicht from "./KampfAnsicht";

const voll = (t: DuellElemon[]): Elemon[] => t.map(x => { const e = { ...x, xp: 0, kp: 0 }; e.kp = maxKp(e); return e; });

/** Kampfstand aus dem Server-Duell: alle vollständigen Runden nachspielen */
function nachspielen(d: KlikkDuell, bis = d.zuege.length): Kampf {
  let k = neuerKampf({ name: d.a_name, team: voll(d.a_team), aktiv: 0 }, { name: d.b_name ?? "", team: voll(d.b_team ?? []), aktiv: 0 }, false, d.seed);
  for (const [za, zb] of d.zuege.slice(0, bis)) k = runde(k, za, zb).kampf;
  return k;
}

export default function Duell({ s, e, online, aendere }: {
  s: Stand; e: ElemonStand; online?: Online; aendere: (f: (e: ElemonStand) => ElemonStand, minuten?: number, spur?: string) => void;
}) {
  const z = online?.zugang;
  const [daten, setDaten] = useState<KlikkDuelle | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kampfId, setKampfId] = useState<number | null>(null);
  const duellRef = useRef<KlikkDuell | null>(null);

  const laden = useCallback(() => {
    if (!z) return;
    api.klikk.duelle(z).then(d => { setDaten(d); duellRef.current = d.meins; }).catch(() => setFehler("Duelle gerade nicht erreichbar."));
  }, [z]);
  useEffect(() => {
    laden();
    const t = setInterval(laden, 3000);
    return () => clearInterval(t);
  }, [laden]);

  if (!z || !NAME_MUSTER.test(s.name)) return <p className="text-xs text-muted">Duelle gibt es nur, wenn die Klasse gemeinsam über einen Sitzungscode spielt.</p>;
  const team: DuellElemon[] = e.team.slice(0, 3).map(x => ({ art: x.art, stufe: x.stufe, attacken: x.attacken }));
  const meins = daten?.meins;

  if (meins && meins.status === "laeuft" && meins.seite && kampfId === meins.id) {
    const ich = meins.seite, er = ich === "a" ? "b" : "a";
    return (
      <KampfAnsicht start={nachspielen(meins)} ich={ich} farbe="#312e81" wild={false} gegnerName={(ich === "a" ? meins.b_name : meins.a_name) ?? "?"}
        warteText="Warte auf den Zug der anderen Seite …"
        zieh={async (k: Kampf, zug: Zug) => {
          const r = k.runde;
          const art = zug.art === "aufgeben" ? "aufgeben" : zug.art === "wechsel" ? "wechsel" : "angriff";
          let d = await api.klikk.duellZug(z, meins.id, r, { art, nr: "nr" in zug ? zug.nr : 0 });
          while (d.zuege.length <= r) {
            await new Promise(res => setTimeout(res, 1500));
            d = (await api.klikk.duelle(z)).meins ?? d;
          }
          const [za, zb] = d.zuege[r];
          return runde(k, za, zb);
        }}
        fertig={k => {
          const sieg = k.ende!.sieger === ich;
          api.klikk.duellEnde(z, meins.id, k.ende!.sieger).catch(() => {});
          const gegner = (er === "a" ? meins.a_name : meins.b_name) ?? "?";
          aendere(x => ({ ...x, muenzen: x.muenzen + (sieg ? 30 : 5), duelle: [...x.duelle, { gegner, sieg }] }), 5);
          setKampfId(null);
          laden();
        }} />
    );
  }

  const fehlerhaft = (p: Promise<unknown>) => p.then(laden).catch((err: Error) => setFehler(err.message));
  return (
    <div className="flex flex-col gap-2 text-xs">
      {fehler && <p className="text-bad">{fehler}</p>}
      <p className="text-muted">Dein Duell-Team: {team.map(x => `${ART[x.art].emoji} Lv ${x.stufe}`).join(" · ")} (die ersten drei, voll geheilt)</p>
      {meins?.status === "laeuft" && meins.seite && (
        <button className="btn-primary" onClick={() => setKampfId(meins.id)}>⚔️ Duell gegen {meins.seite === "a" ? meins.b_name : meins.a_name} – weiter</button>
      )}
      {meins?.status === "offen" ? (
        <div className="card p-2 flex justify-between items-center">
          <span>⏳ Deine Herausforderung wartet …</span>
          <button className="underline text-muted" onClick={() => fehlerhaft(api.klikk.duellZurueck(z, meins.id))}>zurückziehen</button>
        </div>
      ) : (
        <button className="btn-primary" onClick={() => fehlerhaft(api.klikk.duellAnbieten(z, s.name, team))}>📣 Klasse herausfordern</button>
      )}
      {meins?.status === "fertig" && <p>Letztes Duell: {meins.sieger === meins.seite ? "🏆 gewonnen" : "verloren"} gegen {meins.seite === "a" ? meins.b_name : meins.a_name}.</p>}
      <div className="font-bold mt-1">Offene Herausforderungen</div>
      {!daten ? <p className="text-muted">Lade …</p> : daten.offen.length === 0 ? <p className="text-muted">Gerade niemand. Stell selbst eine!</p> : daten.offen.map(o => (
        <div key={o.id} className="card p-2 flex justify-between items-center gap-2">
          <span><b>{o.name}</b><br />{o.team.map(x => `${ART[x.art]?.emoji ?? "❓"} ${x.stufe}`).join(" ")}</span>
          <button className="btn-secondary text-xs" onClick={() => api.klikk.duellAnnehmen(z, o.id, s.name, team)
            .then(d => { setDaten(v => v && { ...v, meins: d }); setKampfId(d.id); }).catch((err: Error) => setFehler(err.message))}>Annehmen</button>
        </div>
      ))}
      {e.duelle.length > 0 && <p className="text-muted">Bilanz: {e.duelle.filter(d => d.sieg).length} Siege, {e.duelle.filter(d => !d.sieg).length} Niederlagen</p>}
    </div>
  );
}
