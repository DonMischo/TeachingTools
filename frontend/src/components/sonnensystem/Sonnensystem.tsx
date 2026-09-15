"use client";
/**
 * Simulation »Sonnensystem« — fünf Reiter über denselben Daten.
 *
 *   🪐 Übersicht     3D, echte Bahnen zu jedem Datum, Zeitraffer
 *   🚀 Flug          selbst fliegen, scannen, Forschungsaufträge
 *   ⚖️ Größen        maßstabsgetreu nebeneinander
 *   📏 Entfernungen  maßstabsgetreues Band, Lichtstrahl, Reisezeiten
 *   🔭 Galerie       Teleskop- und Sondenbilder
 *
 * Von überall öffnet ein Himmelskörper denselben Steckbrief. Die beiden
 * 3D-Reiter laden three.js erst, wenn man sie öffnet — und nur einer ist
 * gleichzeitig montiert, denn jeder hält einen eigenen WebGL-Kontext.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { KOERPER_NACH_ID } from "@/lib/sonnensystem/daten";
import { textur } from "@/lib/sonnensystem/bilder";
import { Steckbrief } from "./Steckbrief";
import { Groessen } from "./Groessen";
import { Entfernungen } from "./Entfernungen";
import { Galerie } from "./Galerie";

const Uebersicht = lazy(() => import("./Uebersicht"));
const Flug = lazy(() => import("./Flug"));

type Reiter = "uebersicht" | "flug" | "groessen" | "entfernungen" | "galerie";

const REITER: { id: Reiter; name: string }[] = [
  { id: "uebersicht", name: "🪐 Übersicht" },
  { id: "flug", name: "🚀 Flug" },
  { id: "groessen", name: "⚖️ Größen" },
  { id: "entfernungen", name: "📏 Entfernungen" },
  { id: "galerie", name: "🔭 Galerie" },
];

export default function Sonnensystem({ action, speicherSchluessel = "geraet" }: {
  action?: ReactNode;
  /** Wo der Flug-Fortschritt abgelegt wird — je Konto oder Sitzungscode. */
  speicherSchluessel?: string;
}) {
  const [reiter, setReiter] = useState<Reiter>("uebersicht");
  const [ausgewaehlt, setAusgewaehlt] = useState<string | null>(null);
  const [steckbrief, setSteckbrief] = useState<string | null>(null);
  const [galerieOffen, setGalerieOffen] = useState<string | null>(null);
  const [imBrowser, setImBrowser] = useState(false);
  const [vollbild, setVollbild] = useState(false);
  const rahmenRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setImBrowser(true); }, []);
  useEffect(() => {
    const wechsel = () => setVollbild(document.fullscreenElement === rahmenRef.current);
    document.addEventListener("fullscreenchange", wechsel);
    return () => document.removeEventListener("fullscreenchange", wechsel);
  }, []);

  const waehle = useCallback((id: string) => {
    setAusgewaehlt(id);
    setSteckbrief(id);
  }, []);

  const zurGalerie = useCallback((id: string) => {
    setSteckbrief(null);
    setReiter("galerie");
    setGalerieOffen(id);
  }, []);

  const umschaltenVollbild = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rahmenRef.current?.requestFullscreen?.().catch(() => {});
  };

  const himmel = textur("milchstrasse")?.datei;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🪐 Sonnensystem</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1 max-w-2xl">
            Sonne, Planeten und ihre wichtigsten Monde — auf echten Bahnen, maßstabsgetreu verglichen und zum Selberfliegen.
            Mit Bildern von Hubble, Webb und den Raumsonden.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      <div
        ref={rahmenRef}
        className={`flex flex-col gap-2 ${vollbild ? "h-screen p-2 bg-black" : ""}`}
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1 overflow-x-auto flex-1" role="tablist">
            {REITER.map(r => (
              <button
                key={r.id}
                role="tab"
                aria-selected={reiter === r.id}
                onClick={() => setReiter(r.id)}
                className={`shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
                  reiter === r.id
                    ? "bg-[var(--accent)] text-[var(--accent-text,#111)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
                }`}
              >{r.name}</button>
            ))}
          </div>
          <button
            onClick={umschaltenVollbild}
            className="shrink-0 px-3 py-2 rounded-xl text-sm border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
            title={vollbild ? "Vollbild verlassen" : "Vollbild"}
          >{vollbild ? "⤡" : "⛶"}</button>
        </div>

        <div
          className="relative rounded-2xl overflow-hidden border border-white/10"
          style={{
            height: vollbild ? undefined : "min(78vh, 820px)",
            flex: vollbild ? 1 : undefined,
            minHeight: 420,
            background: himmel && reiter !== "uebersicht" && reiter !== "flug"
              ? `linear-gradient(rgba(3,6,14,0.78), rgba(3,6,14,0.9)), url(${himmel}) center / cover`
              : "#02040a",
          }}
        >
          {imBrowser && (
            <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400 text-sm">Lade 3D …</div>}>
              {reiter === "uebersicht" && <Uebersicht ausgewaehlt={ausgewaehlt} onWaehle={waehle} />}
              {reiter === "flug" && <Flug onSteckbrief={waehle} speicherSchluessel={speicherSchluessel} />}
            </Suspense>
          )}
          {reiter === "groessen" && <Groessen onWaehle={waehle} />}
          {reiter === "entfernungen" && <Entfernungen onWaehle={waehle} />}
          {reiter === "galerie" && <Galerie offen={galerieOffen} onOeffne={setGalerieOffen} onWaehle={waehle} />}
        </div>

        {steckbrief && KOERPER_NACH_ID[steckbrief] && (
          <Steckbrief
            koerper={KOERPER_NACH_ID[steckbrief]}
            onWaehle={waehle}
            onSchliessen={() => setSteckbrief(null)}
            onGalerie={zurGalerie}
          />
        )}
      </div>
    </div>
  );
}
