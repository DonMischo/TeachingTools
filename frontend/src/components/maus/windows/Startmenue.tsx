"use client";
/**
 * Das Windows-11-Startmenü: angeheftete Apps, Empfohlenes — und bei
 * Sucheingabe die Trefferliste statt dessen. Wird von den Stufen in
 * WindowsDesktop `overlay` eingehängt (die Ebene lässt Klicks durch, das
 * Panel selbst braucht deshalb `pointer-events-auto`).
 */
import { useEffect, useRef, useState } from "react";
import { AvatarDisplay } from "@/components/AvatarPicker";
import { AppSymbol } from "./AppSymbol";
import { APPS, SUCH_DATEIEN, suche, type AppId, type Treffer } from "@/lib/maus/windows";

const GRUPPEN_TITEL: Record<Treffer["art"], string> = { app: "Apps", einstellung: "Einstellungen", datei: "Dokumente" };

function TrefferZeile({ t, gross = false, onWahl, onKontext }: {
  t: Treffer; gross?: boolean; onWahl: () => void; onKontext?: (x: number, y: number) => void;
}) {
  const name = t.art === "app" ? APPS[t.id].name : t.name;
  const unterzeile = t.art === "datei" ? t.ort : t.art === "einstellung" ? t.bereich : "App";
  const appId: AppId = t.art === "app" ? t.id : t.art === "datei" ? t.app : "einstellungen";
  return (
    <button
      type="button"
      data-treffer={`${t.art}:${t.id}`}
      onClick={onWahl}
      onContextMenu={e => { if (onKontext) { e.preventDefault(); onKontext(e.clientX, e.clientY); } }}
      className={
        "flex items-center gap-3 rounded-lg text-left hover:bg-[#0000000f] w-full " +
        (gross ? "p-3" : "px-2 py-1.5")
      }
    >
      <AppSymbol id={appId} groesse={gross ? 40 : 24} titel={false} />
      <span className="min-w-0">
        <span className="block truncate font-bold" style={{ fontSize: gross ? "0.95rem" : "0.8rem" }}>{name}</span>
        {gross && <span className="block truncate text-xs opacity-70">{unterzeile}</span>}
      </span>
    </button>
  );
}

