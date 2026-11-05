"use client";
/**
 * KI-Kompass: gemeinsamer Rahmen, in den Lehrkräfte und Lernende hineinwachsen.
 * Reiter: Start · Kompetenzraster · KI-Führerschein · Portfolio · (Lehrkräfte).
 *
 * Speichern: Konten am Server (eigener Stand über alle Sitzungen), Gäste im
 * Browser. Wer über einen Code beigetreten ist, spiegelt den Stand zusätzlich
 * in die Sitzung, damit die Lehrkraft ihn sieht.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type KiKompassStand, type MausZugang } from "@/lib/api";
import { BEREICHE, NAMENSNENNUNG } from "@/lib/kikompass/raster";
import type { StationStand } from "@/lib/kikompass/stationen";
import { aisAus } from "@/lib/kikompass/ais";
import { Raster } from "./Raster";
import { Fuehrerschein } from "./Fuehrerschein";
import { Portfolio } from "./Portfolio";
import { Lehrkraft, type LehrUnter } from "./Lehrkraft";
import { Workflows } from "./Workflows";
import { Projekte } from "./Projekte";
import type { Sprungziel } from "./AktivWeg";
import type { WerkstattTeil } from "./Werkstatt";

type Reiter = "start" | "raster" | "fuehrerschein" | "portfolio" | "projekte" | "workflows" | "lehrkraft";
const LEER: KiKompassStand = { einschaetzungen: [], stationen: {} };

function lokalLaden(schluessel: string): KiKompassStand {
  try {
    const roh = JSON.parse(localStorage.getItem(schluessel) ?? "null");
    if (roh && Array.isArray(roh.einschaetzungen) && typeof roh.stationen === "object") return roh;
  } catch { /* leer */ }
  return LEER;
}

