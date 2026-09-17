"use client";
/**
 * Das Oszilloskop — ein Gerät für alle Bereiche.
 *
 * Es kennt weder Pendel noch Stromkreis noch Lichtsensor: es liest Signale
 * vom Messbus. Deshalb zeigt dasselbe Gerät später den Pendelwinkel, die
 * Knotenspannung, die Beleuchtungsstärke und die Abkühlkurve an, ohne dass
 * eine Zeile dafür dazukommt.
 *
 * Zwei Dinge sind hier keine Zierde, sondern Bedingung fürs Ablesen:
 *
 * 1. **Beide Kanäle teilen ein Zeitfenster.** Mit eigenem Zeitursprung je
 *    Kanal liefen die Kurven nebeneinanderher und ließen sich nicht mehr
 *    aufeinander beziehen — wozu sonst zwei Kanäle.
 * 2. **Die Höhe lässt sich festhalten.** Wächst sie automatisch mit, füllt
 *    jede Schwingung immer den ganzen Schirm — und ausgerechnet das Abklingen
 *    einer gedämpften Schwingung sieht man dann nicht. Mit »−/+« rastet die
 *    Empfindlichkeit wie am echten Gerät in 1-2-5-Stufen ein.
 *
 * Gezeichnet wird auf Zuruf der Uhr (`beobachte`), nicht über React-Zustand —
 * sonst rendert das ganze Labor 60-mal je Sekunde neu.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatiere, type AnzeigeEinheit, type Einheit } from "@/lib/physik/einheiten";
import { geraetTyp } from "@/lib/physik/katalog";
import { signalId, type Messbus, type SignalId } from "@/lib/physik/messbus";
import { imFenster, jeFeld, spanne, stufe, zeitfenster } from "@/lib/physik/oszilloskop";
import type { Szene } from "@/lib/physik/typen";

const KANAL_FARBE = ["#facc15", "#22d3ee"] as const;
const SPALTEN = 10;
const ZEILEN = 8;

interface Angebot {
  id: SignalId;
  name: string;
  einheit: Einheit;
  anzeige?: AnzeigeEinheit;
}

/** Feste Höheneinstellung eines Kanals: Wert je Feld und Bildmitte. */
interface Hoehe {
  jeFeld: number;
  mitte: number;
}

/** Alle Signale, die in diesem Aufbau überhaupt anfallen können. */
function angebote(szene: Szene): Angebot[] {
  const liste: Angebot[] = [];
  for (const g of szene.geraete) {
    const typ = geraetTyp(g.typ);
    for (const s of typ?.signale ?? []) {
      liste.push({
        id: signalId(g.id, s.schluessel),
        name: `${typ!.name} · ${s.name}`,
        einheit: s.einheit,
        anzeige: s.anzeige,
      });
    }
  }
  return liste;
}

