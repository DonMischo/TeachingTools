"use client";
/**
 * Das Oszilloskop — ein Gerät für alle Bereiche.
 *
 * Es kennt weder Pendel noch Stromkreis noch Lichtsensor: es liest Signale
 * vom Messbus. Deshalb zeigt dasselbe Gerät später den Pendelwinkel, die
 * Knotenspannung, die Beleuchtungsstärke und die Abkühlkurve an, ohne dass
 * eine Zeile dafür dazukommt.
 *
 * Gezeichnet wird auf Zuruf der Uhr (`beobachte`), nicht über React-Zustand —
 * sonst rendert das ganze Labor 60-mal je Sekunde neu.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatiere, type AnzeigeEinheit, type Einheit } from "@/lib/physik/einheiten";
import { geraetTyp } from "@/lib/physik/katalog";
import { signalId, type Messbus, type SignalId } from "@/lib/physik/messbus";
import { ausschnitt, spanne } from "@/lib/physik/oszilloskop";
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
  const [anzeige, setAnzeige] = useState<(number | undefined)[]>([]);

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

  const zeichne = useCallback(() => {
    const c = leinwand.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { b, h } = masse;
    if (c.width !== Math.max(1, b * dpr)) c.width = Math.max(1, b * dpr);
    if (c.height !== Math.max(1, h * dpr)) c.height = Math.max(1, h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#050b16";
    ctx.fillRect(0, 0, b, h);

    // Raster: zehn Felder quer, acht hoch — wie am echten Gerät.
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
    const gelesen: (number | undefined)[] = [];

    kanaele.forEach((id, k) => {
      if (!id) { gelesen[k] = undefined; return; }
      const roh = bus.verlauf(id);
      // Ausgelöst wird immer am ersten Kanal — sonst laufen die beiden
      // Kurven gegeneinander und das Bild wird unlesbar.
      const pegel = auslaufen && k === 0 ? 0 : null;
      const teil = ausschnitt(roh, dauer, pegel);
      gelesen[k] = teil.v[teil.v.length - 1];
      if (teil.t.length < 2) return;

      const { min, max } = spanne(teil.v);
      const t0 = teil.t[0];
      const x = (t: number) => ((t - t0) / dauer) * b;
      const y = (v: number) => h - ((v - min) / (max - min)) * h;

      ctx.strokeStyle = KANAL_FARBE[k];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x(teil.t[0]), y(teil.v[0]));
      for (let i = 1; i < teil.t.length; i++) ctx.lineTo(x(teil.t[i]), y(teil.v[i]));
      ctx.stroke();
    });

    setAnzeige(alt => (alt[0] === gelesen[0] && alt[1] === gelesen[1] ? alt : gelesen));
  }, [bus, kanaele, masse, zeitProFeld, auslaufen]);

  useEffect(() => {
    zeichne();
    return beobachte(zeichne);
  }, [beobachte, zeichne]);

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
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-black">📟 Oszilloskop</span>

        {[0, 1].map(k => {
          const gewaehlt = moeglich.find(m => m.id === kanaele[k]);
          return (
            <label key={k} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: KANAL_FARBE[k] }} />
              <select
                aria-label={`Kanal ${k + 1}`}
                value={kanaele[k] ?? ""}
                onChange={e => setKanaele(alt => alt.map((v, i) => (i === k ? (e.target.value || null) : v)))}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 max-w-44"
              >
                <option value="">— aus —</option>
                {moeglich.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <span className="font-bold tabular-nums min-w-20" style={{ color: KANAL_FARBE[k] }}>
                {gewaehlt && anzeige[k] !== undefined ? formatiere(anzeige[k]!, gewaehlt.einheit, gewaehlt.anzeige) : "—"}
              </span>
            </label>
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
          <span className="text-[var(--text-muted)]" title="Zeichnet ab der letzten steigenden Flanke durch null — dadurch steht die Schwingung still.">
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
          Noch nichts zu messen. Stell einen Funktionsgenerator oder einen Kraftmesser auf den Tisch.
        </p>
      )}
    </div>
  );
}
