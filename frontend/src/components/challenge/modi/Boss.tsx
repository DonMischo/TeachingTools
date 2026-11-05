"use client";
/** Bosskampf: erst Fakten sammeln, dann das Gepäck wählen (= Deck), dann kontert die Figur die Angriffe des Bosses mit Fakten aus dem Inventar. */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BestenlisteKnopf } from "@/components/challenge/Bestenliste";
import { useSpielwert } from "@/lib/challenge/useSpielwert";
import { useAblage } from "@/lib/challenge/useAblage";
import Papierkorb, { WegKnopf } from "@/components/challenge/Papierkorb";
import type { ChallengeAntwort, ChallengeBrett } from "@/lib/api";
import { PixelMatrix } from "@/components/challenge/pixel/Matrix";
import type { ModusProps } from "./typen";
import { Ablage, FaktKarte, Frage, Treffermeldung } from "./teile";
import { heiltrank } from "@/lib/challenge/heiltrank";
import { skinVon } from "./boss/figuren";
import Sammeln from "./boss/Sammeln";
import { Szene, type Anim, type Zahl } from "./boss/Szene";
import Arena3D, { webglDa } from "./boss/Arena3D";
import { EP_SIEG, anzahlMonster, bossSeed, epBalken } from "@/lib/challenge/bossKarte";

type Ansicht = "menu" | "kontern" | "tasche";
const FELDER = ["kontern", "tasche", "wechseln", "flucht"] as const;
const nieAendern = () => () => {};
const LEBEN = 3; // wie LEBEN in api/challenge_engine.py