export default function KiKompass({ action, name = "", konto, verwaltung = false, zugang: beitritt, speicherSchluessel, vorgabe }: {
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
  /** TaskCrawler-Station: { reiter } öffnet diesen Reiter. */
  vorgabe?: Vorgabe;
}) {
  // Station mit festem Reiter: ohne Reiterleiste, wie es der TaskCrawler verspricht.
  const festerReiter = wahl(vorgabe, "reiter", ["start", "raster", "fuehrerschein", "portfolio", "projekte", "workflows"] as const);
  const [reiter, setReiter] = useState<Reiter>(festerReiter ?? "start");
  const [lehrUnter, setLehrUnter] = useState<LehrUnter>("uebersicht");
  const [werkstattTeil, setWerkstattTeil] = useState<WerkstattTeil>("material");
  const [stand, setStand] = useState<KiKompassStand>(LEER);
  // An den Zustand gebunden statt an ein Ref: so speichert StrictMode nie einen leeren Stand über einen geladenen.
  const [geladenFuer, setGeladenFuer] = useState<string | null>(null);
  const [fehler, setFehler] = useState(false);
  // Zuletzt vom Server geladener bzw. dorthin gespeicherter Stand (JSON), um unnötige Speicherungen zu sparen.
  const amServer = useRef<string | null>(null);
  const lokal = `hp_kikompass_${speicherSchluessel}`;

  // Lernende, die den KI-Kompass direkt öffnen (ohne Code), hängen an ihrer zuletzt genutzten Sitzung.
  // So sehen sie den AIS.chat-Link der Lehrkraft, und die Lehrkraft sieht ihren Stand.
  const { data: letzteSitzung } = useQuery({
    queryKey: ["kikompass-meine-sitzung"],
    queryFn: () => api.kikompass.meineSitzung(),
    enabled: konto && !verwaltung && !beitritt,
  });
  const letzterCode = letzteSitzung?.code;
  const zugang = useMemo<MausZugang | undefined>(
    () => beitritt ?? (letzterCode ? { code: letzterCode, token: null } : undefined),
    [beitritt, letzterCode],
  );

  const { data: eigeneSitzung } = useQuery({
    queryKey: ["kikompass-sitzung"],
    queryFn: () => api.toolSessions.create("kikompass"),
    enabled: verwaltung && !zugang,
  });
  const lehrCode = zugang?.code ?? eigeneSitzung?.code ?? null;
  // Wer über den Code kommt, liest die Einstellungen der Lehrkraft (AIS.chat-Links) mit. Neue Links kommen nach spätestens 30 s an.
  const { data: beigetreteneSitzung } = useQuery({
    queryKey: ["kikompass-sitzung-zugang", zugang?.code],
    queryFn: () => api.toolSessions.get(zugang!.code),
    enabled: !!zugang,
    refetchInterval: 30000,
  });
  const qc = useQueryClient();
  const ais = aisAus((zugang ? beigetreteneSitzung : eigeneSitzung)?.settings);

  useEffect(() => {
    let aktiv = true;
    if (!konto) {
      setStand(lokalLaden(lokal));
      setGeladenFuer(lokal);
      return;
    }
    api.kikompass.stand()
      .then(s => { if (aktiv) { amServer.current = JSON.stringify(s); setStand(s); setGeladenFuer(lokal); } })
      .catch(() => { if (aktiv) { setStand(lokalLaden(lokal)); setGeladenFuer(lokal); setFehler(true); } });
    return () => { aktiv = false; };
  }, [konto, lokal]);

  useEffect(() => {
    if (geladenFuer !== lokal) return;
    const json = JSON.stringify(stand);
    try { localStorage.setItem(lokal, json); } catch { /* privat */ }
    const t = setTimeout(() => {
      // Nur speichern, was sich geändert hat: Bloßes Öffnen legt keine Zeile an.
      if (konto && json !== amServer.current) {
        api.kikompass.speichern(stand).then(() => { amServer.current = json; setFehler(false); }).catch(() => setFehler(true));
      }
      // Der Spiegel in die Sitzung geht auch beim Öffnen raus: So sieht die Lehrkraft, wer beigetreten ist.
      if (zugang) api.kikompass.sitzungStand(zugang, stand).catch(() => { /* nur für die Übersicht */ });
    }, 800);
    return () => clearTimeout(t);
  }, [stand, geladenFuer, lokal, konto, zugang]);

  const setStation = (id: string, s: StationStand) =>
    setStand(alt => ({ ...alt, stationen: { ...alt.stationen, [id]: s } }));

  function sprung(ziel: Sprungziel) {
    if (ziel === "raster" || ziel === "fuehrerschein" || ziel === "projekte") { setReiter(ziel); return; }
    if (ziel === "uebersicht") { setLehrUnter("uebersicht"); return; }
    setLehrUnter("werkstatt");
    setWerkstattTeil(ziel === "werkstatt" ? "material" : ziel);
  }

  const REITER: [Reiter, string][] = [
    ["start", "🧭 Start"], ["raster", "🕸️ Kompetenzraster"], ["fuehrerschein", "🪪 KI-Führerschein"], ["portfolio", "📒 Portfolio"], ["projekte", "🚀 Projekte"], ["workflows", "🔀 Workflows"],
    ...(verwaltung ? [["lehrkraft", "👩‍🏫 Für Lehrkräfte"] as [Reiter, string]] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-[var(--seite-breite)] p-4 flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold flex-1">🧭 KI-Kompass</h1>
        {action}
      </header>
      {!festerReiter && <nav className="flex flex-wrap gap-2" role="tablist">
        {REITER.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={reiter === id}
            className={reiter === id ? "chip chip-on" : "chip"} onClick={() => setReiter(id)}>{label}</button>
        ))}
      </nav>}
      {fehler && <p className="text-sm text-bad">Der Server ist gerade nicht erreichbar. Dein Stand liegt vorerst nur in diesem Browser.</p>}
      {geladenFuer !== lokal ? <p className="text-sm text-muted">Lade deinen Stand …</p> : (
        <>
          {reiter === "start" && <Start onWeiter={setReiter} />}
          {reiter === "raster" && (
            <Raster key={stand.einschaetzungen.length} einschaetzungen={stand.einschaetzungen}
              onChange={e => setStand(alt => ({ ...alt, einschaetzungen: e }))} />
          )}
          {reiter === "fuehrerschein" && (
            <Fuehrerschein stande={stand.stationen} onStation={setStation} name={name} konto={konto} code={lehrCode} ais={ais} lehrkraft={verwaltung}
              sitzung={verwaltung && !zugang ? eigeneSitzung ?? null : null} onSitzung={s => qc.setQueryData(["kikompass-sitzung"], s)} />
          )}
          {reiter === "portfolio" && <Portfolio name={name} stande={stand.stationen} einschaetzungen={stand.einschaetzungen} />}
          {reiter === "projekte" && <Projekte ais={ais} />}
          {reiter === "workflows" && <Workflows lehrkraft={verwaltung} mitWerkstatt={!!konto || verwaltung} />}
          {reiter === "lehrkraft" && verwaltung && (
            <Lehrkraft code={lehrCode} sitzung={eigeneSitzung ?? null} onSitzung={s => qc.setQueryData(["kikompass-sitzung"], s)}
              unter={lehrUnter} onUnter={setLehrUnter}
              werkstattTeil={werkstattTeil} onWerkstattTeil={setWerkstattTeil}
              speicherSchluessel={speicherSchluessel} onSprung={sprung} />
          )}
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
        <li>Nach dem Führerschein: neuen Messpunkt im Raster setzen und vergleichen, dann geht es mit den <button className="underline" onClick={() => onWeiter("projekte")}>Projekten</button> auf Stufe II weiter.</li>
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
