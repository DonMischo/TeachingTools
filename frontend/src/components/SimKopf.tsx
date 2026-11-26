/**
 * Kopf jeder Simulation, jedes Spiels und jeder Aktivität: Titel und am Ende
 * derselben Zeile die Sitzungsknöpfe (»Zum Mitmachen«, ☰, Hilfe …), darunter
 * die Beschreibung. So stehen die Knöpfe überall an derselben Stelle, auch wenn
 * die Beschreibung lang ist.
 */
import type { ReactNode } from "react";

export function SimKopf({ titel, action, children }: {
  titel: ReactNode;
  /** Knöpfe am Zeilenende (ToolSessionBar, Hilfe, Schalter) */
  action?: ReactNode;
  /** Beschreibung unter dem Titel */
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-black tracking-tight">{titel}</h1>
        {action && <div className="ml-auto flex items-center gap-2 flex-wrap">{action}</div>}
      </div>
      {children && <div className="text-muted text-sm max-w-4xl">{children}</div>}
    </header>
  );
}