export default function Oszilloskop({ szene, bus, beobachte, zeitProFeld, setZeitProFeld }: {
  szene: Szene;
  bus: Messbus;
  beobachte: (fn: () => void) => () => void;
  zeitProFeld: number;
  setZeitProFeld: (s: number) => void;
}) {
  const leinwand = useRef<HTMLCanvasElement>(null);
  const huelle = useRef<HTMLDivElement>(null);
  const [masse, setMasse] = useState({ b: 640, h: 300 });
  const [kanaele, setKanaele] = useState<(SignalId | null)[]>([null, null]);
  const [auslaufen, setAuslaufen] = useState(true);
  const [hoehen, setHoehen] = useState<(Hoehe | null)[]>([null, null]);
  const [anzeige, setAnzeige] = useState<(number | undefined)[]>([]);
  // Was gerade auf dem Schirm steht — fürs Beschriften neben dem Raster.
  const [achsen, setAchsen] = useState<(Hoehe | null)[]>([null, null]);

  const moeglich = useMemo(() => angebote(szene), [szene]);

  // Ein neu aufgestelltes Gerät kommt von selbst auf den freien Kanal — sonst
  // steht das Oszilloskop nach dem Aufbauen leer da und niemand sucht danach.
  useEffect(() => {
    setKanaele(alt => {
      const gueltig = alt.map(id => (id && moeglich.some(a => a.id === id) ? id : null));
      if (!gueltig[0]) gueltig[0] = moeglich[0]?.id ?? null;
      if (!gueltig[1] && moeglich.length > 1) {
        gueltig[1] = moeglich.find(a => a.id !== gueltig[0])?.id ?? null;
      }
      return gueltig[0] === alt[0] && gueltig[1] === alt[1] ? alt : gueltig;
    });
  }, [moeglich]);

  useEffect(() => {
    const el = huelle.current;
    if (!el) return;
    const messen = () => {
      const r = el.getBoundingClientRect();
      setMasse({ b: Math.round(r.width), h: Math.round(r.height) });
    };
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);

  /** Der Bereich, den Kanal `k` gerade zeigt — fest eingestellt oder mitwachsend. */
  const bereich = useCallback((k: number, werte: number[]) => {
    const fest = hoehen[k];
    if (fest) {
      const halb = (fest.jeFeld * ZEILEN) / 2;
      return { min: fest.mitte - halb, max: fest.mitte + halb };
    }
    return spanne(werte);
  }, [hoehen]);

  const zeichne = useCallback(() => {
    const c = leinwand.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { b, h } = masse;
    const breite = Math.max(1, b * dpr), hoehe = Math.max(1, h * dpr);
    if (c.width !== breite) c.width = breite;
    if (c.height !== hoehe) c.height = hoehe;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#050b16";
    ctx.fillRect(0, 0, b, h);

    ctx.strokeStyle = "rgba(148,163,184,0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < SPALTEN; i++) { ctx.moveTo((b * i) / SPALTEN, 0); ctx.lineTo((b * i) / SPALTEN, h); }
    for (let i = 1; i < ZEILEN; i++) { ctx.moveTo(0, (h * i) / ZEILEN); ctx.lineTo(b, (h * i) / ZEILEN); }
    ctx.stroke();
    ctx.strokeStyle = "rgba(148,163,184,0.4)";
    ctx.beginPath();
    ctx.moveTo(0, h / 2); ctx.lineTo(b, h / 2);
    ctx.moveTo(b / 2, 0); ctx.lineTo(b / 2, h);
    ctx.stroke();

    const dauer = zeitProFeld * SPALTEN;
    // Ein Fenster für beide Kanäle, ausgelöst am ersten belegten.
    const auslöser = kanaele[0] ?? kanaele[1];
    const fenster = zeitfenster(
      auslöser ? bus.verlauf(auslöser) : undefined,
      dauer,
      auslaufen ? 0 : null,
    );
    const breiteZeit = fenster.t1 - fenster.t0 || dauer;

    const gelesen: (number | undefined)[] = [];
    const gezeigt: (Hoehe | null)[] = [null, null];

    kanaele.forEach((id, k) => {
      if (!id) { gelesen[k] = undefined; return; }
      const teil = imFenster(bus.verlauf(id), fenster);
      gelesen[k] = bus.letzter(id);
      if (teil.t.length < 2) return;

      const { min, max } = bereich(k, teil.v);
      gezeigt[k] = { jeFeld: jeFeld(min, max, ZEILEN), mitte: (min + max) / 2 };

      const x = (t: number) => ((t - fenster.t0) / breiteZeit) * b;
      const y = (v: number) => h - ((v - min) / (max - min || 1)) * h;

      // Nulllinie des Kanals, damit man positiv von negativ unterscheidet.
      if (0 > min && 0 < max) {
        ctx.save();
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = KANAL_FARBE[k] + "66";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y(0)); ctx.lineTo(b, y(0));
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, b, h);
      ctx.clip();
      ctx.strokeStyle = KANAL_FARBE[k];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x(teil.t[0]), y(teil.v[0]));
      for (let i = 1; i < teil.t.length; i++) ctx.lineTo(x(teil.t[i]), y(teil.v[i]));
      ctx.stroke();
      ctx.restore();

      // Beschriftung: Kanal 1 links, Kanal 2 rechts.
      const angebot = moeglich.find(m => m.id === id);
      if (angebot) {
        ctx.fillStyle = KANAL_FARBE[k];
        ctx.font = "600 10px system-ui, sans-serif";
        ctx.textAlign = k === 0 ? "left" : "right";
        const rand = k === 0 ? 4 : b - 4;
        ctx.textBaseline = "top";
        ctx.fillText(formatiere(max, angebot.einheit, angebot.anzeige), rand, 3);
        ctx.textBaseline = "bottom";
        ctx.fillText(formatiere(min, angebot.einheit, angebot.anzeige), rand, h - 3);
      }
    });

    setAnzeige(alt => (alt[0] === gelesen[0] && alt[1] === gelesen[1] ? alt : gelesen));
    setAchsen(alt => {
      const gleich = [0, 1].every(k => alt[k]?.jeFeld === gezeigt[k]?.jeFeld && alt[k]?.mitte === gezeigt[k]?.mitte);
      return gleich ? alt : gezeigt;
    });
  }, [bus, kanaele, masse, zeitProFeld, auslaufen, bereich, moeglich]);

  useEffect(() => {
    zeichne();
    return beobachte(zeichne);
  }, [beobachte, zeichne]);

  /** Empfindlichkeit eines Kanals verstellen — das hält sie zugleich fest. */
  function verstelle(k: number, richtung: 1 | -1) {
    setHoehen(alt => {
      const jetzt = alt[k] ?? achsen[k] ?? { jeFeld: 1, mitte: 0 };
      return alt.map((h, i) => (i === k ? { ...jetzt, jeFeld: stufe(jetzt.jeFeld, richtung) } : h));
    });
  }

  function alsCSV() {
    const spalten = kanaele
      .map((id, k) => ({ id, k, a: moeglich.find(m => m.id === id) }))
      .filter((s): s is { id: SignalId; k: number; a: Angebot } => !!s.id && !!s.a);
    if (!spalten.length) return;

    const basis = bus.verlauf(spalten[0].id);
    if (!basis?.t.length) return;

    // Semikolon und Dezimalkomma: so öffnet eine deutsche Tabellenkalkulation
    // die Datei ohne Nachfragen.
    const kopf = ["Zeit in s", ...spalten.map(s => `${s.a.name} in ${s.a.einheit || "1"}`)];
    const zeilen = [kopf.join(";")];
    for (let i = 0; i < basis.t.length; i++) {
      const werte = spalten.map(s => bus.verlauf(s.id)?.v[i]);
      zeilen.push([basis.t[i], ...werte]
        .map(x => (typeof x === "number" ? x.toFixed(6).replace(".", ",") : ""))
        .join(";"));
    }

    const url = URL.createObjectURL(new Blob(["﻿" + zeilen.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${szene.titel || "Messung"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-black">📟 Oszilloskop</span>

        {[0, 1].map(k => {
          const gewaehlt = moeglich.find(m => m.id === kanaele[k]);
          const achse = achsen[k];
          return (
            <div key={k} role="group" aria-label={`Kanal ${k + 1} Einstellung`} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: KANAL_FARBE[k] }} />
              <select
                aria-label={`Kanal ${k + 1}`}
                value={kanaele[k] ?? ""}
                onChange={e => setKanaele(alt => alt.map((v, i) => (i === k ? (e.target.value || null) : v)))}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 max-w-40"
              >
                <option value="">— aus —</option>
                {moeglich.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <span className="font-bold tabular-nums min-w-20" style={{ color: KANAL_FARBE[k] }}>
                {gewaehlt && anzeige[k] !== undefined ? formatiere(anzeige[k]!, gewaehlt.einheit, gewaehlt.anzeige) : "—"}
              </span>

              {gewaehlt && (
                <span className="flex items-center gap-0.5 text-xs">
                  <button
                    onClick={() => verstelle(k, -1)}
                    aria-label={`Kanal ${k + 1} empfindlicher`}
                    className="rounded border border-[var(--border)] w-6 h-6 leading-none"
                  >−</button>
                  <span className="tabular-nums text-[var(--text-muted)] min-w-20 text-center" title="Wert je Rasterfeld">
                    {achse ? `${formatiere(achse.jeFeld, gewaehlt.einheit, gewaehlt.anzeige)}/Feld` : "—"}
                  </span>
                  <button
                    onClick={() => verstelle(k, 1)}
                    aria-label={`Kanal ${k + 1} unempfindlicher`}
                    className="rounded border border-[var(--border)] w-6 h-6 leading-none"
                  >+</button>
                  <button
                    onClick={() => setHoehen(alt => alt.map((h, i) => (i === k ? null : h)))}
                    aria-pressed={hoehen[k] === null}
                    title="Höhe wächst automatisch mit"
                    className={`rounded border border-[var(--border)] px-1.5 h-6 leading-none ${
                      hoehen[k] === null ? "text-[var(--accent)] font-bold" : "text-[var(--text-muted)]"}`}
                  >auto</button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2">
          <span className="text-[var(--text-muted)]">Zeit je Feld</span>
          <input
            type="range" min={-3} max={0.7} step={0.05}
            value={Math.log10(zeitProFeld)}
            onChange={e => setZeitProFeld(10 ** Number(e.target.value))}
            aria-label="Zeit je Feld"
          />
          <span className="font-bold tabular-nums min-w-16">{formatiere(zeitProFeld, "s")}</span>
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={auslaufen} onChange={e => setAuslaufen(e.target.checked)} />
          <span className="text-[var(--text-muted)]" title="Verankert das Bild an einer steigenden Flanke durch null, damit die Schwingung stillsteht.">
            Auslöser bei 0
          </span>
        </label>
        <button
          onClick={alsCSV}
          className="rounded-lg border border-[var(--border)] px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text)]"
        >⬇️ Messwerte als CSV</button>
      </div>

      <div ref={huelle} className="rounded-xl overflow-hidden border border-white/10" style={{ height: 260 }}>
        <canvas ref={leinwand} aria-label="Oszilloskop" style={{ width: masse.b, height: masse.h, display: "block" }} />
      </div>

      {!moeglich.length && (
        <p className="text-xs text-[var(--text-muted)]">
          Noch nichts zu messen. Stell einen Funktionsgenerator, ein Pendel oder einen Kraftmesser auf den Tisch.
        </p>
      )}
    </div>
  );
}
