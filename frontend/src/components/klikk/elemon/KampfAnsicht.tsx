"use client";
/**
 * Ein Elemon-Kampf auf dem Handy: Bühne, KP-Leisten, Textzeile und Menü.
 * Wer den Zug des Gegners liefert (KI oder Mitschüler·in über den Server),
 * entscheidet `zieh` — die Ansicht spielt nur die Ereignisse der Runde ab.
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ART, ATTACKEN, elementInfo } from "@/lib/klikk/elemon/daten";
import { aktivVon, lebt, maxKp, type Ereignis, type Kampf, type SeiteId, type Zug } from "@/lib/klikk/elemon/kampf";
import type { BuehneSteuerung } from "./Buehne";

const Buehne = lazy(() => import("./Buehne"));
const warte = (s: number) => new Promise(r => setTimeout(r, s * 1000));

export interface Tasche { traenke: number; kaefige: number; goldkaefige: number }

function Leiste({ kampf, seite, gegner }: { kampf: Kampf; seite: SeiteId; gegner: boolean }) {
  const e = aktivVon(kampf[seite]);
  const anteil = e.kp / maxKp(e);
  return (
    <div className={`rounded-lg bg-black/55 text-white px-2 py-1 text-[11px] w-40 ${gegner ? "" : "ml-auto"}`}>
      <div className="flex justify-between font-bold">
        <span className="truncate">{ART[e.art].name}</span><span>Lv {e.stufe}</span>
      </div>
      <div className="h-1.5 rounded bg-white/20 my-0.5">
        <div className={`h-1.5 rounded transition-all duration-500 ${anteil > 0.5 ? "bg-emerald-400" : anteil > 0.2 ? "bg-amber-400" : "bg-rose-500"}`} style={{ width: `${anteil * 100}%` }} />
      </div>
      <div className="flex justify-between text-white/70">
        <span>{ART[e.art].elemente.map(x => elementInfo(x).icon).join("")}</span>
        {!gegner && <span className="tabular-nums">{e.kp}/{maxKp(e)}</span>}
        <span>{kampf[seite].team.map((x, i) => <span key={i}>{lebt(x) ? "●" : "○"}</span>)}</span>
      </div>
    </div>
  );
}

/** Ereignis auf eine Anzeige-Kopie anwenden, damit die Leisten Schritt für Schritt mitgehen */
function anwenden(k: Kampf, e: Ereignis): Kampf {
  const n = structuredClone(k);
  const andere = (s: SeiteId): SeiteId => (s === "a" ? "b" : "a");
  if (e.typ === "angriff") { const o = aktivVon(n[andere(e.seite)]); o.kp = Math.max(0, o.kp - e.schaden); }
  if (e.typ === "heilung" || e.typ === "trank") { const t = aktivVon(n[e.seite]); t.kp = Math.min(maxKp(t), t.kp + e.menge); }
  if (e.typ === "wechsel") n[e.seite].aktiv = e.nr;
  return n;
}

