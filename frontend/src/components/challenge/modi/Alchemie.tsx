"use client";
/**
 * Trankladen: Zutaten im Heckenlabyrinth sammeln, dann bestellen Kunden Tränke (= offene Challenges).
 * Zutaten in den Kessel, rühren (kosmetisch), »Abfüllen« = antworte.
 */
import { useEffect, useState } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import { PixelMatrix } from "@/components/challenge/pixel/Matrix";
import Npc from "@/components/challenge/pixel/Npc";
import { useSpielwert } from "@/lib/challenge/useSpielwert";
import Bestenliste from "@/components/challenge/Bestenliste";
import type { ModusProps } from "./typen";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import Garten from "./alchemie/Garten";
import Kessel, { braufarbe, TRANK } from "./alchemie/Kessel";

type Ergebnis = "kombo" | "komplett" | "teil" | "daneben";
type Trank = { n: number; farbe: string; selten: boolean; trueb: boolean };
const KUNDEN = ["townsfolk_m", "townsfolk_f", "merchant", "mage", "king"];
const kundeVon = (id: string) => KUNDEN[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % KUNDEN.length];
const CSS = `@keyframes alchblase{0%{transform:translateY(0);opacity:.9}100%{transform:translateY(-40px);opacity:0}}
@keyframes alchpuff{0%{transform:translateX(-50%) scale(.4);opacity:1}100%{transform:translateX(-50%) scale(2.2);opacity:0}}
@keyframes alchregen{to{filter:hue-rotate(360deg)}}
@keyframes alchwackel{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes alchfunkel{0%,100%{opacity:.2;transform:scale(.6)}50%{opacity:1;transform:scale(1.2)}}
.alch-blase{animation:alchblase 1.6s infinite}.alch-puff{animation:alchpuff 1s forwards}.alch-regen{animation:alchregen 2s linear infinite}
.alch-wackel{animation:alchwackel .25s 4}.alch-funkel{animation:alchfunkel 1.2s infinite}
@media (prefers-reduced-motion: reduce){.alch-blase,.alch-puff,.alch-regen,.alch-wackel,.alch-funkel{animation:none!important}}`;

function Kunde({ name, froh }: { name: string; froh?: boolean }) {
  return (
    <span className="relative inline-block">
      <Npc name={name} scale={2.5} label="Kunde" />
      {froh && <span className="absolute -top-1 right-0 text-2xl" aria-hidden>😊</span>}
    </span>
  );
}

function Regalfach({ t }: { t: Trank }) {
  return (
    <span className={`relative inline-block ${t.selten ? "alch-regen" : ""}`} style={{ filter: t.selten ? "drop-shadow(0 0 6px #fff)" : undefined }}>
      <PixelMatrix bild={TRANK} palette={{ k: "#1d1a24", w: "#dfeaf3", l: t.trueb ? "#8a8a6a" : t.farbe }} scale={4} />
      {t.selten && <span className="alch-funkel absolute -top-1 -right-1 text-sm" aria-hidden>✨</span>}
    </span>
  );
}

