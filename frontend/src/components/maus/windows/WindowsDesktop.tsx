"use client";
/**
 * Ein Windows-11-Bildschirm zum Üben: Hintergrund, Desktop-Symbole und die
 * Taskleiste mit Start, Suche, angehefteten Apps, Symbolen und Uhr.
 *
 * Je nach gewähltem System (WindowsKontext) stattdessen Ubuntu — obere
 * Leiste mit »Aktivitäten« und Dock links — oder macOS — Menüleiste und Dock
 * unten. Die Knöpfe tragen überall dieselben data-Attribute (data-start,
 * data-suche, data-taskleiste), damit Stufen, Vorführung und Tests nichts
 * über das System wissen müssen. Die zweite Lage aus `aussehen.ausrichtung`
 * (»links«) heißt: Windows links ausgerichtet, Ubuntu-Dock unten, Mac-Dock links.
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
 * `bg-(--x)/90` ergab bei der alten Taskleiste gar keinen Hintergrund.
 */
import { useEffect, useState, type CSSProperties, type PointerEventHandler, type ReactNode, type Ref } from "react";
import { AppSymbol } from "./AppSymbol";
import { STANDARD_AUSSEHEN, akzentFarbe, hintergrundCss, type AppId, type Aussehen } from "@/lib/maus/windows";
import { DESKTOP, TASKLEISTE_HOEHE } from "@/lib/maus/fenster";
import { DOCK_BREITE, OBERE_LEISTE, appName, fuerSystem, type Betriebssystem } from "@/lib/maus/system";
import { useWindows } from "./WindowsKontext";

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

