"use client";
import { useState } from "react";
import { LAENDERTYPEN } from "@/lib/leviathan/laender";
import type { Einstellungen, Krisenstufe, TypId } from "@/lib/leviathan/typen";
import { Karte, Punkte } from "./ui";

export const KRISE_TEXT: Record<Krisenstufe, { name: string; icon: string; text: string }> = {
  ruhig: { name: "Ruhige Zeiten", icon: "🌤️", text: "Halb so viele Schocks, keine Kipppunkte – zum Kennenlernen." },
  normal: { name: "Normal", icon: "⛅", text: "Schocks je nach Lage des Landes." },
  stuermisch: { name: "Stürmisch", icon: "⛈️", text: "Doppelt so viele Schocks, die härter treffen; Kipppunkte liegen niedriger." },
  zusammenbruch: { name: "Zusammenbruch", icon: "🌋", text: "Szenario: Eine Krisenkaskade läuft nach Drehbuch ab. Es zählt, wie lange du durchhältst und was du rettest." },
};

export default function Start({ einst, krisenWahl, onStart }: {
  einst: Einstellungen;
  /** Darf die Krisenstufe selbst gewählt werden (ohne Vorgabe der Lehrkraft)? */
  krisenWahl: boolean;
  onStart: (typ: TypId, land: string, einst: Einstellungen) => void;
}) {
  const [typ, setTyp] = useState<TypId | null>(null);
  const [land, setLand] = useState("");
  const [krise, setKrise] = useState<Krisenstufe>(einst.krise);
  const gewaehlt = LAENDERTYPEN.find((t) => t.id === typ);

  return (
    <div className="flex flex-col gap-5">
      <Karte titel="Worum es geht">
        <p className="text-sm leading-relaxed">
          Du regierst ein Land – {einst.runden * 2} Jahre lang, in Runden zu je zwei Jahren. Jede Runde verteilst du Aktionspunkte auf
          sechs Bereiche. Alles hängt mit allem zusammen: Bildung senkt die Geburtenrate, Ungleichheit frisst Vertrauen,
          Desinformation wächst von selbst. Dazu kommen Schocks – und alle vier Jahre eine Wahl.
        </p>
        <p className="text-sm leading-relaxed mt-2">
          Die zweite Anzeige ist der <b>Leviathan</b>: Ist der Staat zu schwach, zerfällt das Land; ist er stärker als die
          Gesellschaft, wird er despotisch. Dazwischen liegt ein schmaler Korridor.
        </p>
      </Karte>

      <div>
        <h2 className="font-black text-lg mb-2">1. Wähle einen Ländertyp</h2>
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
          {LAENDERTYPEN.map((t) => (
            <button key={t.id} onClick={() => { setTyp(t.id); setLand(t.landname); }}
              aria-pressed={typ === t.id}
              className={`text-left rounded-2xl border-2 p-4 bg-[var(--surface)] transition-colors hover:bg-[var(--surface-hover)] ${
                typ === t.id ? "border-[var(--accent)]" : "border-[var(--border)]"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-black">{t.icon} {t.name}</div>
                <Punkte n={t.schwierigkeit} />
              </div>
              <p className="text-sm mt-2">{t.profil}</p>
              <p className="text-xs text-[var(--text-muted)] mt-2"><b>Ähnlich wie:</b> {t.beispiele}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1"><b>Gefahr:</b> {t.gefahr}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Dein Land ist erfunden. Die echten Länder zeigen nur, wo es solche Lagen gibt (Stand ca. 2024/25).
        </p>
      </div>

      {gewaehlt && (
        <Karte titel="2. Los geht's">
          <div className="flex flex-col gap-3">
            <label className="text-sm flex flex-col gap-1 max-w-sm">
              Name deines Landes
              <input value={land} onChange={(e) => setLand(e.target.value.slice(0, 40))}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2" />
            </label>
            {krisenWahl ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm mb-1">Krisenstufe</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(KRISE_TEXT) as Krisenstufe[]).map((k) => (
                    <button key={k} onClick={() => setKrise(k)} aria-pressed={krise === k}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${
                        krise === k ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-transparent" : "border-[var(--border)]"}`}>
                      {KRISE_TEXT[k].icon} {KRISE_TEXT[k].name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[var(--text-muted)]">{KRISE_TEXT[krise].text}</p>
              </fieldset>
            ) : einst.sichtbar ? (
              <p className="text-sm">Krisenstufe (von deiner Lehrkraft): <b>{KRISE_TEXT[einst.krise].icon} {KRISE_TEXT[einst.krise].name}</b></p>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Die Krisenstufe hat deine Lehrkraft festgelegt – du erfährst sie am Ende.</p>
            )}
            <button onClick={() => onStart(gewaehlt.id, land, { ...einst, krise: krisenWahl ? krise : einst.krise })}
              className="self-start px-5 py-2.5 rounded-xl font-black bg-[var(--accent)] text-[var(--accent-text,#111)]">
              {gewaehlt.icon} {land || gewaehlt.landname} regieren
            </button>
          </div>
        </Karte>
      )}
    </div>
  );
}
