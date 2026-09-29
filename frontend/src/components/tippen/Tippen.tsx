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
import { useCallback, useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import { LEKTIONEN, type Lektion } from "@/lib/tippen/lektionen";
import { api, type TippModus, type TippSammlung } from "@/lib/api";
import Lektionen from "@/components/tippen/Lektionen";
import Wortregen from "@/components/tippen/Wortregen";
import Tastenjagd from "@/components/tippen/Tastenjagd";
import TippMaterial from "@/components/tippen/TippMaterial";
import Bestenliste from "@/components/tippen/Bestenliste";
import Wettschreiben from "@/components/tippen/Wettschreiben";

const MODI = [
  { id: "lektionen", label: "📚 Lektionen", nurHost: false },
  { id: "wortregen", label: "🌧️ Wortregen", nurHost: false },
  { id: "tastenjagd", label: "🎯 Tastenjagd", nurHost: false },
  // Bestenliste und Rennen brauchen ein Konto: eine Rangliste frei gewählter
  // Gastnamen wäre keine, und ein Rennen legt die Lehrkraft an.
  { id: "bestenliste", label: "🏆 Bestenliste", nurHost: true },
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

/**
 * `vorgabe` (Exitgame-Station): `{ reiter: "lektionen" | "wortregen" | "tastenjagd" }`
 * legt den Modus fest und blendet die Modus-Leiste aus.
 */
export default function Tippen({
  action,
  verwaltung,
  vorgabe,
}: {
  action?: ReactNode;
  vorgabe?: Vorgabe;
  /**
   * Auf der Werkzeugseite mit eigenem Zugang: eigene Texte wählen, Bestenliste
   * sehen, Ergebnisse eintragen, Rennen anlegen. Auf der Beitrittsseite (Gäste
   * ohne Konto) bleibt das alles aus.
   */
  verwaltung?: boolean;
}) {
  const festerModus = wahl(vorgabe, "reiter", ["lektionen", "wortregen", "tastenjagd"] as const);
  const [modus, setModus] = useState<Modus>(festerModus ?? "lektionen");
  const [zeigeFinger, setZeigeFinger] = useState(true);
  const [sammlung, setSammlung] = useState<TippSammlung | null>(null);

  /**
   * Ein fertiges Ergebnis in die Bestenliste melden. Fehler bleiben still: ein
   * abgelehnter Wert (unplausibel, Werkzeug gesperrt) soll dem Kind nicht die
   * gerade geschaffte Runde vermiesen.
   */
  const melden = useCallback(
    (modus: TippModus) =>
      verwaltung
        ? (e: { wert: number; anschlaege: number; fehler: number; dauer_ms: number; kontext: string }) => {
            api.tippenBestenliste.eintragen({ modus, ...e }).catch(() => {});
          }
        : undefined,
    [verwaltung],
  );

  const texte = sammlung ? alsLektionen(sammlung) : LEKTIONEN;
  const sperre = sammlung ? sammlung.settings.lock_on_error !== false : true;
  const material = sammlung ? `sammlung-${sammlung.id}` : "eingebaut";

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black tracking-tight">⌨️ Tippen</h1>
        <div className="flex-1" />
        <label className="text-xs flex items-center gap-1.5 cursor-pointer text-[var(--text-muted)]">
          <input type="checkbox" checked={zeigeFinger} onChange={e => setZeigeFinger(e.target.checked)} />
          Fingerfarben
        </label>
        {action}
      </div>

      {!festerModus && <div role="tablist" aria-label="Modus" className="flex flex-wrap gap-2">
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
      </div>}

      {verwaltung && modus !== "wettschreiben" && modus !== "bestenliste" && (
        <TippMaterial gewaehlt={sammlung} onWaehlen={setSammlung} />
      )}

      {/* Der Schlüssel wirft den Modus beim Wechsel weg — ein halb getipptes
          Wort oder eine laufende Bildschleife soll nicht im Hintergrund
          weiterlaufen. Ein Materialwechsel setzt genauso zurück. */}
      {modus === "lektionen" && (
        <Lektionen
          key={`lektionen-${material}`}
          zeigeFinger={zeigeFinger}
          texte={texte}
          sperre={sperre}
          onErgebnis={melden("lektionen")}
        />
      )}
      {modus === "wortregen" && (
        <Wortregen
          key={`wortregen-${material}`}
          zeigeFinger={zeigeFinger}
          woerter={sammlung?.words}
          quelle={sammlung?.title}
          onErgebnis={melden("wortregen")}
        />
      )}
      {modus === "tastenjagd" && (
        <Tastenjagd key={`tastenjagd-${material}`} zeigeFinger={zeigeFinger} onErgebnis={melden("tastenjagd")} />
      )}
      {modus === "bestenliste" && verwaltung && <Bestenliste />}
      {modus === "wettschreiben" && verwaltung && <Wettschreiben texte={texte} />}
    </div>
  );
}