function Uhr({ farbe, zeile = false }: { farbe: string; zeile?: boolean }) {
  // Erst im Browser setzen: die Seite wird auch auf dem Server vorgerendert.
  const [jetzt, setJetzt] = useState<Date | null>(null);
  useEffect(() => {
    setJetzt(new Date());
    const uhr = setInterval(() => setJetzt(new Date()), 20000);
    return () => clearInterval(uhr);
  }, []);
  if (zeile) {
    return (
      <span className="tabular-nums whitespace-nowrap" style={{ color: farbe, fontSize: cq(11.5) }}>
        {jetzt
          ? `${jetzt.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })} ${jetzt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
          : "--:--"}
      </span>
    );
  }
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

function Statussymbole({ farbe }: { farbe: string }) {
  return (
    <>
      <svg viewBox="0 0 24 16" style={{ width: cq(16), height: cq(12), color: farbe }} aria-label="WLAN verbunden">
        <path d="M2 6a15 15 0 0 1 20 0M5.5 9.5a10 10 0 0 1 13 0M9 13a5 5 0 0 1 6 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg viewBox="0 0 20 16" style={{ width: cq(15), height: cq(12), color: farbe }} aria-label="Lautsprecher">
        <path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" />
        <path d="M12 5a4 4 0 0 1 0 6M14.5 3a7 7 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </>
  );
}

/** Neun Punkte — »Anwendungen anzeigen« (Ubuntu) bzw. Launchpad (macOS). */
function Raster({ farbe }: { farbe: string }) {
  return (
    <svg viewBox="0 0 18 18" width="100%" height="100%" aria-hidden>
      {[3, 9, 15].flatMap(y => [3, 9, 15].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.9" style={{ fill: farbe }} />))}
    </svg>
  );
}

function Lupe() {
  return (
    <svg viewBox="0 0 16 16" style={{ width: cq(13), height: cq(13) }} aria-hidden>
      <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Platz, den Leisten und Dock einnehmen — Desktop-Symbole weichen ihm aus. */
export function leistenRand(system: Betriebssystem, alternativ: boolean): { oben: number; links: number; unten: number } {
  if (system === "windows") return { oben: 0, links: 0, unten: TASKLEISTE_HOEHE };
  const oben = OBERE_LEISTE[system];
  const seitlich = system === "ubuntu" ? !alternativ : alternativ;
  return seitlich ? { oben, links: DOCK_BREITE, unten: 0 } : { oben, links: 0, unten: DOCK_BREITE + 4 };
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
  onSystemMenue,
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
  /**
   * Ubuntu: ⏻ oben rechts, macOS: ● oben links — dort sitzen Sperren und
   * Ausschalten. Ohne Handler sind beide nur Bild. Bei Windows gibt es den
   * Knopf nicht (dort: Startmenü › Ein/Aus).
   */
  onSystemMenue?: () => void;
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
  const { system } = useWindows();
  const [markiert, setMarkiert] = useState<AppId | null>(null);
  const akzent = akzentFarbe(aussehen.akzent);
  const dunkel = aussehen.dunkel;
  const skala = aussehen.textGroesse / 100;
  const rand = leistenRand(system, aussehen.ausrichtung === "links");
  const leiste = fuerSystem(taskleiste ?? aussehen.taskleiste, system);
  const offenHier = fuerSystem(offen, system);
  const aktivHier = aktiv ? fuerSystem([aktiv], system)[0] ?? null : null;
  const alleInLeiste = [...leiste, ...offenHier.filter(id => !leiste.includes(id))];
  const leistenText = dunkel ? "#ffffff" : "#1a1a1a";
  const schrift = system === "windows" ? '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif'
    : system === "ubuntu" ? 'Ubuntu, "Ubuntu Sans", Cantarell, system-ui, sans-serif'
    : '-apple-system, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif';

  /** Ein Knopf in Taskleiste oder Dock. `senkrecht`: Dock an der Seite, der Punkt für »offen« steht dann links. */
  function appKnopf(id: AppId, groesse: number, senkrecht = false) {
    const istOffen = offenHier.includes(id);
    const istAktiv = aktivHier === id;
    const hell = system === "ubuntu" || dunkel;
    const punktFarbe = system === "ubuntu" ? "#e95420"
      : system === "macos" ? (dunkel ? "#e5e5e5" : "#333333")
      : istAktiv ? akzent : (dunkel ? "#a3a3a3" : "#8a8a8a");
    return (
      <button
        key={id}
        type="button"
        data-taskleiste={id}
        aria-label={`${appName(id, system)}${istOffen ? " (geöffnet)" : ""}`}
        title={system === "windows" ? undefined : appName(id, system)}
        onClick={() => onTaskleiste?.(id)}
        onContextMenu={e => { if (onTaskleisteKontext) { e.preventDefault(); onTaskleisteKontext(id, e.clientX, e.clientY); } }}
        className={"relative flex items-center justify-center shrink-0 " + (system === "windows" ? "rounded-sm " : "rounded-xl ")
          + (istAktiv && system !== "macos" ? (hell ? "bg-[#ffffff1f]" : "bg-[#0000000f]") : (hell ? "hover:bg-[#ffffff14]" : "hover:bg-[#0000000a]"))}
        style={{ width: cq(groesse), height: cq(groesse), padding: cq(groesse / 5) }}
      >
        <AppSymbol id={id} groesse="100%" />
        {istOffen && (
          <span
            className="absolute rounded-full"
            style={senkrecht
              ? { left: cq(1), top: "50%", transform: "translateY(-50%)", width: cq(3), height: istAktiv ? cq(12) : cq(5), background: punktFarbe }
              : system === "windows"
                ? { bottom: cq(1), left: "50%", transform: "translateX(-50%)", height: cq(3), width: istAktiv ? cq(16) : cq(6), background: punktFarbe }
                : { bottom: cq(0), left: "50%", transform: "translateX(-50%)", width: cq(4), height: cq(4), background: punktFarbe }}
          />
        )}
      </button>
    );
  }

  function startKnopf(inhalt: ReactNode, groesse: number, label: string, extra: string) {
    return (
      <button
        type="button"
        data-start
        aria-label={label}
        title={label}
        aria-expanded={startOffen}
        onClick={onStart}
        className={"flex items-center justify-center shrink-0 " + extra}
        style={{ width: cq(groesse), height: cq(groesse), padding: cq(groesse / 4) }}
      >
        {inhalt}
      </button>
    );
  }

  let leisten: ReactNode;
  if (system === "windows") {
    leisten = (
      <div
        className={"absolute inset-x-0 bottom-0 z-20 flex items-center backdrop-blur-md " + (dunkel ? "bg-[#202020e6]" : "bg-[#f3f3f3e0]")}
        style={{ height: cq(TASKLEISTE_HOEHE), borderTop: `1px solid ${dunkel ? "#ffffff1a" : "#0000001a"}`, paddingInline: cq(10) }}
        data-testid="taskleiste"
      >
        <div
          className={"flex items-center h-full " + (aussehen.ausrichtung === "mitte" ? "absolute left-1/2 -translate-x-1/2" : "")}
          style={{ gap: cq(4) }}
        >
          {startKnopf(<StartLogo farbe={akzent} />, 40, "Start",
            "rounded-sm " + (startOffen ? (dunkel ? "bg-[#ffffff1f]" : "bg-[#0000000f]") : (dunkel ? "hover:bg-[#ffffff14]" : "hover:bg-[#0000000a]")))}
          <button
            type="button"
            data-suche
            onClick={onSuche}
            className={"flex items-center rounded-full border " + (dunkel ? "bg-[#ffffff14] border-[#ffffff1f] text-[#d4d4d4]" : "bg-[#ffffffcc] border-[#0000001a] text-[#5f5f5f]")}
            style={{ height: cq(32), paddingInline: cq(12), gap: cq(8), fontSize: cq(12), width: cq(150) }}
          >
            <Lupe />
            Suche
          </button>
          {alleInLeiste.map(id => appKnopf(id, 40))}
        </div>

        <div className="ml-auto flex items-center" style={{ gap: cq(10), color: leistenText }}>
          <Statussymbole farbe={leistenText} />
          <Uhr farbe={leistenText} />
        </div>
      </div>
    );
  } else if (system === "ubuntu") {
    const seitlich = rand.links > 0;
    leisten = (
      <>
        <div
          className="absolute inset-x-0 top-0 z-20 flex items-center bg-[#000000] text-white"
          style={{ height: cq(OBERE_LEISTE.ubuntu), paddingInline: cq(10), fontSize: cq(12) }}
          data-obere-leiste
        >
          <button
            type="button"
            data-suche
            onClick={onSuche}
            className={"rounded-full font-bold " + (startOffen ? "bg-[#ffffff33]" : "hover:bg-[#ffffff1f]")}
            style={{ paddingInline: cq(10), height: cq(22) }}
          >
            Aktivitäten
          </button>
          <span className="absolute left-1/2 -translate-x-1/2"><Uhr farbe="#ffffff" zeile /></span>
          <span className="ml-auto flex items-center" style={{ gap: cq(10) }}>
            <Statussymbole farbe="#ffffff" />
            <button type="button" data-system-menue aria-label="Systemmenü" onClick={onSystemMenue}
              disabled={!onSystemMenue} className="rounded-full hover:bg-[#ffffff1f] disabled:hover:bg-transparent"
              style={{ fontSize: cq(12), paddingInline: cq(6) }}>⏻</button>
          </span>
        </div>
        <div
          className={"absolute z-20 flex items-center bg-[#1d1d1df0] " + (seitlich ? "left-0 bottom-0 flex-col" : "left-1/2 -translate-x-1/2 rounded-2xl")}
          style={seitlich
            ? { top: cq(OBERE_LEISTE.ubuntu), width: cq(DOCK_BREITE), paddingBlock: cq(8), gap: cq(6) }
            : { bottom: cq(4), height: cq(DOCK_BREITE - 4), paddingInline: cq(8), gap: cq(6) }}
          data-testid="taskleiste"
        >
          {alleInLeiste.map(id => appKnopf(id, 44, seitlich))}
          <span className={seitlich ? "mt-auto" : "ml-2"} />
          {startKnopf(<Raster farbe="#ffffff" />, 44, "Anwendungen anzeigen",
            "rounded-xl " + (startOffen ? "bg-[#ffffff33]" : "hover:bg-[#ffffff1f]"))}
        </div>
      </>
    );
  } else {
    const seitlich = rand.links > 0;
    const menueText = dunkel ? "#ffffff" : "#111111";
    const aktivName = aktivHier ? appName(aktivHier, system) : "Finder";
    leisten = (
      <>
        <div
          className={"absolute inset-x-0 top-0 z-20 flex items-center backdrop-blur-md " + (dunkel ? "bg-[#1e1e1ecc]" : "bg-[#ffffffb3]")}
          style={{ height: cq(OBERE_LEISTE.macos), paddingInline: cq(12), gap: cq(14), fontSize: cq(12), color: menueText }}
          data-obere-leiste
        >
          <button type="button" data-system-menue aria-label="Systemmenü" onClick={onSystemMenue}
            disabled={!onSystemMenue} className="rounded-sm" style={{ fontSize: cq(12), paddingInline: cq(4) }}>●</button>
          <span className="font-bold">{aktivName}</span>
          {["Ablage", "Bearbeiten", "Darstellung", "Fenster", "Hilfe"].map(m => <span key={m}>{m}</span>)}
          <span className="ml-auto flex items-center" style={{ gap: cq(12) }}>
            <Statussymbole farbe={menueText} />
            <button
              type="button"
              data-suche
              onClick={onSuche}
              aria-label="Spotlight"
              className={"rounded-sm flex items-center " + (startOffen ? "bg-[#0000001f]" : "")}
              style={{ paddingInline: cq(4), height: cq(20) }}
            >
              <Lupe />
            </button>
            <Uhr farbe={menueText} zeile />
          </span>
        </div>
        <div
          className={"absolute z-20 flex items-center rounded-2xl backdrop-blur-md border "
            + (dunkel ? "bg-[#2a2a2acc] border-[#ffffff26]" : "bg-[#ffffff66] border-[#ffffff80]")
            + (seitlich ? " flex-col top-1/2 -translate-y-1/2" : " left-1/2 -translate-x-1/2")}
          style={seitlich
            ? { left: cq(4), width: cq(DOCK_BREITE - 8), paddingBlock: cq(6), gap: cq(4) }
            : { bottom: cq(4), height: cq(DOCK_BREITE - 4), paddingInline: cq(6), gap: cq(4) }}
          data-testid="taskleiste"
        >
          {startKnopf(<Raster farbe={dunkel ? "#ffffff" : "#555555"} />, 44, "Launchpad", "rounded-xl hover:bg-[#ffffff33]")}
          {alleInLeiste.map(id => appKnopf(id, 44, seitlich))}
          <span className={seitlich ? "h-px w-3/4" : "w-px h-3/4"} style={{ background: dunkel ? "#ffffff40" : "#00000026" }} />
          <span aria-hidden style={{ width: cq(44), height: cq(44), padding: cq(8) }}><AppSymbol id="papierkorb" groesse="100%" titel={false} /></span>
        </div>
      </>
    );
  }

  // Beim Mac liegt der Papierkorb im Dock, nicht auf dem Schreibtisch.
  const symbolListe = fuerSystem(symbole ?? aussehen.desktop, system).filter(id => !(system === "macos" && id === "papierkorb"));

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
        fontFamily: schrift,
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
      data-system={system}
      data-dunkel={dunkel || undefined}
    >
      {/* Desktop-Symbole — beim Mac rechts oben, wie dort üblich */}
      <div
        className={"absolute flex flex-col flex-wrap " + (system === "macos" ? "right-0 content-end items-end" : "content-start")}
        style={{
          top: cq(rand.oben),
          left: system === "macos" ? undefined : cq(rand.links),
          height: `calc(100% - ${cq(rand.oben + rand.unten)})`,
          padding: cq(8),
          gap: cq(4),
        }}
        data-desktop-flaeche
        onClick={e => { if (e.target === e.currentTarget) setMarkiert(null); }}
      >
        {symbolListe.map(id => (
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
              {appName(id, system)}
            </span>
          </button>
        ))}
      </div>

      {/* Fenster */}
      <div className="absolute inset-0 z-10 pointer-events-none">{children}</div>

      {leisten}

      {/* Startmenü, Dialoge */}
      <div className="absolute inset-0 z-30 pointer-events-none">{overlay}</div>
    </div>
  );
}
