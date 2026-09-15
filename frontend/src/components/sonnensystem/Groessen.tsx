"use client";
/**
 * Größenvergleich, maßstabsgetreu: jede Kugel so breit, wie der Körper
 * wirklich ist, alle an derselben Mittellinie aufgereiht.
 *
 * Die Fotos haben unterschiedlich breite Ränder. Aus bilder.json kennt jede
 * Aufnahme Mitte und Durchmesser ihrer Scheibe; das Bild wird so vergrößert
 * und verschoben, dass genau die Scheibe die gewünschte Breite hat. Der
 * schwarze Rest verschwindet per »screen«-Überblendung im Weltraum (am
 * äußeren Element, siehe `Kugel`).
 */
import { useState } from "react";
import { ERDE, HAUPTKOERPER, KOERPER, KOERPER_NACH_ID, type Koerper } from "@/lib/sonnensystem/daten";
import { foto } from "@/lib/sonnensystem/bilder";
import { gerundet, zahl } from "@/lib/sonnensystem/format";
import { Knopfgruppe } from "./Bedienung";

type Auswahl = "planeten" | "monde" | "alle";

const REIHEN: Record<Auswahl, () => Koerper[]> = {
  planeten: () => HAUPTKOERPER,
  monde: () => [ERDE, KOERPER_NACH_ID.merkur, ...KOERPER.filter(k => k.art === "mond"), KOERPER_NACH_ID.pluto, KOERPER_NACH_ID.ceres]
    .sort((a, b) => b.radiusKm - a.radiusKm),
  alle: () => [...KOERPER].sort((a, b) => b.radiusKm - a.radiusKm),
};

export function Groessen({ onWaehle }: { onWaehle: (id: string) => void }) {
  const [auswahl, setAuswahl] = useState<Auswahl>("planeten");
  const [erdePx, setErdePx] = useState(40);
  const reihe = REIHEN[auswahl]();
  /** Durchmesser in Pixeln. */
  const px = (k: Koerper) => (k.radiusKm / ERDE.radiusKm) * erdePx;
  const sonne = reihe.find(k => k.art === "stern");
  const rest = () => reihe.filter(k => k.art !== "stern");
  const hoehe = Math.max(260, Math.min(Math.max(...rest().map(px)) + 90, 620));

  return (
    <div className="h-full flex flex-col text-slate-100">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4">
        <Knopfgruppe
          werte={[
            { wert: "planeten" as Auswahl, name: "Sonne und Planeten" },
            { wert: "monde" as Auswahl, name: "Monde im Vergleich" },
            { wert: "alle" as Auswahl, name: "Alle" },
          ]}
          aktiv={auswahl}
          // Neben der Erde sind die meisten Monde winzig — dort braucht es mehr Pixel.
          onWahl={a => { setAuswahl(a); setErdePx(a === "monde" ? 240 : 40); }}
        />
        <label className="flex items-center gap-2 text-xs text-slate-300">
          Erde =
          <input type="range" min={8} max={320} value={erdePx} onChange={e => setErdePx(Number(e.target.value))} className="w-36 accent-sky-400" />
          <span className="tabular-nums w-12">{erdePx} px</span>
        </label>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden mt-2" style={{ minHeight: hoehe }}>
        <div className="relative flex items-center h-full min-w-max pr-10" style={{ minHeight: hoehe }}>
          {sonne && (
            // Die Sonne passt nie ganz aufs Bild: nur ihr Rand ragt von links herein.
            <button
              onClick={() => onWaehle("sonne")}
              className="relative shrink-0 self-stretch"
              style={{ width: Math.min(px(sonne) * 0.06, 420) + 40 }}
              aria-label="Sonne"
            >
              <Kugel koerper={sonne} durchmesser={px(sonne)} style={{ right: 40, top: "50%", transform: "translate(0, -50%)" }} />
              <span className="absolute left-3 bottom-3 text-left text-xs font-bold text-amber-200 drop-shadow-[0_1px_2px_#000] w-40">
                Sonne<span className="block font-normal text-amber-100/80">{gerundet(sonne.radiusKm / ERDE.radiusKm)}-mal so breit wie die Erde — sie passt nicht aufs Bild</span>
              </span>
            </button>
          )}
          {rest().map(k => {
            const d = px(k);
            return (
              <button
                key={k.id}
                onClick={() => onWaehle(k.id)}
                className="group relative shrink-0 flex flex-col items-center justify-center self-stretch hover:bg-white/5 rounded-xl"
                style={{ width: Math.max(d * (k.ringe && k.id === "saturn" ? 2.4 : 1) + 24, 64) }}
              >
                <div className="relative" style={{ width: d, height: d }}>
                  <Kugel koerper={k} durchmesser={d} style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }} />
                </div>
                <span className="absolute bottom-2 left-0 right-0 text-center text-[11px] font-bold leading-tight">
                  {k.name}
                  <span className="block font-normal text-slate-400">{zahl(k.radiusKm * 2)} km</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="px-4 pb-3 text-[11px] text-slate-400">
        Maßstabsgetreu: {erdePx} Pixel für die Erde heißt {zahl((ERDE.radiusKm * 2) / erdePx)} km je Pixel. Antippen öffnet den Steckbrief; waagerecht scrollen zeigt die ganze Reihe.
      </p>
    </div>
  );
}

/** Nicht rund zuschneiden: Saturns Ringe gehören dazu, die Marsmonde sind Kartoffeln. */
const OHNE_ZUSCHNITT = new Set(["saturn", "phobos", "deimos"]);

/** Das Foto so gelegt, dass die Planetenscheibe genau `durchmesser` breit ist. */
function Kugel({ koerper, durchmesser, style }: { koerper: Koerper; durchmesser: number; style: React.CSSProperties }) {
  const bild = foto(koerper.id);
  if (!bild?.scheibe) {
    return <span className="absolute rounded-full" style={{ ...style, width: durchmesser, height: durchmesser, background: koerper.farbe }} />;
  }
  const breite = durchmesser / bild.scheibe.d;
  return (
    // Rund zugeschnitten verschwinden graue Fotoränder (Venus) und der Lichthof der Sonne.
    <span
      className={`absolute block pointer-events-none ${OHNE_ZUSCHNITT.has(koerper.id) ? "" : "rounded-full overflow-hidden"}`}
      // Die Überblendung sitzt hier, nicht am Bild: das transform in `style` macht aus
      // diesem Element einen eigenen Stapelkontext, darin hätte das Bild keinen Hintergrund.
      style={{ ...style, width: durchmesser, height: durchmesser, mixBlendMode: "screen" }}
    >
      <img
        src={bild.datei}
        alt=""
        draggable={false}
        className="absolute max-w-none"
        style={{
          width: breite,
          left: durchmesser / 2,
          top: durchmesser / 2,
          // Prozente im translate beziehen sich aufs Bild selbst — genau wie scheibe.x/y.
          transform: `translate(${-bild.scheibe.x * 100}%, ${-bild.scheibe.y * 100}%)`,
        }}
      />
    </span>
  );
}
