"use client";
/**
 * Fotogalerie für Simulationen (Küste, Vulkane): Raster nach Bereichen,
 * Leuchtkasten mit ← →, Bildnachweis unter jedem Foto und gesammelt am Ende.
 * Die Bilder kommen von Wikimedia Commons (scripts/commons-galerie.mjs);
 * offline (Standalone) erscheint ein Platzhalter.
 */
import { useEffect, useState, type ReactNode } from "react";

export interface Nachweis { datei: string; titel: string; seite: string; lizenz: string; lizenzUrl?: string; urheber: string }
export interface FotoBild { id: string; bereich: string; titel: string; text: string; begriffe?: string[] }
export interface FotoBereich { id: string; name: string; icon: string }
type Nachweise = (id: string) => Nachweis | undefined;

function Nachweiszeile({ id, nachweisFuer }: { id: string; nachweisFuer: Nachweise }) {
  const n = nachweisFuer(id);
  if (!n) return null;
  return (
    <span>
      Foto: {n.urheber} ·{" "}
      {n.lizenzUrl ? <a href={n.lizenzUrl} target="_blank" rel="noreferrer" className="underline">{n.lizenz}</a> : n.lizenz} ·{" "}
      <a href={n.seite} target="_blank" rel="noreferrer" className="underline">Wikimedia Commons</a>
    </span>
  );
}

function Bild({ id, alt, className, nachweisFuer }: { id: string; alt: string; className: string; nachweisFuer: Nachweise }) {
  const [fehlt, setFehlt] = useState(false);
  const n = nachweisFuer(id);
  if (!n || fehlt) {
    return (
      <div className={`${className} flex items-center justify-center bg-surface-hover text-xs text-muted p-3 text-center`}>
        Bild nur in der Online-Fassung
      </div>
    );
  }
  return <img src={n.datei} alt={alt} loading="lazy" onError={() => setFehlt(true)} className={className} />;
}

function Leuchtkasten({ liste, index, setIndex, nachweisFuer }: { liste: FotoBild[]; index: number; setIndex: (i: number | null) => void; nachweisFuer: Nachweise }) {
  const b = liste[index];
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
      if (e.key === "ArrowRight") setIndex((index + 1) % liste.length);
      if (e.key === "ArrowLeft") setIndex((index - 1 + liste.length) % liste.length);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [index, liste.length, setIndex]);
  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4" onClick={() => setIndex(null)} role="dialog" aria-label={b.titel}>
      <div className="relative max-w-5xl w-full flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        <Bild id={b.id} alt={b.titel} className="w-full max-h-[70vh] object-contain rounded-xl" nachweisFuer={nachweisFuer} />
        <div className="text-white">
          <div className="font-black text-lg">{b.titel}</div>
          <p className="text-sm text-white/85 mt-1 leading-relaxed">{b.text}</p>
          {b.begriffe && <p className="text-xs text-amber-300 mt-1.5">Entdecke im Bild: {b.begriffe.join(" · ")}</p>}
          <p className="text-[11px] text-white/60 mt-2"><Nachweiszeile id={b.id} nachweisFuer={nachweisFuer} /></p>
        </div>
        <button onClick={() => setIndex(null)} className="absolute -top-2 -right-2 w-9 h-9 rounded-full bg-white/90 text-black font-black" aria-label="Schließen">✕</button>
        {liste.length > 1 && <>
          <button onClick={() => setIndex((index - 1 + liste.length) % liste.length)} className="absolute left-2 top-[35%] w-10 h-10 rounded-full bg-black/60 text-white text-xl" aria-label="Voriges Bild">‹</button>
          <button onClick={() => setIndex((index + 1) % liste.length)} className="absolute right-2 top-[35%] w-10 h-10 rounded-full bg-black/60 text-white text-xl" aria-label="Nächstes Bild">›</button>
        </>}
      </div>
    </div>
  );
}

/** Kleiner Bildstreifen, z. B. unter einer Simulation */
export function BildStreifen({ bilder, nachweisFuer }: { bilder: FotoBild[]; nachweisFuer: Nachweise }) {
  const [offen, setOffen] = useState<number | null>(null);
  if (!bilder.length) return null;
  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {bilder.map((b, i) => (
          <button key={b.id} onClick={() => setOffen(i)} className="shrink-0 w-36 text-left group" title={b.titel}>
            <Bild id={b.id} alt={b.titel} className="w-36 h-24 object-cover rounded-lg border border-line group-hover:border-accent" nachweisFuer={nachweisFuer} />
            <div className="text-[11px] mt-1 leading-tight line-clamp-2">{b.titel}</div>
          </button>
        ))}
      </div>
      {offen !== null && <Leuchtkasten liste={bilder} index={offen} setIndex={setOffen} nachweisFuer={nachweisFuer} />}
    </>
  );
}

export default function FotoGalerie({ bilder, bereiche, nachweisFuer, einleitung }: {
  bilder: FotoBild[];
  bereiche: FotoBereich[];
  nachweisFuer: Nachweise;
  einleitung: ReactNode;
}) {
  const [bereich, setBereich] = useState<string | null>(null);
  const [offen, setOffen] = useState<number | null>(null);
  const [nachweise, setNachweise] = useState(false);
  const liste = bilder.filter(b => !bereich || b.bereich === bereich);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted max-w-3xl">{einleitung}</p>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setBereich(null)} className={`px-3 py-1 rounded-full text-sm font-bold border ${!bereich ? "bg-accent text-accent-fg border-accent" : "border-line hover:bg-surface-hover"}`}>
          Alle ({bilder.length})
        </button>
        {bereiche.map(b => (
          <button key={b.id} onClick={() => setBereich(b.id)} className={`px-3 py-1 rounded-full text-sm font-bold border ${bereich === b.id ? "bg-accent text-accent-fg border-accent" : "border-line hover:bg-surface-hover"}`}>
            {b.icon} {b.name}
          </button>
        ))}
      </div>

      {bereiche.filter(b => !bereich || b.id === bereich).map(ber => (
        <section key={ber.id} className="flex flex-col gap-2">
          <h3 className="font-black">{ber.icon} {ber.name}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {liste.filter(b => b.bereich === ber.id).map(b => (
              <button key={b.id} onClick={() => setOffen(liste.indexOf(b))}
                className="text-left rounded-xl border border-line bg-surface overflow-hidden hover:border-accent transition-colors">
                <Bild id={b.id} alt={b.titel} className="w-full aspect-3/2 object-cover" nachweisFuer={nachweisFuer} />
                <div className="p-2">
                  <div className="text-sm font-bold leading-tight">{b.titel}</div>
                  <div className="text-xs text-muted mt-1 line-clamp-2">{b.text}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      <section className="card p-4 text-sm">
        <button onClick={() => setNachweise(!nachweise)} className="font-black">📷 Bildnachweise {nachweise ? "▾" : "▸"}</button>
        {nachweise && (
          <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
            {bilder.map(b => <li key={b.id}><b className="text-fg">{b.titel}:</b> <Nachweiszeile id={b.id} nachweisFuer={nachweisFuer} /></li>)}
          </ul>
        )}
        <p className="text-xs text-muted mt-2">Alle Fotos stammen von Wikimedia Commons und stehen unter freien Lizenzen (gemeinfrei, CC0, CC BY, CC BY-SA). Sie liegen verkleinert auf dem Schulserver.</p>
      </section>

      {offen !== null && <Leuchtkasten liste={liste} index={offen} setIndex={setOffen} nachweisFuer={nachweisFuer} />}
    </div>
  );
}
