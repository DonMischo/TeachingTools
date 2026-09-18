"use client";
/**
 * Simulation »Physiklabor« — der Baukasten.
 *
 * Aus wenigen Grundteilen und Verbindern baut man, was der Vorbereitungsraum
 * hergibt: Pendel, Hebel, Wippe, Flaschenzug — und was er nicht hergibt,
 * ein Trebuchet etwa. Zwei Modi, weil Umbauen und Ausprobieren sich im Weg
 * stehen:
 *
 * - **Bauen**: keine Uhr, nichts bewegt sich. Teile hinstellen, drehen,
 *   befestigen; alles bleibt, wo man es hinstellt, auch in der Luft.
 * - **Versuch**: aus dem Aufbau wird *einmal* eine Welt gebaut, und die
 *   läuft. Man greift Teile mit der Hand, löst Verbinder, verstellt Motoren.
 *   Zurück im Bauen steht alles wieder so da, wie man es aufgebaut hat.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  lageImAufbau, merke, neuerVerlauf, setze, setzeGelenk, setzeLage, setzeTeilWerte, setzeVerbinderWerte,
  spanne, teileUnter, tue, verbinderUnter, vor, zurueck, zurWelt, type Lage, type Verlauf,
} from "@/lib/physik/kern/bearbeiten";
import {
  amTeil, entferneTeil, entferneVerbinder, fuegeTeilHinzu, neuerAufbau, verbinde, wand,
  type TeilArt, type VerbinderArt,
} from "@/lib/physik/kern/modell";
import { ladeAufbau, speichereAufbau } from "@/lib/physik/kern/speicher";
import { standardWerteTeil, TEILE } from "@/lib/physik/kern/teile";
import { standardWerteVerbinder, VERBINDER, verbinderTyp } from "@/lib/physik/kern/verbinder";
import { TAKT, Welt } from "@/lib/physik/kern/welt";
import type { Blick, Punkt } from "@/lib/physik/typen";
import { Buehne, type Auswahl, type Bild } from "./buehne";
import { Inspektor } from "./Inspektor";

type Werkzeug =
  | { art: "auswahl" }
  | { art: "teil"; teil: TeilArt }
  | { art: "verbinder"; verbinder: VerbinderArt };

const BILD_TOLERANZ = 8; // Pixel, in denen ein Verbinder als getroffen gilt
const DREHSCHRITT = Math.PI / 12; // 15°

export default function Baukasten({ action, speicherSchluessel = "geraet" }: {
  action?: ReactNode;
  speicherSchluessel?: string;
}) {
  // Der Verlauf trägt mit, zu welchem Speicherplatz er gehört — sonst
  // überschriebe der Speicher-Effekt unter StrictMode einen gespeicherten
  // Aufbau mit dem leeren Anfangsstand (siehe feedback_strictmode_speicher_race).
  const [stand, setStand] = useState<{ fuer: string | null; verlauf: Verlauf }>(
    () => ({ fuer: null, verlauf: neuerVerlauf(neuerAufbau()) }),
  );
  const aufbau = stand.verlauf.jetzt;
  const aendere = useCallback((f: (v: Verlauf) => Verlauf) => {
    setStand(alt => ({ ...alt, verlauf: f(alt.verlauf) }));
  }, []);

  const [werkzeug, setWerkzeug] = useState<Werkzeug>({ art: "auswahl" });
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null);
  const [schwebt, setSchwebt] = useState<Auswahl | null>(null);
  const [spannStart, setSpannStart] = useState<Punkt | null>(null);
  const [zeiger, setZeiger] = useState<Punkt | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [blick, setBlick] = useState<Blick>({ mitte: { x: 0, y: 0.7 }, skala: 320, breite: 800, hoehe: 520 });

  // Versuch
  const [versuch, setVersuch] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [durchlauf, setDurchlauf] = useState(0);
  const [takt, setTakt] = useState(0);
  const welt = useRef<Welt | null>(null);
  const geloest = useRef(new Set<string>());

  const huelle = useRef<HTMLDivElement>(null);
  const buehne = useRef<Buehne | null>(null);
  const zieht = useRef<
    | { art: "teil"; id: string; griff: Punkt }
    | { art: "hand"; id: string }
    | { art: "blick"; start: Punkt; mitte: Punkt }
    | null
  >(null);

  // ── Laden und Speichern ─────────────────────────────────────────────────────
  useEffect(() => {
    setStand({ fuer: speicherSchluessel, verlauf: neuerVerlauf(ladeAufbau(speicherSchluessel)) });
  }, [speicherSchluessel]);
  useEffect(() => {
    if (stand.fuer === speicherSchluessel) speichereAufbau(speicherSchluessel, stand.verlauf.jetzt);
  }, [speicherSchluessel, stand]);

  useEffect(() => {
    if (!fehler) return;
    const t = window.setTimeout(() => setFehler(null), 2800);
    return () => window.clearTimeout(t);
  }, [fehler]);

  // ── Bühne ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = huelle.current;
    if (!el) return;
    let aus = false;
    const r = el.getBoundingClientRect();
    void Buehne.erzeuge(el, r.width, r.height).then(b => {
      if (aus) { b?.zerstoere(); return; }
      buehne.current = b;
      setTakt(x => x + 1);
    });
    const beobachter = new ResizeObserver(() => {
      const r2 = el.getBoundingClientRect();
      setBlick(b => ({ ...b, breite: Math.round(r2.width), hoehe: Math.round(r2.height) }));
      buehne.current?.groesse(r2.width, r2.height);
    });
    beobachter.observe(el);
    return () => {
      aus = true;
      beobachter.disconnect();
      buehne.current?.zerstoere();
      buehne.current = null;
    };
  }, []);

  // ── Versuch ─────────────────────────────────────────────────────────────────
  // Jeder Start und jedes »Von vorn« baut die Welt neu aus dem Aufbau.
  useEffect(() => {
    if (!versuch) return;
    const w = new Welt(aufbau);
    welt.current = w;
    geloest.current = new Set();
    return () => {
      w.zerstoere();
      if (welt.current === w) welt.current = null;
    };
    // Der Aufbau ist im Versuch fest; neu gebaut wird nur bei Start und Neustart.
  }, [versuch, durchlauf]);

  const lageAusWelt: Lage = useCallback(t => {
    const z = welt.current?.zustand(t.id);
    return z ? { pos: { x: z.x, y: z.y }, winkel: z.winkel } : { pos: t.pos, winkel: t.winkel };
  }, []);
  const lage = versuch ? lageAusWelt : lageImAufbau;

  const vorschau = useMemo<Bild["vorschau"]>(() => {
    if (versuch || !zeiger) return null;
    if (werkzeug.art === "verbinder" && spannStart) {
      const v = werkzeug.verbinder;
      if (v === "seil" || v === "feder") return { art: "spannen", verbinder: v, von: spannStart, bis: zeiger };
    }
    if (werkzeug.art === "teil") {
      return { art: "teil", teil: { id: "vorschau", art: werkzeug.teil, pos: zeiger, winkel: 0, werte: standardWerteTeil(werkzeug.teil) } };
    }
    return null;
  }, [versuch, zeiger, werkzeug, spannStart]);

  const bild = useCallback((): Bild => ({
    aufbau, lage, blick, auswahl, schwebt, vorschau, geloest: geloest.current,
  }), [aufbau, lage, blick, auswahl, schwebt, vorschau]);
  // Die Schleife liest das jeweils neueste Bild über ein Ref. Hinge sie selbst
  // am Bild, finge sie bei jeder Zeigerbewegung neu an — und verlöre dabei
  // jedes Mal Rechenzeit, gerade wenn man etwas mit der Hand zieht.
  const bildRef = useRef(bild);
  bildRef.current = bild;

  // Im Bauen wird gezeichnet, wenn sich etwas ändert; im Versuch je Bild.
  useEffect(() => {
    if (!versuch || !laeuft) buehne.current?.zeichne(bild());
  }, [bild, versuch, laeuft, takt]);

  useEffect(() => {
    if (!versuch || !laeuft) return;
    let id = 0, vorher = performance.now(), rest = 0, bilder = 0;
    const rahmen = (jetzt: number) => {
      rest += Math.min(0.1, (jetzt - vorher) / 1000);
      vorher = jetzt;
      const w = welt.current;
      while (w && rest >= TAKT) {
        w.schritt();
        for (const e of w.holeEreignisse()) {
          if (e.art === "bruch" || e.art === "geloest") geloest.current.add(e.verbinder);
        }
        rest -= TAKT;
      }
      buehne.current?.zeichne(bildRef.current());
      // Die Werte im Inspektor laufen mit, aber nicht 60-mal je Sekunde.
      if (++bilder % 15 === 0) setTakt(x => x + 1);
      id = requestAnimationFrame(rahmen);
    };
    id = requestAnimationFrame(rahmen);
    return () => cancelAnimationFrame(id);
  }, [versuch, laeuft]);

  const starteVersuch = () => {
    setWerkzeug({ art: "auswahl" });
    setSpannStart(null);
    setVersuch(true);
    setLaeuft(true);
    setDurchlauf(d => d + 1);
  };
  const zumBauen = () => {
    welt.current?.lasse();
    setVersuch(false);
    setLaeuft(false);
  };

  // ── Zeiger ──────────────────────────────────────────────────────────────────
  const weltpunkt = (e: React.PointerEvent | React.WheelEvent): Punkt => {
    const r = huelle.current!.getBoundingClientRect();
    return zurWelt({ x: e.clientX - r.left, y: e.clientY - r.top }, blick);
  };
  const toleranz = BILD_TOLERANZ / blick.skala;

  /**
   * Was unter dem Finger liegt. Achsen und Schrauben zuerst — sie sitzen *auf*
   * einem Teil und wären sonst nie zu treffen —, dann Teile, zuletzt Seile
   * und Federn. Ein Seil, das über ein Gewicht läuft, soll das Gewicht nicht
   * verdecken.
   */
  const treffer = (p: Punkt): Auswahl | null => {
    const punkt = verbinderUnter(aufbau, p, toleranz, lage, v => v.art === "achse" || v.art === "schraube");
    if (punkt) return { art: "verbinder", id: punkt.id };
    const [t] = teileUnter(aufbau, p, lage, 2 / blick.skala);
    if (t) return { art: "teil", id: t.id };
    const linie = verbinderUnter(aufbau, p, toleranz, lage);
    return linie ? { art: "verbinder", id: linie.id } : null;
  };

  function beiDruck(e: React.PointerEvent) {
    const p = weltpunkt(e);
    huelle.current?.setPointerCapture?.(e.pointerId);

    if (versuch) {
      const t = treffer(p);
      setAuswahl(t);
      if (t?.art === "teil" && laeuft && welt.current?.greife(t.id, p)) {
        zieht.current = { art: "hand", id: t.id };
        return;
      }
      if (!t) zieht.current = { art: "blick", start: { x: e.clientX, y: e.clientY }, mitte: blick.mitte };
      return;
    }

    if (werkzeug.art === "teil") {
      const r = fuegeTeilHinzu(aufbau, werkzeug.teil, p, standardWerteTeil(werkzeug.teil));
      aendere(v => tue(v, r.aufbau));
      setAuswahl({ art: "teil", id: r.id });
      if (!e.shiftKey) setWerkzeug({ art: "auswahl" });
      return;
    }
    if (werkzeug.art === "verbinder") {
      const art = werkzeug.verbinder;
      if (art === "achse" || art === "schraube") {
        const r = setzeGelenk(aufbau, art, p);
        if ("fehler" in r) setFehler(r.fehler);
        else { aendere(v => tue(v, r.aufbau)); setAuswahl({ art: "verbinder", id: r.id }); }
        return;
      }
      if (!spannStart) { setSpannStart(p); return; }
      const r = spanne(aufbau, art, spannStart, p);
      setSpannStart(null);
      if ("fehler" in r) setFehler(r.fehler);
      else { aendere(v => tue(v, r.aufbau)); setAuswahl({ art: "verbinder", id: r.id }); }
      return;
    }

    const t = treffer(p);
    setAuswahl(t);
    if (t?.art === "teil") {
      const teil = aufbau.teile.find(x => x.id === t.id)!;
      aendere(merke);
      zieht.current = { art: "teil", id: t.id, griff: { x: p.x - teil.pos.x, y: p.y - teil.pos.y } };
    } else if (!t) {
      zieht.current = { art: "blick", start: { x: e.clientX, y: e.clientY }, mitte: blick.mitte };
    }
  }

  function beiBewegung(e: React.PointerEvent) {
    const p = weltpunkt(e);
    setZeiger(p);
    const z = zieht.current;
    if (!z) {
      setSchwebt(treffer(p));
      return;
    }
    if (z.art === "hand") welt.current?.ziehe(p);
    else if (z.art === "teil") aendere(v => setze(v, setzeLage(v.jetzt, z.id, { x: p.x - z.griff.x, y: p.y - z.griff.y })));
    else {
      setBlick(b => ({
        ...b,
        mitte: { x: z.mitte.x - (e.clientX - z.start.x) / b.skala, y: z.mitte.y + (e.clientY - z.start.y) / b.skala },
      }));
    }
  }

  function beiLoslassen() {
    if (zieht.current?.art === "hand") welt.current?.lasse();
    zieht.current = null;
  }

  function beiRad(e: React.WheelEvent) {
    // Um den Zeiger zoomen: der Punkt unter dem Finger bleibt, wo er ist.
    const p = weltpunkt(e);
    setBlick(b => {
      const skala = Math.min(4000, Math.max(30, b.skala * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      const k = b.skala / skala;
      return { ...b, skala, mitte: { x: p.x + (b.mitte.x - p.x) * k, y: p.y + (b.mitte.y - p.y) * k } };
    });
  }

  // ── Tastatur ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && (ziel.tagName === "INPUT" || ziel.tagName === "TEXTAREA" || ziel.tagName === "SELECT")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !versuch) {
        e.preventDefault();
        aendere(e.shiftKey ? vor : zurueck);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && !versuch) {
        e.preventDefault();
        aendere(vor);
        return;
      }
      if (e.key === "Escape") { setWerkzeug({ art: "auswahl" }); setSpannStart(null); return; }
      if (versuch || !auswahl) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        aendere(v => tue(v, auswahl.art === "teil" ? entferneTeil(v.jetzt, auswahl.id) : entferneVerbinder(v.jetzt, auswahl.id)));
        setAuswahl(null);
        return;
      }
      if (auswahl.art === "teil" && (e.key === "r" || e.key === "R")) {
        const t = aufbau.teile.find(x => x.id === auswahl.id);
        if (t) aendere(v => tue(v, setzeLage(v.jetzt, t.id, t.pos, t.winkel + (e.shiftKey ? -DREHSCHRITT : DREHSCHRITT))));
      }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [versuch, auswahl, aufbau, aendere]);

  // ── Aktionen des Inspektors ─────────────────────────────────────────────────
  const aktionen = {
    teilWerte: (id: string, w: Record<string, number>) => aendere(v => tue(v, setzeTeilWerte(v.jetzt, id, w))),
    verbinderWerte: (id: string, w: Record<string, number>) => {
      aendere(v => tue(v, setzeVerbinderWerte(v.jetzt, id, w)));
      // Bedienelemente wirken auch im laufenden Versuch.
      if (versuch && w.drehzahl !== undefined) welt.current?.setzeDrehzahl(id, w.drehzahl);
    },
    drehe: (id: string, winkel: number) => {
      const t = aufbau.teile.find(x => x.id === id);
      if (t) aendere(v => tue(v, setzeLage(v.jetzt, id, t.pos, winkel)));
    },
    anWand: (id: string, art: "schraube" | "achse") => {
      const t = aufbau.teile.find(x => x.id === id);
      if (!t) return;
      const r = verbinde(aufbau, art, amTeil(id), wand(t.pos), standardWerteVerbinder(art));
      aendere(v => tue(v, r.aufbau));
    },
    entferne: (a: Auswahl) => {
      aendere(v => tue(v, a.art === "teil" ? entferneTeil(v.jetzt, a.id) : entferneVerbinder(v.jetzt, a.id)));
      setAuswahl(null);
    },
    loese: (id: string) => {
      welt.current?.loese(id);
      geloest.current.add(id);
      setTakt(x => x + 1);
    },
  };

  const hinweis = werkzeug.art === "verbinder"
    ? (spannStart ? "Jetzt das Ende antippen." : verbinderTyp(werkzeug.verbinder)?.hinweis)
    : werkzeug.art === "teil"
      ? "Auf die Wand tippen, wo es hin soll. Mit Umschalt bleibt das Werkzeug für das nächste."
      : versuch
        ? "Teile greifen und werfen, Verbinder antippen zum Lösen."
        : "Teile ziehen, mit R drehen, Entf entfernt. Strg+Z macht rückgängig.";

  const knopf = "rounded-xl border border-[var(--border)] px-3 py-2 text-sm";
  const aktivKnopf = (an: boolean) => `${knopf} ${an ? "border-[var(--accent)] text-[var(--accent)] font-bold" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🔬 Physiklabor</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1 max-w-2xl">
            Ein Baukasten aus Brettern, Stangen, Gewichten, Achsen, Seilen und Federn — daraus wird ein Pendel,
            eine Wippe, ein Flaschenzug. Oder ein Trebuchet.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          value={aufbau.titel}
          disabled={versuch}
          onChange={e => aendere(v => setze(v, { ...v.jetzt, titel: e.target.value }))}
          aria-label="Name des Aufbaus"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-bold min-w-48"
        />
        <div className="inline-flex rounded-xl border border-[var(--border)] overflow-hidden" role="group" aria-label="Modus">
          <button onClick={zumBauen} aria-pressed={!versuch}
            className={`px-3 py-2 font-bold ${!versuch ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)]"}`}
          >🛠️ Bauen</button>
          <button onClick={starteVersuch} aria-pressed={versuch}
            className={`px-3 py-2 font-bold ${versuch ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)]"}`}
          >🧪 Versuch</button>
        </div>
        {versuch ? (
          <>
            <button onClick={() => setLaeuft(l => !l)} aria-pressed={laeuft} className={`${knopf} font-bold`}>
              {laeuft ? "⏸️ Anhalten" : "▶️ Laufen"}
            </button>
            <button onClick={() => { setDurchlauf(d => d + 1); setLaeuft(true); }} className={knopf}>⏮️ Von vorn</button>
          </>
        ) : (
          <>
            <button onClick={() => aendere(zurueck)} disabled={!stand.verlauf.vorher.length} className={`${knopf} disabled:opacity-40`} title="Strg+Z">↶ Rückgängig</button>
            <button onClick={() => aendere(vor)} disabled={!stand.verlauf.nachher.length} className={`${knopf} disabled:opacity-40`} title="Strg+Y">↷ Wiederholen</button>
            <button onClick={() => { aendere(v => tue(v, { ...neuerAufbau(), titel: v.jetzt.titel })); setAuswahl(null); }} className={aktivKnopf(false)}>
              🧹 Tisch abräumen
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[12rem_1fr_17rem] gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-3 max-h-[72vh] overflow-y-auto">
          {versuch && (
            <p className="rounded-xl bg-[var(--surface-hover)] p-2 text-xs text-[var(--text-muted)]">
              Im Versuch ist der Aufbau fest. <button onClick={zumBauen} className="font-bold text-[var(--accent)] underline">Zum Bauen</button>
            </p>
          )}
          <button onClick={() => setWerkzeug({ art: "auswahl" })} disabled={versuch}
            className={`${aktivKnopf(werkzeug.art === "auswahl" && !versuch)} text-left disabled:opacity-40`}>↖ Auswählen</button>
          <Gruppe titel="Teile">
            {TEILE.map(t => (
              <button key={t.art} disabled={versuch} aria-label={`${t.name} hinstellen`}
                onClick={() => { setWerkzeug({ art: "teil", teil: t.art }); setSpannStart(null); }}
                className={`${aktivKnopf(werkzeug.art === "teil" && werkzeug.teil === t.art)} text-left flex gap-2 disabled:opacity-40`}>
                <span aria-hidden="true">{t.icon}</span>{t.name}
              </button>
            ))}
          </Gruppe>
          <Gruppe titel="Verbinder">
            {VERBINDER.map(v => (
              <button key={v.art} disabled={versuch} aria-label={`${v.name} setzen`}
                onClick={() => { setWerkzeug({ art: "verbinder", verbinder: v.art }); setSpannStart(null); }}
                className={`${aktivKnopf(werkzeug.art === "verbinder" && werkzeug.verbinder === v.art)} text-left flex gap-2 disabled:opacity-40`}>
                <span aria-hidden="true">{v.icon}</span>{v.name}
              </button>
            ))}
          </Gruppe>
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          <div
            ref={huelle}
            aria-label="Werkbank"
            role="application"
            className="relative rounded-2xl overflow-hidden border border-[var(--border)] bg-[#1c2535] touch-none"
            style={{ height: "min(72vh, 660px)", minHeight: 360, cursor: werkzeug.art === "auswahl" ? (schwebt ? "grab" : "default") : "crosshair" }}
            onPointerDown={beiDruck}
            onPointerMove={beiBewegung}
            onPointerUp={beiLoslassen}
            onPointerCancel={beiLoslassen}
            onPointerLeave={() => { beiLoslassen(); setZeiger(null); setSchwebt(null); }}
            onWheel={beiRad}
          >
            {fehler && (
              <div role="alert" className="absolute left-1/2 -translate-x-1/2 top-3 rounded-xl bg-rose-950/90 border border-rose-400/50 px-4 py-2 text-xs font-bold text-rose-100">
                {fehler}
              </div>
            )}
            {aufbau.teile.length === 0 && !versuch && (
              <p className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm text-slate-400 text-center px-6">
                Die Wand ist leer. Links ein Teil wählen und auf die Wand tippen.
              </p>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)]" role="status">{hinweis}</p>
        </div>

        <Inspektor
          aufbau={aufbau}
          auswahl={auswahl}
          versuch={versuch}
          welt={welt.current}
          geloest={geloest.current}
          takt={takt}
          aktionen={aktionen}
        />
      </div>
    </div>
  );
}

function Gruppe({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)] mb-1">{titel}</div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}
