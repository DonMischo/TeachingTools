"use client";
/** Alchemieküche: Zutaten im Garten pflücken, dann Fakten als Zutaten in den Kessel legen und brauen. */
import { useEffect, useState } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import { PixelMatrix } from "@/components/challenge/pixel/Matrix";
import type { ModusProps } from "./typen";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import Garten from "./alchemie/Garten";

const spiegel = (halb: string[]) => halb.map((z) => z + [...z].reverse().join(""));
const KESSEL = spiegel(["..kkkkk", ".klllll", "kcccccc", "kcccccc", "kcccccc", ".kccccc", "..kkkkk", "..kk..k"]);
const TRANK = spiegel(["..kkk", "...kw", "...kw", "..kww", ".kwll", ".klll", "kllll", "kllll", ".kkkk"]);

type Ergebnis = "kombo" | "komplett" | "teil" | "daneben";
const FLUESSIG: Record<Ergebnis | "ruhig", string> = { ruhig: "#4fd36a", komplett: "#ffd84a", kombo: "#ff6bd6", teil: "#8a8a6a", daneben: "#33333a" };
const CSS = `@keyframes alchblase{0%{transform:translateY(0);opacity:.9}100%{transform:translateY(-40px);opacity:0}}
@keyframes alchpuff{0%{transform:scale(.4);opacity:1}100%{transform:scale(2.2);opacity:0}}
@keyframes alchregen{to{filter:hue-rotate(360deg)}}
.alch-blase{animation:alchblase 1.6s infinite}.alch-puff{animation:alchpuff 1s forwards}.alch-regen{animation:alchregen 2s linear infinite}
@media (prefers-reduced-motion: reduce){.alch-blase,.alch-puff,.alch-regen{animation:none!important}}`;

function Alchemist() {
  const [i, setI] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n % 4) + 1), 250);
    return () => clearInterval(t);
  }, []);
  return <img src={`/challenge/pixel/npcs/alchemist_idle_${i}.png`} alt="Alchemist" width={96} height={96} draggable={false} style={{ imageRendering: "pixelated" }} />;
}

