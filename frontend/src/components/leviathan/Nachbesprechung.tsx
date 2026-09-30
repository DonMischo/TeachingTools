"use client";
import { TYP } from "@/lib/leviathan/laender";
import { auswertung, leviathan, STARTJAHR } from "@/lib/leviathan/motor";
import { QUELLEN } from "@/lib/leviathan/quellen";
import { SCHLEIFEN } from "@/lib/leviathan/regeln";
import type { Zustand } from "@/lib/leviathan/typen";
import { Verlauf, ZONE_TEXT } from "./Anzeigen";
import { Meldungskarte } from "./Spiel";
import { KRISE_TEXT } from "./Start";
import { Karte, QuelleLink } from "./ui";

export default function Nachbesprechung({ z, onWiederaufbau, onNeu, onDownload }: {
  z: Zustand;
  onWiederaufbau?: () => void;
  onNeu: () => void;
  onDownload: () => void;
}) {
  const a = auswertung(z);
  const t = TYP[z.typ];
  const zone = ZONE_TEXT[leviathan(z.w).zone];
  const zusammengebrochen = z.status === "zusammengebrochen";
  const kannWeiter = zusammengebrochen && z.runde < z.einst.runden && onWiederaufbau;
  const schleife = (id: string) => SCHLEIFEN.find((s) => s.id === id)!;

  return (
    <div className="flex flex-col gap-4">
      <Karte>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">
              {zusammengebrochen ? `💥 ${z.land} ist zusammengebrochen` : `🏁 ${z.land} im Jahr ${STARTJAHR + 2 * z.runde}`}
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {t.icon} {t.name} · Krisenstufe {KRISE_TEXT[z.einst.krise].icon} {KRISE_TEXT[z.einst.krise].name}
              {!z.einst.sichtbar && " (war verdeckt)"}
            </p>
            {z.einst.krise === "zusammenbruch" && (
              <p className="text-sm mt-2">Das war das Szenario <b>Zusammenbruch</b>: Die Krisen kamen nach Drehbuch. Hattet ihr eine Chance – oder doch?</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-4xl font-black tabular-nums">{a.punkte}</div>
            <div className="text-xs text-[var(--text-muted)]">Punkte</div>
          </div>
        </div>
        <div className="grid gap-3 mt-4 grid-cols-2 sm:grid-cols-4 text-sm">
          <Zahl name="Durchgehalten" wert={`${a.durchgehalten} von ${z.einst.runden} Runden`} />
          <Zahl name="Lebensqualität im Schnitt" wert={Math.round(a.lqSchnitt)} />
          <Zahl name="Runden im Korridor" wert={a.korridorRunden} />
          <Zahl name="Nachhaltigkeit" wert={a.nachhaltigkeit} />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {kannWeiter && (
            <button onClick={onWiederaufbau} className="px-4 py-2 rounded-xl font-black bg-[var(--accent)] text-[var(--accent-text,#111)]">
              🏗️ Wiederaufbau versuchen ({z.einst.runden - z.runde} Runden übrig)
            </button>
          )}
          <button onClick={onNeu} className="px-4 py-2 rounded-xl font-bold border border-[var(--border)]">Neues Land</button>
          <button onClick={onDownload} className="px-4 py-2 rounded-xl font-bold border border-[var(--border)]">⬇ Verlauf speichern (JSON)</button>
        </div>
        {kannWeiter && (
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Im Wiederaufbau hast du deutlich weniger Aktionspunkte. Schaffst du es zurück in den Korridor?
          </p>
        )}
      </Karte>

      <div className="grid gap-4 lg:grid-cols-2">
        <Karte titel="Lebensqualität über die Jahre">
          <Verlauf verlauf={z.verlauf} wert={(s) => s.lq} hoehe={100} />
          <Achse z={z} />
        </Karte>
        <Karte titel="Der Weg deines Leviathans">
          <Verlauf verlauf={z.verlauf} wert={(s) => s.position} min={-55} max={55} hoehe={100} band={[-12, 12]} />
          <div className="flex justify-between text-[11px] text-[var(--text-muted)]"><span>oben: despotisch · Mitte: Korridor · unten: abwesend</span></div>
          <p className="text-sm mt-2">Am Ende: <b style={{ color: zone.farbe }}>{zone.name}</b>. {zone.text}</p>
          <QuelleLink id="korridor" />
        </Karte>
      </div>

      {a.wendepunkt && (
        <Karte titel={`Wendepunkt: ${a.wendepunkt.jahr}`}>
          <p className="text-sm mb-3">In dieser Runde fiel die Lebensqualität am stärksten (−{Math.round(a.wendepunkt.minus)}). Das ist passiert:</p>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
            {a.wendepunkt.meldungen.length
              ? a.wendepunkt.meldungen.map((m, i) => <Meldungskarte key={i} m={m} />)
              : <p className="text-sm text-[var(--text-muted)]">Kein einzelnes Ereignis – das Land ist über seine Rückkopplungen abgerutscht.</p>}
          </div>
        </Karte>
      )}

      <Karte titel="Welche Schleifen haben dein Land bewegt?">
        {a.schleifen.length === 0 && <p className="text-sm text-[var(--text-muted)]">Keine der Schleifen war lange genug aktiv.</p>}
        <div className="flex flex-col gap-3">
          {a.schleifen.map(({ id, runden }) => {
            const s = schleife(id);
            return (
              <div key={id} className="rounded-xl border p-3" style={{ borderColor: s.gut ? "var(--green)" : "var(--red)" }}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-black">{s.gut ? "✅" : "⚠️"} {s.name} <span className="text-xs text-[var(--text-muted)]">({s.art === "verstaerkend" ? "verstärkend" : "ausgleichend"})</span></div>
                  <div className="text-xs text-[var(--text-muted)]">{runden} von {z.verlauf.length - 1} Runden aktiv</div>
                </div>
                <p className="text-sm mt-1">{s.ablauf}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{QUELLEN[s.quelle].befund}</p>
                <QuelleLink id={s.quelle} />
              </div>
            );
          })}
        </div>
      </Karte>

      <Karte titel="Alle Ereignisse">
        <ul className="text-sm space-y-1">
          {z.meldungen.map((m, i) => (
            <li key={i}><span className="tabular-nums text-[var(--text-muted)]">{STARTJAHR + 2 * m.runde}</span> {m.icon} <b>{m.titel}</b>{m.folgen ? ` – ${m.folgen}` : ""}</li>
          ))}
        </ul>
      </Karte>

      <p className="text-xs text-[var(--text-muted)]">
        Die Regeln des Spiels sind vereinfacht: Studien legen Richtung, Verzögerung und grobe Rangfolge der Wirkungen fest,
        nicht die genauen Zahlen. Inspiriert von Frederic Vesters Vernetztem Denken (Ökolopoly, 1980) und von
        Acemoglu &amp; Robinsons »gefesseltem Leviathan«.
      </p>
    </div>
  );
}

function Zahl({ name, wert }: { name: string; wert: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-3">
      <div className="text-xs text-[var(--text-muted)]">{name}</div>
      <div className="font-black text-lg tabular-nums">{wert}</div>
    </div>
  );
}

function Achse({ z }: { z: Zustand }) {
  return (
    <div className="flex justify-between text-[11px] text-[var(--text-muted)] tabular-nums">
      <span>{STARTJAHR}</span><span>{STARTJAHR + 2 * z.runde}</span>
    </div>
  );
}
