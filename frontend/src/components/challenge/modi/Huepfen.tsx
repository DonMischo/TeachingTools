"use client";
/** Hüpfen: Jump'n'Run im Seitenlauf. Schlüssel (= Fakten) einsammeln, an einer Tür aufschließen (= antworten). */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChallengeAntwort, ChallengeFakt } from "@/lib/api";
import { Sprite } from "@/components/challenge/pixel/Sprite";
import { PixelMatrix } from "@/components/challenge/pixel/Matrix";
import {
  baueLevel, naheSchluessel, naheTuer, schritt, startSpieler, type Eingabe, type Spieler,
} from "@/lib/challenge/huepfen";
import type { ModusProps } from "./typen";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import { bodenKachel } from "@/lib/challenge/themes";

const SK = 3, KACHEL = 16 * SK; // Bildschirm-Pixel je Kachel

const SCHLUESSEL = ["..yyy...", ".y...y..", ".y...y..", "..yyy...", "...y....", "...yy...", "...y....", "...yy..."];
const TUER = ["..bbbbbb..", ".bbbbbbbb.", "bbddddddbb", "bbddddddbb", "bbddddddbb", "bbdddddybb", "bbddddddbb", "bbddddddbb", "bbddddddbb", "bbddddddbb"];
const PAL = { y: "#f5c518", b: "#5b3a1a", d: "#8b5a2b" };

const lesbar = (f: ChallengeFakt) => f.info?.text;

