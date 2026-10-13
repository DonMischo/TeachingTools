"use client";
/** Bosskampf: erst Fakten sammeln, dann kontert die Figur die Angriffe des Bosses mit Fakten aus dem Inventar. */
import { useEffect, useState } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import { PixelMatrix } from "@/components/challenge/pixel/Matrix";
import type { ModusProps } from "./typen";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import { skinVon } from "./boss/figuren";
import Sammeln from "./boss/Sammeln";

const CSS = `@keyframes bosswackel{0%,100%{transform:translateX(0)}25%{transform:translateX(-10px)}75%{transform:translateX(10px)}}
@keyframes bossblitz{0%{opacity:.9}100%{opacity:0}}
.boss-wackel{animation:bosswackel .5s}.boss-blitz{animation:bossblitz .6s forwards}
@media (prefers-reduced-motion: reduce){.boss-wackel,.boss-blitz{animation:none!important}}`;

export default function Boss({ brett, theme, skin, lauf, zurKarte }: ModusProps) {
  const sk = skinVon(skin);
  const [phase, setPhase] = useState<"sammeln" | "arena">(brett.fakten.length ? "sammeln" : "arena");
  const [gefunden, setGefunden] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [anim, setAnim] = useState<{ art: "treffer" | "daneben" | "teil"; n: number } | null>(null);
  const [schaden, setSchaden] = useState(0);
  const [sende, setSende] = useState(false);

  const offene = brett.challenges.filter((c) => !c.erledigt);
  const aktiv = offene.length ? offene[idx % offene.length] : null;
  const inventar = brett.fakten.filter((f) => gefunden.includes(f.id));
  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));

  const max = brett.challenges.reduce((s, c) => s + c.strength * 15, 0);
  const erledigt = brett.challenges.reduce((s, c) => s + (c.erledigt ? c.strength * 10 : 0), 0);
  const hp = offene.length === 0 ? 0 : Math.max(1, max - Math.max(schaden, erledigt));

  useEffect(() => { if (phase === "arena" && aktiv) lauf.waehle(aktiv.id); }, [phase, aktiv?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!anim) return;
    const t = setTimeout(() => setAnim(null), 900);
    return () => clearTimeout(t);
  }, [anim]);

  const legeAuf = (id: string) => {
    if (!aktiv || ablage.includes(id) || !fakten.has(id)) return;
    lauf.gelegt();
    setAblage([...ablage, id]);
  };
  const kontern = async () => {
    if (!aktiv || !ablage.length || sende) return;
    setSende(true);
    try {
      const r = await lauf.antworte(aktiv.id, ablage, tipp);
      setSchaden((s) => s + r.schaden);
      setAnim({ art: r.komplett ? "treffer" : r.treffer ? "teil" : "daneben", n: Date.now() });
      setAntwort(r.etappe_geschafft || r.zurueck_zur_karte || r.fertig ? null : r);
    } catch {
      setAnim({ art: "daneben", n: Date.now() }); // z. B. 409: das Brett ist schon neu geladen
    } finally {
      setAblage([]); setTipp(false); setSende(false);
    }
  };

  const bg = theme.farben.himmel === "transparent" ? undefined : theme.farben.himmel;
  const boden = theme.farben.boden === "transparent" ? "#6b7a5a" : theme.farben.boden;

  return (
    <>
      <style>{CSS}</style>
      <div className="flex items-center justify-between">
        <Herzen leben={brett.leben} />
        <strong>{sk.titel}</strong>
        <button className="btn-secondary" onClick={zurKarte}>Karte</button>
      </div>

      {phase === "sammeln" ? (
        <Sammeln fakten={brett.fakten} theme={theme} gefunden={gefunden} setGefunden={setGefunden} weiter={() => setPhase("arena")} />
      ) : (
        <>
          <Treffermeldung antwort={antwort} />
          <div className="relative rounded-lg overflow-hidden p-3 flex flex-col gap-3" style={{ background: bg, color: theme.farben.text === "inherit" ? undefined : theme.farben.text }}>
            {anim?.art === "treffer" && <div key={anim.n} className="boss-blitz absolute inset-0 bg-white pointer-events-none" />}
            {aktiv && (
              <div className="card p-3 self-end max-w-[90%]" aria-live="polite">
                <strong className="text-sm">{sk.angriff} ({"⚔️".repeat(Math.min(5, aktiv.strength))}):</strong>
                <div><Inhalt x={aktiv} /></div>
              </div>
            )}
            <div className="flex items-end justify-between gap-2">
              <div role="img" aria-label={sk.held.name}><PixelMatrix bild={sk.held.bild} palette={sk.held.palette} scale={6} /></div>
              <div className="flex flex-col items-center gap-1">
                <div role="progressbar" aria-label="Lebensbalken des Gegners" aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp}
                  className="w-32 h-3 rounded bg-black/30 overflow-hidden">
                  <div className="h-full bg-bad" style={{ width: `${max ? (hp / max) * 100 : 0}%` }} />
                </div>
                <div key={anim?.art === "daneben" ? anim.n : "b"} className={anim?.art === "daneben" ? "boss-wackel" : ""}>
                  <div style={{ transform: "scaleX(-1)" }} role="img" aria-label={sk.boss.name}>
                    <PixelMatrix bild={sk.boss.bild} palette={sk.boss.palette} scale={7} />
                  </div>
                </div>
              </div>
            </div>
            <div className="h-3 -mx-3 -mb-3" style={{ background: boden }} />
          </div>

          {offene.length === 0 && <p className="card p-3 font-bold text-good">{sk.sieg}</p>}
          {aktiv && (
            <div className="card p-3 flex flex-col gap-2">
              <Ablage karten={ablage.map((id) => fakten.get(id)!)} onLege={legeAuf} onNimm={(id) => setAblage(ablage.filter((x) => x !== id))} leer="Lege hier die Fakten ab, mit denen du kontern willst." />
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" disabled={!ablage.length || sende} onClick={kontern}>{sk.kontern}</button>
                {offene.length > 1 && <button className="btn-secondary" onClick={() => { setIdx(idx + 1); setAblage([]); setTipp(false); setAntwort(null); }}>Anderer {sk.angriff}</button>}
                {aktiv.tip && (tipp ? <span className="text-muted self-center">💡 {aktiv.tip}</span> : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
              </div>
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2" aria-label="Inventar">
            {inventar.filter((f) => !ablage.includes(f.id)).map((f) => (
              <FaktKarte key={f.id} fakt={f} disabled={!aktiv} onClick={() => legeAuf(f.id)} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
