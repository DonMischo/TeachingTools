"use client";
/**
 * Stadtentwicklung — römische, europäische und amerikanische Städte auf
 * einem zufälligen Gelände (mit Erosion auf Wunsch).
 *
 * Reiter:
 *   Wachstum   — die Stadt wächst Epoche für Epoche, dazu ein Quiz
 *   Bauen      — wichtige Orte setzen, Häuser und Straßen wachsen von selbst (2D)
 *   Aufbau     — dasselbe in 2,5D auf einem Raster, drehbar, Zoom vom Haus bis zur Stadt (wie Anno)
 *   Planen     — Aufträge: selbst gründen, dann prüfen lassen
 *   Sandkasten — frei bauen, optional prüfen
 *   So geht's  — Stadttypen im Vergleich, Quellen
 * Vorbilder: MapGenerator (Straßen aus Tensorfeldern), Voxel Space (3D-Flug),
 * terrain-erosion-3-ways (Erosion) — alles neu geschrieben.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { wahl as vorgabeWahl, type Vorgabe } from "@/lib/vorgabe";
import { erzeuge, type Gelaende, type GelaendeWahl } from "@/lib/gelaende/gelaende";
import { STILE, type Stil } from "@/lib/stadt/modell";
import { passendeWahl } from "@/lib/stadt/landschaft";
import { MERKMALE } from "@/lib/gelaende/gelaende";
import GelaendeLeiste from "@/components/gelaende/GelaendeLeiste";
import { erodiereNebenbei, gelaendeLeinwand, wasserLeinwand, type GelaendeBilder } from "@/components/gelaende/leinwand";
import { waldMaske } from "@/lib/gelaende/wald";
import WachstumAnsicht from "./WachstumAnsicht";
import BauModus from "./BauModus";
import Aufbau from "./aufbau/Aufbau";
import Planen from "./Planen";
import Erklaerung from "./Erklaerung";

const REITER = [
  { id: "wachstum", icon: "🕰️", label: "Wachstum" },
  { id: "bauen", icon: "🏗️", label: "Bauen" },
  { id: "aufbau", icon: "🏰", label: "Aufbau" },
  { id: "planen", icon: "📐", label: "Planen" },
  { id: "sandkasten", icon: "🧱", label: "Sandkasten" },
  { id: "erklaerung", icon: "📘", label: "So geht's" },
] as const;
type Reiter = (typeof REITER)[number]["id"];

const chip = (an: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;

/** `vorgabe` (TaskCrawler-Station): { reiter, stil } */
/** `speicherSchluessel`: wem der Aufbau-Spielstand gehört (Konto oder Gastname), sonst »geraet« */
export default function Stadtentwicklung({ action, vorgabe, speicherSchluessel }: { action?: ReactNode; vorgabe?: Vorgabe; speicherSchluessel?: string }) {
  const fest = vorgabeWahl(vorgabe, "reiter", REITER.map(r => r.id));
  const [reiter, setReiter] = useState<Reiter>(fest ?? "wachstum");
  const [stil, setStil] = useState<Stil>(vorgabeWahl(vorgabe, "stil", STILE.map(x => x.id)) ?? "europaeisch");
  // Gelände passend zum Stadttyp planen (Quellsee, Erzberg, Bucht …) oder frei wählen
  const [passend, setPassend] = useState(true);
  const [wahl, setWahl] = useState<GelaendeWahl>(() => passendeWahl(stil, 12));
  const waehleStil = (s: Stil) => { setStil(s); if (passend) setWahl(w => passendeWahl(s, w.seed)); };
  const roh = useMemo(() => erzeuge(wahl), [wahl]);
  const [erodiert, setErodiert] = useState<Gelaende | null>(null);
  const [fortschritt, setFortschritt] = useState<number | null>(null);
  const abbruch = useRef<(() => void) | null>(null);
  useEffect(() => { abbruch.current?.(); setErodiert(null); setFortschritt(null); }, [roh]);
  useEffect(() => () => abbruch.current?.(), []);
  const g = erodiert ?? roh;
  const [bild, setBild] = useState<GelaendeBilder | null>(null);
  useEffect(() => { const land = gelaendeLeinwand(g, { aue: true, wald: waldMaske(g) }); setBild({ land, wasser: wasserLeinwand(g, land) }); }, [g]);

  const erosion = () => {
    setFortschritt(0);
    abbruch.current = erodiereNebenbei(roh, setFortschritt, ge => { setErodiert(ge); setFortschritt(null); });
  };

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-seite mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🏘️ Stadtentwicklung</h1>
          <p className="text-muted text-sm mt-1">
            Warum liegt eine Stadt, wo sie liegt — und warum sieht sie so aus? Zwölf Stadttypen — von der Römerstadt bis zum Silicon Valley — wachsen auf einem Gelände, das du passend zum Typ formen lassen oder frei wählen kannst.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!fest && (
          <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
            {REITER.map(r => <button key={r.id} onClick={() => setReiter(r.id)} className={chip(reiter === r.id)}>{r.icon} {r.label}</button>)}
          </div>
        )}
        {reiter !== "erklaerung" && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-muted" title="Landschaft so formen, wie dieser Stadttyp sie braucht — nach echten Vorbildern">
              <input type="checkbox" checked={passend} onChange={x => { setPassend(x.target.checked); if (x.target.checked) setWahl(w => passendeWahl(stil, w.seed)); }} /> 🧭 passend zum Stadttyp
            </label>
            <GelaendeLeiste wahl={wahl} setWahl={w => { setWahl(passend ? { ...w, merkmale: passendeWahl(stil, w.seed).merkmale } : { ...w, merkmale: undefined }); }} erosion={erodiert ? undefined : erosion} erosionLaeuft={fortschritt} />
            {wahl.merkmale?.map(m => <span key={m} className="chip" title={MERKMALE[m].text}>{MERKMALE[m].icon} {MERKMALE[m].label}</span>)}
            {erodiert && <span className="chip chip-on">🌧️ erodiert</span>}
          </div>
        )}
      </div>
      {!bild ? <div className="h-[600px]" /> : (
        <>
          {/* Planen und Sandkasten bleiben eingehängt, damit Pläne beim Reiterwechsel erhalten bleiben */}
          <div hidden={reiter !== "wachstum"}>{reiter === "wachstum" && <WachstumAnsicht g={g} bild={bild} stil={stil} setStil={waehleStil} />}</div>
          <div hidden={reiter !== "bauen"}><BauModus g={g} bild={bild} stil={stil} setStil={waehleStil} aktiv={reiter === "bauen"} /></div>
          {reiter === "aufbau" && <Aufbau g={g} stil={stil} setStil={waehleStil} speicherSchluessel={speicherSchluessel} />}
          <div hidden={reiter !== "planen"}><Planen g={g} bild={bild} aktiv={reiter === "planen"} /></div>
          <div hidden={reiter !== "sandkasten"}><Planen g={g} bild={bild} sandkasten aktiv={reiter === "sandkasten"} /></div>
          {reiter === "erklaerung" && <Erklaerung />}
        </>
      )}
    </div>
  );
}

