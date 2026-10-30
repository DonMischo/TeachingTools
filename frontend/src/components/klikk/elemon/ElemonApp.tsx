"use client";
/**
 * »Elemon« auf dem Klikk-Handy: Starter wählen, in Gebieten wilde Elemon mit
 * dem Käfig fangen, Trainer und Arenen besiegen, gegen Mitschüler·innen
 * duellieren. Energie, Werbevideos und der gesperrte Kristall-Shop zeigen,
 * wie solche Spiele zurückholen — und alles läuft durch AdKit.
 */
import { useEffect, useState } from "react";
import { ART, ARTEN, ATTACKEN, ELEMENTE, STARTER, TYPEN_SCHWACH, TYPEN_STARK, elementInfo, type ElementId } from "@/lib/klikk/elemon/daten";
import { aktivVon, heile, kiZug, lebt, maxKp, neuerKampf, runde, xpBis, type Elemon, type Kampf, type Zug } from "@/lib/klikk/elemon/kampf";
import {
  ENERGIE_MAX, GEBIETE, PREISE, darfIns, kampfEnde, kaufen, naechsteEnergie, neuerElemonStand, sehen, starten,
  tauschen, trainerTeam, wildesElemon, type Ausgang, type ElemonStand, type Gebiet, type Trainer,
} from "@/lib/klikk/elemon/spiel";
import type { Aufstieg } from "@/lib/klikk/elemon/kampf";
import { elemonAktion } from "@/lib/klikk/motor";
import type { Stand } from "@/lib/klikk/typen";
import type { Online } from "../spiele/SpieleApp";
import KampfAnsicht from "./KampfAnsicht";
import Duell from "./Duell";

type Setze = (f: (s: Stand) => Stand) => void;
type Reiter = "karte" | "team" | "kartei" | "laden" | "duell";

interface Laufend { kampf: Kampf; gebiet: Gebiet; trainer?: Trainer & { schluessel: string; orden?: string } }
interface Bericht { titel: string; zeilen: string[] }

export function ElemonKarte({ e, onClick, rechts }: { e: Elemon; onClick?: () => void; rechts?: React.ReactNode }) {
  const art = ART[e.art];
  return (
    <div className={`card p-2 flex gap-2 items-center text-xs ${onClick ? "cursor-pointer hover:bg-surface-hover" : ""}`} onClick={onClick}>
      <span className="text-2xl">{art.emoji}</span>
      <span className="flex-1 min-w-0">
        <span className="font-bold">{art.name}</span> <span className="text-muted">Lv {e.stufe} · {art.elemente.map(x => elementInfo(x).icon).join("")}</span>
        <span className="block h-1 rounded bg-surface-hover mt-0.5"><span className={`block h-1 rounded ${lebt(e) ? "bg-good" : "bg-bad"}`} style={{ width: `${(e.kp / maxKp(e)) * 100}%` }} /></span>
        <span className="text-[10px] text-muted">{e.kp}/{maxKp(e)} KP · {e.xp}/{xpBis(e.stufe)} XP · {e.attacken.map(a => ATTACKEN[a].name).join(", ")}</span>
      </span>
      {rechts}
    </div>
  );
}

