"use client";
/**
 * Elemon-Duelle gegen Mitschüler·innen derselben Sitzung (Klikk-Handy oder
 * eigenes Elemon-Spiel): gezielt herausfordern (Liste oder QR-Code), die
 * Klasse offen herausfordern oder eine Herausforderung annehmen. Nach jeder
 * Herausforderung drei Minuten Pause; gezielte muss die andere Seite annehmen.
 * Dann Lockstep über den Server — beide Handys rechnen mit denselben Regeln.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api, type DuellElemon, type KlikkDuell, type KlikkDuelle, type MausZugang } from "@/lib/api";
import { ART } from "@/lib/elemon/daten";
import { maxKp, neuerKampf, runde, type Elemon, type Kampf, type Zug } from "@/lib/elemon/kampf";
import { qrSpieler, type ElemonStand } from "@/lib/elemon/spiel";
import { NAME_MUSTER } from "@/lib/klikk/klasse";
import KampfAnsicht from "./KampfAnsicht";

const voll = (t: DuellElemon[]): Elemon[] => t.map(x => { const e = { ...x, xp: 0, kp: 0 }; e.kp = maxKp(e); return e; });

/** Kampfstand aus dem Server-Duell: alle vollständigen Runden nachspielen */
function nachspielen(d: KlikkDuell, bis = d.zuege.length): Kampf {
  let k = neuerKampf({ name: d.a_name, team: voll(d.a_team), aktiv: 0 }, { name: d.b_name ?? "", team: voll(d.b_team ?? []), aktiv: 0 }, false, d.seed);
  for (const [za, zb] of d.zuege.slice(0, bis)) k = runde(k, za, zb).kampf;
  return k;
}

export const duellTeam = (e: ElemonStand): DuellElemon[] => e.team.slice(0, 3).map(x => ({ art: x.art, stufe: x.stufe, attacken: x.attacken }));

/**
 * Solange Elemon offen ist: in der Sitzung melden (herausforderbar sein) und
 * die Duelle abfragen — auch ohne den Duell-Reiter, damit Anfragen ankommen.
 */
export function useDuelle(z: MausZugang | undefined, name: string, team: DuellElemon[]) {
  const [daten, setDaten] = useState<KlikkDuelle | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const darf = !!z && NAME_MUSTER.test(name) && team.length > 0;
  const teamText = JSON.stringify(team);
  const laden = useCallback(() => {
    if (!z || !darf) return;
    api.klikk.duelle(z).then(d => { setDaten(d); setFehler(null); }).catch(() => setFehler("Duelle gerade nicht erreichbar."));
  }, [z, darf]);
  useEffect(() => {
    if (!z || !darf) return;
    const melden = () => api.klikk.elemonMelden(z, name, JSON.parse(teamText)).then(laden).catch(() => {});
    melden();
    const m = setInterval(melden, 60_000);
    const t = setInterval(laden, 4000);
    return () => { clearInterval(m); clearInterval(t); };
  }, [z, darf, name, teamText, laden]);
  return { daten, setDaten, fehler, setFehler, laden, darf };
}

export type DuellLage = ReturnType<typeof useDuelle>;

/** Ein laufendes, noch nicht ausgewertetes Duell */
export const laufendesDuell = (d: KlikkDuelle | null, e: ElemonStand) =>
  d?.meins && d.meins.status === "laeuft" && d.meins.seite && !e.duelle.some(x => x.id === d.meins!.id) ? d.meins : null;

