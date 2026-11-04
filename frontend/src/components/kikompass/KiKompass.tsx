"use client";
/**
 * KI-Kompass: gemeinsamer Rahmen, in den Lehrkräfte und Lernende hineinwachsen.
 * Reiter: Start · Kompetenzraster · KI-Führerschein · Portfolio · (Lehrkräfte).
 *
 * Speichern: Konten am Server (eigener Stand über alle Sitzungen), Gäste im
 * Browser. Wer über einen Code beigetreten ist, spiegelt den Stand zusätzlich
 * in die Sitzung, damit die Lehrkraft ihn sieht.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type KiKompassStand, type MausZugang } from "@/lib/api";
import { BEREICHE, NAMENSNENNUNG } from "@/lib/kikompass/raster";
import type { StationStand } from "@/lib/kikompass/stationen";
import { Raster } from "./Raster";
import { Fuehrerschein } from "./Fuehrerschein";
import { Portfolio } from "./Portfolio";
import { Lehrkraft } from "./Lehrkraft";

type Reiter = "start" | "raster" | "fuehrerschein" | "portfolio" | "lehrkraft";
const LEER: KiKompassStand = { einschaetzungen: [], stationen: {} };

function lokalLaden(schluessel: string): KiKompassStand {
  try {
    const roh = JSON.parse(localStorage.getItem(schluessel) ?? "null");
    if (roh && Array.isArray(roh.einschaetzungen) && typeof roh.stationen === "object") return roh;
  } catch { /* leer */ }
  return LEER;
}

export default function KiKompass({ action, name = "", konto, verwaltung = false, zugang, speicherSchluessel }: {
  action?: ReactNode;
  name?: string;
  /** Angemeldet: Stand liegt am Konto. */
  konto: boolean;
  /** Lehrkraft auf der Werkzeugseite: mit Reiter für Lehrkräfte. */
  verwaltung?: boolean;
  /** Beitritt über Code/QR. */
  zugang?: MausZugang;
  /** Schlüssel im Browser, für Gäste (und als Rückfall). */
  speicherSchluessel: string;
}) {
  const [reiter, setReiter] = useState<Reiter>("start");
  const [stand, setStand] = useState<KiKompassStand>(LEER);
  // An den Zustand gebunden statt an ein Ref: so speichert StrictMode nie einen leeren Stand über einen geladenen.
  const [geladenFuer, setGeladenFuer] = useState<string | null>(null);
  const [fehler, setFehler] = useState(false);
  const lokal = `hp_kikompass_${speicherSchluessel}`;

  const { data: eigeneSitzung } = useQuery({
    queryKey: ["kikompass-sitzung"],
    queryFn: () => api.toolSessions.create("kikompass"),
    enabled: verwaltung && !zugang,
  });
  const lehrCode = zugang?.code ?? eigeneSitzung?.code ?? null;

  useEffect(() => {
    let aktiv = true;
    if (!konto) {
      setStand(lokalLaden(lokal));
      setGeladenFuer(lokal);
      return;
    }
    api.kikompass.stand()
      .then(s => { if (aktiv) { setStand(s); setGeladenFuer(lokal); } })
      .catch(() => { if (aktiv) { setStand(lokalLaden(lokal)); setGeladenFuer(lokal); setFehler(true); } });
    return () => { aktiv = false; };
  }, [konto, lokal]);

  useEffect(() => {
    if (geladenFuer !== lokal) return;
    try { localStorage.setItem(lokal, JSON.stringify(stand)); } catch { /* privat */ }
    const t = setTimeout(() => {
      if (konto) api.kikompass.speichern(stand).then(() => setFehler(false)).catch(() => setFehler(true));
      if (zugang) api.kikompass.sitzungStand(zugang, stand).catch(() => { /* nur für die Übersicht */ });
    }, 800);
    return () => clearTimeout(t);
  }, [stand, geladenFuer, lokal, konto, zugang]);

  const setStation = (id: string, s: StationStand) =>
    setStand(alt => ({ ...alt, stationen: { ...alt.stationen, [id]: s } }));

  const REITER: [Reiter, string][] = [
    ["start", "🧭 Start"], ["raster", "🕸️ Kompetenzraster"], ["fuehrerschein", "🪪 KI-Führerschein"], ["portfolio", "📒 Portfolio"],
    ...(verwaltung ? [["lehrkraft", "👩‍🏫 Für Lehrkräfte"] as [Reiter, string]] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-[var(--seite-breite)] p-4 flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold flex-1">🧭 KI-Kompass</h1>
        {action}
      </header>
      <nav className="flex flex-wrap gap-2" role="tablist">
        {REITER.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={reiter === id}
            className={reiter === id ? "chip chip-on" : "chip"} onClick={() => setReiter(id)}>{label}</button>
        ))}
      </nav>
      {fehler && <p className="text-sm text-bad">Der Server ist gerade nicht erreichbar. Dein Stand liegt vorerst nur in diesem Browser.</p>}
      {geladenFuer !== lokal ? <p className="text-sm text-muted">Lade deinen Stand …</p> : (
        <>
          {reiter === "start" && <Start onWeiter={setReiter} />}
          {reiter === "raster" && (
            <Raster key={stand.einschaetzungen.length} einschaetzungen={stand.einschaetzungen}
              onChange={e => setStand(alt => ({ ...alt, einschaetzungen: e }))} />
          )}
          {reiter === "fuehrerschein" && (
            <Fuehrerschein stande={stand.stationen} onStation={setStation} name={name} konto={konto} code={lehrCode} />
          )}
          {reiter === "portfolio" && <Portfolio name={name} stande={stand.stationen} einschaetzungen={stand.einschaetzungen} />}
          {reiter === "lehrkraft" && verwaltung && <Lehrkraft code={lehrCode} />}
        </>
      )}
    </div>
  );
}

