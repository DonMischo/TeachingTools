"use client";
/**
 * Ein Windows-11-Bildschirm zum Üben: Hintergrund, Desktop-Symbole und die
 * Taskleiste mit Start, Suche, angehefteten Apps, Symbolen und Uhr.
 *
 * Die Maße folgen lib/maus/fenster.ts (900 × 506, Taskleiste 48). Größen
 * laufen über Container-Einheiten (cqw), damit alles mitschrumpft, wenn der
 * Bildschirm schmaler wird — Fenster setzt der Aufrufer in Prozent derselben
 * Fläche.
 *
 * Ebenen: Hintergrund & Symbole → `children` (Fenster) → Taskleiste →
 * `overlay` (Startmenü, Dialoge). `children` und `overlay` lassen Klicks
 * durch; was klickbar sein soll, trägt selbst `pointer-events-auto`.
 *
 * Farben mit Transparenz stehen als Hex-Alpha im Klassennamen — die Form
 * `bg-[var(--x)]/90` ergab bei der alten Taskleiste gar keinen Hintergrund.
 */
import { useEffect, useState, type CSSProperties, type PointerEventHandler, type ReactNode, type Ref } from "react";
import { AppSymbol } from "./AppSymbol";
import { APPS, STANDARD_AUSSEHEN, akzentFarbe, hintergrundCss, type AppId, type Aussehen } from "@/lib/maus/windows";
import { DESKTOP, TASKLEISTE_HOEHE } from "@/lib/maus/fenster";

const cq = (px: number) => `${(px / DESKTOP.w) * 100}cqw`;

/** Der Mauszeiger als SVG — Größe 1–5 und Farbe aus den Einstellungen. */
export function zeigerCursor(groesse: number, farbe: Aussehen["zeigerFarbe"]): string {
  const breite = [20, 28, 36, 48, 64][Math.min(4, Math.max(0, Math.round(groesse) - 1))];
  const fuellung = farbe === "schwarz" ? "#000000" : farbe === "gelb" ? "#c6f700" : farbe === "bunt" ? "url(#r)" : "#ffffff";
  const rand = farbe === "schwarz" ? "#ffffff" : "#000000";
  const verlauf = farbe === "bunt"
    ? "<defs><linearGradient id='r' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#f43f5e'/><stop offset='.5' stop-color='#facc15'/><stop offset='1' stop-color='#22c55e'/></linearGradient></defs>"
    : "";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${breite}' height='${Math.round(breite * 1.5)}' viewBox='0 0 16 24'>${verlauf}`
    + `<path d='M1 1 L1 18 L5.5 13.5 L8.5 21 L11.5 19.8 L8.6 12.6 L14.5 12.6 Z' fill='${fuellung}' stroke='${rand}' stroke-width='1.2' stroke-linejoin='round'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 1 1, auto`;
}

