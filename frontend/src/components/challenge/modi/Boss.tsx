"use client";
/** Bosskampf: erst Fakten sammeln, dann kontert die Figur die Angriffe des Bosses mit Fakten aus dem Inventar. */
import { useEffect, useState } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import { PixelMatrix } from "@/components/challenge/pixel/Matrix";
import type { ModusProps } from "./typen";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import { skinVon } from "./boss/figuren";
import Sammeln from "./boss/Sammeln";
import { Szene, type Anim, type Zahl } from "./boss/Szene";
import { bossSeed } from "@/lib/challenge/bossKarte";

export default function Boss({ brett, theme, skin, lauf, zurKarte }: ModusProps) {
  const sk = skinVon(skin);
  const [phase, setPhase] = useState<"sammeln" | "arena">(brett.fakten.length ? "sammeln" : "arena");
  const [gefunden, setGefunden] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [heldAnim, setHeldAnim] = useState<Anim>(null);
  const [gegnerAnim, setGegnerAnim] = useState<Anim>(null);
  const [zahlen, setZahlen] = useState<Zahl[]>([]);
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
    if (!zahlen.length) return;
    const t = setTimeout(() => setZahlen([]), 900);
    return () => clearTimeout(t);
  }, [zahlen]);

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
      const n = Date.now();
      if (r.treffer) {
        setHeldAnim({ art: "lunge", n }); setGegnerAnim({ art: "treffer", n });
        if (r.schaden > 0) setZahlen([{ id: n, wert: r.schaden }]);
      } else setGegnerAnim({ art: "wackel", n });
      setAntwort(r.etappe_geschafft || r.zurueck_zur_karte || r.fertig ? null : r);
    } catch {
      setGegnerAnim({ art: "wackel", n: Date.now() }); // z. B. 409: das Brett ist schon neu geladen
    } finally {
      setAblage([]); setTipp(false); setSende(false);
    }
  };

  const bg = theme.farben.himmel === "transparent" ? undefined : theme.farben.himmel;
  const boden = theme.farben.boden === "transparent" ? "#6b7a5a" : theme.farben.boden;

  return (
    <>
      <div className="flex items-center justify-between">
        <Herzen leben={brett.leben} />
        <strong>{sk.titel}</strong>
        <button className="btn-secondary" onClick={zurKarte}>Karte</button>
      </div>

      {phase === "sammeln" ? (
        <Sammeln fakten={brett.fakten} theme={theme} seed={bossSeed(brett.etappe, brett.fakten.length)} gefunden={gefunden} setGefunden={setGefunden} weiter={() => setPhase("arena")} />
      ) : (
        <>
          <Treffermeldung antwort={antwort} />
          <Szene introText={sk.intro} himmel={bg} boden={boden === "#6b7a5a" ? undefined : boden}
            held={<PixelMatrix bild={sk.held.bild} palette={sk.held.palette} scale={6} label={sk.held.name} />}
            gegner={<div style={{ transform: "scaleX(-1)" }}><PixelMatrix bild={sk.boss.bild} palette={sk.boss.palette} scale={7} label={sk.boss.name} /></div>}
            heldName={sk.held.name} gegnerName={sk.boss.name} hp={hp} hpMax={max}
            heldAnim={heldAnim} gegnerAnim={offene.length === 0 ? { art: "weg", n: -1 } : gegnerAnim} zahlen={zahlen}>
            {aktiv ? (
              <div aria-live="polite">
                <strong className="text-sm">{sk.angriff} ({"⚔️".repeat(Math.min(5, aktiv.strength))}):</strong>
                <div><Inhalt x={aktiv} /></div>
              </div>
            ) : <p className="font-bold text-good">{sk.sieg}</p>}
          </Szene>

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