export default function KampfAnsicht({ start, ich, farbe, wild, gegnerName, tasche, zieh, fertig, warteText, verbrauche, merke }: {
  start: Kampf;
  ich: SeiteId;
  farbe: string;
  wild: boolean;
  /** »Wildes«, »Kims« oder der Klikk-Name */
  gegnerName: string;
  tasche?: Tasche;
  /** einen Gegenstand sofort aus der Tasche nehmen */
  verbrauche?: (was: keyof Tasche) => void;
  /** Kampfstand nach jeder Runde sichern (App verlassen → später weiter) */
  merke?: (k: Kampf) => void;
  /** Text, solange auf den Zug der anderen Seite gewartet wird */
  warteText?: string;
  /** führt meinen Zug aus und liefert die Runde (lokal oder vom Server) */
  zieh: (k: Kampf, zug: Zug) => Promise<{ kampf: Kampf; ereignisse: Ereignis[] }>;
  fertig: (k: Kampf) => void;
}) {
  const du: SeiteId = ich, er: SeiteId = ich === "a" ? "b" : "a";
  const [k, setK] = useState(start);
  const [anzeige, setAnzeige] = useState(start);
  const [text, setText] = useState(start.runde > 0
    ? `Weiter geht's! Was soll ${ART[aktivVon(start[du]).art].name} tun?`
    : `${wild ? "Ein wildes" : gegnerName + " schickt"} ${ART[aktivVon(start[er]).art].name}${wild ? " taucht auf!" : " in den Ring!"}`);
  const [menue, setMenue] = useState<"haupt" | "angriff" | "team" | "tasche" | "warte">("haupt");
  const buehne = useRef<BuehneSteuerung>(null);
  // Mitten in der letzten Runde weggegangen: das Ende ist schon gesichert, also gleich auswerten
  const fertigRef = useRef(fertig);
  useEffect(() => { fertigRef.current = fertig; });
  useEffect(() => { if (start.ende) fertigRef.current(start); }, [start.ende]); // eslint-disable-line react-hooks/exhaustive-deps
  // Auf der Bühne steht »ich« immer links (a)
  const bs = (s: SeiteId): SeiteId => (s === du ? "a" : "b");

  const name = (s: SeiteId, kampf: Kampf) => `${s === du ? "" : wild ? "Das wilde " : `${gegnerName}s `}${ART[aktivVon(kampf[s]).art].name}`;

  async function spielen(zug: Zug) {
    setMenue("warte");
    setText(zug.art === "aufgeben" ? "Du gibst auf …" : warteText ?? "…");
    let runde;
    try { runde = await zieh(k, zug); } catch { setText("Verbindung weg – versuch es nochmal."); setMenue("haupt"); return; }
    merke?.(runde.kampf);
    let a = k;
    for (const e of runde.ereignisse) {
      const vorher = a;
      a = anwenden(a, e);
      const b = buehne.current;
      if (e.typ === "angriff") {
        const at = ATTACKEN[e.attacke];
        setText(`${name(e.seite, vorher)} setzt ${at.name} ein!`);
        const d = b?.angriff(bs(e.seite), at.element) ?? 0.6;
        await warte(Math.min(1.6, d * 0.7));
        if (!e.verfehlt) b?.treffer(bs(e.seite === "a" ? "b" : "a"));
        setAnzeige(a);
        const zusatz = e.verfehlt ? "Daneben!" : e.faktor >= 2 ? "Das ist sehr effektiv!" : e.faktor < 1 ? "Das ist nicht sehr effektiv …" : e.kritisch ? "Volltreffer!" : "";
        if (zusatz) { setText(zusatz); await warte(0.9); } else await warte(0.4);
      } else if (e.typ === "heilung") {
        setText(`${name(e.seite, vorher)} setzt ${ATTACKEN[e.attacke].name} ein und heilt ${e.menge} KP.`);
        b?.angriff(bs(e.seite), "heilung");
        setAnzeige(a); await warte(1.4);
      } else if (e.typ === "trank") {
        setText(`Kräutertrank: +${e.menge} KP.`); setAnzeige(a); await warte(1);
      } else if (e.typ === "ko") {
        setText(`${name(e.seite, vorher)} ist erschöpft!`);
        b?.ko(bs(e.seite)); await warte(1.6);
      } else if (e.typ === "wechsel") {
        setAnzeige(a);
        setText(e.seite === du ? `Los, ${ART[aktivVon(a[du]).art].name}!` : `${gegnerName} schickt ${ART[aktivVon(a[er]).art].name}.`);
        await warte(1);
      } else if (e.typ === "kaefig") {
        setText("Du wirfst den Käfig!");
        const d = b?.kaefig(e.wackeln, e.gefangen) ?? 1;
        await warte(d);
        setText(e.gefangen ? `Geschafft! ${ART[aktivVon(a[er]).art].name} ist im Käfig.` : ["Oh nein, es ist sofort ausgebrochen!", "Fast! Es hat sich befreit.", "So knapp! Das Gitter hat nachgegeben."][Math.min(2, e.wackeln)]);
        await warte(1.2);
      } else if (e.typ === "flucht") {
        setText(e.ok ? "Du bist entkommen." : "Flucht misslungen!"); await warte(1);
      } else if (e.typ === "aufgabe") {
        setText(e.seite === du ? "Du hast aufgegeben." : `${gegnerName} gibt auf!`); await warte(1);
      } else if (e.typ === "ende") {
        if (e.sieger === du && !e.geflohen) b?.jubel("a");
      }
    }
    setK(runde.kampf); setAnzeige(runde.kampf);
    if (runde.kampf.ende) { await warte(0.6); fertig(runde.kampf); return; }
    // eigenes Elemon erschöpft und kein automatischer Ersatz da? (kommt nicht vor: K.o. holt das nächste)
    setMenue("haupt");
    setText(`Was soll ${ART[aktivVon(runde.kampf[du]).art].name} tun?`);
  }

  const mein = aktivVon(k[du]);
  const t = tasche ?? null;
  const nimm = (was: keyof Tasche) => verbrauche?.(was);

  return (
    <div className="flex flex-col h-full">
      <div className="relative h-52 shrink-0 overflow-hidden rounded-b-2xl">
        <Suspense fallback={<div className="w-full h-full" style={{ background: farbe }} />}>
          <Buehne links={`${aktivVon(anzeige[du]).art}#${anzeige[du].aktiv}`} rechts={`${aktivVon(anzeige[er]).art}#${anzeige[er].aktiv}`} farbe={farbe} steuerung={buehne} />
        </Suspense>
        <div className="absolute top-2 left-2"><Leiste kampf={anzeige} seite={er} gegner /></div>
        <div className="absolute bottom-2 right-2"><Leiste kampf={anzeige} seite={du} gegner={false} /></div>
      </div>
      <div className="p-2 text-sm min-h-12 font-medium" aria-live="polite">{text}</div>
      <div className="p-2 pt-0">
        {menue === "warte" && <div className="text-xs text-muted text-center py-3">…</div>}
        {menue === "haupt" && (
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-primary" onClick={() => setMenue("angriff")}>⚔️ Angriff</button>
            <button className="btn-secondary" onClick={() => setMenue("team")}>🐾 Team</button>
            {t ? <button className="btn-secondary" onClick={() => setMenue("tasche")}>🎒 Tasche</button> : <span />}
            {wild
              ? <button className="btn-secondary" onClick={() => spielen({ art: "flucht" })}>🏃 Flucht</button>
              : <button className="btn-secondary" onClick={() => spielen({ art: "aufgeben" })}>🏳️ Aufgeben</button>}
          </div>
        )}
        {menue === "angriff" && (
          <div className="grid grid-cols-2 gap-2">
            {mein.attacken.map((id, nr) => {
              const at = ATTACKEN[id];
              return (
                <button key={id} className="btn-secondary text-left text-xs py-2" onClick={() => spielen({ art: "angriff", nr })}>
                  <div className="font-bold">{at.element ? elementInfo(at.element).icon : "💥"} {at.name}</div>
                  <div className="text-[10px] text-muted">{at.heilt ? `heilt ${Math.round(at.heilt * 100)} %` : `Stärke ${at.staerke}`} · {at.genau} %</div>
                </button>
              );
            })}
            <button className="text-xs underline text-muted col-span-2" onClick={() => setMenue("haupt")}>zurück</button>
          </div>
        )}
        {menue === "team" && (
          <div className="flex flex-col gap-1">
            {k[du].team.map((e, nr) => (
              <button key={nr} disabled={!lebt(e) || nr === k[du].aktiv} onClick={() => spielen({ art: "wechsel", nr })}
                className="card px-2 py-1 text-left text-xs flex justify-between disabled:opacity-40">
                <span>{ART[e.art].emoji} {ART[e.art].name} · Lv {e.stufe}</span><span className="tabular-nums">{e.kp}/{maxKp(e)} KP</span>
              </button>
            ))}
            <button className="text-xs underline text-muted" onClick={() => setMenue("haupt")}>zurück</button>
          </div>
        )}
        {menue === "tasche" && t && (
          <div className="flex flex-col gap-1">
            <button className="btn-secondary text-xs" disabled={t.traenke <= 0 || mein.kp >= maxKp(mein)} onClick={() => { nimm("traenke"); spielen({ art: "trank" }); }}>🧪 Kräutertrank (+25 KP) · {t.traenke}×</button>
            {wild && <button className="btn-secondary text-xs" disabled={t.kaefige <= 0} onClick={() => { nimm("kaefige"); spielen({ art: "kaefig" }); }}>⛓️ Käfig · {t.kaefige}×</button>}
            {wild && <button className="btn-secondary text-xs" disabled={t.goldkaefige <= 0} onClick={() => { nimm("goldkaefige"); spielen({ art: "kaefig", gold: true }); }}>✨ Goldkäfig (hält doppelt) · {t.goldkaefige}×</button>}
            {!wild && <p className="text-[10px] text-muted">Elemon von Trainer·innen kann man nicht einsperren.</p>}
            <button className="text-xs underline text-muted" onClick={() => setMenue("haupt")}>zurück</button>
          </div>
        )}
      </div>
    </div>
  );
}