export default function Alchemie({ brett, theme, lauf, zurKarte }: ModusProps) {
  const [phase, setPhase] = useState<"garten" | "kueche">(brett.fakten.length ? "garten" : "kueche");
  const [gefunden, setGefunden] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [ergebnis, setErgebnis] = useState<{ art: Ergebnis; n: number } | null>(null);
  const [sende, setSende] = useState(false);

  const offene = brett.challenges.filter((c) => !c.erledigt);
  const aktiv = offene.length ? offene[idx % offene.length] : null;
  const zutaten = brett.fakten.filter((f) => gefunden.includes(f.id));
  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));

  useEffect(() => { if (phase === "kueche" && aktiv) lauf.waehle(aktiv.id); }, [phase, aktiv?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ergebnis) return;
    const t = setTimeout(() => setErgebnis(null), 2500);
    return () => clearTimeout(t);
  }, [ergebnis]);

  const blaettern = (d: number) => {
    setIdx((offene.length + (idx % offene.length) + d) % offene.length);
    setAblage([]); setTipp(false); setAntwort(null);
  };
  const legeAuf = (id: string) => {
    if (!aktiv || ablage.includes(id) || !fakten.has(id)) return;
    lauf.gelegt();
    setAblage([...ablage, id]);
  };
  const brauen = async () => {
    if (!aktiv || !ablage.length || sende) return;
    setSende(true);
    try {
      const r = await lauf.antworte(aktiv.id, ablage, tipp);
      setErgebnis({ art: r.komplett ? (r.kombo ? "kombo" : "komplett") : r.treffer ? "teil" : "daneben", n: Date.now() });
      setAntwort(r.etappe_geschafft || r.zurueck_zur_karte || r.fertig ? null : r);
    } catch {
      setErgebnis({ art: "daneben", n: Date.now() }); // z. B. 409: das Brett ist schon neu geladen
    } finally {
      setAblage([]); setTipp(false); setSende(false);
    }
  };

  const farbe = FLUESSIG[ergebnis?.art ?? "ruhig"];
  const bg = theme.farben.himmel === "transparent" ? undefined : theme.farben.himmel;

  return (
    <>
      <style>{CSS}</style>
      <div className="flex items-center justify-between">
        <Herzen leben={brett.leben} />
        <strong>Alchemieküche</strong>
        <button className="btn-secondary" onClick={zurKarte}>Karte</button>
      </div>

      {phase === "garten" ? (
        <Garten fakten={brett.fakten} theme={theme} gefunden={gefunden} setGefunden={setGefunden} weiter={() => setPhase("kueche")} />
      ) : (
        <>
          <Treffermeldung antwort={antwort} />
          {offene.length === 0 && <p className="card p-3 font-bold text-good">Alle Tränke sind gebraut!</p>}
          {aktiv && (
            <div className="card p-3 flex items-start gap-2" aria-label="Rezeptbuch">
              <button className="btn-secondary" aria-label="Voriges Rezept" disabled={offene.length < 2} onClick={() => blaettern(-1)}>◀</button>
              <div className="flex-1 text-center">
                <div className="text-sm text-muted">📖 Rezept {(idx % offene.length) + 1} von {offene.length}</div>
                <Inhalt x={aktiv} />
              </div>
              <button className="btn-secondary" aria-label="Nächstes Rezept" disabled={offene.length < 2} onClick={() => blaettern(1)}>▶</button>
            </div>
          )}

          <div className="relative rounded-lg p-3 flex items-end justify-around gap-2 overflow-hidden" style={{ background: bg, color: theme.farben.text === "inherit" ? undefined : theme.farben.text }}>
            <Alchemist />
            <div className="relative flex flex-col items-center">
              {ablage.length > 0 && !ergebnis && [0, 1, 2].map((b) => (
                <span key={b} className="alch-blase absolute top-0 w-2 h-2 rounded-full bg-white/80" style={{ left: 20 + b * 22, animationDelay: `${b * 0.5}s` }} />
              ))}
              <div role="img" aria-label="Kessel">
                <PixelMatrix bild={KESSEL} palette={{ k: "#1d1a24", c: "#3b3744", l: farbe }} scale={8} />
              </div>
              {ergebnis?.art === "daneben" && <span key={ergebnis.n} className="alch-puff absolute top-0 text-5xl" aria-hidden>💨</span>}
            </div>
            <div className={ergebnis?.art === "kombo" ? "alch-regen" : ""} style={{ filter: ergebnis && (ergebnis.art === "komplett" || ergebnis.art === "kombo") ? `drop-shadow(0 0 10px ${farbe})` : undefined }}>
              {ergebnis && ergebnis.art !== "daneben"
                ? <div role="img" aria-label="Trank"><PixelMatrix bild={TRANK} palette={{ k: "#1d1a24", w: "#dfeaf3", l: farbe }} scale={6} /></div>
                : <span className="inline-block w-12" />}
            </div>
          </div>
          {ergebnis && (
            <p className="font-bold" role="status">
              {{ kombo: "Regenbogen-Trank! Kombo!", komplett: "Der Trank leuchtet!", teil: "Der Trank ist trüb …", daneben: "Puff! Daneben." }[ergebnis.art]}
            </p>
          )}

          {aktiv && (
            <div className="card p-3 flex flex-col gap-2">
              <Ablage karten={ablage.map((id) => fakten.get(id)!)} onLege={legeAuf} onNimm={(id) => setAblage(ablage.filter((x) => x !== id))} leer="Lege Zutaten in den Kessel." />
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" disabled={!ablage.length || sende} onClick={brauen}>Brauen</button>
                {aktiv.tip && (tipp ? <span className="text-muted self-center">💡 {aktiv.tip}</span> : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
              </div>
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2" aria-label="Zutatenregal">
            {zutaten.filter((f) => !ablage.includes(f.id)).map((f) => (
              <FaktKarte key={f.id} fakt={f} disabled={!aktiv} onClick={() => legeAuf(f.id)} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
