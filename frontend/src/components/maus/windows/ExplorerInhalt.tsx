"use client";
/**
 * Inhalt eines Explorer-Fensters auf dem nachgebauten Dateisystem:
 * Adressleiste, Navigationsbereich und Liste. Der Explorer und der Dialog
 * »Speichern unter« benutzen beide diese Ansicht — so sieht das Kind in
 * beiden dieselben Ordner an denselben Stellen.
 *
 * Systemordner (Windows, Programme, Öffentlich) zeigen keine Dateien, nur
 * eine Warnung mit dem Weg zurück.
 */
import { useState, type DragEvent } from "react";
import { AppSymbol } from "./AppSymbol";
import { OrdnerSymbol } from "./OrdnerSymbol";
import { EIGENE_ORDNER, kinder, pfad, type Dateisystem, type Knoten } from "@/lib/maus/dateisystem";

const BLAU_MARKIERT = "bg-[#0078d738] border-[#0078d799]";
const BLAU_HOVER = "hover:bg-[#0078d71a]";

function Symbol({ k, groesse }: { k: Knoten; groesse: number | string }) {
  if (k.art === "datei" && k.app) return <AppSymbol id={k.app} groesse={groesse} titel={false} />;
  if (k.art === "pc") return <AppSymbol id="dieserpc" groesse={groesse} titel={false} />;
  return <OrdnerSymbol knoten={k} groesse={groesse} />;
}

const ZIEH_TYP = "application/x-maus-datei";

