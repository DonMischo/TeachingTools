"use client";
/**
 * Stufe 1 (Klick) und Stufe 2 (Doppelklick) — ein Spiel, zwei Regeln.
 *
 * Oben steht das gesuchte Tier, darunter das Raster. Jedes Ziel hat eine
 * Zeitgrenze (der Balken); Stufe und Raster passen sich an, siehe
 * lib/maus/klickspiele.ts.
 *
 * Beim Doppelklick zählt das echte `dblclick` des Browsers — es folgt den
 * Regeln von Windows, und genau die sollen die Kinder lernen. Misslingt einer,
 * erklärt der Hinweis warum: zu langsam oder die Maus bewegt.
 */
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { AVATARS } from "@/components/AvatarPicker";
import {
  DOPPELKLICK, KLICK, auswertung, einzelklickGrund, stufenWechsel, trefferPunkte, zeitFuer, ziehe, type Versuch,
} from "@/lib/maus/klickspiele";
import { sekunden, type StufenErgebnis } from "@/lib/maus/ergebnis";
import { tierName } from "@/lib/maus/tiere";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, mitte, useDemo } from "./Demo";
import { HILFE_ZEIT, useMausKontext } from "./MausKontext";

type Art = "klick" | "doppelklick";
type Runde = { raster: string[]; ziel: string; nr: number; seit: number };
type Hinweis = { text: string; ton: "gut" | "schlecht" | "info" } | null;

/** Eine zufällige Reihenfolge aller Tiere — beim Klicken gilt sie für einen ganzen Durchgang. */
function mischen(): string[] {
  return ziehe(AVATARS, AVATARS.length).map(a => a.id);
}

/**
 * Mit `reihenfolge` bleibt das Raster stehen (nur mehr oder weniger Tiere je
 * Stufe) — das Kind soll zielen üben, nicht jedes Mal neu suchen. Ohne wird
 * jede Runde neu gemischt.
 */
function neueRunde(anzahl: number, nr: number, ohne?: string, reihenfolge?: string[]): Runde {
  const raster = reihenfolge ? reihenfolge.slice(0, anzahl) : ziehe(AVATARS, anzahl).map(a => a.id);
  const auswahl = raster.filter(id => id !== ohne);
  return { raster, ziel: auswahl[Math.floor(Math.random() * auswahl.length)], nr, seit: performance.now() };
}