function Start({ onWeiter }: { onWeiter: (r: Reiter) => void }) {
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <p>
        Mit KI umgehen lernen wir alle gerade erst, Schüler·innen genauso wie Lehrkräfte. Der KI-Kompass fängt deshalb
        ganz unten an und wächst mit: <strong>ein Raster, gemeinsam wachsen.</strong>
      </p>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
        {BEREICHE.map(b => (
          <div key={b.id} className="card p-3" style={{ borderTop: `4px solid ${b.farbe}` }}>
            <p className="text-xl">{b.icon}</p>
            <p className="font-semibold">{b.name}</p>
            <p className="text-sm text-muted">{b.untertitel}</p>
          </div>
        ))}
      </div>
      <ol className="list-decimal pl-5 flex flex-col gap-2">
        <li><button className="underline" onClick={() => onWeiter("raster")}>Kompetenzraster</button>: Schätze dich ein. Die Spinne zeigt, wo du stehst.</li>
        <li><button className="underline" onClick={() => onWeiter("fuehrerschein")}>KI-Führerschein</button>: 14 Stationen in vier Modulen, von Stufe 0 bis Stufe I, mit AIS.chat.</li>
        <li><button className="underline" onClick={() => onWeiter("portfolio")}>Portfolio</button>: Deine Reflexionen sammeln sich hier.</li>
        <li>Nach dem Führerschein: neuen Messpunkt im Raster setzen und vergleichen.</li>
      </ol>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer">Quellen und Lizenzen</summary>
        <ul className="list-disc pl-5 mt-1 flex flex-col gap-1">
          <li>{NAMENSNENNUNG}</li>
          <li>Ablauf für Lehrkräfte orientiert am AKTIV(ER)-Framework von Manuel Flick, <a className="underline" href="https://www.manuelflick.de/blog/aktiv-framework" target="_blank" rel="noreferrer">manuelflick.de</a> (nur verlinkt, eigene Texte).</li>
          <li>Themen der Stationen angeregt durch die Pinnwand »KI-Kompetenzen im Unterricht: Impulse für die Praxis« (A. Fischer, U. Friese, K. Minner, S. Ricker, C. Zirwes; VK:KIWA Thinktank, Leitung Dr. M. Veggian). Die Aufgaben sind eigene Texte.</li>
          <li>Faktencheck-Stationen verlinken <a className="underline" href="https://www.iqesonline.net/bildung-digital/checknews/" target="_blank" rel="noreferrer">CheckNews</a> (fög, Universität Zürich, und IQES online).</li>
        </ul>
      </details>
    </div>
  );
}
