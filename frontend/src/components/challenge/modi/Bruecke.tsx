"use client";
/** Brückenbau: Bretter (Fakten) am Ufer aufsammeln, dann je Lücke Bretter legen und bauen. */
import { useEffect, useState } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import type { ModusProps } from "./typen";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import { PixelMatrix } from "../pixel/Matrix";
import { Sprite } from "../pixel/Sprite";

const BRETT = ["..........", "bbbbbbbbbb", "bddbbddbbb", "dddddddddd", ".........."];
const PAL = { b: "#c28a4a", d: "#8a5a2b" };
const reduziert = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Bruecke({ brett, theme, lauf, zurKarte }: ModusProps) {
  const [gesammelt, setGesammelt] = useState<string[]>([]);
  const [gefunden, setGefunden] = useState<string | null>(null);
  const [alleDa, setAlleDa] = useState(false);
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [ablage, setAblage] = useState<string[]>([]);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [anim, setAnim] = useState<"ok" | "bruch" | null>(null);
  const [sende, setSende] = useState(false);

  useEffect(() => {
    if (reduziert()) { setAlleDa(true); return; }
    const t = setTimeout(() => setAlleDa(true), 20000);
    return () => clearTimeout(t);
  }, []);

  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const sammeln = gesammelt.length < brett.fakten.length;
  const challenge = brett.challenges.find((c) => c.id === aktiv && !c.erledigt);
  const offene = brett.challenges.filter((c) => !c.erledigt);

  const sammle = (id: string) => { setGesammelt((g) => (g.includes(id) ? g : [...g, id])); setGefunden(id); };
  const alles = () => { setGesammelt(brett.fakten.map((f) => f.id)); setGefunden(null); };
  const waehle = (c: string) => { setAktiv(c); setAblage([]); setAntwort(null); setAnim(null); lauf.waehle(c); };
  const legeAuf = (id: string) => {
    if (!challenge || ablage.includes(id) || !gesammelt.includes(id) || !fakten.has(id)) return;
    lauf.gelegt();
    setAblage([...ablage, id]);
  };

  const bauen = async () => {
    if (!challenge || !ablage.length || sende) return;
    setSende(true);
    try {
      const r = await lauf.antworte(challenge.id, ablage, false);
      setAnim(r.komplett ? "ok" : "bruch");
      setAktiv(null); setAblage([]);
      setAntwort(r.etappe_geschafft || r.zurueck_zur_karte || r.fertig ? null : r);
    } catch {
      setAktiv(null); setAblage([]);
    } finally {
      setSende(false);
    }
  };

  const Kopf = (
    <div className="flex items-center justify-between">
      <Herzen leben={brett.leben} />
      <button className="btn-secondary" onClick={zurKarte}>Karte</button>
    </div>
  );

  if (sammeln) {
    const gf = gefunden ? fakten.get(gefunden) : null;
    return (
      <>
        {Kopf}
        <h2 className="font-bold">Sammle Bretter am Ufer: {gesammelt.length} von {brett.fakten.length}</h2>
        <div className="flex flex-wrap gap-3 rounded-lg p-3" style={{ background: theme.farben.boden }}>
          {brett.fakten.map((f) => (
            <button key={f.id} aria-label="Brett aufsammeln" disabled={gesammelt.includes(f.id)} onClick={() => sammle(f.id)}
              className="disabled:opacity-20 focus-visible:outline outline-2 outline-offset-2">
              <PixelMatrix bild={BRETT} palette={PAL} scale={6} />
            </button>
          ))}
        </div>
        {gf && (
          <p className="card p-3" role="status">
            <b>Gefunden:</b> <Inhalt x={gf} />
            {gf.info && <span className="block text-muted mt-1">{gf.info.text}</span>}
          </p>
        )}
        {alleDa && <button className="btn-secondary self-start" onClick={alles}>Alles einsammeln</button>}
      </>
    );
  }

  const inventar = brett.fakten.filter((f) => gesammelt.includes(f.id) && !ablage.includes(f.id));
  return (
    <>
      {Kopf}
      <Treffermeldung antwort={antwort} />

      <div className="relative rounded-lg overflow-hidden p-3 flex items-end gap-1" style={{ background: theme.farben.himmel, minHeight: 140 }}>
        <div className="flex flex-col items-center" style={{ transition: "transform 1s", transform: anim === "ok" ? "translateX(24px)" : "none" }}>
          <Sprite src={theme.spieler.src} frame={theme.spieler.stehen} scale={3} />
          <div className="h-3 w-16" style={{ background: theme.farben.boden }} />
        </div>
        {offene.map((c) => (
          <button key={c.id} onClick={() => waehle(c.id)} aria-pressed={c.id === aktiv}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (c.id !== aktiv) waehle(c.id); legeAuf(e.dataTransfer.getData("text/plain")); }}
            className={`card p-2 text-left flex-1 min-w-24 self-start ${c.id === aktiv ? "border-accent" : ""}`}>
            <Inhalt x={c} />
            <span className={`block mt-2 h-3 border-b-4 border-dashed ${anim === "bruch" ? "border-bad" : "border-line"}`} />
          </button>
        ))}
      </div>

      {challenge && (
        <div className="card p-3 flex flex-col gap-2">
          <Ablage karten={ablage.map((id) => fakten.get(id)!)} onLege={legeAuf} onNimm={(id) => setAblage(ablage.filter((x) => x !== id))}
            leer="Lege Bretter in die Lücke." />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!ablage.length || sende} onClick={bauen}>Bauen</button>
            {challenge.tip && <span className="text-muted self-center">💡 {challenge.tip}</span>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
        {inventar.map((f) => <FaktKarte key={f.id} fakt={f} disabled={!challenge} onClick={() => legeAuf(f.id)} />)}
      </div>
    </>
  );
}
