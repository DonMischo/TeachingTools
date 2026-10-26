"use client";
/**
 * Baumleben — vom Samen bis zum Humus: Lebenslauf eines Baumes (prozedurales Wachstum,
 * Wasser- und Nährstoffbilanz, Bewohner, Jahresringe), Stoffströme im Baum, Fotosynthese
 * für die Oberstufe, 30 Bäume bestimmen und das Spiel »Sei ein Baum«.
 * Die Simulation selbst steckt in lib/baum und arbeitet direkt am DOM.
 */
import { useEffect, useRef, type ReactNode } from "react";

export default function Baumleben({ action }: { action?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let aus = () => {};
    let lebt = true;
    import("@/lib/baum").then(m => {
      if (lebt && ref.current) aus = m.mountBaumleben(ref.current);
    });
    return () => { lebt = false; aus(); };
  }, []);
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-seite mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🌳 Baumleben</h1>
          <p className="text-muted text-sm mt-1">Vom Samen bis zum Humus: wie ein Baum wächst, trinkt, Zucker baut, wer in ihm lebt — und wie man 30 Bäume erkennt.</p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      <div ref={ref} className="baumleben" />
    </div>
  );
}