export default function Duell({ name, e, z, lage, aendere, qrZiel, qrErledigt, scannen }: {
  name: string; e: ElemonStand; z?: MausZugang; lage: DuellLage;
  aendere: (f: (e: ElemonStand) => ElemonStand, minuten?: number, spur?: string) => void;
  /** per QR gescannte Spieler-ID: gleich herausfordern */
  qrZiel?: number | null; qrErledigt?: () => void;
  scannen?: () => void;
}) {
  const { daten, setDaten, fehler, setFehler, laden, darf } = lage;
  const team = useMemo(() => duellTeam(e), [e]);
  // Wartezeit sekundengenau herunterzählen
  const [rest, setRest] = useState(0);
  useEffect(() => setRest(daten?.warten ?? 0), [daten?.warten]);
  useEffect(() => {
    if (rest <= 0) return;
    const t = setTimeout(() => setRest(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [rest]);

  const fehlerhaft = useCallback((p: Promise<unknown>) => p.then(laden).catch((err: Error) => setFehler(err.message)), [laden, setFehler]);
  const herausfordern = useCallback((ziel?: number) => {
    if (z) fehlerhaft(api.klikk.duellAnbieten(z, name, team, ziel));
  }, [z, name, team, fehlerhaft]);

  // Gescannter QR-Code einer Mitspielerin / eines Mitspielers
  useEffect(() => {
    if (qrZiel == null || !daten) return;
    if (qrZiel === daten.ich) setFehler("Das ist dein eigener Code.");
    else herausfordern(qrZiel);
    qrErledigt?.();
  }, [qrZiel, daten, herausfordern, qrErledigt, setFehler]);

  if (!z || !darf) return <p className="text-xs text-muted">Duelle gibt es nur, wenn die Klasse gemeinsam über einen Sitzungscode spielt.</p>;
  const meins = daten?.meins;
  const laeuft = laufendesDuell(daten, e);

  // Ein laufendes Duell geht beim Öffnen sofort weiter — wie bei echten Spiele-Apps
  if (laeuft) {
    const ich = laeuft.seite!, er = ich === "a" ? "b" : "a";
    return (
      <KampfAnsicht start={nachspielen(laeuft)} ich={ich} farbe="#312e81" wild={false} gegnerName={(ich === "a" ? laeuft.b_name : laeuft.a_name) ?? "?"}
        warteText="Warte auf den Zug der anderen Seite …"
        zieh={async (k: Kampf, zug: Zug) => {
          const r = k.runde;
          const art = zug.art === "aufgeben" ? "aufgeben" : zug.art === "wechsel" ? "wechsel" : "angriff";
          let d = await api.klikk.duellZug(z, laeuft.id, r, { art, nr: "nr" in zug ? zug.nr : 0 });
          while (d.zuege.length <= r) {
            await new Promise(res => setTimeout(res, 1500));
            d = (await api.klikk.duelle(z)).meins ?? d;
          }
          const [za, zb] = d.zuege[r];
          return runde(k, za, zb);
        }}
        fertig={k => {
          const sieg = k.ende!.sieger === ich;
          api.klikk.duellEnde(z, laeuft.id, k.ende!.sieger).then(laden).catch(() => {});
          const gegner = (er === "a" ? laeuft.a_name : laeuft.b_name) ?? "?";
          // Belohnung nur einmal je Duell, auch wenn die Ansicht neu aufgeht
          aendere(x => x.duelle.some(d => d.id === laeuft.id) ? x
            : { ...x, muenzen: x.muenzen + (sieg ? 30 : 5), duelle: [...x.duelle, { id: laeuft.id, gegner, sieg }] }, 5);
        }} />
    );
  }

  const annehmen = (id: number) => api.klikk.duellAnnehmen(z, id, name, team)
    .then(d => setDaten(v => v && { ...v, meins: d })).catch((err: Error) => setFehler(err.message));
  const wartet = meins && (meins.status === "offen" || meins.status === "angefragt") && meins.seite === "a";

  return (
    <div className="flex flex-col gap-2 text-xs">
      {fehler && <p className="text-bad">{fehler}</p>}

      {daten && daten.an_mich.length > 0 && (
        <div className="rounded-xl border-2 border-accent p-2 flex flex-col gap-1">
          <b>⚔️ Herausforderung an dich</b>
          {daten.an_mich.map(o => (
            <div key={o.id} className="flex justify-between items-center gap-2">
              <span><b>{o.name}</b> · {o.team.map(x => `${ART[x.art]?.emoji ?? "❓"} ${x.stufe}`).join(" ")}</span>
              <span className="flex gap-1">
                <button className="btn-primary text-xs" onClick={() => annehmen(o.id)}>Annehmen</button>
                <button className="btn-secondary text-xs" onClick={() => fehlerhaft(api.klikk.duellAblehnen(z, o.id))}>Ablehnen</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-muted">Dein Duell-Team: {team.map(x => `${ART[x.art].emoji} Lv ${x.stufe}`).join(" · ")} (die ersten drei, voll geheilt)</p>

      {wartet ? (
        <div className="card p-2 flex justify-between items-center">
          <span>⏳ {meins!.status === "angefragt" ? `Warte, ob ${meins!.b_name} annimmt …` : "Deine Herausforderung an alle wartet …"}</span>
          <button className="underline text-muted" onClick={() => fehlerhaft(api.klikk.duellZurueck(z, meins!.id))}>zurückziehen</button>
        </div>
      ) : meins?.status === "abgelehnt" && meins.seite === "a" ? (
        <p>🙅 {meins.b_name} hat abgelehnt.</p>
      ) : meins?.status === "fertig" ? (
        <p>Letztes Duell: {meins.sieger === meins.seite ? "🏆 gewonnen" : "verloren"} gegen {meins.seite === "a" ? meins.b_name : meins.a_name}.</p>
      ) : null}
      {rest > 0 && <p className="text-muted">⏱️ Nächste Herausforderung in {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, "0")}</p>}

      <div className="font-bold mt-1">Wer gerade Elemon spielt</div>
      {!daten ? <p className="text-muted">Lade …</p> : daten.spieler.length === 0 ? <p className="text-muted">Noch niemand außer dir.</p> : daten.spieler.map(p => (
        <div key={p.id} className="card p-2 flex justify-between items-center gap-2">
          <span><b>{p.name}</b><br />{p.team.map(x => `${ART[x.art]?.emoji ?? "❓"} ${x.stufe}`).join(" ")}</span>
          <button className="btn-secondary text-xs" disabled={rest > 0 || !!wartet} onClick={() => herausfordern(p.id)}>Herausfordern</button>
        </div>
      ))}

      <div className="font-bold mt-1">Offene Herausforderungen an alle</div>
      {daten && daten.offen.length === 0 && <p className="text-muted">Gerade keine.</p>}
      {daten?.offen.map(o => (
        <div key={o.id} className="card p-2 flex justify-between items-center gap-2">
          <span><b>{o.name}</b><br />{o.team.map(x => `${ART[x.art]?.emoji ?? "❓"} ${x.stufe}`).join(" ")}</span>
          <button className="btn-secondary text-xs" onClick={() => annehmen(o.id)}>Annehmen</button>
        </div>
      ))}
      <button className="btn-secondary" disabled={rest > 0 || !!wartet} onClick={() => herausfordern()}>📣 Ganze Klasse herausfordern</button>

      {daten?.ich != null && (
        <div className="card p-2 flex gap-3 items-center mt-1">
          <div className="bg-white p-1 rounded"><QRCodeSVG value={qrSpieler(z.code, daten.ich)} size={96} /></div>
          <div className="flex flex-col gap-1">
            <b>Dein Duell-Code</b>
            <span className="text-muted">Andere scannen ihn und fordern dich heraus. Abtippen: <b className="text-fg">{daten.ich}</b></span>
            {scannen && <button className="btn-primary text-xs self-start" onClick={scannen}>📷 Code scannen</button>}
          </div>
        </div>
      )}
      {e.duelle.length > 0 && <p className="text-muted">Bilanz: {e.duelle.filter(d => d.sieg).length} Siege, {e.duelle.filter(d => !d.sieg).length} Niederlagen</p>}
    </div>
  );
}
