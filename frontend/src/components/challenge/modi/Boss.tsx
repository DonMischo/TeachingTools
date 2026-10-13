"use client";
/** Bosskampf: erst Fakten sammeln, dann kontert die Figur die Angriffe des Bosses mit Fakten aus dem Inventar. */
import { useEffect, useRef, useState } from "react";
import Bestenliste from "@/components/challenge/Bestenliste";
import type { ChallengeAntwort } from "@/lib/api";
import { PixelMatrix } from "@/components/challenge/pixel/Matrix";
import type { ModusProps } from "./typen";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import { skinVon } from "./boss/figuren";
import Sammeln from "./boss/Sammeln";
import { Szene, type Anim, type Zahl } from "./boss/Szene";
import { EP_SIEG, anzahlMonster, bossSeed, epBalken } from "@/lib/challenge/bossKarte";

type Ansicht = "menu" | "kontern" | "tasche";
const FELDER = ["kontern", "tasche", "wechseln", "flucht"] as const;

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
  const [ansicht, setAnsicht] = useState<Ansicht>("menu");
  const [feld, setFeld] = useState(0);
  const [ep, setEp] = useState(0);
  const [liste, setListe] = useState(false);
  const feldEl = useRef<(HTMLButtonElement | null)[]>([]);
  const gemeldet = useRef(-1);
  const epRef = useRef(0);
  epRef.current = ep;
  const epMax = anzahlMonster(brett.fakten.length) * EP_SIEG;

  const offene = brett.challenges.filter((c) => !c.erledigt);
  const aktiv = offene.length ? offene[idx % offene.length] : null;
  const inventar = brett.fakten.filter((f) => gefunden.includes(f.id));
  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));

  const max = brett.challenges.reduce((s, c) => s + c.strength * 15, 0);
  const erledigt = brett.challenges.reduce((s, c) => s + (c.erledigt ? c.strength * 10 : 0), 0);
  const hp = offene.length === 0 ? 0 : Math.max(1, max - Math.max(schaden, erledigt));

  // Spielpunkte (EP aus den Klicker-Kämpfen) melden: bei jedem Gewinn und beim Verlassen
  const melde = () => {
    if (epMax <= 0 || epRef.current === gemeldet.current || epRef.current === 0) return;
    gemeldet.current = epRef.current;
    void lauf.spielwert?.("boss", brett.etappe, epRef.current, epMax);
  };
  const meldeRef = useRef(melde);
  meldeRef.current = melde;
  useEffect(() => { meldeRef.current(); }, [ep]);
  useEffect(() => () => meldeRef.current(), []);
  useEffect(() => { if (phase === "arena" && ansicht === "menu") feldEl.current[feld]?.focus(); }, [phase, ansicht]); // eslint-disable-line react-hooks/exhaustive-deps
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
      setAblage([]); setTipp(false); setSende(false); setAnsicht("menu");
    }
  };

  const bg = theme.farben.himmel === "transparent" ? undefined : theme.farben.himmel;
  const boden = theme.farben.boden === "transparent" ? "#6b7a5a" : theme.farben.boden;
  const bal = epBalken(ep);
  const zug = sk.zuege[(brett.etappe + (aktiv ? idx : 0)) % sk.zuege.length];
  const felder: { id: (typeof FELDER)[number]; text: string; icon: string; aus?: boolean }[] = [
    { id: "kontern", text: sk.kontern, icon: "⚔️" },
    { id: "tasche", text: "Tasche", icon: "🎒" },
    { id: "wechseln", text: "Wechseln", icon: "🔄", aus: offene.length < 2 },
    { id: "flucht", text: "Flucht", icon: "🏃" },
  ];
  const waehleFeld = (id: (typeof FELDER)[number]) => {
    if (id === "kontern") setAnsicht("kontern");
    else if (id === "tasche") setAnsicht("tasche");
    else if (id === "wechseln") { setIdx(idx + 1); setAblage([]); setTipp(false); setAntwort(null); }
    else zurKarte();
  };
  // Game-Boy-Menü: Pfeiltasten springen im 2×2-Raster
  const menuTaste = (e: React.KeyboardEvent) => {
    const sp = feld % 2, z = Math.floor(feld / 2);
    const [ns, nz] = e.key === "ArrowRight" ? [1, z] : e.key === "ArrowLeft" ? [0, z] : e.key === "ArrowDown" ? [sp, 1] : e.key === "ArrowUp" ? [sp, 0] : [-1, -1];
    if (ns < 0) return;
    e.preventDefault();
    const n = nz * 2 + ns;
    setFeld(n); feldEl.current[n]?.focus();
  };
  const nachlesen = inventar.filter((f) => f.info?.text);

  return (
    <>
      <div className="flex items-center justify-between">
        <Herzen leben={brett.leben} />
        <strong>{sk.titel} · Lv. {bal.level}</strong>
        <div className="flex gap-2">
          {lauf.hatBestenliste && <button className="btn-secondary" aria-expanded={liste} onClick={() => setListe(!liste)}>🏆 Bestenliste</button>}
          <button className="btn-secondary" onClick={zurKarte}>Karte</button>
        </div>
      </div>
      {liste && <div className="card p-3" role="dialog" aria-label="Bestenliste"><p className="text-muted text-sm">Erfahrung aus den Kämpfen gegen Mini-Monster</p><Bestenliste laden={lauf.bestenliste} spiel="boss" /></div>}

      {phase === "sammeln" ? (
        <Sammeln fakten={brett.fakten} theme={theme} seed={bossSeed(brett.etappe, brett.fakten.length)} gefunden={gefunden} setGefunden={setGefunden} weiter={() => setPhase("arena")}
          ep={ep} onEp={() => setEp((e) => e + EP_SIEG)} />
      ) : (
        <>
          <Treffermeldung antwort={antwort} />
          <Szene introText={sk.intro} himmel={bg} boden={boden === "#6b7a5a" ? undefined : boden}
            held={<PixelMatrix bild={sk.held.bild} palette={sk.held.palette} scale={6} label={sk.held.name} />}
            gegner={<div style={{ transform: "scaleX(-1)" }}><PixelMatrix bild={sk.boss.bild} palette={sk.boss.palette} scale={7} label={sk.boss.name} /></div>}
            heldName={`${sk.held.name} Lv. ${bal.level}`} heldEp={ep > 0 ? { wert: bal.wert, max: bal.max } : undefined} gegnerName={sk.boss.name} hp={hp} hpMax={max}
            heldAnim={heldAnim} gegnerAnim={offene.length === 0 ? { art: "weg", n: -1 } : gegnerAnim} zahlen={zahlen}>
            {aktiv ? (
              <div className="flex flex-col gap-2">
                <div aria-live="polite">
                  <p className="text-sm text-muted">{zug}</p>
                  <strong className="text-sm">{sk.angriff} ({"⚔️".repeat(Math.min(5, aktiv.strength))}):</strong>
                  <div><Inhalt x={aktiv} /></div>
                </div>
                {ansicht === "menu" && (
                  <div role="group" aria-label="Was tust du?" onKeyDown={menuTaste} className="grid grid-cols-2 gap-1 self-end w-full max-w-xs border-2 border-line rounded-lg p-1 bg-surface">
                    {felder.map((f, i) => (
                      <button key={f.id} ref={(el) => { feldEl.current[i] = el; }} disabled={f.aus} tabIndex={i === feld ? 0 : -1}
                        className="btn-secondary justify-start text-left" onFocus={() => setFeld(i)} onClick={() => waehleFeld(f.id)}>
                        <span aria-hidden>{i === feld ? "▶ " : "• "}{f.icon} </span>{f.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : <p className="font-bold text-good">{sk.sieg}</p>}
          </Szene>

          {aktiv && ansicht === "kontern" && (
            <div className="card p-3 flex flex-col gap-2">
              <Ablage karten={ablage.map((id) => fakten.get(id)!)} onLege={legeAuf} onNimm={(id) => setAblage(ablage.filter((x) => x !== id))} leer="Lege hier die Fakten ab, mit denen du kontern willst." />
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" disabled={!ablage.length || sende} onClick={kontern}>{sk.kontern}</button>
                <button className="btn-secondary" onClick={() => { setAnsicht("menu"); setAblage([]); }}>Zurück</button>
                {tipp && aktiv.tip && <span className="text-muted self-center">💡 {aktiv.tip}</span>}
              </div>
            </div>
          )}
          {aktiv && ansicht === "tasche" && (
            <div className="card p-3 flex flex-col gap-2" role="region" aria-label="Tasche">
              <strong>🎒 Tasche</strong>
              {aktiv.tip ? (tipp ? <p className="text-muted">💡 {aktiv.tip}</p> : <button className="btn-secondary self-start" onClick={() => setTipp(true)}>💡 Tipp benutzen</button>)
                : <p className="text-muted">Für diesen {sk.angriff} gibt es keinen Tipp.</p>}
              <strong className="text-sm">Wissen nachlesen</strong>
              {nachlesen.length ? nachlesen.map((f) => (
                <p key={f.id} className="text-sm"><span className="font-bold">{f.text}</span> – {f.info!.text}</p>
              )) : <p className="text-muted text-sm">Noch nichts zum Nachlesen in der Tasche.</p>}
              <button className="btn-secondary self-start" onClick={() => setAnsicht("menu")}>Zurück</button>
            </div>
          )}
          {ansicht === "kontern" && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2" aria-label="Inventar">
              {inventar.filter((f) => !ablage.includes(f.id)).map((f) => (
                <FaktKarte key={f.id} fakt={f} disabled={!aktiv} onClick={() => legeAuf(f.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