export default function Huepfen({ brett, theme, lauf, zurKarte }: ModusProps) {
  const level = useMemo(() => baueLevel(brett.etappe, brett.fakten.length, brett.challenges.length), [brett.etappe, brett.fakten.length, brett.challenges.length]);
  const [gesammelt, setGesammelt] = useState<string[]>([]);
  const [fund, setFund] = useState<ChallengeFakt | null>(null);
  const [tuer, setTuer] = useState<string | null>(null);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [sende, setSende] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [richtung, setRichtung] = useState<1 | -1>(1);
  const [skipDa, setSkipDa] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  const spieler = useRef<Spieler>(startSpieler(level));
  const eingabe = useRef<Eingabe>({ links: false, rechts: false, sprung: false });
  const gesRef = useRef<string[]>([]);
  const tuerRef = useRef<string | null>(null);
  const imTuer = useRef<string | null>(null);
  const bildRef = useRef<HTMLDivElement>(null);
  const weltRef = useRef<HTMLDivElement>(null);
  const figurRef = useRef<HTMLDivElement>(null);

  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const offene = brett.challenges.filter((c) => !c.erledigt);
  const challenge = brett.challenges.find((c) => c.id === tuer);
  const sp = theme.spieler;
  const figH = sp.stehen.h * SK;

  useEffect(() => { if (!skipDa) { const t = setTimeout(() => setSkipDa(true), 20000); return () => clearTimeout(t); } }, [skipDa]);

  const sammle = (id: string, zeige = true) => {
    if (gesRef.current.includes(id)) return;
    gesRef.current = [...gesRef.current, id];
    setGesammelt(gesRef.current);
    if (zeige) setFund(fakten.get(id) ?? null);
  };
  const oeffneTuer = (id: string | null) => {
    tuerRef.current = id;
    setTuer(id); setAblage([]); setTipp(false);
    if (id) { setAntwort(null); lauf.waehle(id); }
  };

  // Eingabe: Tastatur
  useEffect(() => {
    const setze = (e: KeyboardEvent, an: boolean) => {
      if (tuerRef.current) return;
      const k = e.key.toLowerCase();
      const feld = k === "arrowleft" || k === "a" ? "links" : k === "arrowright" || k === "d" ? "rechts"
        : k === " " || k === "w" || k === "arrowup" ? "sprung" : null;
      if (!feld) return;
      e.preventDefault();
      eingabe.current[feld] = an;
    };
    const ab = (e: KeyboardEvent) => setze(e, true), auf = (e: KeyboardEvent) => setze(e, false);
    window.addEventListener("keydown", ab); window.addEventListener("keyup", auf);
    return () => { window.removeEventListener("keydown", ab); window.removeEventListener("keyup", auf); };
  }, []);

  // Spielschleife
  useEffect(() => {
    let raf = 0, letzte = 0, anim = false, dir: 1 | -1 = 1;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || tuerRef.current) { letzte = 0; return; }
      const dt = letzte ? Math.min(0.05, (t - letzte) / 1000) : 0;
      letzte = t;
      const s = schritt(spieler.current, eingabe.current, dt, level);
      spieler.current = s;
      const bewegt = eingabe.current.links !== eingabe.current.rechts;
      if (bewegt !== anim) { anim = bewegt; setLaeuft(bewegt); }
      if (s.richtung !== dir) { dir = s.richtung; setRichtung(dir); }
      for (const k of level.schluessel) {
        const f = brett.fakten[k.faktIndex];
        if (f && !gesRef.current.includes(f.id) && naheSchluessel(s, k)) sammle(f.id);
      }
      const d = level.tueren.findIndex((td, i) => brett.challenges[i] && !brett.challenges[i].erledigt && naheTuer(s, td));
      const id = d >= 0 ? brett.challenges[d].id : null;
      if (id !== imTuer.current) { imTuer.current = id; if (id) oeffneTuer(id); }
      const breite = bildRef.current?.clientWidth ?? 600;
      const kam = Math.max(0, Math.min(level.breite * KACHEL - breite, s.x * KACHEL - breite / 2));
      if (weltRef.current) weltRef.current.style.transform = `translateX(${-kam}px)`;
      if (figurRef.current) figurRef.current.style.transform = `translate(${s.x * KACHEL - sp.stehen.w * SK / 2}px, ${s.y * KACHEL - figH}px)`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, brett.fakten, brett.challenges]);

  const halte = (feld: keyof Eingabe, an: boolean) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); eingabe.current[feld] = an; },
    onPointerUp: () => { eingabe.current[feld] = false; },
    onPointerLeave: () => { eingabe.current[feld] = false; },
    onPointerCancel: () => { eingabe.current[feld] = false; },
  });

  const legeAuf = (id: string) => {
    if (!challenge || ablage.includes(id) || !fakten.has(id)) return;
    lauf.gelegt();
    setAblage([...ablage, id]);
  };
  const aufschliessen = async () => {
    if (!challenge || !ablage.length || sende) return;
    setSende(true);
    try {
      const r = await lauf.antworte(challenge.id, ablage, tipp);
      oeffneTuer(null); imTuer.current = null;
      setAntwort(r.etappe_geschafft || r.zurueck_zur_karte || r.fertig ? null : r);
    } catch {
      oeffneTuer(null); imTuer.current = null; // z. B. 409: das Brett ist schon neu geladen
    } finally {
      setSende(false);
    }
  };

  const tile = theme.hintergrund;
  const boden = (i: number) => tile ? { x: (bodenKachel(tile.muster.boden, i, 0) % tile.cols) * tile.tile, y: Math.floor(bodenKachel(tile.muster.boden, i, 0) / tile.cols) * tile.tile, w: tile.tile, h: tile.tile } : null;
  const himmel = theme.farben.himmel === "transparent" ? "linear-gradient(#bfe6ff, #eaf7ff)" : theme.farben.himmel;
  const anim = useMemo(() => ({ frames: richtung > 0 ? sp.laufen.rechts : sp.laufen.links, fps: 8 }), [richtung, sp]);

  return (
    <>
      <div className="flex items-center justify-between">
        <Herzen leben={brett.leben} />
        <div className="flex gap-2">
          {skipDa && <button className="btn-secondary" onClick={() => brett.fakten.forEach((f) => sammle(f.id, false))}>Alles einsammeln</button>}
          <button className="btn-secondary" onClick={zurKarte}>Karte</button>
        </div>
      </div>
      <Treffermeldung antwort={antwort} />

      <div ref={bildRef} className="relative overflow-hidden rounded-lg border-2 border-line" style={{ height: level.hoehe * KACHEL, background: himmel }}
        role="group" aria-label="Spielfeld: mit Pfeiltasten oder A und D laufen, mit Leertaste springen">
        <div ref={weltRef} className="absolute left-0 top-0" style={{ width: level.breite * KACHEL, height: level.hoehe * KACHEL }}>
          {level.plattformen.map((p, i) => (
            <div key={i} className="absolute flex" style={{ left: p.x * KACHEL, top: p.y * KACHEL, width: p.w * KACHEL }}>
              {Array.from({ length: p.w }, (_, c) => {
                const f = boden(c + i);
                return f && tile ? <Sprite key={c} src={tile.src} frame={f} scale={SK} />
                  : <span key={c} className="inline-block" style={{ width: KACHEL, height: KACHEL / 2, background: theme.farben.boden === "transparent" ? "#8b5a2b" : theme.farben.boden, borderTop: "4px solid #4c8a2b" }} />;
              })}
              {p.cp && <span className="absolute -top-8 left-1 text-2xl" aria-hidden>🚩</span>}
            </div>
          ))}
          {level.schluessel.map((k) => {
            const f = brett.fakten[k.faktIndex];
            return f && !gesammelt.includes(f.id) ? (
              <div key={k.faktIndex} className="absolute animate-bounce" style={{ left: k.x * KACHEL - 16, top: k.y * KACHEL - 56 }}><PixelMatrix bild={SCHLUESSEL} palette={PAL} scale={4} label="Schlüssel" /></div>
            ) : null;
          })}
          {level.tueren.map((t, i) => {
            const c = brett.challenges[i];
            return c && !c.erledigt ? (
              <button key={c.id} onClick={() => oeffneTuer(c.id)} aria-label={`Tür: ${c.text}`}
                className="absolute focus-visible:outline focus-visible:outline-2" style={{ left: t.x * KACHEL - 20, top: t.y * KACHEL - 80 }}>
                <PixelMatrix bild={TUER} palette={PAL} scale={8} />
              </button>
            ) : null;
          })}
          <div ref={figurRef} className="absolute left-0 top-0" style={{ transform: `translate(${spieler.current.x * KACHEL}px, ${spieler.current.y * KACHEL - figH}px)` }}>
            <Sprite src={sp.src} frame={sp.stehen} scale={SK} animation={laeuft ? anim : undefined} label="Du" />
          </div>
        </div>
      </div>

      <div className="flex justify-between gap-2 select-none touch-none">
        <div className="flex gap-2">
          <button className="btn-secondary" aria-label="Nach links" {...halte("links", true)}>◀</button>
          <button className="btn-secondary" aria-label="Nach rechts" {...halte("rechts", true)}>▶</button>
        </div>
        <button className="btn-primary" aria-label="Springen" {...halte("sprung", true)}>⤒ Sprung</button>
      </div>

      {fund && (
        <div className="card p-3" role="status">
          <b>Schlüssel gefunden:</b> <Inhalt x={fund} />
          {lesbar(fund) && <p className="text-muted mt-1">{lesbar(fund)}</p>}
        </div>
      )}

      {challenge && (
        <div className="card p-3 flex flex-col gap-2 border-accent" role="dialog" aria-label="Tür">
          <div><b>Tür:</b> <Inhalt x={challenge} /></div>
          <Ablage karten={ablage.map((id) => fakten.get(id)!)} onLege={legeAuf} onNimm={(id) => setAblage(ablage.filter((x) => x !== id))} leer="Lege Schlüssel auf das Schloss." />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!ablage.length || sende} onClick={aufschliessen}>Aufschließen</button>
            <button className="btn-secondary" onClick={() => oeffneTuer(null)}>Schließen</button>
            {challenge.tip && (tipp
              ? <span className="text-muted self-center">💡 {challenge.tip}</span>
              : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
          </div>
        </div>
      )}

      <div>
        <p className="text-muted mb-1">Schlüsselbund: {gesammelt.length} von {brett.fakten.length}{offene.length ? ` · ${offene.length} Tür(en) am Ende` : ""}</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
          {brett.fakten.filter((f) => gesammelt.includes(f.id) && !ablage.includes(f.id)).map((f) => (
            <FaktKarte key={f.id} fakt={f} disabled={!challenge} onClick={() => legeAuf(f.id)} />
          ))}
        </div>
      </div>
    </>
  );
}
