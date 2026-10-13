"use client";
/** Hält eine Pixelbühne fester Größe auf schmalen Bildschirmen im Rahmen: verkleinert sie, nie größer. */
import { useEffect, useRef, useState, type ReactNode } from "react";

export function Passend({ breite, hoehe, children }: { breite: number; hoehe: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [faktor, setFaktor] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const beob = new ResizeObserver(([e]) => setFaktor(Math.min(1, e.contentRect.width / breite)));
    beob.observe(el);
    return () => beob.disconnect();
  }, [breite]);

  return (
    <div ref={ref} className="w-full" style={{ height: hoehe * faktor }}>
      <div className="mx-auto origin-top-left" style={{ width: breite, height: hoehe, transform: faktor < 1 ? `scale(${faktor})` : undefined }}>
        {children}
      </div>
    </div>
  );
}
