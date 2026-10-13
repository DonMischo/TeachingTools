"use client";
/** Hüpfen: Jump'n'Run im Seitenlauf. Schlüssel (= Fakten) einsammeln, an einer Tür aufschließen (= antworten). */
import { useEffect, useMemo, useRef, useState } from "react";
import Bestenliste from "@/components/challenge/Bestenliste";
import type { ChallengeAntwort, ChallengeFakt } from "@/lib/api";
import { Sprite } from "@/components/challenge/pixel/Sprite";
import { PixelMatrix } from "@/components/challenge/pixel/Matrix";
import {
  GEGNER_BONUS, STIL_NAMEN, baueLevel, bewegerFlaeche, edelsteineGesamt, figurBilder, gegnerBegegnung, gegnerX, naheEdelstein, naheSchluessel, naheTuer,
  schritt, startSpieler, zumKontrollpunkt, type Eingabe, type Spieler,
} from "@/lib/challenge/huepfen";
import type { ModusProps } from "./typen";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import { bodenKachel } from "@/lib/challenge/themes";

const SK = 3, KACHEL = 16 * SK; // Bildschirm-Pixel je Kachel

const SCHLUESSEL = ["..yyy...", ".y...y..", ".y...y..", "..yyy...", "...y....", "...yy...", "...y....", "...yy..."];
const TUER = ["..bbbbbb..", ".bbbbbbbb.", "bbddddddbb", "bbddddddbb", "bbddddddbb", "bbdddddybb", "bbddddddbb", "bbddddddbb", "bbddddddbb", "bbddddddbb"];
const EDEL = ["..cccc..", ".cwcccd.", "cwccccdd", "ccccccdd", ".ccccdd.", "..cccd..", "...cd...", "........"];
const SCHLEIM = ["..gggg..", ".gggggg.", "gwkggwkg", "gggggggg", "gggggggg", ".gg..gg."];
const PAL = { y: "#f5c518", b: "#5b3a1a", d: "#8b5a2b" };

const PAL_EDEL = { c: "#35c9e8", w: "#e8fbff", d: "#1a8fb0" };
const PAL_EDEL_SCHWER = { c: "#f5a623", w: "#fff3c4", d: "#c46a00" };
const PAL_SCHLEIM = { g: "#7ac943", w: "#ffffff", k: "#222222" };

