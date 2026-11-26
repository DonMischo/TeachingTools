"use client";
/**
 * Kopf jeder Host-Seite, für alle gleich (Vorbild TaskCrawler-Dashboard):
 * links Zurück, Titel, Code, live/getrennt und kurze Fakten, darunter die
 * Knöpfe der Seite; rechts QR, Beitrittspfad, Gastzugang und »selbst spielen«.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { JoinQR } from "@/components/JoinQR";
import { GuestAccessToggle } from "@/components/GuestAccessToggle";
import { SelbstSpielenKnopf } from "@/components/LehrkraftSpielt";
import { useLanUrl } from "@/hooks/useLanUrl";

/** Einheitlicher Knopf in der Kopfzeile (CSV, Auswertung, PDF …) */
export const KOPF_KNOPF = "text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent disabled:opacity-60";

export function SitzungKopf({ titel, code, pfad, gast, zurueck, untertitel, live, info, selbst = true, qrExtra, children }: {
  titel: ReactNode;
  code: string;
  /** Beitrittspfad, z. B. `/play/bingo/ABC123` */
  pfad: string;
  /** Werkzeug für den Gastzugang (GuestAccessToggle) */
  gast: string;
  zurueck?: { href: string; label: string };
  untertitel?: ReactNode;
  /** Verbindung zum Live-Socket; ohne Angabe keine Anzeige */
  live?: boolean;
  /** Kurze Fakten hinter dem Code (Status, Teilnehmende …) */
  info?: ReactNode[];
  /** »Selbst spielen« am QR anbieten */
  selbst?: boolean;
  /** Weiteres unter dem QR (Barometer: Ergebnisse teilen) */
  qrExtra?: ReactNode;
  /** Knöpfe der Seite */
  children?: ReactNode;
}) {
  const joinUrl = useLanUrl(pfad);
  return (
    <div className="flex items-start gap-4 flex-wrap">
      <div className="flex-1 min-w-0">
        {zurueck && <Link href={zurueck.href} className="text-sm text-muted hover:text-fg">← {zurueck.label}</Link>}
        <h1 className="text-2xl font-black tracking-tight mt-1">{titel}</h1>
        {untertitel && <div className="text-sm text-muted mt-0.5">{untertitel}</div>}
        <div className="text-xs text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span>Code: <b className="font-mono tracking-widest text-fg">{code}</b></span>
          {live !== undefined && <span>{live ? "🟢 live" : "🔴 getrennt"}</span>}
          {info?.map((t, i) => <span key={i}>{t}</span>)}
        </div>
        {children && <div className="flex flex-wrap items-start gap-2 mt-3">{children}</div>}
      </div>
      {joinUrl && (
        <div className="flex flex-col items-center gap-1">
          <JoinQR url={joinUrl} />
          <span className="text-xs text-muted">{pfad}</span>
          <GuestAccessToggle tool={gast} code={code} />
          {selbst && <SelbstSpielenKnopf href={pfad} className="text-xs border border-line rounded-lg px-2 py-1 hover:border-accent" />}
          {qrExtra}
        </div>
      )}
    </div>
  );
}