export function Startmenue({
  suchText, onSuchText, angeheftet, onApp, onTreffer, onAppKontext,
  benutzer, profilTier = null, onSperren, dunkel, akzent, hilfe = false, autoFocusSuche = false, onSchliessen,
}: {
  suchText: string;
  onSuchText: (t: string) => void;
  angeheftet: AppId[];
  onApp: (id: AppId) => void;
  onTreffer: (t: Treffer) => void;
  onAppKontext?: (id: AppId, x: number, y: number) => void;
  benutzer: string;
  profilTier?: string | null;
  onSperren?: () => void;
  dunkel: boolean;
  akzent: string;
  hilfe?: boolean;
  autoFocusSuche?: boolean;
  onSchliessen?: () => void;
}) {
  const eingabeRef = useRef<HTMLInputElement>(null);
  const [profilMenue, setProfilMenue] = useState(false);

  useEffect(() => {
    if (autoFocusSuche) eingabeRef.current?.focus();
  }, [autoFocusSuche]);

  const treffer = suchText.trim() ? suche(suchText) : [];
  const beste = treffer[0];
  const gruppen: Treffer["art"][] = ["app", "einstellung", "datei"];

  function nachTaste(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onSchliessen?.(); return; }
    if (e.key === "Enter" && beste) { onTreffer(beste); }
  }

  // Auch eine gefundene App lässt sich per Rechtsklick anheften.
  const kontextFuer = (t: Treffer) => t.art === "app" && onAppKontext
    ? (x: number, y: number) => onAppKontext(t.id, x, y)
    : undefined;

  const textGroesse = hilfe ? 1.15 : 1;

  return (
    <div
      data-startmenue
      className={"pointer-events-auto absolute left-1/2 -translate-x-1/2 flex flex-col rounded-xl backdrop-blur-md shadow-2xl overflow-hidden " + (dunkel ? "text-white bg-[#2b2b2bf2]" : "text-[#1a1a1a] bg-[#f3f3f3f2]")}
      style={{ bottom: "12%", width: "62%", maxHeight: "74%", fontSize: `${textGroesse}rem` }}
    >
      <div className="p-4 flex flex-col gap-3 overflow-y-auto">
        <input
          ref={eingabeRef}
          data-testid="startmenue-suche"
          value={suchText}
          onChange={e => onSuchText(e.target.value)}
          onKeyDown={nachTaste}
          placeholder="Programme, Einstellungen und Dokumente durchsuchen"
          className={"rounded-full px-4 py-2 text-sm outline-none border " + (dunkel ? "bg-[#ffffff14] border-[#ffffff1f]" : "bg-white border-[#0000001a]")}
        />

        {!suchText.trim() ? (
          <>
            <section>
              <h3 className="text-xs font-bold opacity-70 mb-2">Angeheftet</h3>
              <div className="grid grid-cols-4 gap-2">
                {angeheftet.map(id => (
                  <button
                    key={id}
                    type="button"
                    data-start-app={id}
                    onClick={() => onApp(id)}
                    onContextMenu={e => { if (onAppKontext) { e.preventDefault(); onAppKontext(id, e.clientX, e.clientY); } }}
                    className="flex flex-col items-center gap-1 rounded-lg p-2 hover:bg-[#0000000f]"
                  >
                    <AppSymbol id={id} groesse={hilfe ? 40 : 30} titel={false} />
                    <span className="text-xs truncate w-full text-center">{APPS[id].name}</span>
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-xs font-bold opacity-70 mb-2">Empfohlen</h3>
              <div className="flex flex-col">
                {SUCH_DATEIEN.slice(0, 3).map(d => (
                  <TrefferZeile
                    key={d.id}
                    t={{ art: "datei", id: d.id, name: d.name, ort: d.ort, app: d.app }}
                    onWahl={() => onTreffer({ art: "datei", id: d.id, name: d.name, ort: d.ort, app: d.app })}
                  />
                ))}
              </div>
            </section>
          </>
        ) : treffer.length === 0 ? (
          <div className="text-sm opacity-70 py-6 text-center">Keine Treffer für »{suchText}«</div>
        ) : (
          <>
            {beste && (
              <section>
                <h3 className="text-xs font-bold opacity-70 mb-2">Beste Übereinstimmung</h3>
                <TrefferZeile t={beste} gross onWahl={() => onTreffer(beste)} onKontext={kontextFuer(beste)} />
              </section>
            )}
            {gruppen.map(art => {
              const liste = treffer.filter(t => t.art === art && t !== beste);
              if (liste.length === 0) return null;
              return (
                <section key={art}>
                  <h3 className="text-xs font-bold opacity-70 mb-2">{GRUPPEN_TITEL[art]}</h3>
                  <div className="flex flex-col">
                    {liste.map(t => <TrefferZeile key={`${t.art}:${t.id}`} t={t} onWahl={() => onTreffer(t)} onKontext={kontextFuer(t)} />)}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>

      <div className={"relative flex items-center gap-2 px-4 py-2.5 border-t " + (dunkel ? "border-[#ffffff1a]" : "border-[#0000001a]")}>
        <button
          type="button"
          onClick={() => { if (onSperren) setProfilMenue(m => !m); }}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#0000000f]"
        >
          {profilTier ? <AvatarDisplay avatarId={profilTier} size="sm" /> : (
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <circle cx="12" cy="8" r="4" fill={akzent} />
              <path d="M4 21c0-4.5 3.5-8 8-8s8 3.5 8 8" fill={akzent} />
            </svg>
          )}
          <span className="text-sm font-bold">{benutzer}</span>
        </button>
        {profilMenue && onSperren && (
          <button
            type="button"
            onClick={() => { setProfilMenue(false); onSperren(); }}
            className={"absolute left-0 bottom-full mb-1 rounded-lg px-3 py-1.5 text-sm font-bold shadow-lg border " + (dunkel ? "bg-[#2b2b2b] border-[#ffffff1f]" : "bg-white border-[#0000001a]")}
          >
            🔒 Sperren
          </button>
        )}
        <span className="flex-1" />
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 3v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