export default function Alchemie({ brett, theme, lauf, zurKarte }: ModusProps) {
  const [phase, setPhase] = useState<"garten" | "laden">(brett.fakten.length ? "garten" : "laden");
  const [gefunden, setGefunden] = useState<string[]>([]);
  const [wahl, setWahl] = useState<string | null>(null);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [ergebnis, setErgebnis] = useState<{ art: Ergebnis; n: number } | null>(null);
  const [ruehr, setRuehr] = useState(0);
  const [sende, setSende] = useState(false);
  const [gold, setGold] = useState(0);
  const [regal, setRegal] = useState<Trank[]>([]);
  const [geht, setGeht] = useState<{ kunde: string; n: number; gold: number } | null>(null);

  const offene = brett.challenges.filter((c) => !c.erledigt);
  const aktiv = offene.find((c) => c.id === wahl) ?? offene[0] ?? null;
  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const zutaten = brett.fakten.filter((f) => gefunden.includes(f.id));
  const maxGold = brett.challenges.reduce((s, c) => s + c.strength * 15, 0);

  useEffect(() => { if (phase === "laden" && aktiv) lauf.waehle(); }, [phase, aktiv?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ergebnis) return;
    const t = setTimeout(() => setErgebnis(null), 2500);
    return () => clearTimeout(t);
  }, [ergebnis]);
  useEffect(() => {
    if (!geht) return;
    const t = setTimeout(() => setGeht(null), 3000);
    return () => clearTimeout(t);
  }, [geht]);

  useSpielwert(lauf, "alchemie", brett.etappe, gold, Math.max(gold, maxGold));

  const waehleKunde = (id: string) => { setWahl(id); setAblage([]); setTipp(false); setAntwort(null); };
  const legeAuf = (id: string) => {
    if (!aktiv || ablage.includes(id) || !fakten.has(id)) return;
    lauf.gelegt();
    setAblage([...ablage, id]);
  };
  const fuelleAb = async () => {
    if (!aktiv || !ablage.length || sende) return;
    setSende(true);
    const farbe = braufarbe(ruehr);
    const kunde = kundeVon(aktiv.id);
    const stark = aktiv.strength;
    try {
      const r = await lauf.antworte(aktiv.id, ablage, tipp);
      const art: Ergebnis = r.komplett ? (r.kombo ? "kombo" : "komplett") : r.treffer ? "teil" : "daneben";
      setErgebnis({ art, n: Date.now() });
      if (art !== "daneben") setRegal((g) => [...g, { n: Date.now(), farbe, selten: art === "kombo", trueb: art === "teil" }]);
      const verdient = art === "kombo" ? Math.round(stark * 15) : art === "komplett" ? stark * 10 : art === "teil" ? stark * 3 : 0;
      if (verdient) setGold((g) => g + verdient);
      if (art === "kombo" || art === "komplett") setGeht({ kunde, n: Date.now(), gold: verdient });
      setAntwort(r);
    } catch {
      setErgebnis({ art: "daneben", n: Date.now() }); // z. B. 409: das Brett ist schon neu geladen
    } finally {
      setAblage([]); setTipp(false); setSende(false); setRuehr(0); setWahl(null);
    }
  };

  const farbe = ergebnis?.art === "teil" ? "#8a8a6a" : braufarbe(ruehr);
  const bg = theme.farben.himmel === "transparent" ? undefined : theme.farben.himmel;
  const kunden = offene.slice(0, 3);

  return (
    <>
      <style>{CSS}</style>
      <div className="flex items-center justify-between">
        <Herzen leben={brett.leben} />
        <strong>Trankladen · 🪙 {gold}</strong>
        <button className="btn-secondary" onClick={zurKarte}>Karte</button>
      </div>

      {phase === "garten" ? (
        <Garten fakten={brett.fakten} theme={theme} seed={brett.etappe * 131 + brett.fakten.length} etappe={brett.etappe}
          gefunden={gefunden} setGefunden={setGefunden} weiter={() => setPhase("laden")} />
      ) : (
        <>
          <Treffermeldung antwort={antwort} />
          {offene.length === 0 && <p className="card p-3 font-bold text-good">Alle Bestellungen sind abgefüllt!</p>}
          <div className="rounded-lg p-3 flex flex-col gap-3 overflow-hidden" style={{ background: bg, color: theme.farben.text === "inherit" ? undefined : theme.farben.text }}>
            <div className="flex flex-wrap items-end gap-3" aria-label="Kundschaft">
              {kunden.map((c) => {
                const ist = aktiv?.id === c.id;
                return (
                  <div key={c.id} className="flex flex-col items-center gap-1 max-w-[16rem]">
                    <button type="button" aria-pressed={ist} onClick={() => waehleKunde(c.id)}
                      className={`card p-2 text-left text-sm relative ${ist ? "ring-2 ring-accent" : "opacity-80"}`}>
                      <span className="block text-xs text-muted">Bestellung{ist ? "" : " (antippen)"}</span>
                      {ist ? <Inhalt x={c} /> : <span>…</span>}
                    </button>
                    <Kunde name={kundeVon(c.id)} />
                  </div>
                );
              })}
              {geht && (
                <div key={geht.n} className="flex flex-col items-center" role="status">
                  <span className="text-sm font-bold">+{geht.gold} 🪙</span>
                  <Kunde name={geht.kunde} froh />
                </div>
              )}
            </div>
            <div className="flex items-end justify-around gap-2 flex-wrap">
              <Kessel farbe={farbe} ruehr={ruehr} setRuehr={setRuehr} blubbert={ablage.length > 0 && !ergebnis} ueberlauf={ergebnis?.art === "daneben"} />
              <div className={ergebnis?.art === "kombo" ? "alch-regen" : ""} style={{ filter: ergebnis && (ergebnis.art === "komplett" || ergebnis.art === "kombo") ? `drop-shadow(0 0 10px ${farbe})` : undefined }}>
                {ergebnis && ergebnis.art !== "daneben"
                  ? <div role="img" aria-label="Trank"><PixelMatrix bild={TRANK} palette={{ k: "#1d1a24", w: "#dfeaf3", l: farbe }} scale={6} /></div>
                  : <span className="inline-block w-12" />}
              </div>
            </div>
          </div>
          {ergebnis && (
            <p className="font-bold" role="status">
              {{ kombo: "Seltener Glitzertrank! Kombo!", komplett: "Der Kunde ist begeistert!", teil: "Der Trank ist trüb …", daneben: "Puff! Der Kessel läuft über. Daneben." }[ergebnis.art]}
            </p>
          )}

          {aktiv && (
            <div className="card p-3 flex flex-col gap-2">
              <Ablage karten={ablage.map((id) => fakten.get(id)!)} onLege={legeAuf} onNimm={(id) => setAblage(ablage.filter((x) => x !== id))} leer="Gib Zutaten in den Kessel." />
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" disabled={!ablage.length || sende} onClick={fuelleAb}>Abfüllen</button>
                {aktiv.tip && (tipp ? <span className="text-muted self-center">💡 {aktiv.tip}</span> : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
              </div>
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2" aria-label="Zutatenregal">
            {zutaten.filter((f) => !ablage.includes(f.id)).map((f) => (
              <FaktKarte key={f.id} fakt={f} disabled={!aktiv} onClick={() => legeAuf(f.id)} />
            ))}
          </div>
          <div className="card p-3" aria-label="Trankregal">
            <div className="text-sm text-muted">🧪 Trankregal ({regal.length})</div>
            <div className="flex flex-wrap gap-2 min-h-8">{regal.map((t) => <Regalfach key={t.n} t={t} />)}</div>
          </div>
          {lauf.hatBestenliste && <Bestenliste laden={lauf.bestenliste} spiel="alchemie" />}
        </>
      )}
    </>
  );
}
