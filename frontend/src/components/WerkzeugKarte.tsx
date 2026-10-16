import type { ReactNode } from "react";
import Link from "next/link";
import HelpButton from "@/components/HelpButton";

/** Eine Kachel der Übersichtsseiten (Aktivitäten, Tools, Sport & Spiele, Simulationen). */
export type Werkzeug = { slug: string; href: string; icon: string; title: string; description: string; color: string };

export function KartenRaster({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">{children}</div>;
}

/** `link={false}` macht die Kachel unklickbar — z.B. solange darin etwas bearbeitet wird. */
export function WerkzeugKarte({ karte, link = true, children }: { karte: Werkzeug; link?: boolean; children?: ReactNode }) {
  const inhalt = (
    <>
      <HelpButton slug={karte.slug} className="absolute top-3 right-3" />
      <div className="flex items-center gap-3">
        <span style={{ fontSize: 40, lineHeight: 1, filter: `drop-shadow(0 2px 6px ${karte.color}66)` }}>
          {karte.icon}
        </span>
        <div>
          <div className="font-black text-lg" style={{ color: karte.color }}>{karte.title}</div>
          <div className="text-xs text-muted">→ öffnen</div>
        </div>
      </div>
      <p className="text-sm text-muted leading-relaxed">{karte.description}</p>
      {children}
    </>
  );
  const stil = "group relative flex flex-col gap-4 p-6 rounded-2xl border border-line bg-surface transition-all";
  return link ? (
    <Link href={karte.href} className={`${stil} hover:bg-surface-hover hover:border-accent hover:shadow-lg`}>{inhalt}</Link>
  ) : (
    <div className={stil}>{inhalt}</div>
  );
}
