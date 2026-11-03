"use client";
/**
 * Trankladen: Zutaten im Heckenlabyrinth sammeln, dann bestellen Kunden Tränke (= offene Challenges).
 * Zutaten in die Suppe im Kessel (jede färbt sie), rühren (kosmetisch), »Abfüllen« = antworte.
 */
import { useEffect, useState } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import { useSpielwert } from "@/lib/challenge/useSpielwert";
import { useAblage } from "@/lib/challenge/useAblage";
import Papierkorb, { WegKnopf } from "@/components/challenge/Papierkorb";
import Bestenliste from "@/components/challenge/Bestenliste";
import type { ModusProps } from "./typen";
import { Ablage, Herzen, Frage, Inhalt, Treffermeldung } from "./teile";
import Garten from "./alchemie/Garten";
import Kessel, { braufarbe, Flasche, SUPPE_STAND } from "./alchemie/Kessel";
import Figur, { KUNDENARTEN, type Kundenart, type Stimmung } from "./alchemie/Figuren";
import Regal, { type Trank } from "./alchemie/Regal";

type Ergebnis = "kombo" | "komplett" | "teil" | "daneben";
const kundeVon = (id: string): Kundenart => KUNDENARTEN[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % KUNDENARTEN.length];
const CSS = `@keyframes alchblase{0%{transform:translateY(0);opacity:.9}100%{transform:translateY(-40px);opacity:0}}
@keyframes alchpuff{0%{transform:translateX(-50%) scale(.4);opacity:1}100%{transform:translateX(-50%) scale(2.2);opacity:0}}
@keyframes alchregen{to{filter:hue-rotate(360deg)}}
@keyframes alchwackel{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes alchfunkel{0%,100%{opacity:.2;transform:scale(.6)}50%{opacity:1;transform:scale(1.2)}}
.alch-blase{animation:alchblase 1.6s infinite}.alch-puff{animation:alchpuff 1s forwards}.alch-regen{animation:alchregen 2s linear infinite}
.alch-wackel{animation:alchwackel .25s 4}.alch-funkel{animation:alchfunkel 1.2s infinite}
@keyframes alchwippe{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes alchflug{0%{transform:translateY(-60px) scale(.6);opacity:0}100%{transform:none;opacity:1}}
@keyframes alchtropf{0%{transform:translateY(0) scaleY(.5);opacity:1}100%{transform:translateY(120px) scaleY(1.4);opacity:0}}
.alch-wippe{animation:alchwippe 2.4s ease-in-out infinite}.alch-flug{animation:alchflug .7s ease-out}.alch-tropf{animation:alchtropf 1.1s ease-in infinite}
@media (prefers-reduced-motion: reduce){.alch-wippe,.alch-flug,.alch-tropf,.alch-blase,.alch-puff,.alch-regen,.alch-wackel,.alch-funkel{animation:none!important}}`;

function Kunde({ art, stimmung = "neutral" }: { art: Kundenart; stimmung?: Stimmung }) {
  return (
    <span className="relative inline-block">
      <Figur art={art} stimmung={stimmung} etikett="Kunde" />
      {stimmung === "froh" && <span className="absolute -top-1 right-0 text-2xl" aria-hidden>😊</span>}
    </span>
  );
}

