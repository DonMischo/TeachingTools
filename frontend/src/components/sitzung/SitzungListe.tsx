"use client";
/**
 * Sitzungen eines Werkzeugs, für alle gleich: oben »▶ Neue Sitzung« (Klasse
 * oder Kurs wählen, Starten), darunter je Sitzung eine Zeile mit Status, Code,
 * Klasse, kurzen Fakten und Aktionen. Vorbild ist die Sitzungsliste des
 * TaskCrawlers.
 *
 * Die Komponente kennt die Werkzeuge nicht: Aufrufer liefern Einträge und bauen
 * die Aktionen mit `SitzungAktion`.
 */
import { useState, type ReactNode } from "react";
import { ScopeSelect, type Scope } from "@/components/ScopeSelect";

export type SitzungTon = "live" | "wartet" | "aus";

export type SitzungEintrag = {
  /** Beitritts-Code, zugleich der React-Key */
  code: string;
  status?: { label: string; ton: SitzungTon } | null;
  /** Klasse bzw. Kurs, als Pille */
  klasse?: string | null;
  /** Kurze Fakten, z. B. »3 Versuche«, »12 Teiln.«, ein Datum */
  info?: string[];
  /** Die gerade gewählte Sitzung */
  gewaehlt?: boolean;
  aktionen?: ReactNode;
};

const TON: Record<SitzungTon, string> = {
  live: "border-green-500/40 text-green-500",
  wartet: "border-blue-400/40 text-blue-400",
  aus: "border-line text-muted",
};

export type SitzungNeuProps = {
  onStart: (scope: Scope) => void;
  laeuft?: boolean;
  /** false: Werkzeug ohne Klassenbezug (Lückentext) — nur ein Knopf */
  mitKlasse?: boolean;
  /** Auch ohne Klasse starten (offene Sitzung) */
  ohneKlasse?: boolean;
  label?: string;
  /** Hinweis unter der Zeile, je nach Wahl (Kurs: Punkte je Klasse …) */
  hinweis?: (scope: Scope) => ReactNode;
  /** Weitere Einstellungen vor dem Start (Caputh: Team-Modus) */
  extra?: ReactNode;
};

/** »▶ Neue Sitzung«: Klasse wählen und starten. */
export function SitzungNeu({ onStart, laeuft, mitKlasse = true, ohneKlasse, label = "Starten", hinweis, extra }: SitzungNeuProps) {
  const [scope, setScope] = useState<Scope>(null);
  const start = (s: Scope) => { onStart(s); setScope(null); };
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Neue Sitzung">
      <h2 className="font-semibold text-sm">▶ Neue Sitzung</h2>
      <div className="flex flex-wrap items-center gap-2">
        {mitKlasse && <label className="flex items-center gap-1.5 text-sm">Für <ScopeSelect value={scope} onChange={setScope} className="input w-64" /></label>}
        <button type="button" onClick={() => start(scope)} disabled={laeuft || (mitKlasse && !scope)}
          className="btn-primary text-sm py-1.5 px-4">
          {laeuft ? "Startet …" : label}
        </button>
        {mitKlasse && ohneKlasse && (
          <button type="button" onClick={() => start(null)} disabled={laeuft}
            className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent disabled:opacity-40">
            Ohne Klasse
          </button>
        )}
      </div>
      {extra}
      {hinweis && <div className="text-xs text-muted">{hinweis(scope)}</div>}
    </div>
  );
}

export function SitzungListe({ eintraege, titel = "Sitzungen", leer = "Noch keine Sitzungen.", laedt, neu, kopf, text }: {
  eintraege: SitzungEintrag[];
  titel?: ReactNode;
  leer?: ReactNode;
  laedt?: boolean;
  /** Zeile »▶ Neue Sitzung« oben in der Karte */
  neu?: SitzungNeuProps;
  /** Rechts neben dem Titel (Caputh: »Alle löschen«) */
  kopf?: ReactNode;
  /** Erklärung unter dem Titel */
  text?: ReactNode;
}) {
  return (
    <section className="card p-4 flex flex-col gap-3" aria-label="Sitzungen">
      {neu && <><SitzungNeu {...neu} /><div className="border-t border-line" /></>}
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-sm flex-1">{titel}</h2>
        {kopf}
      </div>
      {text && <p className="text-xs text-muted -mt-2">{text}</p>}
      {laedt ? (
        <p className="text-sm text-muted">Lade …</p>
      ) : eintraege.length === 0 ? (
        <p className="text-sm text-muted">{leer}</p>
      ) : (
        <ul className="divide-y divide-line">
          {eintraege.map(s => (
            <li key={s.code} aria-current={s.gewaehlt || undefined}
              className={`py-2 flex items-center gap-3 flex-wrap ${s.gewaehlt ? "bg-accent/5 -mx-2 px-2 rounded-lg" : ""}`}>
              {s.status && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${TON[s.status.ton]}`}>{s.status.label}</span>
              )}
              <span className="text-sm font-mono tracking-wider">{s.code}</span>
              {s.klasse && <span className="text-xs px-2 py-0.5 rounded-full bg-page text-muted">{s.klasse}</span>}
              {s.info?.map(t => <span key={t} className="text-xs text-muted">{t}</span>)}
              {s.gewaehlt && <span className="text-xs font-bold text-accent">● gewählt</span>}
              <div className="flex-1" />
              {s.aktionen && <div className="flex items-center gap-3 flex-wrap">{s.aktionen}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Aktion in einer Sitzungszeile, als Textlink wie beim TaskCrawler. */
export function SitzungAktion({ onClick, href, download, art = "normal", disabled, title, children }: {
  onClick?: () => void;
  href?: string;
  download?: boolean;
  /** haupt: Dashboard/Öffnen (Akzent), gefahr: Löschen/Beenden */
  art?: "haupt" | "normal" | "gefahr";
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  const cls = `text-xs hover:underline disabled:opacity-40 ${
    art === "haupt" ? "text-accent" : art === "gefahr" ? "text-red-400" : "text-muted"}`;
  if (href) return <a href={href} download={download} title={title} className={cls}>{children}</a>;
  return <button type="button" onClick={onClick} disabled={disabled} title={title} className={cls}>{children}</button>;
}
