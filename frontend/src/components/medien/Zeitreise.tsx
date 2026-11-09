"use client";
/** Zeitstrahl oben, darunter die gewählte Station. Weiter geht's erst, wenn die Station geschafft ist. */
import { useEffect, useRef, useState } from "react";
import { EPOCHEN, MEDIEN, epoche } from "@/lib/medien/medien";
import { erreichbarBis, type Aenderung, type Fortschritt } from "@/lib/medien/fortschritt";
import Station from "./Station";

export default function Zeitreise({ fortschritt, aendere, zuruecksetzen }: { fortschritt: Fortschritt; aendere: (a: Aenderung) => void; zuruecksetzen: () => void }) {
  const bis = erreichbarBis(fortschritt.geschafft);
  const [index, setIndex] = useState(0);
  const gewaehlt = useRef(false);
  // Beim Laden des gespeicherten Stands zur ersten offenen Station springen — nicht mehr, sobald man selbst wählt oder antwortet
  useEffect(() => { if (!gewaehlt.current) setIndex(bis); }, [bis]);
  const leiste = useRef<HTMLDivElement>(null);
  useEffect(() => {
    leiste.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  const waehle = (i: number) => { gewaehlt.current = true; setIndex(Math.max(0, Math.min(i, bis))); };
  const m = MEDIEN[index];

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-3">
        <div ref={leiste} className="flex gap-3 overflow-x-auto pb-2" role="list" aria-label="Zeitstrahl">
          {EPOCHEN.map(e => {
            const hier = MEDIEN.map((x, i) => ({ x, i })).filter(({ x }) => x.epoche === e.id);
            if (!hier.length) return null;
            return (
              <div key={e.id} className="shrink-0 flex flex-col gap-1.5">
                <div className="text-[11px] font-black uppercase tracking-wide px-1" style={{ color: e.farbe }}>{e.icon} {e.name}</div>
                <div className="flex gap-1 rounded-xl p-1" style={{ background: `${e.farbe}1f` }}>
                  {hier.map(({ x, i }) => {
                    const zu = i > bis, fertig = fortschritt.geschafft.includes(x.id);
                    return (
                      <button key={x.id} data-index={i} role="listitem" disabled={zu} onClick={() => waehle(i)}
                        title={zu ? "Noch gesperrt — schaff erst die Station davor" : `${x.name} (${x.jahrText})`}
                        className={`relative w-11 h-11 rounded-full text-xl flex items-center justify-center transition-transform border-2
                          ${i === index ? "scale-110 shadow-lg" : "hover:scale-105"} ${zu ? "opacity-35 cursor-not-allowed" : ""}`}
                        style={{ borderColor: i === index ? e.farbe : "transparent", background: zu ? "transparent" : "var(--color-surface)" }}>
                        <span aria-hidden>{zu ? "🔒" : x.icon}</span>
                        <span className="sr-only">{x.name}</span>
                        {fertig && <span className="absolute -bottom-0.5 -right-0.5 text-[10px] bg-ok text-white rounded-full w-4 h-4 flex items-center justify-center">✓</span>}
                        {x.flop && !zu && <span className="absolute -top-1 -right-1 text-[11px]" title="Flop">💀</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-surface-hover overflow-hidden" title="Fortschritt">
          <div className="h-full rounded-full transition-all" style={{ width: `${(fortschritt.geschafft.length / MEDIEN.length) * 100}%`, background: `linear-gradient(90deg, ${EPOCHEN.map(e => e.farbe).join(",")})` }} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn-secondary" disabled={index === 0} onClick={() => waehle(index - 1)}>‹ Früher</button>
        <span className="text-sm text-muted">Station {index + 1} von {MEDIEN.length} · <span style={{ color: epoche(m.epoche).farbe }} className="font-bold">{epoche(m.epoche).name}</span></span>
        <button className="btn-secondary ml-auto" disabled={index >= bis} onClick={() => waehle(index + 1)}
          title={index >= bis ? "Beantworte erst die Frage dieser Station" : undefined}>Später ›</button>
      </div>

      <Station key={m.id} m={m} geschafft={fortschritt.geschafft.includes(m.id)}
        aendere={a => { gewaehlt.current = true; aendere(a); }}
        weiter={index < MEDIEN.length - 1 ? () => { gewaehlt.current = true; setIndex(index + 1); } : undefined} />

      <div className="text-right">
        <button className="text-xs text-muted underline" onClick={() => {
          if (confirm("Den ganzen Fortschritt der Zeitreise löschen? Die Fotos werden wieder gesperrt.")) { zuruecksetzen(); gewaehlt.current = true; setIndex(0); }
        }}>Fortschritt zurücksetzen</button>
      </div>
    </div>
  );
}