export default function Alchemie({ brett, theme, lauf, zurKarte }: ModusProps) {
  const korb = useAblage(brett.etappe);
  const [phase, setPhase] = useState<"garten" | "laden">(brett.fakten.length ? "garten" : "laden");
  const [gefunden, setGefunden] = useState<string[]>([]);
  const [wahl, setWahl] = useState<string | null>(null);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [ergebnis, setErgebnis] = useState<{ art: Ergebnis; n: number; farbe?: string } | null>(null);
  const [ruehr, setRuehr] = useState(0);
  const [sende, setSende] = useState(false);
  const [gold, setGold] = useState(0);
  const [regal, setRegal] = useState<Trank[]>([]);
  const [geht, setGeht] = useState<{ kunde: Kundenart; n: number; gold: number } | null>(null);
  const [zufluss, setZufluss] = useState<{ id: number; groesse: number; teilchen: number } | null>(null);

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
    if (!aktiv || ablage.includes(id) || korb.istWeg(id) || !fakten.has(id)) return;
    lauf.gelegt();
    setAblage([...ablage, id]);
    setZufluss((z) => ({ id: (z?.id ?? 0) + 1, groesse: 0.8, teilchen: 40 }));
  };
  const fuelleAb = async () => {
    if (!aktiv || !ablage.length || sende) return;
    setSende(true);
    const farbe = braufarbe(ablage, ruehr);
    const kunde = kundeVon(aktiv.id);
    const stark = aktiv.strength;
    try {
      const r = await lauf.antworte(aktiv.id, ablage, tipp);
      const art: Ergebnis = r.komplett ? (r.kombo ? "kombo" : "komplett") : r.treffer ? "teil" : "daneben";
      setErgebnis({ art, n: Date.now(), farbe });
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

  // Nach dem Abfüllen zeigt Kessel und Flasche das Gebräu, nicht die schon geleerte Suppe
  const farbe = ergebnis?.art === "teil" ? "#8a8a6a" : ergebnis?.farbe ?? braufarbe(ablage, ruehr);
  const bg = theme.farben.himmel === "transparent" ? undefined : theme.farben.himmel;
  const kunden = offene.slice(0, 3);
  const fuell = ergebnis?.art === "daneben" ? 1 : ergebnis ? SUPPE_STAND : Math.min(0.9, SUPPE_STAND + ablage.length * 0.1);
  const wirbel = ergebnis ? { kombo: 1, komplett: 0.9, teil: 0.5, daneben: 0.8 }[ergebnis.art] : ablage.length ? 0.15 : 0;

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
          gefunden={gefunden} setGefunden={setGefunden} weiter={() => setPhase("laden")} onWegwerfen={korb.wegwerfen} />
      ) : (
        <>
          <Treffermeldung antwort={antwort} />
          {offene.length === 0 && <p className="card p-3 font-bold text-good">Alle Bestellungen sind abgefüllt!</p>}
          <div className="rounded-lg p-3 flex flex-col gap-3 overflow-hidden" style={{ background: bg ? `radial-gradient(ellipse at 50% 0%, #ffe9b855, transparent 60%), ${bg}` : undefined, boxShadow: "inset 0 -12px 24px rgba(60,30,0,.25)", color: theme.farben.text === "inherit" ? undefined : theme.farben.text }}>
            <div className="flex flex-wrap items-end gap-3" aria-label="Kundschaft">
              {kunden.map((c) => {
                const ist = aktiv?.id === c.id;
                return (
                  <div key={c.id} className="flex flex-col items-center gap-1 max-w-[16rem]">
                    <button type="button" aria-pressed={ist} onClick={() => waehleKunde(c.id)}
                      className={`card p-2 text-left text-sm relative ${ist ? "ring-2 ring-accent" : "opacity-80"}`}>
                      <span className="block text-xs text-muted">Bestellung{ist ? "" : " (antippen)"}</span>
                      {ist ? <Frage x={c} icon="🧾" /> : <span>…</span>}
                    </button>
                    <Kunde art={kundeVon(c.id)} stimmung={ist && (ergebnis?.art === "daneben" || ergebnis?.art === "teil") ? "unmutig" : "neutral"} />
                  </div>
                );
              })}
              {geht && (
                <div key={geht.n} className="flex flex-col items-center" role="status">
                  <span className="text-sm font-bold">+{geht.gold} 🪙</span>
                  <Kunde art={geht.kunde} stimmung="froh" />
                </div>
              )}
            </div>
            <div className="flex items-end justify-around gap-2 flex-wrap">
              <Kessel farbe={farbe} setRuehr={setRuehr} zufluss={zufluss} blubbert={ablage.length > 0 && !ergebnis} ueberlauf={ergebnis?.art === "daneben"}
                fuellstand={fuell} wirbel={wirbel} regenbogen={ergebnis?.art === "kombo"} />
              <div className="min-w-16" style={{ filter: ergebnis && (ergebnis.art === "komplett" || ergebnis.art === "kombo") ? `drop-shadow(0 0 10px ${farbe})` : undefined }}>
                {ergebnis && ergebnis.art !== "daneben" && <Flasche farbe={farbe} regenbogen={ergebnis.art === "kombo"} wirbel={0.3} />}
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
          <div className="rounded-lg p-3" aria-label="Zutatenregal" style={{ background: "linear-gradient(#6b4524,#432a14)", boxShadow: "inset 0 2px 8px rgba(0,0,0,.5)" }}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-3 pb-2" style={{ borderBottom: "8px solid #8a5d33", boxShadow: "0 6px 6px -4px rgba(0,0,0,.5)" }}>
              {zutaten.filter((f) => !ablage.includes(f.id) && !korb.istWeg(f.id)).map((f) => (
                <div key={f.id} className="flex flex-col gap-1">
                <button draggable={!!aktiv} disabled={!aktiv} onClick={() => legeAuf(f.id)}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", f.id)}
                  className="relative text-left text-sm p-2 pt-4 rounded-b-2xl rounded-t-md disabled:opacity-85 text-[#2b1d10] transition-transform hover:-translate-y-0.5"
                  style={{ background: "linear-gradient(135deg, rgba(255,250,235,.92), rgba(222,236,240,.82))", border: "2px solid rgba(255,255,255,.7)", boxShadow: "0 4px 6px rgba(0,0,0,.4), inset 0 0 10px rgba(255,255,255,.5)" }}>
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-3 rounded-sm" style={{ background: "linear-gradient(#b98650,#8a5d33)" }} aria-hidden />
                  <Inhalt x={f} />
                </button>
                <WegKnopf fakt={f} onClick={() => korb.wegwerfen(f.id)} />
                </div>
              ))}
            </div>
          </div>
          <Papierkorb weg={korb.weg} fakten={brett.fakten} onZurueck={korb.zurueckholen} />
          <Regal traenke={regal} />
          {lauf.hatBestenliste && <Bestenliste laden={lauf.bestenliste} spiel="alchemie" />}
        </>
      )}
    </>
  );
}
