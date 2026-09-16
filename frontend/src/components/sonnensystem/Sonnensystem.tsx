"use client";
/**
 * Simulation »Sonnensystem« — sechs Reiter über denselben Daten.
 *
 *   🪐 Übersicht     3D, echte Bahnen zu jedem Datum, Zeitraffer
 *   🚀 Flug          selbst fliegen, scannen, Forschungsaufträge, Erfolge
 *   ⚖️ Größen        maßstabsgetreu nebeneinander
 *   📏 Entfernungen  maßstabsgetreues Band, Lichtstrahl, Reisezeiten
 *   🔭 Galerie       Teleskop-, Sonden- und Missionsbilder — freigeschaltet durch Scans
 *   📓 Kodex         alles Erforschte, Erfolge, Statistik, PDF
 *
 * Der Flug nimmt den ganzen Bildschirm ein (fixed über der App); seine
 * Einstellungen und der Weg zurück stecken dort im Menü oben links. Kodex und
 * Steckbrief legen sich darüber und halten den Flug solange an.
 *
 * Der Forschungsstand (`useForschung`) gehört hierher, weil Flug, Galerie,
 * Steckbrief und Kodex ihn gemeinsam lesen. Von überall öffnet ein
 * Himmelskörper denselben Steckbrief. Die beiden 3D-Reiter laden three.js erst,
 * wenn man sie öffnet — und nur einer ist gleichzeitig montiert, denn jeder
 * hält einen eigenen WebGL-Kontext.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { KOERPER_NACH_ID } from "@/lib/sonnensystem/daten";
import { textur } from "@/lib/sonnensystem/bilder";
import { Steckbrief } from "./Steckbrief";
import { Groessen } from "./Groessen";
import { Entfernungen } from "./Entfernungen";
import { Galerie } from "./Galerie";
import { Kodex, type KodexBereich } from "./Kodex";
import { useForschung } from "./fortschritt";

const Uebersicht = lazy(() => import("./Uebersicht"));
const Flug = lazy(() => import("./Flug"));

type Reiter = "uebersicht" | "flug" | "groessen" | "entfernungen" | "galerie" | "kodex";

const REITER: { id: Reiter; name: string }[] = [
  { id: "uebersicht", name: "🪐 Übersicht" },
  { id: "flug", name: "🚀 Flug" },
  { id: "groessen", name: "⚖️ Größen" },
  { id: "entfernungen", name: "📏 Entfernungen" },
  { id: "galerie", name: "🔭 Galerie" },
  { id: "kodex", name: "📓 Kodex" },
];

export default function Sonnensystem({ action, speicherSchluessel = "geraet", lehrkraft = false }: {
  action?: ReactNode;
  /** Wo der Forschungsstand abgelegt wird — je Konto oder Sitzungscode. */
  speicherSchluessel?: string;
  /** Lehrkräfte dürfen Galerie und Kodex ohne Scans ganz aufdecken. */
  lehrkraft?: boolean;
}) {
  const [reiter, setReiter] = useState<Reiter>("uebersicht");
  const [ausgewaehlt, setAusgewaehlt] = useState<string | null>(null);
  const [steckbrief, setSteckbrief] = useState<string | null>(null);
  const [galerieOffen, setGalerieOffen] = useState<string | null>(null);
  const [kodexUeberFlug, setKodexUeberFlug] = useState<KodexBereich | null>(null);
  const [alleZeigen, setAlleZeigen] = useState(false);
  const [imBrowser, setImBrowser] = useState(false);
  const [vollbild, setVollbild] = useState(false);
  const rahmenRef = useRef<HTMLDivElement>(null);
  const forschung = useForschung(speicherSchluessel);
  const { fortschritt } = forschung;
  const zeigeAlles = lehrkraft && alleZeigen;

  useEffect(() => { setImBrowser(true); }, []);
  useEffect(() => {
    const wechsel = () => setVollbild(document.fullscreenElement === rahmenRef.current);
    document.addEventListener("fullscreenchange", wechsel);
    return () => document.removeEventListener("fullscreenchange", wechsel);
  }, []);

  // Neue Erfolge: je fünf Sekunden eingeblendet, einer nach dem anderen.
  // Nur an der Id hängen: der Fortschritt ändert sich im Flug alle zwei Sekunden.
  const naechsterErfolg = forschung.neueErfolge[0];
  const erfolgId = naechsterErfolg?.id;
  const { gesehen } = forschung;
  useEffect(() => {
    if (!erfolgId) return;
    const t = window.setTimeout(() => gesehen(erfolgId), 5000);
    return () => window.clearTimeout(t);
  }, [erfolgId, gesehen]);

  const waehle = useCallback((id: string) => {
    setAusgewaehlt(id);
    setSteckbrief(id);
  }, []);

  const zurGalerie = useCallback((id: string) => {
    setSteckbrief(null);
    setKodexUeberFlug(null);
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
            Mit Bildern von Hubble, Webb, Raumsonden, Rovern und Astronauten.
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
            </Suspense>
          )}
          {reiter === "groessen" && <Groessen onWaehle={waehle} />}
          {reiter === "entfernungen" && <Entfernungen onWaehle={waehle} />}
          {reiter === "galerie" && (
            <Galerie
              offen={galerieOffen} onOeffne={setGalerieOffen} onWaehle={waehle}
              erforscht={fortschritt.erforscht} alleZeigen={zeigeAlles}
              onAlleZeigen={lehrkraft ? setAlleZeigen : undefined}
            />
          )}
          {reiter === "kodex" && (
            <Kodex
              fortschritt={fortschritt} alleZeigen={zeigeAlles} onSteckbrief={waehle}
              onAlleZeigen={lehrkraft ? setAlleZeigen : undefined}
            />
          )}
        </div>

        {reiter === "flug" && imBrowser && (
          <div className="fixed inset-0 z-40 bg-black">
            <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400 text-sm">Lade 3D …</div>}>
              <Flug
                onSteckbrief={waehle}
                fortschritt={fortschritt}
                aendere={forschung.aendere}
                zuruecksetzen={forschung.zuruecksetzen}
                onVerlassen={setReiter}
                onVollbild={umschaltenVollbild}
                vollbild={vollbild}
                onKodex={setKodexUeberFlug}
                angehalten={kodexUeberFlug !== null || steckbrief !== null}
              />
            </Suspense>
          </div>
        )}

        {reiter === "flug" && kodexUeberFlug && (
          <div className="fixed inset-0 z-[45] bg-slate-950/95 backdrop-blur">
            <div className="h-full max-w-5xl mx-auto">
              <Kodex
                fortschritt={fortschritt} alleZeigen={zeigeAlles} bereich={kodexUeberFlug}
                onSteckbrief={waehle} onSchliessen={() => setKodexUeberFlug(null)}
              />
            </div>
          </div>
        )}

        {steckbrief && KOERPER_NACH_ID[steckbrief] && (
          <Steckbrief
            koerper={KOERPER_NACH_ID[steckbrief]}
            onWaehle={waehle}
            onSchliessen={() => setSteckbrief(null)}
            onGalerie={zurGalerie}
            erforscht={fortschritt.erforscht}
            alleZeigen={zeigeAlles}
          />
        )}

        {naechsterErfolg && (
          <button
            onClick={() => forschung.gesehen(naechsterErfolg.id)}
            className="fixed left-1/2 top-4 -translate-x-1/2 z-[60] flex items-center gap-3 rounded-2xl border border-amber-300/60
              bg-slate-950/90 backdrop-blur px-4 py-3 text-left shadow-[0_0_30px_rgba(252,211,77,0.35)] animate-[erfolg_0.5s_ease-out]"
            role="status"
          >
            <style>{"@keyframes erfolg { from { opacity: 0; transform: translate(-50%, -20px) scale(.95) } to { opacity: 1; transform: translate(-50%, 0) } }"}</style>
            <span className="text-3xl">{naechsterErfolg.icon}</span>
            <span>
              <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">🏆 Erfolg freigeschaltet</span>
              <span className="block font-black text-slate-50">{naechsterErfolg.name}</span>
              <span className="block text-xs text-slate-300">{naechsterErfolg.text}</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
