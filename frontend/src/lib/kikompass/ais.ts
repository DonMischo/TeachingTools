/**
 * AIS.chat-Links einer KI-Kompass-Sitzung. Sie liegen in
 * `ToolSession.settings.ais` (höchstens 4 kB für alle Einstellungen). Lesen
 * kann sie jede·r mit dem Beitrittscode, also dieselben Leute, für die der
 * Einladungslink ohnehin gedacht ist.
 *
 * Was aus den Einstellungen kommt, wird hier geprüft: Nur http(s)-Links ohne
 * Leerzeichen kommen durch, damit nie ein »javascript:«-Link angezeigt wird.
 */
import { STATIONEN } from "./stationen";

export type AisAnzeige = "link" | "qr" | "beides";
export type AisEinstellungen = {
  /** Link für alle Stationen ohne eigenen Link. */
  standard: string | null;
  /** Eigene Lernumgebung je Station (Station-Id → Link). */
  stationen: Record<string, string>;
  anzeige: AisAnzeige;
};

export const LINK_MAX = 500;
/** Unter der 4-kB-Grenze des Servers bleiben, mit Luft für andere Einstellungen. */
export const AIS_MAX_BYTES = 3500;

export const AIS_LEER: AisEinstellungen = { standard: null, stationen: {}, anzeige: "beides" };

const STATION_IDS = new Set(STATIONEN.map(s => s.id));

export function sichererLink(roh: unknown): string | null {
  if (typeof roh !== "string") return null;
  const v = roh.trim();
  if (!v || v.length > LINK_MAX || /\s/.test(v)) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Liest die AIS-Einstellungen aus den Sitzungseinstellungen und verwirft alles Ungültige. */
export function aisAus(settings: Record<string, unknown> | null | undefined): AisEinstellungen {
  const roh = (settings?.ais ?? {}) as Record<string, unknown>;
  const stationen: Record<string, string> = {};
  if (roh.stationen && typeof roh.stationen === "object") {
    for (const [id, link] of Object.entries(roh.stationen as Record<string, unknown>)) {
      const ok = sichererLink(link);
      if (ok && STATION_IDS.has(id)) stationen[id] = ok;
    }
  }
  const anzeige = roh.anzeige === "link" || roh.anzeige === "qr" ? roh.anzeige : "beides";
  return { standard: sichererLink(roh.standard), stationen, anzeige };
}

/** Der Link für eine Station: eigener, sonst der für die ganze Sitzung. */
export function linkFuer(ais: AisEinstellungen, stationId?: string): string | null {
  return (stationId && ais.stationen[stationId]) || ais.standard;
}

/** Hängt die AIS-Einstellungen an die übrigen Sitzungseinstellungen an. */
export function mitAis(settings: Record<string, unknown> | null | undefined, ais: AisEinstellungen): Record<string, unknown> {
  return { ...(settings ?? {}), ais };
}

export function zuGross(settings: Record<string, unknown>): boolean {
  return new TextEncoder().encode(JSON.stringify(settings)).length > AIS_MAX_BYTES;
}
