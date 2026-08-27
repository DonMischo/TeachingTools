"use client";
/**
 * Die Schreibübung — Hülle mit dem Umschalter zwischen den Modi.
 *
 * Alle Modi teilen sich Engine, Tastatur und Zeichenvorrat; sie sind bewusst
 * *ein* Werkzeug und nicht drei Katalogeinträge: eine Karte, eine Freigabe,
 * ein Beitritts-Code. Sonst müsste die Lehrkraft je Spiel einen neuen QR
 * ausdrucken und das Admin-Raster wüchse für nichts.
 *
 * Getippt wird im Browser; gespeichert wird nichts. Nur das *Material* kommt
 * vom Server, wenn eine Lehrkraft eigene Texte hochgeladen hat — und auch das
 * nur auf der Werkzeugseite (`verwaltung`), nicht auf der Beitrittsseite, wo
 * niemand angemeldet ist.
 */
import { useState, type ReactNode } from "react";
import { LEKTIONEN, type Lektion } from "@/lib/tippen/lektionen";
import type { TippSammlung } from "@/lib/api";
import Lektionen from "@/components/tippen/Lektionen";
import Wortregen from "@/components/tippen/Wortregen";
import Tastenjagd from "@/components/tippen/Tastenjagd";
import TippMaterial from "@/components/tippen/TippMaterial";
import Wettschreiben from "@/components/tippen/Wettschreiben";

const MODI = [
  { id: "lektionen", label: "📚 Lektionen", nurHost: false },
  { id: "wortregen", label: "🌧️ Wortregen", nurHost: false },
  { id: "tastenjagd", label: "🎯 Tastenjagd", nurHost: false },
  // Das Rennen legt die Lehrkraft an; die Klasse kommt über Code/QR dazu.
  { id: "wettschreiben", label: "🏁 Wettschreiben", nurHost: true },
] as const;

type Modus = (typeof MODI)[number]["id"];

/** Hochgeladene Texte in die Form bringen, die der Lektionsmodus erwartet. */
function alsLektionen(sammlung: TippSammlung): Lektion[] {
  return sammlung.texts.map((t, i) => ({
    id: `sammlung-${sammlung.id}-${i}`,
    titel: t.title,
    neueZeichen: "", // eigene Texte führen keine Tasten ein
    text: t.text,
  }));
}

export default function Tippen({
  action,
  verwaltung,
}: {
  action?: ReactNode;
  /** Auf der Werkzeugseite: eigene Texte wählen und hochladen. */
  verwaltung?: boolean;
}) {
  const [modus, setModus] = useState<Modus>("lektionen");
  const [zeigeFinger, setZeigeFinger] = useState(true);
  const [sammlung, setSammlung] = useState<TippSammlung | null>(null);

  const texte = sammlung ? alsLektionen(sammlung) : LEKTIONEN;
  const sperre = sammlung ? sammlung.settings.lock_on_error !== false : true;
  const material = sammlung ? `sammlung-${sammlung.id}` : "eingebaut";

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black tracking-tight">⌨️ Tippen</h1>
        <div className="flex-1" />
        <label className="text-xs flex items-center gap-1.5 cursor-pointer text-[var(--text-muted)]">
          <input type="checkbox" checked={zeigeFinger} onChange={e => setZeigeFinger(e.target.checked)} />
          Fingerfarben
        </label>
        {action}
      </div>

      <div role="tablist" aria-label="Modus" className="flex flex-wrap gap-2">
        {MODI.filter(m => verwaltung || !m.nurHost).map(m => (
          <button
            key={m.id}
            role="tab"
            aria-selected={modus === m.id}
            onClick={() => setModus(m.id)}
            className={
              "text-sm rounded-lg px-3 py-1.5 border transition-colors " +
              (modus === m.id
                ? "border-[var(--accent)] text-[var(--accent)] font-bold"
                : "border-[var(--border)] hover:border-[var(--accent)]")
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      {verwaltung && modus !== "wettschreiben" && (
        <TippMaterial gewaehlt={sammlung} onWaehlen={setSammlung} />
      )}

      {/* Der Schlüssel wirft den Modus beim Wechsel weg — ein halb getipptes
          Wort oder eine laufende Bildschleife soll nicht im Hintergrund
          weiterlaufen. Ein Materialwechsel setzt genauso zurück. */}
      {modus === "lektionen" && (
        <Lektionen key={`lektionen-${material}`} zeigeFinger={zeigeFinger} texte={texte} sperre={sperre} />
      )}
      {modus === "wortregen" && (
        <Wortregen
          key={`wortregen-${material}`}
          zeigeFinger={zeigeFinger}
          woerter={sammlung?.words}
          quelle={sammlung?.title}
        />
      )}
      {modus === "tastenjagd" && <Tastenjagd key={`tastenjagd-${material}`} zeigeFinger={zeigeFinger} />}
      {modus === "wettschreiben" && verwaltung && <Wettschreiben texte={texte} />}
    </div>
  );
}
