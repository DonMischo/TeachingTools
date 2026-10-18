"use client";
/**
 * Tatort-Haus (Markov-Regeln, Art »haus«) bei Nacht: Nur die Taschenlampe leuchtet, Spuren zeigen sich erst in ihrem Schein
 * und wollen untersucht werden (Enter/E daneben oder anklicken). Manche Stellen sind leer. Jeder Fund wandert ins Notizbuch.
 */
import { useMemo, useState } from "react";
import type { ChallengeFakt } from "@/lib/api";
import type { ThemeDef } from "@/lib/challenge/themes";
import { markovKarte } from "@/lib/challenge/markovKarte";
import { useUeberspringen } from "@/lib/challenge/useUeberspringen";
import Fundkarte from "@/components/challenge/Fundkarte";
import Erkunden, { type ErkundObjekt } from "@/components/challenge/pixel/Erkunden";
import { skizzeVon } from "./hilfen";

/** Radius der Taschenlampe in Feldern. */
export const LICHT = 3.5;
/** Leere Stellen neben den echten Spuren. */
export const leereStellen = (n: number) => Math.max(2, Math.ceil(n / 3));
const LEER = ["Nur Staub.", "Ein alter Fleck – nichts Brauchbares.", "Nichts Auffälliges.", "Eine Maus huscht davon. Sonst nichts.", "Kratzer im Holz, aber alt."];

export default function Tatort({ fakten, theme, seed, gefunden, setGefunden, weiter, onWegwerfen }: {
  fakten: ChallengeFakt[]; theme: ThemeDef; seed: number; gefunden: string[]; setGefunden(f: (g: string[]) => string[]): void; weiter(): void; onWegwerfen?(id: string): void;
}) {
  const nLeer = leereStellen(fakten.length);
  const karte = useMemo(() => markovKarte(seed, Math.max(1, fakten.length + nLeer), "haus"), [seed, fakten.length, nLeer]);
  // eine Stelle je Fakt und je leerer Stelle: erst in den Zimmern, bei Bedarf auf weiteren Bodenfeldern
  const stellen = useMemo(() => {
    const n = fakten.length + nLeer;
    const s: [number, number][] = karte.orte.slice(0, n).map((o) => [o.x, o.y]);
    const belegt = new Set(s.map(([x, y]) => `${x},${y}`));
    belegt.add(karte.start.join(","));
    for (let y = 0; y < karte.R && s.length < n; y++) {
      for (let x = 0; x < karte.R && s.length < n; x++) {
        if (karte.begehbar([x, y]) && !belegt.has(`${x},${y}`)) { s.push([x, y]); belegt.add(`${x},${y}`); }
      }
    }
    // reihum verteilt, damit die leeren Stellen nicht alle am Ende liegen
    return s.map((p, i) => ({ p, k: (i * 7 + seed) % s.length })).sort((a, b) => a.k - b.k).map((x) => x.p);
  }, [karte, fakten.length, nLeer, seed]);
  const [zeige, setZeige] = useState<ChallengeFakt | null>(null);
  const [leer, setLeer] = useState<number[]>([]);
  const [meldung, setMeldung] = useState("");
  const skip = useUeberspringen();

  const alle = fakten.length > 0 && fakten.every((f) => gefunden.includes(f.id));
  const spuren: ErkundObjekt[] = fakten.slice(0, stellen.length).map((f, i) => {
    const da = gefunden.includes(f.id);
    return {
      id: f.id, x: stellen[i][0], y: stellen[i][1], untersuchen: true,
      label: da ? undefined : "Verdächtige Stelle untersuchen",
      render: () => da ? <span className="text-xl" aria-hidden>📄</span> : <span className="text-2xl dt-blink" aria-hidden>🔍</span>,
    };
  });
  const attrappen: ErkundObjekt[] = stellen.slice(fakten.length).map(([x, y], j) => {
    const durch = leer.includes(j);
    return {
      id: `leer-${j}`, x, y, untersuchen: true,
      label: durch ? undefined : "Verdächtige Stelle untersuchen",
      render: () => durch ? <span className="text-lg opacity-60" aria-hidden>✖️</span> : <span className="text-2xl dt-blink" aria-hidden>🔍</span>,
    };
  });
  const betreten = (id: ErkundObjekt["id"]) => {
    if (typeof id === "string" && id.startsWith("leer-")) {
      const j = Number(id.slice(5));
      if (!leer.includes(j)) { setLeer((l) => [...l, j]); setMeldung(LEER[(j + seed) % LEER.length]); }
      return;
    }
    const f = fakten.find((x) => x.id === id);
    if (!f || gefunden.includes(f.id)) return;
    setMeldung("");
    setGefunden((g) => (g.includes(f.id) ? g : [...g, f.id]));
    setZeige(f);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted">
        Es ist dunkel. Leuchte mit der Taschenlampe (Pfeiltasten/WASD) und untersuche verdächtige Stellen mit Enter oder E. Spuren gesichert: {gefunden.length}/{fakten.length}
      </p>
      <Erkunden karte={karte} theme={theme} objekte={[...spuren, ...attrappen]} onBetreten={betreten} pausiert={!!zeige} kachel="haus" label="Tatort" licht={LICHT} />
      {meldung && <p className="text-sm italic" role="status">🔦 {meldung}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {alle && <button className="btn-primary" onClick={weiter}>Zur Ermittlungswand</button>}
        {!alle && skip && (
          <button className="btn-secondary" onClick={() => setGefunden((g) => [...g, ...fakten.map((f) => f.id).filter((id) => !g.includes(id))])}>
            Alles einsammeln
          </button>
        )}
      </div>
      {zeige && <Fundkarte fakt={zeige} titel="🔍 Spur gesichert!" skizze={skizzeVon(zeige.id)} ok="Ins Notizbuch" onOk={() => setZeige(null)} onWegwerfen={onWegwerfen && (() => { onWegwerfen(zeige.id); setZeige(null); })} />}
    </div>
  );
}
