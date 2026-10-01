"use client";
/**
 * Leviathan – Kunst des Regierens.
 *
 * Eine vernetzte Regierungssimulation: sechs Hebel, acht Folgegrößen, eine
 * Bevölkerung mit Altersstruktur, Schocks, Wahlen und die Leviathan-Anzeige
 * (Acemoglu & Robinson). Alles rechnet im Browser (lib/leviathan).
 * Mit Code liest das Spiel die Einstellungen der Lehrkraft aus der Sitzung.
 * Entwurf und Quellen: docs/leviathan-recherche.md
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { einstellungenAus, neuesSpiel, runde, wiederaufbau } from "@/lib/leviathan/motor";
import { STANDARD_EINSTELLUNGEN, type Einstellungen, type TypId, type Verteilung, type Zustand } from "@/lib/leviathan/typen";
import LehrkraftPanel from "./LehrkraftPanel";
import Nachbesprechung from "./Nachbesprechung";
import Quellen from "./Quellen";
import Spiel from "./Spiel";
import Start from "./Start";

const VERSION = 1;

function laden(schluessel: string): Zustand | null {
  try {
    const roh = localStorage.getItem(schluessel);
    if (!roh) return null;
    const x = JSON.parse(roh);
    return x?.version === VERSION ? (x.z as Zustand) : null;
  } catch {
    return null;
  }
}

export default function Leviathan({ action, code, lehrkraft = false, speicherSchluessel = "geraet" }: {
  action?: ReactNode;
  /** Sitzungscode: liefert die Einstellungen der Lehrkraft. */
  code?: string | null;
  lehrkraft?: boolean;
  speicherSchluessel?: string;
}) {
  const schluessel = `hp_leviathan_${speicherSchluessel}${code ? `_${code}` : ""}`;
  // Der Spielstand gehört zu genau einem Schlüssel – so überschreibt ein
  // zweites Montieren (StrictMode) oder ein Kontowechsel nichts Fremdes.
  const [stand, setStand] = useState<{ fuer: string | null; z: Zustand | null }>({ fuer: null, z: null });
  const [vorgabe, setVorgabe] = useState<Einstellungen | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [quellenOffen, setQuellenOffen] = useState(false);

  useEffect(() => {
    setStand({ fuer: schluessel, z: laden(schluessel) });
  }, [schluessel]);

  useEffect(() => {
    if (stand.fuer !== schluessel) return;
    try {
      if (stand.z) localStorage.setItem(schluessel, JSON.stringify({ version: VERSION, z: stand.z }));
      else localStorage.removeItem(schluessel);
    } catch { /* voller oder gesperrter Speicher: das Spiel läuft trotzdem */ }
  }, [stand, schluessel]);

  useEffect(() => {
    if (!code) { setVorgabe(null); return; }
    api.toolSessions.get(code).then((s) => setVorgabe(einstellungenAus(s.settings))).catch(() => setVorgabe(null));
  }, [code]);

  const z = stand.fuer === schluessel ? stand.z : null;
  const setZ = useCallback((neu: Zustand | null) => setStand({ fuer: schluessel, z: neu }), [schluessel]);

  // Die Lehrkraft probiert frei aus; Schüler:innen folgen ihrer Vorgabe, wenn es eine gibt.
  const einst = vorgabe ?? STANDARD_EINSTELLUNGEN;
  const krisenWahl = lehrkraft || !vorgabe;

  function starten(typ: TypId, land: string, e: Einstellungen) {
    setFehler(null);
    setZ(neuesSpiel(typ, e, undefined, land));
  }

  function weiter(v: Verteilung) {
    if (!z) return;
    try {
      setZ(runde(z, v));
      window.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
    }
  }

  function neu() {
    if (z && (z.status === "laeuft" || z.status === "wiederaufbau") && !window.confirm("Das laufende Spiel verwerfen?")) return;
    setZ(null);
  }

  function herunterladen() {
    if (!z) return;
    const blob = new Blob([JSON.stringify(z, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leviathan-${z.land.replace(/[^\p{L}\p{N}]+/gu, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function speichern(e: Einstellungen) {
    if (!code) return;
    const s = await api.toolSessions.einstellungen(code, e as unknown as Record<string, unknown>);
    setVorgabe(einstellungenAus(s.settings));
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🐋 Leviathan – Kunst des Regierens</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Regiere ein Land durch Krisen, Wahlen und Rückkopplungen – und halte Staat und Gesellschaft im Gleichgewicht.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setQuellenOffen((o) => !o)} aria-expanded={quellenOffen}
            className="px-3 py-1.5 rounded-lg text-sm font-bold border border-[var(--border)]">📚 Quellen</button>
          {z && <button onClick={neu} className="px-3 py-1.5 rounded-lg text-sm font-bold border border-[var(--border)]">Neues Land</button>}
          {action}
        </div>
      </div>

      {quellenOffen && <Quellen onSchliessen={() => setQuellenOffen(false)} />}

      {lehrkraft && code && !z && (
        <LehrkraftPanel key={JSON.stringify(vorgabe)} einst={vorgabe ?? STANDARD_EINSTELLUNGEN} onSpeichern={speichern} />
      )}

      {fehler && <p role="alert" className="text-sm" style={{ color: "var(--red)" }}>{fehler}</p>}

      {stand.fuer !== schluessel ? null
        : !z ? <Start key={JSON.stringify(einst)} einst={einst} krisenWahl={krisenWahl} onStart={starten} />
        : z.status === "laeuft" || z.status === "wiederaufbau" ? <Spiel z={z} onRunde={weiter} />
        : <Nachbesprechung z={z} onNeu={neu} onDownload={herunterladen} onWiederaufbau={() => setZ(wiederaufbau(z))} />}
    </div>
  );
}