const lesbar = (f: ChallengeFakt) => f.info?.text;

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
  const [liste, setListe] = useState(false);
  const [plings, setPlings] = useState<{ id: number; x: number; y: number }[]>([]);
  const [erledigtG, setErledigtG] = useState<number[]>([]);
  const [richtung, setRichtung] = useState<1 | -1>(1);
  const [skipDa, setSkipDa] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

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
  // Edelsteine melden: höchstens alle 2 s, sofort an der Tür und beim Verlassen
  const letzteMeldung = useRef(0);
  const gemeldet = useRef(-1);
  const meldeRef = useRef<(sofort: boolean) => void>(() => {});
  meldeRef.current = (sofort) => {
    const n = edelRef.current.size;
    if (n === gemeldet.current || n === 0) return;
    const jetzt = Date.now();
    if (!sofort && jetzt - letzteMeldung.current < 2000) return;
    letzteMeldung.current = jetzt; gemeldet.current = n;
    void lauf.spielwert?.("huepfen", brett.etappe, n, Math.max(n, edelsteineGesamt(level)));
  };

  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const offene = brett.challenges.filter((c) => !c.erledigt);
  const challenge = brett.challenges.find((c) => c.id === tuer);
  const sp = theme.spieler;
  const figH = sp.stehen.h * SK;
  const edelMax = edelsteineGesamt(level);

  useEffect(() => { const t = setInterval(() => meldeRef.current(false), 2000); return () => { clearInterval(t); meldeRef.current(true); }; }, []);
  useEffect(() => { if (!skipDa) { const t = setTimeout(() => setSkipDa(true), 20000); return () => clearTimeout(t); } }, [skipDa]);

  const sammle = (id: string, zeige = true) => {
    if (gesRef.current.includes(id)) return;
    gesRef.current = [...gesRef.current, id];
    setGesammelt(gesRef.current);
    if (zeige) setFund(fakten.get(id) ?? null);
  };
  const pling = (x: number, y: number) => {
    const id = Date.now() + Math.random();
    setPlings((p) => [...p, { id, x, y }]);
    setTimeout(() => setPlings((p) => p.filter((q) => q.id !== id)), 700);
  };
  const oeffneTuer = (id: string | null) => {
    tuerRef.current = id;
    setTuer(id); setAblage([]); setTipp(false);
    if (id) { setAntwort(null); lauf.waehle(id); meldeRef.current(true); }
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
      if (document.hidden || tuerRef.current || listeRef.current) { letzte = 0; return; }
      const dt = letzte ? Math.min(0.05, (t - letzte) / 1000) : 0;
      letzte = t;
      let s = schritt(spieler.current, eingabe.current, dt, level);
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
      const d = level.tueren.findIndex((td, i) => brett.challenges[i] && !brett.challenges[i].erledigt && naheTuer(s, td));
      const id = d >= 0 ? brett.challenges[d].id : null;
      if (id !== imTuer.current) { imTuer.current = id; if (id) oeffneTuer(id); }
      const breite = bildRef.current?.clientWidth ?? 600;
      const kam = Math.max(0, Math.min(level.breite * KACHEL - breite, s.x * KACHEL - breite / 2));
      if (weltRef.current) weltRef.current.style.transform = `translateX(${-kam}px)`;
      if (wolkenRef.current) wolkenRef.current.style.transform = `translateX(${-kam * 0.35}px)`;
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
  const bild = figurBilder(sp.laufen, richtung, laeuft);
  const anim = useMemo(() => ({ frames: bild.frames ?? [], fps: 8 }), [bild.frames]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Herzen leben={brett.leben} /><span className="font-bold" aria-label="Edelsteine">💎 {edel}/{edelMax}</span><span className="text-muted">Karte: {STIL_NAMEN[level.stil]}</span></div>
        <div className="flex gap-2">
          {skipDa && <button className="btn-secondary" onClick={() => brett.fakten.forEach((f) => sammle(f.id, false))}>Alles einsammeln</button>}
          {lauf.hatBestenliste && <button className="btn-secondary" aria-expanded={liste} onClick={() => { listeRef.current = !liste; setListe(!liste); }}>🏆 Bestenliste</button>}
          <button className="btn-secondary" onClick={zurKarte}>Karte</button>
        </div>
      </div>
      <Treffermeldung antwort={antwort} />
      {liste && <div className="card p-3" role="dialog" aria-label="Bestenliste"><Bestenliste laden={lauf.bestenliste} /></div>}

      <div ref={bildRef} className="relative overflow-hidden rounded-lg border-2 border-line" style={{ height: level.hoehe * KACHEL, background: himmel }}
        role="group" aria-label="Spielfeld: mit Pfeiltasten oder A und D laufen, mit Leertaste springen">
        <div ref={wolkenRef} className="absolute left-0 top-4 flex gap-40 opacity-60 pointer-events-none text-5xl" aria-hidden style={{ width: level.breite * KACHEL }}>
          {Array.from({ length: Math.ceil(level.breite / 6) }, (_, i) => <span key={i} style={{ marginTop: (i % 3) * 24 }}>☁️</span>)}
        </div>
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
          {plings.map((p) => (
            <span key={p.id} className="absolute animate-ping pointer-events-none" style={{ left: p.x * KACHEL - 12, top: p.y * KACHEL - 16 }} aria-hidden>✨</span>
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

      {fund && (
        <div className="card p-3" role="status">
          <b>Schlüssel gefunden:</b> <Inhalt x={fund} />
          {lesbar(fund) && <p className="text-muted mt-1">{lesbar(fund)}</p>}
        </div>
      )}

      {challenge && (
        <div className="card p-3 flex flex-col gap-2 border-accent" role="dialog" aria-label="Tür">
          <div><b>Tür:</b> <Inhalt x={challenge} /> <span className="text-muted">· 💎 {edel}/{edelMax}</span></div>
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
        <p className="text-muted mb-1">Schlüsselbund: {gesammelt.length} von {brett.fakten.length}{offene.length ? ` · ${offene.length} Tür(en) am Ende` : ""} · 💎 {edel}/{edelMax}</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
          {brett.fakten.filter((f) => gesammelt.includes(f.id) && !ablage.includes(f.id)).map((f) => (
            <FaktKarte key={f.id} fakt={f} disabled={!challenge} onClick={() => legeAuf(f.id)} />
          ))}
        </div>
      </div>
    </>
  );
}