export default function ElemonApp({ s, setze, online }: { s: Stand; setze: Setze; online?: Online }) {
  const [reiter, setReiter] = useState<Reiter>("karte");
  const [laufend, setLaufend] = useState<Laufend | null>(null);
  const [bericht, setBericht] = useState<Bericht | null>(null);
  const [werbung, setWerbung] = useState<number | null>(null);
  const [kaufHinweis, setKaufHinweis] = useState(false);
  const [standort, setStandort] = useState<boolean | null>(null);
  const jetzt = s.tag * 1440 + s.uhr;
  const e: ElemonStand = s.elemon ?? neuerElemonStand();
  const aendere = (f: (e: ElemonStand) => ElemonStand, minuten = 0, spur?: string) => setze(st => elemonAktion(st, f, minuten, spur));

  // --- Start ---
  if (e.team.length === 0) return (
    <div className="p-3 flex flex-col gap-3">
      <div className="text-center">
        <div className="text-4xl">🐾</div>
        <div className="font-black text-xl">Elemon</div>
        <p className="text-xs text-muted">Fang sie im Käfig. Trainiere sie. Werde Meister·in der Stadt.</p>
      </div>
      {standort === null ? (
        <div className="card p-3 flex flex-col gap-2 text-sm">
          <b>📍 »Elemon« möchte auf deinen Standort zugreifen</b>
          <p className="text-xs text-muted">Damit seltene Elemon in deiner Nähe auftauchen können. Auch wenn du die App nicht benutzt.</p>
          <button className="btn-primary" onClick={() => setStandort(true)}>Immer erlauben</button>
          <button className="btn-secondary" onClick={() => setStandort(false)}>Nicht erlauben</button>
        </div>
      ) : (
        <>
          <p className="text-sm font-bold">Wähle dein erstes Elemon:</p>
          <div className="grid grid-cols-3 gap-2">
            {STARTER.map(id => (
              <button key={id} className="card p-2 flex flex-col items-center hover:bg-surface-hover"
                onClick={() => aendere(x => ({ ...starten(x, id), standort }), 2,
                  standort ? "Standort »immer« freigegeben – Elemon meldet deinen Ort auch im Hintergrund" : undefined)}>
                <span className="text-4xl">{ART[id].emoji}</span>
                <span className="text-xs font-bold">{ART[id].name}</span>
                <span className="text-[10px]">{elementInfo(ART[id].elemente[0]).icon} {elementInfo(ART[id].elemente[0]).name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // --- Kampf ---
  const kampfStarten = (gebiet: Gebiet, gegner: Elemon[], trainer?: Laufend["trainer"]) => {
    const team = e.team;
    const aktiv = team.findIndex(lebt);
    if (aktiv < 0) return;
    const wurf = e.wurf + 1;
    const kampf = neuerKampf({ name: s.name, team, aktiv }, { name: trainer?.name ?? "wild", team: gegner, aktiv: 0 }, !trainer, wurf * 7919 + s.seed);
    aendere(x => ({ ...sehen({ ...x, wurf }, gegner[0].art), energie: x.energie - 1 }), 3,
      e.standort ? `Kampf in »${gebiet.name}« – Standort, Uhrzeit, Spielstand` : `Kampf in »${gebiet.name}«`);
    setLaufend({ kampf, gebiet, trainer });
  };

  if (laufend) {
    const { kampf, gebiet, trainer } = laufend;
    return (
      <KampfAnsicht start={kampf} ich="a" farbe={gebiet.farbe} wild={!trainer} gegnerName={trainer?.name ?? "Wild"}
        tasche={{ traenke: e.traenke, kaefige: e.kaefige, goldkaefige: e.goldkaefige }}
        zieh={async (k: Kampf, zug: Zug) => runde(k, zug, kiZug(k))}
        fertig={(k, verbraucht) => {
          const ende = k.ende!;
          const aus: Ausgang = ende.gefangen ? { art: "gefangen", elemon: { ...aktivVon(k.b), kp: aktivVon(k.b).kp } }
            : ende.geflohen ? { art: "flucht" }
            : ende.sieger === "a" ? { art: "sieg", besiegt: k.b.team, lohn: trainer ? trainer.lohn : 8 + aktivVon(k.b).stufe * 2, trainer: trainer?.schluessel, orden: trainer?.orden }
            : { art: "niederlage" };
          const r = kampfEnde(e, k.a.team, aus);
          const zeilen: string[] = [];
          if (aus.art === "sieg") zeilen.push(`+${aus.lohn} 🪙`, `+${r.xp} XP für alle, die noch stehen`);
          if (aus.art === "gefangen") zeilen.push(`${ART[aus.elemon.art].name} ist jetzt ${e.team.length < 6 ? "in deinem Team" : "im Lager"}.`, `+${r.xp} XP`);
          if (aus.art === "sieg" && aus.orden) zeilen.push(`🏅 Neuer Orden: ${aus.orden}`);
          if (aus.art === "niederlage") zeilen.push("Du hast dein Team zur Heilstation geschleppt.", `−${r.verlust} 🪙 für die Behandlung`);
          zeilen.push(...aufstiegsZeilen(r.stand.team, r.aufstiege));
          aendere(() => ({
            ...r.stand,
            traenke: r.stand.traenke - verbraucht.traenke, kaefige: r.stand.kaefige - verbraucht.kaefige, goldkaefige: r.stand.goldkaefige - verbraucht.goldkaefige,
          }), 4);
          setBericht({ titel: aus.art === "sieg" ? "🏆 Gewonnen!" : aus.art === "gefangen" ? "⛓️ Gefangen!" : aus.art === "flucht" ? "🏃 Entkommen" : "😵 Verloren", zeilen });
          setLaufend(null);
        }} />
    );
  }

  if (bericht) return (
    <div className="p-4 flex flex-col gap-3">
      <div className="text-2xl font-black text-center">{bericht.titel}</div>
      <ul className="text-sm flex flex-col gap-1">{bericht.zeilen.map((z, i) => <li key={i}>{z}</li>)}</ul>
      <button className="btn-primary" onClick={() => setBericht(null)}>Weiter</button>
      {e.energie > 0 && <p className="text-[11px] text-muted text-center">Noch {e.energie} ⚡ – nur noch ein Kampf?</p>}
    </div>
  );

  // --- Werbung für Energie ---
  if (werbung !== null) return <Werbevideo sekunden={werbung} fertig={() => {
    setWerbung(null);
    aendere(x => ({ ...x, energie: Math.min(ENERGIE_MAX, x.energie + 2), werbungen: x.werbungen + 1 }), 1, "Werbevideo bis zum Ende angesehen – Werbe-ID, Spielstand, Uhrzeit");
  }} />;

  const ohneEnergie = e.energie <= 0;
  const keinerFit = !e.team.some(lebt);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 bg-surface border-b border-line px-3 py-2 flex items-center gap-2 text-xs">
        <span className="font-black text-base">🐾 Elemon</span>
        <span className="ml-auto" title="Energie">⚡ {e.energie}/{ENERGIE_MAX}</span>
        <span title="Münzen">🪙 {e.muenzen}</span>
        <span title="Orden">🏅 {e.orden.length}</span>
      </div>
      <div className="flex text-[11px] border-b border-line">
        {([["karte", "🗺️ Karte"], ["team", "🐾 Team"], ["kartei", "📖 Kartei"], ["laden", "🛒 Laden"], ["duell", "⚔️ Duell"]] as [Reiter, string][]).map(([id, t]) => (
          <button key={id} onClick={() => setReiter(id)} className={`flex-1 py-1.5 ${reiter === id ? "font-bold border-b-2 border-accent" : "text-muted"}`}>{t}</button>
        ))}
      </div>

      <div className="p-3 flex flex-col gap-2">
        {reiter === "karte" && (
          <>
            {ohneEnergie && (
              <div className="card p-2 text-xs flex flex-col gap-1 border-amber-500">
                <b>Keine Energie mehr.</b>
                <span>Nächste ⚡ in {naechsteEnergie(e, jetzt)} Minuten.</span>
                <button className="btn-primary text-xs" onClick={() => setWerbung(15)}>📺 Werbung ansehen: +2 ⚡</button>
                <button className="btn-secondary text-xs" onClick={() => {
                  setKaufHinweis(true);
                  aendere(x => ({ ...x, kaufVersuche: x.kaufVersuche + 1 }), 0, "Kaufversuch »Energie-Paket 0,99 €« – Zahlungsbereitschaft vermerkt");
                }}>💎 Volle Energie für 0,99 €</button>
                {kaufHinweis && <p className="text-[11px] text-bad">Kauf abgelehnt: Für In-App-Käufe brauchst du die Zustimmung deiner Eltern. (Die App hat sich trotzdem gemerkt, dass du es versucht hast.)</p>}
              </div>
            )}
            {keinerFit && <p className="text-xs text-bad">Alle deine Elemon sind erschöpft. Ab zur Heilstation!</p>}
            <button className="btn-secondary text-xs" disabled={e.team.every(x => x.kp === maxKp(x))}
              onClick={() => aendere(x => ({ ...x, team: heile(x.team) }), 10)}>🏥 Heilstation (10 Min.)</button>
            {GEBIETE.map(g => {
              const offen = darfIns(e, g);
              return (
                <div key={g.id} className="rounded-xl p-2 text-white flex flex-col gap-1" style={{ background: g.farbe, opacity: offen ? 1 : 0.5 }}>
                  <div className="flex justify-between items-center">
                    <b>{g.emoji} {g.name}</b><span className="text-[10px] opacity-80">Lv {g.stufen[0]}–{g.stufen[1]}</span>
                  </div>
                  {!offen ? <span className="text-[11px]">🔒 braucht {g.braucht} Orden</span> : (
                    <div className="flex flex-wrap gap-1">
                      <button className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] disabled:opacity-40" disabled={ohneEnergie || keinerFit}
                        onClick={() => kampfStarten(g, [wildesElemon(g, e.wurf * 13 + s.seed + jetzt, !!e.standort)])}>🌿 Suchen ⚡1</button>
                      {g.trainer.map((t, i) => {
                        const schluessel = `${g.id}:${i}`, besiegt = e.besiegt.includes(schluessel);
                        return (
                          <button key={i} className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] disabled:opacity-40" disabled={ohneEnergie || keinerFit}
                            onClick={() => kampfStarten(g, trainerTeam(t), { ...t, schluessel, lohn: besiegt ? Math.round(t.lohn / 3) : t.lohn })}>
                            {t.emoji} {t.name}{besiegt ? " ✓" : ""} ⚡1
                          </button>
                        );
                      })}
                      <button className="rounded-full bg-amber-400/90 text-black px-2 py-0.5 text-[11px] font-bold disabled:opacity-40" disabled={ohneEnergie || keinerFit}
                        onClick={() => kampfStarten(g, trainerTeam(g.arena), { ...g.arena, schluessel: `${g.id}:arena`, lohn: e.orden.includes(g.arena.orden) ? Math.round(g.arena.lohn / 3) : g.arena.lohn })}>
                        🏟️ Arena {e.orden.includes(g.arena.orden) ? g.arena.orden.split(" ")[0] : ""} ⚡1
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {reiter === "team" && (
          <>
            <p className="text-[11px] text-muted">Das erste fitte Elemon geht zuerst in den Kampf. Tippen = nach vorn holen.</p>
            {e.team.map((x, i) => (
              <ElemonKarte key={i} e={x} onClick={i > 0 ? () => aendere(st => ({ ...st, team: [st.team[i], ...st.team.filter((_, j) => j !== i)] })) : undefined}
                rechts={e.team.length > 1 && <button className="text-[10px] underline text-muted" onClick={ev => { ev.stopPropagation(); aendere(st => tauschen(st, i, null)); }}>ins Lager</button>} />
            ))}
            {e.lager.length > 0 && <div className="text-xs font-bold mt-2">📦 Lager ({e.lager.length})</div>}
            {e.lager.map((x, i) => (
              <ElemonKarte key={`l${i}`} e={x} rechts={e.team.length < 6 && <button className="text-[10px] underline text-muted" onClick={() => aendere(st => tauschen(st, null, i))}>ins Team</button>} />
            ))}
          </>
        )}

        {reiter === "kartei" && (
          <>
            <p className="text-xs">Gesehen: {e.gesehen.length} · Gefangen: {e.gefangen.length} von {ARTEN.length}</p>
            <div className="grid grid-cols-4 gap-1">
              {ARTEN.map(a => {
                const gef = e.gefangen.includes(a.id), ges = e.gesehen.includes(a.id);
                return (
                  <div key={a.id} className={`card p-1 text-center ${gef ? "" : "opacity-50"}`} title={ges ? a.name : "???"}>
                    <div className={`text-2xl ${ges ? "" : "grayscale brightness-0"}`}>{a.emoji}</div>
                    <div className="text-[9px] truncate">{ges ? a.name : "???"}</div>
                    <div className="text-[9px]">{ges ? a.elemente.map(x => elementInfo(x).icon).join("") : ""}{gef ? " ⛓️" : ""}</div>
                  </div>
                );
              })}
            </div>
            <Typentabelle />
          </>
        )}

        {reiter === "laden" && (
          <>
            <div className="card p-2 text-xs flex justify-between items-center">
              <span>⛓️ Käfig ({e.kaefige}×)</span>
              <button className="btn-secondary text-xs" disabled={e.muenzen < PREISE.kaefig} onClick={() => aendere(x => kaufen(x, "kaefig"))}>{PREISE.kaefig} 🪙</button>
            </div>
            <div className="card p-2 text-xs flex justify-between items-center">
              <span>🧪 Kräutertrank ({e.traenke}×)</span>
              <button className="btn-secondary text-xs" disabled={e.muenzen < PREISE.trank} onClick={() => aendere(x => kaufen(x, "trank"))}>{PREISE.trank} 🪙</button>
            </div>
            <div className="rounded-xl p-2 text-xs flex flex-col gap-1 bg-gradient-to-r from-fuchsia-600 to-amber-500 text-white">
              <b>💎 NUR HEUTE: Goldkäfig-Paket</b>
              <span>5 Goldkäfige – hält doppelt so gut! <s>4,99 €</s> <b>1,99 €</b></span>
              <span className="text-[10px] opacity-80">Angebot endet in 00:{String(59 - (s.uhr % 60)).padStart(2, "0")} Min.</span>
              <button className="rounded-full bg-white text-black font-bold py-1" onClick={() => {
                setKaufHinweis(true);
                aendere(x => ({ ...x, kaufVersuche: x.kaufVersuche + 1 }), 0, "Kaufversuch »Goldkäfig-Paket 1,99 €« – Zahlungsbereitschaft vermerkt");
              }}>Jetzt kaufen</button>
              {kaufHinweis && <p className="text-[11px] bg-black/30 rounded p-1">Kauf abgelehnt: Für In-App-Käufe brauchst du die Zustimmung deiner Eltern. Der Countdown fängt übrigens jede Stunde neu an.</p>}
            </div>
          </>
        )}

        {reiter === "duell" && <Duell s={s} e={e} online={online} aendere={aendere} />}
      </div>
    </div>
  );
}

function aufstiegsZeilen(team: Elemon[], aufstiege: Aufstieg[]) {
  return aufstiege.flatMap(a => [
    `⬆️ ${ART[team[a.nr].art].name} ist jetzt Lv ${a.stufe}!`,
    ...a.gelernt.map(id => `✨ … und kann jetzt ${ATTACKEN[id].name}${a.vergessen.length ? ` (statt ${a.vergessen.map(v => ATTACKEN[v].name).join(", ")})` : ""}.`),
  ]);
}

function Werbevideo({ sekunden, fertig }: { sekunden: number; fertig: () => void }) {
  const [rest, setRest] = useState(sekunden);
  useEffect(() => {
    const t = setInterval(() => setRest(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="h-full min-h-96 flex flex-col items-center justify-center gap-3 p-6 text-center bg-gradient-to-b from-pink-500 to-orange-400 text-white">
      <div className="text-xs opacity-80">Werbung · {rest > 0 ? `noch ${rest} s` : "fertig"}</div>
      <div className="text-6xl">🍬</div>
      <div className="font-black text-2xl">Candy Blast</div>
      <div className="text-sm">Level 1–5000! Jetzt gratis spielen!</div>
      <button className="btn-secondary" disabled={rest > 0} onClick={fertig}>{rest > 0 ? "✕" : "Belohnung abholen ✕"}</button>
    </div>
  );
}

function Typentabelle() {
  const [offen, setOffen] = useState(false);
  return (
    <div className="mt-2">
      <button className="text-xs underline" onClick={() => setOffen(o => !o)}>{offen ? "Typentabelle ausblenden" : "📊 Welches Element schlägt welches?"}</button>
      {offen && <TypenListe />}
    </div>
  );
}

function TypenListe() {
  const ic = (ids: string[]) => ids.map(id => elementInfo(id as ElementId).icon).join(" ") || "–";
  return (
    <ul className="text-[10px] mt-1 flex flex-col gap-0.5">
      {ELEMENTE.filter(x => x.id !== "heilung").map(x => (
        <li key={x.id}>{x.icon} <b>{x.name}</b>: stark gegen {ic(TYPEN_STARK(x.id))} · schwach gegen {ic(TYPEN_SCHWACH(x.id))}</li>
      ))}
    </ul>
  );
}
