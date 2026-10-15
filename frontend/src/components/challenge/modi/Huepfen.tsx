"use client";
/** Hüpfen: Jump'n'Run im Seitenlauf. Schlüssel (= Fakten) einsammeln, an einer Tür aufschließen (= antworten). */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { BestenlisteKnopf } from "@/components/challenge/Bestenliste";
import Fundkarte from "@/components/challenge/Fundkarte";
import { wenigerBewegung } from "@/lib/challenge/bewegung";
import { useSpielwert } from "@/lib/challenge/useSpielwert";
import { useUeberspringen } from "@/lib/challenge/useUeberspringen";
import type { ChallengeAntwort, ChallengeFakt } from "@/lib/api";
import { Sprite } from "@/components/challenge/pixel/Sprite";
import { PixelMatrix } from "@/components/challenge/pixel/Matrix";
import {
  GEGNER_BONUS, TOR_HOCH, VIEW_H, VX, STIL_NAMEN, baueLevel, bewegerFlaeche, type Level, edelsteineGesamt, figurBilder, gegnerBegegnung, gegnerX, naheEdelstein, nahePogo, naheSchluessel, naheTuer,
  schritt, sterne, startSpieler, zumKontrollpunkt, type Eingabe, type Spieler,
} from "@/lib/challenge/huepfen";
import type { ModusProps } from "./typen";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import { bodenKachel, type ThemeDef } from "@/lib/challenge/themes";

const SK = 3, KACHEL = 16 * SK; // Bildschirm-Pixel je Kachel

const SCHLUESSEL = ["..yyy...", ".y...y..", ".y...y..", "..yyy...", "...y....", "...yy...", "...y....", "...yy..."];
const TUER = ["..bbbbbb..", ".bbbbbbbb.", "bbddddddbb", "bbddddddbb", "bbddddddbb", "bbdddddybb", "bbddddddbb", "bbddddddbb", "bbddddddbb", "bbddddddbb"];
const EDEL = ["..cccc..", ".cwcccd.", "cwccccdd", "ccccccdd", ".ccccdd.", "..cccd..", "...cd...", "........"];
const SCHLEIM = ["..gggg..", ".gggggg.", "gwkggwkg", "gggggggg", "gggggggg", ".gg..gg."];
const TUER_OFFEN = ["..bbbbbb..", ".bbbbbbbb.", "bbkkkkkkbb", "bbkkkkkkbb", "bbkkkkkkbb", "bbkkkkkkbb", "bbkkkkkkbb", "bbkkkkkkbb", "bbkkkkkkbb", "bbkkkkkkbb"];
const PAL = { y: "#f5c518", b: "#5b3a1a", d: "#8b5a2b" };
const PAL_OFFEN = { b: "#5b3a1a", k: "#241508" };

const PAL_EDEL = { c: "#35c9e8", w: "#e8fbff", d: "#1a8fb0" };
const PAL_EDEL_SCHWER = { c: "#f5a623", w: "#fff3c4", d: "#c46a00" };
const PAL_SCHLEIM = { g: "#7ac943", w: "#ffffff", k: "#222222" };

const POGO = [".rrrr...", ".rrrr...", "..gg....", "..gg....", "..gg....", "..gg....", ".gggg...", "..ss....", "..ss....", ".kkkk..."];
const PAL_POGO = { r: "#d33a2c", g: "#aab4c0", s: "#6e7a88", k: "#333333" };

type Hintergrund = ThemeDef["hintergrund"];

/** Boden und Fahnen: ändert sich nur, wenn eine Fahne erreicht wird (nicht bei Edelsteinen und Funden). */
const Plattformen = memo(function Plattformen({ plattformen, tile, bodenFarbe, cp, reduziert }: {
  plattformen: Level["plattformen"]; tile: Hintergrund; bodenFarbe: string; cp: number; reduziert: boolean;
}) {
  return (
    <>
      {plattformen.map((p, i) => (
        <div key={i} className="absolute flex" style={{ left: p.x * KACHEL, top: p.y * KACHEL, width: p.w * KACHEL }}>
          {Array.from({ length: p.w }, (_, c) => {
            if (tile) {
              const k = bodenKachel(tile.muster.boden, c + i, 0);
              return <Sprite key={c} src={tile.src} frame={{ x: (k % tile.cols) * tile.tile, y: Math.floor(k / tile.cols) * tile.tile, w: tile.tile, h: tile.tile }} scale={SK} />;
            }
            return <span key={c} className="inline-block" style={{ width: KACHEL, height: KACHEL / 2, background: bodenFarbe === "transparent" ? "#8b5a2b" : bodenFarbe, borderTop: "4px solid #4c8a2b" }} />;
          })}
          {p.cp && (
            <span className="absolute left-2 -top-9 w-1 h-9 bg-[#6b4a2b] overflow-hidden" aria-hidden data-fahne={i <= cp ? "oben" : "unten"}>
              <span className="absolute left-1 w-5 h-4 rounded-r-sm" style={{ background: i <= cp ? "#e63946" : "#9aa0a6", top: 0, transform: `translateY(${i <= cp ? 0 : 20}px)`, transition: reduziert ? "none" : "transform .7s ease-out, background .7s" }} />
            </span>
          )}
        </div>
      ))}
    </>
  );
});