export default function Klickspiel({
  art, onFertig, onWeiter,
}: { art: Art; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const spiel = art === "klick" ? KLICK : DOPPELKLICK;
  const { hilfe } = useMausKontext();
  // Hilfsmodus: höchstens 4×4 — die Felder bleiben groß genug zum Treffen.
  const stufen = hilfe
    ? spiel.stufen.map(s => ({ spalten: Math.min(s.spalten, 4), zeilen: Math.min(s.zeilen, 4) }))
    : spiel.stufen;
  const [phase, setPhase] = useState<"bereit" | "laeuft" | "fertig">("bereit");
  const [stufe, setStufe] = useState(0);
  // Beim Klicken eine feste Reihenfolge je Durchgang; »Nochmal« mischt neu.
  const reihenfolge = useRef<string[] | null>(null);
  if (reihenfolge.current === null) reihenfolge.current = mischen();
  const ordnung = () => (art === "klick" ? reihenfolge.current! : undefined);
  const [runde, setRunde] = useState<Runde>(() => neueRunde(stufen[0].spalten * stufen[0].zeilen, 0, undefined, ordnung()));
  const [treffer, setTreffer] = useState(0);
  const [punkte, setPunkte] = useState(0);
  const [hinweis, setHinweis] = useState<Hinweis>(null);
  const [wackelt, setWackelt] = useState<{ id: string; nr: number } | null>(null);

  const verlauf = useRef<Versuch[]>([]);
  const alle = useRef<Versuch[]>([]);
  const hoechste = useRef(0);
  const start = useRef(0);
  const einzel = useRef<{ id: string; t: number } | null>(null);
  const einzelUhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wackelUhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zielAnzeige = useRef<HTMLDivElement>(null);
  const rasterRef = useRef<HTMLDivElement>(null);

  const demo = useDemo();
  const { spalten, zeilen } = stufen[stufe];
  // Jeder Treffer macht die Zeit fürs nächste Tier etwas knapper; mit Hilfe gibt es mehr.
  const zeitMs = Math.round(zeitFuer(spiel, treffer) * (hilfe ? HILFE_ZEIT : 1));
  const avatar = AVATARS.find(a => a.id === runde.ziel)!;

  function versuch(getroffen: boolean, ms: number, meldung?: Hinweis) {
    const v = { treffer: getroffen, ms };
    alle.current.push(v);
    verlauf.current = [...verlauf.current, v];

    let neu = stufe;
    const wechsel = stufenWechsel(verlauf.current, zeitMs);
    if (wechsel !== 0) {
      neu = Math.max(0, Math.min(spiel.stufen.length - 1, stufe + wechsel));
      if (neu !== stufe) verlauf.current = [];
    }
    hoechste.current = Math.max(hoechste.current, neu);

    let neuePunkte = punkte;
    let neueTreffer = treffer;
    if (getroffen) {
      neuePunkte += trefferPunkte(stufe, ms, spiel.startMs);
      neueTreffer += 1;
      setPunkte(neuePunkte);
      setTreffer(neueTreffer);
    }

    if (neueTreffer >= spiel.ziele) {
      const a = auswertung(alle.current);
      setPhase("fertig");
      setHinweis({ text: `Geschafft! ${neuePunkte} Punkte.`, ton: "gut" });
      onFertig({
        punkte: neuePunkte,
        dauerMs: Math.round(performance.now() - start.current),
        details: [
          `Trefferquote ${Math.round(a.quote * 100)} %`,
          `Mittlere Zeit ${sekunden(a.medianMs)}`,
          `Höchste Stufe ${hoechste.current + 1} von ${spiel.stufen.length}`,
        ],
      });
      return;
    }

    if (neu !== stufe) {
      setStufe(neu);
      setHinweis(neu > stufe
        ? { text: art === "klick" ? "Super schnell! Die Felder werden kleiner." : "Super! Jetzt wird es schneller.", ton: "gut" }
        : { text: art === "klick" ? "Etwas ruhiger — die Felder werden wieder größer." : "Etwas ruhiger — du bekommst mehr Zeit.", ton: "info" });
    } else if (meldung) {
      setHinweis(meldung);
    }
    // Ein neues Tier gibt es nach Treffer, abgelaufener Zeit oder Stufenwechsel —
    // nach einem Fehlgriff bleibt das Ziel stehen.
    if (getroffen || ms >= zeitMs || neu !== stufe) {
      const s = stufen[neu];
      setRunde(neueRunde(s.spalten * s.zeilen, runde.nr + 1, runde.ziel, ordnung()));
    }
  }

  // Die Zeitgrenze des aktuellen Ziels.
  useEffect(() => {
    if (phase !== "laeuft") return;
    const uhr = setTimeout(() => versuch(false, zeitMs, { text: "Zu spät — hier ist das nächste Tier.", ton: "schlecht" }), zeitMs);
    return () => clearTimeout(uhr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, runde.nr, stufe]);

  useEffect(() => () => {
    if (einzelUhr.current) clearTimeout(einzelUhr.current);
    if (wackelUhr.current) clearTimeout(wackelUhr.current);
  }, []);

  function los() {
    if (!start.current) start.current = performance.now();
    setHinweis(null);
    setRunde(r => ({ ...r, seit: performance.now() }));
    setPhase("laeuft");
  }

  function nochmal() {
    verlauf.current = [];
    alle.current = [];
    hoechste.current = 0;
    start.current = 0;
    setStufe(0);
    setTreffer(0);
    setPunkte(0);
    setHinweis(null);
    reihenfolge.current = mischen();
    setRunde(neueRunde(stufen[0].spalten * stufen[0].zeilen, 0, undefined, ordnung()));
    setPhase("bereit");
  }

  function daneben(id: string, text: string) {
    if (wackelUhr.current) clearTimeout(wackelUhr.current);
    setWackelt({ id, nr: Date.now() });
    // Nur kurz: blieb die Markierung stehen, wackelte dasselbe Tier in einer
    // späteren Runde noch einmal — als wäre es wieder daneben gegangen.
    wackelUhr.current = setTimeout(() => setWackelt(null), 650);
    versuch(false, performance.now() - runde.seit, { text, ton: "schlecht" });
  }

  function klick(e: MouseEvent, id: string) {
    if (phase !== "laeuft" || demo.aktiv) return;
    if (art === "klick") {
      if (id === runde.ziel) versuch(true, performance.now() - runde.seit, { text: "Treffer!", ton: "gut" });
      else daneben(id, `Daneben — das war ${tierName(id)}.`);
      return;
    }
    // Doppelklick: der zweite Klick eines gelungenen Doppelklicks trägt detail 2.
    if (e.detail >= 2 || id !== runde.ziel) return;
    const jetzt = performance.now();
    const vorher = einzel.current;
    if (einzelUhr.current) clearTimeout(einzelUhr.current);
    if (vorher && vorher.id === id && jetzt - vorher.t < 1500) {
      einzel.current = null;
      const grund = einzelklickGrund(jetzt - vorher.t);
      daneben(id, grund === "zu-langsam"
        ? "Zu langsam — die zwei Klicks müssen schneller hintereinander kommen."
        : "Die Maus hat gewackelt — halte sie beim Klicken ganz still.");
      return;
    }
    einzel.current = { id, t: jetzt };
    einzelUhr.current = setTimeout(() => {
      setHinweis({ text: "Das war ein Klick. Zweimal schnell hintereinander!", ton: "info" });
    }, 700);
  }

  function doppelklick(id: string) {
    if (art !== "doppelklick" || phase !== "laeuft" || demo.aktiv) return;
    if (einzelUhr.current) clearTimeout(einzelUhr.current);
    einzel.current = null;
    if (id === runde.ziel) versuch(true, performance.now() - runde.seit, { text: "Treffer!", ton: "gut" });
    else daneben(id, "Daneben — gesucht ist das blinkende Tier.");
  }

  function rechtsklick(e: MouseEvent) {
    e.preventDefault();
    if (phase === "laeuft") setHinweis({ text: "Das war die rechte Taste — nimm die linke!", ton: "info" });
  }

  function vorfuehren() {
    if (phase === "laeuft") setPhase("bereit");
    const zelle = () => mitte(rasterRef.current?.querySelector(`[data-zelle="${runde.ziel}"]`) ?? null);
    demo.abspielen(art === "klick"
      ? [
          { text: "Oben steht, welches Tier du suchst.", zu: () => mitte(zielAnzeige.current) },
          { text: "Schiebe die Maus auf das Tier.", zu: zelle },
          { text: "Drücke einmal die linke Taste.", taste: "links" },
          { text: "Treffer! Dann kommt das nächste Tier.", ms: 2000 },
        ]
      : [
          { text: "Das blinkende Tier ist dein Ziel.", zu: zelle },
          { text: "Zweimal schnell die linke Taste: klick-klick!", taste: "doppel" },
          { text: "Wichtig: Die Maus dabei ganz stillhalten.", taste: null },
        ]);
  }

  // Kopf, Reiter, Zeitbalken und Hinweis brauchen gut 400 px — der Rest gehört dem Raster.
  const rasterBreite = `min(640px, calc((100vh - 420px) * ${spalten / zeilen}))`;

  return (
    <div className="flex flex-col gap-4">
      <Stufenkopf
        titel={art === "klick" ? "👆 Stufe 1 · Klicken" : "✌️ Stufe 2 · Doppelklick"}
        auftrag={
          <>
            {art === "klick"
              ? <>Klicke mit der <b>linken</b> Maustaste auf: <b>{tierName(runde.ziel)}</b></>
              : <><b>Doppelklick</b> auf das blinkende Tier: <b>{tierName(runde.ziel)}</b></>}
            <div data-zusatz className="text-xs text-(--text-muted) mt-1 tabular-nums">
              Treffer {treffer} / {spiel.ziele} · Stufe {stufe + 1} von {spiel.stufen.length} · {sekunden(zeitMs)} je Tier
            </div>
          </>
        }
        punkte={punkte}
        onDemo={vorfuehren}
        onWeiter={onWeiter}
        hervor={phase === "fertig"}
      >
        <div
          ref={zielAnzeige}
          className="w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center text-4xl"
          style={{ backgroundColor: avatar.bg }}
          data-testid="ziel"
        >
          {avatar.emoji}
        </div>
      </Stufenkopf>

      <div className="h-2 rounded-full bg-(--surface-hover) overflow-hidden" aria-hidden>
        {phase === "laeuft" && (
          <div
            key={`${runde.nr}-${stufe}`}
            className="h-full bg-(--accent)"
            style={{ animation: `maus-zeit ${zeitMs}ms linear forwards` }}
          />
        )}
      </div>
      <style>{"@keyframes maus-zeit { from { width: 100% } to { width: 0% } }"}</style>

      <div className="min-h-6 text-center text-sm font-bold" aria-live="polite"
        style={{ color: hinweis?.ton === "gut" ? "var(--green, #16a34a)" : hinweis?.ton === "schlecht" ? "var(--red, #dc2626)" : "var(--text-muted)" }}>
        {hinweis?.text}
      </div>

      <div className="relative mx-auto w-full" style={{ maxWidth: rasterBreite }}>
        <div
          ref={rasterRef}
          className={"grid gap-2 " + (phase === "laeuft" ? "" : "opacity-60")}
          style={{ gridTemplateColumns: `repeat(${spalten}, minmax(0, 1fr))` }}
          onClick={e => { if (e.target === e.currentTarget && art === "klick" && phase === "laeuft") daneben("", "Daneben!"); }}
          onContextMenu={rechtsklick}
        >
          {runde.raster.map(id => {
            const a = AVATARS.find(x => x.id === id)!;
            const istZiel = id === runde.ziel;
            return (
              <button
                key={id}
                type="button"
                data-zelle={id}
                data-ziel={istZiel || undefined}
                aria-label={tierName(id)}
                onClick={e => klick(e, id)}
                onDoubleClick={() => doppelklick(id)}
                className={
                  "aspect-square rounded-2xl flex items-center justify-center select-none cursor-pointer " +
                  (istZiel ? "maus-blinken ring-4 ring-(--accent) " : "") +
                  (wackelt?.id === id ? "maus-wackeln" : "")
                }
                style={{ backgroundColor: a.bg, fontSize: `min(${48 / spalten}vw, ${300 / spalten}px)` }}
              >
                <span className="pointer-events-none">{a.emoji}</span>
              </button>
            );
          })}
        </div>

        {phase !== "laeuft" && !demo.aktiv && (
          <div className="absolute inset-0 flex items-center justify-center">
            {phase === "bereit" ? (
              <button onClick={los} className="rounded-2xl bg-(--accent) text-(--bg) px-8 py-4 text-xl font-black shadow-xl">
                ▶ Los geht&apos;s
              </button>
            ) : (
              <div className="rounded-2xl bg-(--surface) border border-(--border) shadow-xl px-8 py-6 text-center">
                <div className="text-4xl">🏅</div>
                <div className="text-2xl font-black mt-1">{punkte} Punkte</div>
                <div className="flex gap-2 justify-center mt-4">
                  <button onClick={nochmal} className="rounded-lg px-4 py-2 border border-(--border) hover:border-(--accent)">↺ Nochmal</button>
                  <button onClick={onWeiter} className="rounded-lg px-4 py-2 bg-(--accent) text-(--bg) font-bold">Weiter →</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <DemoBuehne demo={demo} />
    </div>
  );
}
