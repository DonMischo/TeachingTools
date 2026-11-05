"use client";
/**
 * Zeigt den AIS.chat-Zugang, den die Lehrkraft in der Sitzung hinterlegt hat:
 * Link, QR-Code oder beides. Der QR lässt sich zum Abscannen vom Beamer
 * vergrößern.
 */
import { JoinQR } from "@/components/JoinQR";
import { linkFuer, type AisEinstellungen } from "@/lib/kikompass/ais";

export function AisZugang({ ais, stationId, gross = false }: {
  ais: AisEinstellungen | null;
  stationId?: string;
  /** Lehrkraft-Ansicht: größerer QR zum Zeigen. */
  gross?: boolean;
}) {
  const link = ais ? linkFuer(ais, stationId) : null;
  if (!ais || !link) return null;
  const zeigeLink = ais.anzeige !== "qr";
  const zeigeQr = ais.anzeige !== "link";
  return (
    <div className="rounded p-3 bg-surface-hover flex flex-wrap items-center gap-4" aria-label="Zugang zu AIS.chat">
      {zeigeQr && <JoinQR url={link} size={gross ? 180 : 120} />}
      <div className="flex flex-col gap-1 min-w-0">
        <p className="font-medium">🤖 Hier geht es zu AIS.chat</p>
        {zeigeLink && (
          <a href={link} target="_blank" rel="noreferrer noopener" className="btn-primary self-start">AIS.chat öffnen ↗</a>
        )}
        {zeigeLink && <span className="text-xs text-muted break-all">{link}</span>}
        {zeigeQr && <span className="text-xs text-muted">QR-Code mit dem Tablet oder Handy scannen{gross ? " (antippen zum Vergrößern)" : ""}.</span>}
      </div>
    </div>
  );
}