export function ExplorerInhalt({
  fs, ordner, onOrdner, onOeffnen, markiert = null, onMarkieren, onAblegen, onLoeschen, dunkel = false, hilfe = false,
}: {
  fs: Dateisystem;
  ordner: string;
  onOrdner: (id: string) => void;
  /** Doppelklick auf eine Datei. */
  onOeffnen?: (datei: Knoten) => void;
  markiert?: string | null;
  onMarkieren?: (k: Knoten | null) => void;
  /** Datei auf einen Ordner oder ein Laufwerk gezogen (Liste oder Navigationsbereich). Ohne: kein Ziehen. */
  onAblegen?: (dateiId: string, zielId: string) => void;
  /** Markierte Datei löschen (🗑 oder Entf). Ohne: kein Löschen. */
  onLoeschen?: (datei: Knoten) => void;
  dunkel?: boolean;
  hilfe?: boolean;
}) {
  const aktuell = fs[ordner] ?? fs.pc;
  const kette = pfad(fs, aktuell.id);
  const hoch = aktuell.eltern;
  const inhalt = kinder(fs, aktuell.id);
  const icon = hilfe ? 52 : 40;
  const [ueber, setUeber] = useState<string | null>(null);
  const markierteDatei = inhalt.find(k => k.id === markiert && k.art === "datei");

  // Ablegen geht auf Ordner und Laufwerke — in der Liste wie im Navigationsbereich.
  function ablage(zielId: string) {
    if (!onAblegen) return {};
    return {
      onDragOver: (e: DragEvent) => {
        if (!e.dataTransfer.types.includes(ZIEH_TYP)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setUeber(zielId);
      },
      onDragLeave: () => setUeber(u => (u === zielId ? null : u)),
      onDrop: (e: DragEvent) => {
        const id = e.dataTransfer.getData(ZIEH_TYP);
        setUeber(null);
        if (!id) return;
        e.preventDefault();
        onAblegen(id, zielId);
      },
    };
  }

  const farben = dunkel
    ? { grund: "#202020", leiste: "#2b2b2b", text: "#ffffff", leise: "#a3a3a3", linie: "#ffffff1f" }
    : { grund: "#ffffff", leiste: "#f3f3f3", text: "#1a1a1a", leise: "#616161", linie: "#0000001a" };

  function oeffnen(k: Knoten) {
    if (k.art === "datei") onOeffnen?.(k);
    else onOrdner(k.id);
  }

  function navKnopf(id: string, eingerueckt = false) {
    const k = fs[id];
    if (!k) return null;
    const aktiv = aktuell.id === id || ueber === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onOrdner(id)}
        data-nav={id}
        {...ablage(id)}
        className={"flex items-center gap-2 rounded-sm px-2 py-1 text-left border " + (aktiv ? BLAU_MARKIERT : `border-transparent ${BLAU_HOVER}`)}
        style={{ paddingLeft: eingerueckt ? "1.5em" : undefined }}
      >
        <Symbol k={k} groesse={18} />
        <span className="truncate">{k.name}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 select-none" style={{ background: farben.grund, color: farben.text, fontSize: hilfe ? 15 : 13 }} data-testid="explorer-inhalt">
      {/* Adressleiste */}
      <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ background: farben.leiste, borderBottom: `1px solid ${farben.linie}` }}>
        <button
          type="button"
          aria-label="Eine Ebene nach oben"
          title="Eine Ebene nach oben"
          disabled={!hoch}
          onClick={() => hoch && onOrdner(hoch)}
          className={`rounded-sm w-7 h-7 flex items-center justify-center disabled:opacity-30 ${BLAU_HOVER}`}
        >
          ↑
        </button>
        {onLoeschen && (
          <button
            type="button"
            aria-label="Löschen"
            title="Löschen (Entf)"
            disabled={!markierteDatei}
            onClick={() => markierteDatei && onLoeschen(markierteDatei)}
            data-testid="loeschen"
            className={`rounded-sm w-7 h-7 flex items-center justify-center disabled:opacity-30 ${BLAU_HOVER}`}
          >
            🗑
          </button>
        )}
        <div
          className="flex-1 min-w-0 flex items-center gap-0.5 rounded-sm px-1.5 py-1 overflow-x-auto whitespace-nowrap"
          style={{ background: farben.grund, border: `1px solid ${farben.linie}` }}
          data-testid="adressleiste"
        >
          {kette.map((k, i) => (
            <span key={k.id} className="flex items-center gap-0.5">
              {i > 0 && <span style={{ color: farben.leise }}>›</span>}
              <button type="button" onClick={() => onOrdner(k.id)} className={`rounded-sm px-1 ${BLAU_HOVER}`} data-pfad={k.id}>
                {k.name}
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <nav aria-label="Navigationsbereich" className="shrink-0 flex flex-col gap-0.5 p-1.5 overflow-y-auto" style={{ width: hilfe ? "11em" : "10em", borderRight: `1px solid ${farben.linie}` }}>
          {EIGENE_ORDNER.map(o => navKnopf(o.id))}
          <div className="my-1 h-px" style={{ background: farben.linie }} />
          {navKnopf("pc")}
          {navKnopf("c", true)}
          {navKnopf("usb", true)}
        </nav>

        <div
          className="flex-1 min-w-0 overflow-y-auto p-3"
          onClick={e => { if (e.target === e.currentTarget) onMarkieren?.(null); }}
          data-testid="explorer-liste"
        >
          {aktuell.gesperrt ? (
            <div role="alert" className="rounded-lg border border-[#f59e0b] bg-[#f59e0b1f] p-4 flex flex-col gap-3 max-w-md" data-testid="warnung">
              <div className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden>⚠️</span>
                <p className="leading-snug">{aktuell.gesperrt}</p>
              </div>
              {hoch && (
                <button type="button" onClick={() => onOrdner(hoch)} className="self-start rounded-sm px-3 py-1.5 bg-[#0078d7] text-white font-semibold">
                  ← Zurück
                </button>
              )}
            </div>
          ) : inhalt.length === 0 ? (
            <p style={{ color: farben.leise }}>Dieser Ordner ist leer.</p>
          ) : (
            <div className="flex flex-wrap content-start gap-2">
              {inhalt.map(k => (
                <button
                  key={k.id}
                  type="button"
                  data-knoten={k.id}
                  onClick={() => onMarkieren?.(k)}
                  onDoubleClick={() => oeffnen(k)}
                  onKeyDown={e => { if (e.key === "Delete" && onLoeschen && k.art === "datei") onLoeschen(k); }}
                  draggable={!!onAblegen && k.art === "datei"}
                  onDragStart={e => {
                    if (!onAblegen || k.art !== "datei") return;
                    e.dataTransfer.setData(ZIEH_TYP, k.id);
                    e.dataTransfer.effectAllowed = "copyMove";
                    onMarkieren?.(k);
                  }}
                  {...(k.art !== "datei" ? ablage(k.id) : {})}
                  className={"flex flex-col items-center gap-1 rounded-md border p-1.5 text-center " + (markiert === k.id || ueber === k.id ? BLAU_MARKIERT : `border-transparent ${BLAU_HOVER}`)}
                  style={{ width: hilfe ? 112 : 92 }}
                >
                  <Symbol k={k} groesse={icon} />
                  <span className="leading-tight wrap-break-word w-full" style={{ fontSize: "0.92em" }}>{k.name}</span>
                  {k.art === "laufwerk" && (
                    <span className="w-full flex flex-col gap-0.5" aria-label={k.frei}>
                      <span className="h-1.5 w-full rounded-full bg-[#0000001f] overflow-hidden"><span className="block h-full bg-[#0078d7]" style={{ width: `${(k.belegt ?? 0.5) * 100}%` }} /></span>
                      <span style={{ color: farben.leise, fontSize: "0.8em" }}>{k.frei}</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