export default function Huepfen({ brett, theme, lauf, zurKarte }: ModusProps) {
  // Neue Karte bei jedem Besuch: der Zufallswert gilt, solange die Komponente steht (eine Tür zu öffnen mischt nicht neu)
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const level = useMemo(() => baueLevel(brett.etappe, brett.fakten.length, brett.challenges.length, seed), [brett.etappe, brett.fakten.length, brett.challenges.length, seed]);
  const [gesammelt, setGesammelt] = useState<string[]>([]);
  const [fund, setFund] = useState<ChallengeFakt | null>(null);
  const [tuer, setTuer] = useState<string | null>(null);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [sende, setSende] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [edel, setEdel] = useState(0);
  const [plings, setPlings] = useState<{ id: number; x: number; y: number }[]>([]);
  const [erledigtG, setErledigtG] = useState<number[]>([]);
  const [pogo, setPogo] = useState(false);
  const [cp, setCp] = useState(0);
  const [, setOffen] = useState<string[]>([]); // Tore, die per vollständiger Antwort aufgegangen sind (Wert in offenRef)
  const [staub, setStaub] = useState<{ id: number; x: number; y: number }[]>([]);
  const [richtung, setRichtung] = useState<1 | -1>(1);
  const skipDa = useUeberspringen();

  const spieler = useRef<Spieler>(startSpieler(level));
  const eingabe = useRef<Eingabe>({ links: false, rechts: false, sprung: false });
  const edelRef = useRef<Set<number>>(new Set());
  const gegnerRef = useRef<Set<number>>(new Set());
  const gegnerEl = useRef<(HTMLDivElement | null)[]>([]);
  const bewegerEl = useRef<(HTMLDivElement | null)[]>([]);
  const wolkenRef = useRef<HTMLDivElement>(null);
  const gesRef = useRef<string[]>([]);
  const tuerRef = useRef<string | null>(null);
  const imTuer = useRef<string | null>(null);
  const bildRef = useRef<HTMLDivElement>(null);
  const weltRef = useRef<HTMLDivElement>(null);
  const figurRef = useRef<HTMLDivElement>(null);
  const listeRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nachher = (f: () => void, ms: number) => { timer.current.push(setTimeout(f, ms)); };
  const kamX = useRef<number | null>(null);
  const kamY = useRef<number | null>(null);
  const offenRef = useRef<Set<string>>(new Set());
  const reduziert = useMemo(() => wenigerBewegung(), []);
  const breiteRef = useRef(600);

  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const offene = brett.challenges.filter((c) => !c.erledigt);
  const challenge = brett.challenges.find((c) => c.id === tuer);
  const sp = theme.spieler;
  const figH = sp.stehen.h * SK;
  const edelMax = edelsteineGesamt(level);
  useSpielwert(lauf, "huepfen", brett.etappe, edel, Math.max(edel, edelMax)); // Edelsteine

  useEffect(() => () => timer.current.forEach(clearTimeout), []);

  const sammle = (id: string, zeige = true) => {
    if (gesRef.current.includes(id)) return;
    gesRef.current = [...gesRef.current, id];
    setGesammelt(gesRef.current);
    if (zeige) setFund(fakten.get(id) ?? null);
  };
  const pling = (x: number, y: number) => {
    const id = Date.now() + Math.random();
    setPlings((p) => [...p, { id, x, y }]);
    nachher(() => setPlings((p) => p.filter((q) => q.id !== id)), 700);
  };
  const staubAn = (x: number, y: number) => {
    if (reduziert) return;
    const id = Date.now() + Math.random();
    setStaub((p) => [...p.slice(-3), { id, x, y }]);
    nachher(() => setStaub((p) => p.filter((q) => q.id !== id)), 450);
  };
  /** Tor i sperrt, solange seine Challenge offen und nicht aufgeschlossen ist. */
  const torZu = (i: number) => { const c = brett.challenges[i]; return !!c && !c.erledigt && !offenRef.current.has(c.id); };
  const oeffneTuer = (id: string | null) => {
    tuerRef.current = id;
    setTuer(id); setAblage([]); setTipp(false);
    if (id) { setAntwort(null); lauf.waehle(); }
  };

  // Spielfeldbreite zwischenspeichern, statt sie in jedem Frame zu lesen
  useEffect(() => {
    const el = bildRef.current;
    if (!el) return;
    breiteRef.current = el.clientWidth || 600;
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { breiteRef.current = el.clientWidth || 600; });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    let raf = 0, letzte = 0, anim = false, dir: 1 | -1 = 1, landungen = 0, cpAlt = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || tuerRef.current || listeRef.current) { letzte = 0; return; }
      const dt = letzte ? Math.min(0.05, (t - letzte) / 1000) : 0;
      letzte = t;
      const zu = level.tueren.map((_, i) => torZu(i));
      let s = schritt(spieler.current, eingabe.current, dt, level, zu);
      for (const g of level.gegner) {
        if (gegnerRef.current.has(g.id)) continue;
        const b = gegnerBegegnung(s, g, level);
        if (b === "besiegt") {
          gegnerRef.current.add(g.id); setErledigtG([...gegnerRef.current]);
          for (let j = 0; j < GEGNER_BONUS; j++) edelRef.current.add(1000 + g.id * 10 + j);
          setEdel(edelRef.current.size); pling(gegnerX(g, s.t), level.plattformen[g.plat].y - 1);
          s = { ...s, vy: -10, auf: -1 };
        } else if (b === "treffer") {
          s = zumKontrollpunkt(s, level); // zurück zur Fahne, ohne Folgen
        }
      }
      if (level.pogo && !s.pogo && nahePogo(s, level.pogo)) { s = { ...s, pogo: true }; setPogo(true); }
      if (s.landung !== landungen) { landungen = s.landung; staubAn(s.x, s.y); }
      if (s.cp !== cpAlt) { cpAlt = s.cp; setCp(s.cp); }
      spieler.current = s;
      for (const g of level.edelsteine) {
        if (!edelRef.current.has(g.id) && naheEdelstein(s, g)) { edelRef.current.add(g.id); setEdel(edelRef.current.size); pling(g.x, g.y); }
      }
      level.gegner.forEach((g, i) => {
        const el = gegnerEl.current[i];
        if (el) el.style.transform = `translate(${gegnerX(g, s.t) * KACHEL - 12}px, ${level.plattformen[g.plat].y * KACHEL - 24}px)`;
      });
      level.beweger.forEach((m, i) => {
        const el = bewegerEl.current[i], f = bewegerFlaeche(m, s.t);
        if (el) el.style.transform = `translate(${f.x * KACHEL}px, ${f.y * KACHEL}px)`;
      });
      const bewegt = eingabe.current.links !== eingabe.current.rechts;
      if (bewegt !== anim) { anim = bewegt; setLaeuft(bewegt); }
      if (s.richtung !== dir) { dir = s.richtung; setRichtung(dir); }
      for (const k of level.schluessel) {
        const f = brett.fakten[k.faktIndex];
        if (f && !gesRef.current.includes(f.id) && naheSchluessel(s, k)) sammle(f.id);
      }
      const d = level.tueren.findIndex((td, i) => zu[i] && naheTuer(s, td));
      const id = d >= 0 ? brett.challenges[d].id : null;
      if (id !== imTuer.current) { imTuer.current = id; if (id) oeffneTuer(id); }
      const breite = breiteRef.current;
      // Kamera schaut in Laufrichtung voraus und gleitet nach
      const voraus = (s.vx / VX) * 70;
      const ziel = Math.max(0, Math.min(level.breite * KACHEL - breite, s.x * KACHEL - breite / 2 + voraus));
      // ... und senkrecht: beim Fallen nach unten, beim Steigen nach oben
      const hBild = VIEW_H * KACHEL;
      const zielY = Math.max(0, Math.min(level.hoehe * KACHEL - hBild, s.y * KACHEL - hBild * 0.62 + Math.max(-1, Math.min(1, s.vy / 12)) * 110));
      kamX.current = kamX.current === null || reduziert ? ziel : kamX.current + (ziel - kamX.current) * Math.min(1, dt * 6);
      const kam = kamX.current;
      kamY.current = kamY.current === null || reduziert ? zielY : kamY.current + (zielY - kamY.current) * Math.min(1, dt * 7);
      const kamH = kamY.current;
      if (weltRef.current) weltRef.current.style.transform = `translate(${-kam}px, ${-kamH}px)`;
      if (wolkenRef.current) wolkenRef.current.style.transform = `translate(${-kam * 0.35}px, ${-kamH * 0.25}px)`;
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
      oeffneTuer(null);
      if (r.komplett) { // Tor geht auf; sonst bleibt es zu und das Feld öffnet sich nicht neu, bis man sich entfernt
        offenRef.current.add(challenge.id); setOffen([...offenRef.current]); imTuer.current = null;
        const t = level.tueren[brett.challenges.findIndex((c) => c.id === challenge.id)];
        if (t) pling(t.x, t.y - 1);
      }
      setAntwort(r);
    } catch {
      oeffneTuer(null); imTuer.current = null; // z. B. 409: das Brett ist schon neu geladen
    } finally {
      setSende(false);
    }
  };

  const tile = theme.hintergrund;
  const himmel = theme.farben.himmel === "transparent" ? "linear-gradient(#bfe6ff, #eaf7ff)" : theme.farben.himmel;
  const bild = figurBilder(sp.laufen, richtung, laeuft);
  const anim = useMemo(() => ({ frames: bild.frames ?? [], fps: 8 }), [bild.frames]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Herzen leben={brett.leben} /><span className="font-bold" aria-label="Edelsteine">💎 {edel}/{edelMax}</span><span className="text-muted">Karte: {STIL_NAMEN[level.stil]}</span>{pogo && <span className="font-bold" title="Pogo-Stab: Sprung gedrückt halten">🪀 Pogo</span>}</div>
        <div className="flex gap-2">
          {skipDa && <button className="btn-secondary" onClick={() => brett.fakten.forEach((f) => sammle(f.id, false))}>Alles einsammeln</button>}
          <BestenlisteKnopf lauf={lauf} spiel="huepfen" rechts onWechsel={(offen) => { listeRef.current = offen; }} />
          <button className="btn-secondary" onClick={zurKarte}>Karte</button>
        </div>
      </div>
      <style>{`@keyframes hpstaub{from{opacity:.9;transform:scale(.4)}to{opacity:0;transform:scale(2) translateY(-4px)}}@media (prefers-reduced-motion: reduce){[style*="hpstaub"]{animation:none!important;opacity:0}}`}</style>
      <Treffermeldung antwort={antwort} />

      <div ref={bildRef} className="relative overflow-hidden rounded-lg border-2 border-line" style={{ height: VIEW_H * KACHEL, background: himmel }}
        role="group" aria-label="Spielfeld: mit Pfeiltasten oder A und D laufen, mit Leertaste springen; Tore auf dem Weg gehen erst nach dem Aufschließen auf">
        <div ref={wolkenRef} className="absolute left-0 top-4 flex gap-40 opacity-60 pointer-events-none text-5xl" aria-hidden style={{ width: level.breite * KACHEL }}>
          {Array.from({ length: Math.ceil(level.breite / 6) }, (_, i) => <span key={i} style={{ marginTop: (i % 3) * 24 + (i % 2) * 260 }}>☁️</span>)}
        </div>
        <div ref={weltRef} className="absolute left-0 top-0" style={{ width: level.breite * KACHEL, height: level.hoehe * KACHEL }}>
          <Plattformen plattformen={level.plattformen} tile={tile} bodenFarbe={theme.farben.boden} cp={cp} reduziert={reduziert} />
          {level.leisten.map((p, i) => (
            <div key={`l${i}`} className="absolute rounded-sm" style={{ left: p.x * KACHEL, top: p.y * KACHEL, width: p.w * KACHEL, height: 10, background: "#8b5a2b", borderTop: "4px solid #4c8a2b" }} />
          ))}
          {level.beweger.map((m, i) => (
            <div key={`m${i}`} ref={(el) => { bewegerEl.current[i] = el; }} className="absolute left-0 top-0 rounded-sm" style={{ width: m.w * KACHEL, height: 10, background: "#6b7bb3", borderTop: "4px solid #aab6e6" }} />
          ))}
          {level.gegner.map((g, i) => !erledigtG.includes(g.id) && (
            <div key={`g${g.id}`} ref={(el) => { gegnerEl.current[i] = el; }} className="absolute left-0 top-0"><PixelMatrix bild={SCHLEIM} palette={PAL_SCHLEIM} scale={3} label="Gegner" /></div>
          ))}
          {level.edelsteine.map((g) => !edelRef.current.has(g.id) && (
            <div key={`e${g.id}`} className="absolute" style={{ left: g.x * KACHEL - 12, top: g.y * KACHEL - 12 }}>
              <PixelMatrix bild={EDEL} palette={g.schwer ? PAL_EDEL_SCHWER : PAL_EDEL} scale={3} label="Edelstein" />
            </div>
          ))}
          {level.pogo && !pogo && (
            <div className="absolute animate-bounce" style={{ left: level.pogo.x * KACHEL - 12, top: level.pogo.y * KACHEL - 24 }}><PixelMatrix bild={POGO} palette={PAL_POGO} scale={3} label="Pogo-Stab" /></div>
          )}
          {staub.map((q) => (
            <span key={q.id} className="absolute pointer-events-none rounded-full" aria-hidden
              style={{ left: q.x * KACHEL - 12, top: q.y * KACHEL - 8, width: 24, height: 8, background: "rgba(255,255,255,.7)", animation: "hpstaub .45s ease-out forwards" }} />
          ))}
          {plings.map((p) => (
            <span key={p.id} className="absolute animate-ping pointer-events-none" style={{ left: p.x * KACHEL - 12, top: p.y * KACHEL - 16 }} aria-hidden>✨</span>
          ))}
          {level.schluessel.map((k) => {
            const f = brett.fakten[k.faktIndex];
            return f && !gesammelt.includes(f.id) ? (
              <div key={k.faktIndex} className="absolute animate-bounce" style={{ left: k.x * KACHEL - 16, top: k.y * KACHEL - 56 }}><PixelMatrix bild={SCHLUESSEL} palette={PAL} scale={4} label="Schlüssel" /></div>
            ) : null;
          })}
          <div className="absolute" style={{ left: level.ziel.x * KACHEL - 12, top: level.ziel.y * KACHEL - 56 }} role="img" aria-label="Ziel"><span className="text-4xl">🏁</span></div>
          {level.tueren.map((t, i) => {
            const c = brett.challenges[i];
            if (!c) return null;
            if (!torZu(i)) { // schon geschafft oder aufgeschlossen: offen
              return <div key={c.id} className="absolute pointer-events-none" style={{ left: t.x * KACHEL - 40, top: t.y * KACHEL - 80 }} data-tor="offen"><PixelMatrix bild={TUER_OFFEN} palette={PAL_OFFEN} scale={8} /></div>;
            }
            return (
              <div key={c.id} data-tor="zu">
                <div className="absolute pointer-events-none opacity-40" aria-hidden
                  style={{ left: t.x * KACHEL - 6, top: (t.y - TOR_HOCH) * KACHEL, width: 12, height: (TOR_HOCH - 1.7) * KACHEL, background: "repeating-linear-gradient(#8b5a2b 0 10px, transparent 10px 20px)" }} />
                <button onClick={() => oeffneTuer(c.id)} aria-label={`Tür: ${c.text}`}
                  className="absolute focus-visible:outline focus-visible:outline-2" style={{ left: t.x * KACHEL - 40, top: t.y * KACHEL - 80 }}>
                  <PixelMatrix bild={TUER} palette={PAL} scale={8} />
                </button>
              </div>
            );
          })}
          <div ref={figurRef} className="absolute left-0 top-0" style={{ transform: `translate(${spieler.current.x * KACHEL}px, ${spieler.current.y * KACHEL - figH}px)` }}>
            <Sprite src={sp.src} frame={bild.frame} scale={SK} animation={laeuft ? anim : undefined} label="Du" />
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

      {fund && <Fundkarte fakt={fund} titel="Schlüssel gefunden:" fokus={false} onOk={() => setFund(null)} />}

      {challenge && (
        <div className="card p-3 flex flex-col gap-2 border-accent" role="dialog" aria-label="Tür">
          <div><b>Tür:</b> <Inhalt x={challenge} /> </div>
          <div className="text-sm" aria-label="Etappenbilanz">
            <b>Bilanz:</b> 💎 {edel}/{edelMax} · {"★".repeat(sterne(edel, edelMax))}{"☆".repeat(3 - sterne(edel, edelMax))} <span className="text-muted">({sterne(edel, edelMax)} von 3 Sternen)</span>
          </div>
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
        <p className="text-muted mb-1">Schlüsselbund: {gesammelt.length} von {brett.fakten.length}{offene.length ? ` · ${offene.length} Tor(e) auf dem Weg, alle Schlüssel liegen davor` : ""} · 💎 {edel}/{edelMax}</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
          {brett.fakten.filter((f) => gesammelt.includes(f.id) && !ablage.includes(f.id)).map((f) => (
            <FaktKarte key={f.id} fakt={f} disabled={!challenge} onClick={() => legeAuf(f.id)} />
          ))}
        </div>
      </div>
    </>
  );
}