export default function Boss({ brett, theme, skin, lauf, zurKarte, spielart }: ModusProps) {
  const sk = skinVon(skin);
  const mitGL = useSyncExternalStore(nieAendern, webglDa, () => false); // 3D-Arena nur mit WebGL, sonst Pixelbühne
  // Schon gesammelt (z. B. nach drei Fehlversuchen zurück zur Karte): direkt wieder zur Gepäck-Wahl, nicht noch einmal ins Verlies
  const sammelKey = lauf.schluessel ? `hp_ch_gesammelt_${lauf.schluessel}_${brett.etappe}` : null;
  const [schonGesammelt] = useState(() => { try { return !!sammelKey && localStorage.getItem(sammelKey) === "1"; } catch { return false; } });
  const [phase, setPhase] = useState<"sammeln" | "arena">(brett.fakten.length && !brett.deck && !schonGesammelt ? "sammeln" : "arena");
  const [deckLokal, setDeckLokal] = useState<string[] | null>(null);
  const [neuWaehlen, setNeuWaehlen] = useState(false);
  const [abgewaehlt, setAbgewaehlt] = useState<string[]>([]); // Gepäck: alles ist eingepackt, man wählt ab
  const deck = brett.deck ?? deckLokal;
  const deckWar = useRef(!!brett.deck);
  const [gefunden, setGefunden] = useState<string[]>(() => (schonGesammelt ? brett.fakten.map((f) => f.id) : []));
  const korb = useAblage(brett.etappe);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [heldAnim, setHeldAnim] = useState<Anim>(null);
  const [gegnerAnim, setGegnerAnim] = useState<Anim>(null);
  const [zahlen, setZahlen] = useState<Zahl[]>([]);
  const [schaden, setSchaden] = useState(0);
  const [geheilt, setGeheilt] = useState(0); // Heiltränke nach falschen/unvollständigen Antworten
  const [heil, setHeil] = useState(0);
  const [sende, setSende] = useState(false);
  const [ansicht, setAnsicht] = useState<Ansicht>("menu");
  const [feld, setFeld] = useState(0);
  const [ep, setEp] = useState(0);
  const [trankText, setTrankText] = useState("");
  const feldEl = useRef<(HTMLButtonElement | null)[]>([]);
  const epMax = anzahlMonster(brett.fakten.length) * EP_SIEG;

  const offene = brett.challenges.filter((c) => !c.erledigt);
  const aktiv = offene[0] ?? null;
  const gesammelt = brett.fakten.filter((f) => gefunden.includes(f.id) || (brett.deck ?? []).includes(f.id));
  const imGepaeck = gesammelt.filter((f) => !korb.istWeg(f.id));
  const ausruesten = phase === "arena" && brett.fakten.length > 0 && (!deck || neuWaehlen);
  const markiert = imGepaeck.filter((f) => !abgewaehlt.includes(f.id)).map((f) => f.id);
  const inventar = deck ? brett.fakten.filter((f) => deck.includes(f.id)) : [];
  const b = brett as ChallengeBrett & { geschafft_etappen?: number; gesamt_etappen?: number };
  const gesamt = Math.max(1, b.gesamt_etappen ?? brett.etappen.length);
  const geschafft = b.geschafft_etappen ?? brett.etappen.filter((e) => e.erledigt).length;
  const etappeBeat = !!antwort?.etappe_geschafft && !antwort.fertig;
  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));

  const max = brett.challenges.reduce((s, c) => s + c.strength * 15, 0);
  const erledigt = brett.challenges.reduce((s, c) => s + (c.erledigt ? c.strength * 10 : 0), 0);
  const hp = offene.length === 0 ? 0 : Math.min(max, Math.max(1, max - Math.max(schaden, erledigt) + geheilt));

  useEffect(() => { // Server leert das Deck nach der Rückkehr zur Karte: Gepäck neu wählen
    if (brett.deck) deckWar.current = true;
    else if (deckWar.current) { deckWar.current = false; setDeckLokal(null); setAbgewaehlt([]); }
  }, [brett.deck]);
  useSpielwert(lauf, "boss", brett.etappe, ep, epMax); // EP aus den Klicker-Kämpfen
  useEffect(() => { if (phase === "arena" && !ausruesten && ansicht === "menu") feldEl.current[feld]?.focus(); }, [phase, ansicht, ausruesten]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (phase === "arena" && aktiv) lauf.waehle(); }, [phase, aktiv?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!zahlen.length) return;
    const t = setTimeout(() => setZahlen([]), 900);
    return () => clearTimeout(t);
  }, [zahlen]);

  const zurArena = () => {
    setPhase("arena");
    try { if (sammelKey) localStorage.setItem(sammelKey, "1"); } catch { /* ohne Speicher: neu sammeln */ }
  };
  const einpacken = async () => {
    if (!markiert.length) return;
    try { await lauf.deckSetzen(markiert); setDeckLokal(markiert); setNeuWaehlen(false); } catch { /* Brett bleibt wie es ist */ }
  };
  // Flucht: zurück zur Gepäck-Wahl, wieder mit allem (auch Weggeworfenem) — wer Passendes abgewählt hatte, kann es nun mitnehmen
  const fliehen = () => {
    setGefunden(brett.fakten.map((f) => f.id));
    korb.weg.forEach(korb.zurueckholen);
    setAbgewaehlt([]); setAblage([]); setTipp(false); setAntwort(null); setAnsicht("menu"); setFeld(0);
    setNeuWaehlen(true);
  };
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
      setTrankText("");
      setSchaden((s) => s + r.schaden);
      const n = Date.now();
      const h = heiltrank(r, max, Math.max(schaden + r.schaden, erledigt) - geheilt);
      setGeheilt((g) => g + h); setHeil(h);
      const heilZahl = h > 0 ? [{ id: n + 1, wert: h, heil: true }] : [];
      if (r.treffer) {
        setHeldAnim({ art: "lunge", n }); setGegnerAnim({ art: "treffer", n });
        setZahlen([...(r.schaden > 0 ? [{ id: n, wert: r.schaden }] : []), ...heilZahl]);
      } else { setGegnerAnim({ art: "wackel", n }); setZahlen(heilZahl); }
      setAntwort(r);
    } catch {
      setGegnerAnim({ art: "wackel", n: Date.now() }); // z. B. 409: das Brett ist schon neu geladen
    } finally {
      setAblage([]); setTipp(false); setSende(false); setAnsicht("menu");
    }
  };

  const traenke = brett.traenke ?? 0;
  const trinken = async () => {
    if (await lauf.trinken()) {
      setTrankText("🧪 Du trinkst einen Heiltrank – ein Leben zurück!");
      setAnsicht("menu");
    }
  };
  const bg = theme.farben.himmel === "transparent" ? undefined : theme.farben.himmel;
  const boden = theme.farben.boden === "transparent" ? "#6b7a5a" : theme.farben.boden;
  const bal = epBalken(ep);
  const zugNr = brett.etappe % sk.zuege.length;
  const zug = sk.zuege[zugNr];
  const felder: { id: (typeof FELDER)[number]; text: string; icon: string; aus?: boolean }[] = [
    { id: "kontern", text: sk.kontern, icon: "⚔️" },
    { id: "tasche", text: "Tasche", icon: "🎒" },
    { id: "wechseln", text: "Wechseln", icon: "🔄", aus: !spielart }, // andere Spielart; die Etappe beginnt von vorn
    { id: "flucht", text: "Flucht", icon: "🏃" },
  ];
  const waehleFeld = (id: (typeof FELDER)[number]) => {
    if (id === "kontern") setAnsicht("kontern");
    else if (id === "tasche") setAnsicht("tasche");
    else if (id === "wechseln") spielart?.();
    else fliehen();
  };
  // Game-Boy-Menü: Pfeiltasten springen im 2×2-Raster
  const menuTaste = (e: React.KeyboardEvent) => {
    const sp = feld % 2, z = Math.floor(feld / 2);
    const [ns, nz] = e.key === "ArrowRight" ? [1, z] : e.key === "ArrowLeft" ? [0, z] : e.key === "ArrowDown" ? [sp, 1] : e.key === "ArrowUp" ? [sp, 0] : [-1, -1];
    if (ns < 0) return;
    e.preventDefault();
    const n = nz * 2 + ns;
    if (felder[n].aus) return; // gesperrte Felder lassen sich nicht anwählen
    setFeld(n); feldEl.current[n]?.focus();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <strong>{sk.titel} · Lv. {bal.level} · Etappe {Math.min(gesamt, geschafft + 1)} von {gesamt}</strong>
        <div className="flex gap-2">
          <BestenlisteKnopf lauf={lauf} spiel="boss" hinweis="Erfahrung aus den Kämpfen gegen Mini-Monster" rechts />
          <button className="btn-secondary" onClick={zurKarte}>Karte</button>
        </div>
      </div>

      {phase === "sammeln" ? (
        <Sammeln fakten={brett.fakten} theme={theme} seed={bossSeed(brett.etappe, brett.fakten.length)} gefunden={gefunden} setGefunden={setGefunden} weiter={zurArena}
          ep={ep} etappe={brett.etappe} onEp={() => setEp((e) => e + EP_SIEG)} onWegwerfen={korb.wegwerfen} />
      ) : ausruesten ? (
        <section aria-label="Ausrüsten" className="card p-3 flex flex-col gap-2">
          <h2 className="font-bold">🎒 Ausrüsten: Was nimmst du in den Kampf mit?</h2>
          <p className="text-muted text-sm">Alles ist eingepackt. Klicke Fakten an, die du zurücklässt – im Kampf stehen nur die markierten zur Verfügung.</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
            {imGepaeck.map((f) => (
              <div key={f.id} aria-pressed={markiert.includes(f.id)} className={`rounded-xl flex flex-col gap-1 ${markiert.includes(f.id) ? "ring-4 ring-accent" : ""}`}>
                <FaktKarte fakt={f} onClick={() => setAbgewaehlt((a) => (a.includes(f.id) ? a.filter((x) => x !== f.id) : [...a, f.id]))} />
                <WegKnopf fakt={f} onClick={() => korb.wegwerfen(f.id)} />
              </div>
            ))}
          </div>
          <button className="btn-primary self-start" disabled={!markiert.length} onClick={einpacken}>In den Kampf ({markiert.length})</button>
          <Papierkorb weg={korb.weg} fakten={brett.fakten} onZurueck={korb.zurueckholen} />
        </section>
      ) : (
        <>
          {etappeBeat && <p className="card p-3 font-bold text-good" role="status">Etappe geschafft – der Drache flieht tiefer ins Verlies!</p>}
          <Treffermeldung antwort={antwort} heil={heil} />
          {trankText && <p className="card p-3 font-bold" role="status">{trankText}</p>}
          <Szene introText={sk.intro} himmel={bg} boden={boden === "#6b7a5a" ? undefined : boden}
            held={<PixelMatrix bild={sk.held.bild} palette={sk.held.palette} scale={6} label={sk.held.name} />}
            gegner={<div style={{ transform: "scaleX(-1)" }}><PixelMatrix bild={sk.boss.bild} palette={sk.boss.palette} scale={7} label={sk.boss.name} /></div>}
            heldName={`${sk.held.name} Lv. ${bal.level}`} heldEp={ep > 0 ? { wert: bal.wert, max: bal.max } : undefined} heldKp={{ wert: brett.leben, max: LEBEN }} gegnerName={sk.boss.name} hp={hp} hpMax={max}
            heldAnim={heldAnim} gegnerAnim={offene.length === 0 ? { art: "weg", n: -1 } : gegnerAnim} zahlen={zahlen}
            buehne={mitGL ? <Arena3D skin={skin} himmel={bg} boden={boden === "#6b7a5a" ? undefined : boden} gegnerAnim={gegnerAnim}
              heldElement={sk.heldElement} bossElement={sk.zugElemente[zugNr]} weg={offene.length === 0} /> : undefined}>
            {aktiv ? (
              <div className="flex flex-col gap-2">
                <div aria-live="polite">
                  <p className="text-sm text-muted">{zug}</p>
                  <strong className="text-sm">{sk.angriff} ({"⚔️".repeat(Math.min(5, aktiv.strength))}):</strong>
                  <Frage x={aktiv} />
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
            ) : etappeBeat ? null : <p className="font-bold text-good">{sk.sieg}</p>}
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">🧪 Heiltrank ×{traenke}</span>
                <button className="btn-secondary" disabled={traenke <= 0 || brett.leben >= LEBEN} onClick={trinken}>Trinken (+1 Leben)</button>
                {traenke > 0 && brett.leben >= LEBEN && <span className="text-muted text-sm">Du bist voll bei Kräften.</span>}
              </div>
              {aktiv.tip ? (tipp ? <p className="text-muted">💡 {aktiv.tip}</p> : <button className="btn-secondary self-start" onClick={() => setTipp(true)}>💡 Tipp benutzen</button>)
                : <p className="text-muted">Für diesen {sk.angriff} gibt es keinen Tipp.</p>}
              <strong className="text-sm">Im Gepäck ({inventar.length})</strong>
              <ul className="flex flex-col gap-1">
                {inventar.map((f) => (
                  <li key={f.id} className="text-sm">
                    <span className="font-bold">{f.text}</span>{f.info?.text && <> – {f.info.text}</>}
                    {f.info?.source?.url && <> <a href={f.info.source.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{f.info.source.label || "Quelle"}</a></>}
                  </li>
                ))}
              </ul>
              <p className="text-muted text-sm">Fehlt dir etwas? Mit »Flucht« packst du neu.</p>
              <button className="btn-secondary self-start" onClick={() => setAnsicht("menu")}>Zurück</button>
            </div>
          )}
          {ansicht === "kontern" && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2" aria-label="Inventar">
              {inventar.filter((f) => !ablage.includes(f.id) && !korb.istWeg(f.id)).map((f) => (
                <div key={f.id} className="flex flex-col gap-1">
                  <FaktKarte fakt={f} disabled={!aktiv} onClick={() => legeAuf(f.id)} />
                  <WegKnopf fakt={f} onClick={() => korb.wegwerfen(f.id)} />
                </div>
              ))}
            </div>
          )}
          {ansicht === "kontern" && <Papierkorb weg={korb.weg} fakten={inventar} onZurueck={korb.zurueckholen} />}
        </>
      )}
    </>
  );
}