function Uhr({ farbe }: { farbe: string }) {
  // Erst im Browser setzen: die Seite wird auch auf dem Server vorgerendert.
  const [jetzt, setJetzt] = useState<Date | null>(null);
  useEffect(() => {
    setJetzt(new Date());
    const uhr = setInterval(() => setJetzt(new Date()), 20000);
    return () => clearInterval(uhr);
  }, []);
  return (
    <span className="flex flex-col items-end leading-tight tabular-nums" style={{ color: farbe, fontSize: cq(11.5) }}>
      <span>{jetzt ? jetzt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</span>
      <span>{jetzt ? jetzt.toLocaleDateString("de-DE") : ""}</span>
    </span>
  );
}

function StartLogo({ farbe }: { farbe: string }) {
  return (
    <svg viewBox="0 0 20 20" width="100%" height="100%" aria-hidden>
      <rect x="1" y="1" width="8.5" height="8.5" rx="1" fill={farbe} />
      <rect x="10.5" y="1" width="8.5" height="8.5" rx="1" fill={farbe} />
      <rect x="1" y="10.5" width="8.5" height="8.5" rx="1" fill={farbe} />
      <rect x="10.5" y="10.5" width="8.5" height="8.5" rx="1" fill={farbe} />
    </svg>
  );
}

export function WindowsDesktop({
  aussehen = STANDARD_AUSSEHEN,
  symbole,
  taskleiste,
  offen = [],
  aktiv = null,
  onSymbol,
  onTaskleiste,
  onTaskleisteKontext,
  onDesktopKontext,
  onStart,
  onSuche,
  startOffen = false,
  children,
  overlay,
  rahmenRef,
  className = "",
  style,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  aussehen?: Aussehen;
  /** Desktop-Symbole — sonst die aus dem Aussehen. */
  symbole?: AppId[];
  /** Angeheftete Apps — sonst die aus dem Aussehen. Geöffnete, nicht angeheftete Apps kommen hinten dazu. */
  taskleiste?: AppId[];
  offen?: AppId[];
  aktiv?: AppId | null;
  onSymbol?: (id: AppId) => void;
  onTaskleiste?: (id: AppId) => void;
  /** Rechtsklick auf ein Taskleisten-Symbol. */
  onTaskleisteKontext?: (id: AppId, x: number, y: number) => void;
  /** Rechtsklick auf eine freie Stelle des Desktops. */
  onDesktopKontext?: (x: number, y: number) => void;
  onStart?: () => void;
  onSuche?: () => void;
  startOffen?: boolean;
  children?: ReactNode;
  overlay?: ReactNode;
  rahmenRef?: Ref<HTMLDivElement>;
  className?: string;
  style?: CSSProperties;
  onPointerMove?: PointerEventHandler<HTMLDivElement>;
  onPointerUp?: PointerEventHandler<HTMLDivElement>;
  onPointerCancel?: PointerEventHandler<HTMLDivElement>;
}) {
  const [markiert, setMarkiert] = useState<AppId | null>(null);
  const akzent = akzentFarbe(aussehen.akzent);
  const dunkel = aussehen.dunkel;
  const skala = aussehen.textGroesse / 100;
  const leiste = taskleiste ?? aussehen.taskleiste;
  const alleInLeiste = [...leiste, ...offen.filter(id => !leiste.includes(id))];
  const leistenText = dunkel ? "#ffffff" : "#1a1a1a";

  return (
    <div
      ref={rahmenRef}
      className={"relative w-full mx-auto overflow-hidden rounded-2xl border border-[#0000001f] select-none " + className}
      style={{
        maxWidth: DESKTOP.w,
        aspectRatio: `${DESKTOP.w} / ${DESKTOP.h}`,
        background: hintergrundCss(aussehen.hintergrund),
        containerType: "inline-size",
        touchAction: "none",
        cursor: zeigerCursor(aussehen.zeigerGroesse, aussehen.zeigerFarbe),
        fontFamily: '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
        ...style,
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={e => { if (e.target === e.currentTarget) setMarkiert(null); }}
      onContextMenu={e => {
        if (!onDesktopKontext || (e.target !== e.currentTarget && !(e.target as HTMLElement).hasAttribute("data-desktop-flaeche"))) return;
        e.preventDefault();
        onDesktopKontext(e.clientX, e.clientY);
      }}
      data-testid="windows-desktop"
      data-dunkel={dunkel || undefined}
    >
      {/* Desktop-Symbole */}
      <div
        className="absolute left-0 top-0 flex flex-col flex-wrap content-start"
        style={{ height: `calc(100% - ${cq(TASKLEISTE_HOEHE)})`, padding: cq(8), gap: cq(4) }}
        data-desktop-flaeche
        onClick={e => { if (e.target === e.currentTarget) setMarkiert(null); }}
      >
        {(symbole ?? aussehen.desktop).map(id => (
          <button
            key={id}
            type="button"
            data-desktop-symbol={id}
            onClick={() => setMarkiert(id)}
            onDoubleClick={() => onSymbol?.(id)}
            className={"flex flex-col items-center rounded-[3px] border " + (markiert === id ? "bg-[#ffffff40] border-[#ffffff80]" : "border-transparent hover:bg-[#ffffff26]")}
            style={{ width: cq(76), padding: cq(4), gap: cq(2) }}
          >
            <span style={{ width: cq(36), height: cq(36) }}><AppSymbol id={id} groesse="100%" /></span>
            <span
              className="text-white text-center leading-tight"
              style={{ fontSize: `calc(${cq(11)} * ${skala})`, textShadow: "0 1px 2px #000000b3, 0 0 1px #000" }}
            >
              {APPS[id].name}
            </span>
          </button>
        ))}
      </div>

      {/* Fenster */}
      <div className="absolute inset-0 z-10 pointer-events-none">{children}</div>

      {/* Taskleiste */}
      <div
        className={"absolute inset-x-0 bottom-0 z-20 flex items-center backdrop-blur-md " + (dunkel ? "bg-[#202020e6]" : "bg-[#f3f3f3e0]")}
        style={{ height: cq(TASKLEISTE_HOEHE), borderTop: `1px solid ${dunkel ? "#ffffff1a" : "#0000001a"}`, paddingInline: cq(10) }}
        data-testid="taskleiste"
      >
        <div
          className={"flex items-center h-full " + (aussehen.ausrichtung === "mitte" ? "absolute left-1/2 -translate-x-1/2" : "")}
          style={{ gap: cq(4) }}
        >
          <button
            type="button"
            data-start
            aria-label="Start"
            aria-expanded={startOffen}
            onClick={onStart}
            className={"flex items-center justify-center rounded " + (startOffen ? (dunkel ? "bg-[#ffffff1f]" : "bg-[#0000000f]") : (dunkel ? "hover:bg-[#ffffff14]" : "hover:bg-[#0000000a]"))}
            style={{ width: cq(40), height: cq(40), padding: cq(9) }}
          >
            <StartLogo farbe={akzent} />
          </button>
          <button
            type="button"
            data-suche
            onClick={onSuche}
            className={"flex items-center rounded-full border " + (dunkel ? "bg-[#ffffff14] border-[#ffffff1f] text-[#d4d4d4]" : "bg-[#ffffffcc] border-[#0000001a] text-[#5f5f5f]")}
            style={{ height: cq(32), paddingInline: cq(12), gap: cq(8), fontSize: cq(12), width: cq(150) }}
          >
            <svg viewBox="0 0 16 16" style={{ width: cq(13), height: cq(13) }} aria-hidden>
              <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Suche
          </button>
          {alleInLeiste.map(id => {
            const istOffen = offen.includes(id);
            const istAktiv = aktiv === id;
            return (
              <button
                key={id}
                type="button"
                data-taskleiste={id}
                aria-label={`${APPS[id].name}${istOffen ? " (geöffnet)" : ""}`}
                onClick={() => onTaskleiste?.(id)}
                onContextMenu={e => { if (onTaskleisteKontext) { e.preventDefault(); onTaskleisteKontext(id, e.clientX, e.clientY); } }}
                className={"relative flex items-center justify-center rounded " + (istAktiv ? (dunkel ? "bg-[#ffffff1f]" : "bg-[#0000000f]") : (dunkel ? "hover:bg-[#ffffff14]" : "hover:bg-[#0000000a]"))}
                style={{ width: cq(40), height: cq(40), padding: cq(8) }}
              >
                <AppSymbol id={id} groesse="100%" />
                {istOffen && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 rounded-full"
                    style={{ bottom: cq(1), height: cq(3), width: istAktiv ? cq(16) : cq(6), background: istAktiv ? akzent : (dunkel ? "#a3a3a3" : "#8a8a8a") }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center" style={{ gap: cq(10), color: leistenText }}>
          <svg viewBox="0 0 24 16" style={{ width: cq(16), height: cq(12) }} aria-label="WLAN verbunden">
            <path d="M2 6a15 15 0 0 1 20 0M5.5 9.5a10 10 0 0 1 13 0M9 13a5 5 0 0 1 6 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <svg viewBox="0 0 20 16" style={{ width: cq(15), height: cq(12) }} aria-label="Lautsprecher">
            <path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" />
            <path d="M12 5a4 4 0 0 1 0 6M14.5 3a7 7 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <Uhr farbe={leistenText} />
        </div>
      </div>

      {/* Startmenü, Dialoge */}
      <div className="absolute inset-0 z-30 pointer-events-none">{overlay}</div>
    </div>
  );
}
