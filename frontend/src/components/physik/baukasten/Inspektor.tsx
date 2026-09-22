"use client";
/**
 * Der Inspektor: was man am ausgewählten Teil oder Verbinder einstellt — und
 * im Versuch, was gerade an ihm geschieht.
 *
 * Im Bauen steht die Masse obenan, weil sie beim Baukasten nicht mehr
 * eingetippt, sondern aus Werkstoff und Maßen berechnet wird: man soll sehen,
 * was man gebaut hat. Im Versuch stehen die Messwerte mit der Formel dahinter.
 */
import { formatiere, G, grad, bogen } from "@/lib/physik/einheiten";
import { feststoff } from "@/lib/physik/material";
import type { Aufbau } from "@/lib/physik/kern/modell";
import { aufhaengung } from "@/lib/physik/kern/bearbeiten";
import { istElektrisch, teilMasse, teilTyp } from "@/lib/physik/kern/teile";
import { verbinderTyp } from "@/lib/physik/kern/verbinder";
import type { Welt } from "@/lib/physik/kern/welt";
import type { ParameterDef } from "@/lib/physik/typen";
import type { Auswahl } from "./buehne";

export interface InspektorAktionen {
  teilWerte: (id: string, w: Record<string, number>) => void;
  verbinderWerte: (id: string, w: Record<string, number>) => void;
  drehe: (id: string, winkel: number) => void;
  /** Setzt, wie das Teil in seiner Mitte an der Wand sitzt; null löst es. */
  anWand: (id: string, art: "schraube" | "achse" | null, stelle?: number) => void;
  entferne: (a: Auswahl) => void;
  loese: (id: string) => void;
}

export function Inspektor({ aufbau, auswahl, versuch, welt, geloest, takt, aktionen }: {
  aufbau: Aufbau;
  auswahl: Auswahl | null;
  versuch: boolean;
  welt: Welt | null;
  geloest: Set<string>;
  /** Wechselt, damit die Messwerte im Versuch neu gelesen werden. */
  takt: number;
  aktionen: InspektorAktionen;
}) {
  void takt;
  const rahmen = "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3 text-sm";
  const knopf = "rounded-xl border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)]";

  if (!auswahl) {
    return (
      <div className={rahmen} role="region" aria-label="Einstellungen">
        <p className="text-[var(--text-muted)]">
          {versuch ? "Ein Teil antippen zeigt, was gerade an ihm geschieht." : "Nichts ausgewählt. Ein Teil oder einen Verbinder antippen, um es einzustellen."}
        </p>
      </div>
    );
  }

  if (auswahl.art === "teil") {
    const t = aufbau.teile.find(x => x.id === auswahl.id);
    const typ = t ? teilTyp(t.art) : undefined;
    if (!t || !typ) return <div className={rahmen} role="region" aria-label="Einstellungen" />;
    const masse = teilMasse(t);
    const vorgegeben = t.art !== "massestueck" && (t.werte.masseVorgabe ?? 0) > 0;
    const herkunft = t.art === "massestueck" ? "eingestellt" : vorgegeben ? "vorgegeben" : `aus ${feststoff(t.werte.stoff ?? 0).name}`;
    const verbunden = aufbau.verbinder.filter(v => v.a.teil === t.id || v.b.teil === t.id);
    const { art: anWand, stelle } = aufhaengung(aufbau, t.id);
    // Gezählt statt aufgezählt: »Achse, Achse, Achse« liest niemand.
    const anzahl = new Map<string, number>();
    for (const v of verbunden) {
      const name = verbinderTyp(v.art)?.name ?? v.art;
      anzahl.set(name, (anzahl.get(name) ?? 0) + 1);
    }

    return (
      <div className={rahmen} role="region" aria-label="Einstellungen">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">{typ.icon}</span>
          <span className="font-black">{typ.name}</span>
        </div>
        <div className="rounded-xl bg-[var(--surface-hover)] px-3 py-2 flex justify-between">
          <span className="text-[var(--text-muted)]">Masse</span>
          <span><b className="tabular-nums">{formatiere(masse, "kg")}</b> <span className="text-xs text-[var(--text-muted)]">{herkunft}</span></span>
        </div>

        {versuch ? (
          <>
            {typ.parameter.filter(p => p.bedienung).map(p => (
              <Regler key={p.schluessel} p={p} wert={t.werte[p.schluessel] ?? p.standard}
                onWert={w => aktionen.teilWerte(t.id, { [p.schluessel]: w })} />
            ))}
            {istElektrisch(t.art)
              ? <Stromwerte welt={welt} id={t.id} art={t.art} />
              : <Messwerte welt={welt} id={t.id} masse={masse} />}
          </>
        ) : (
          <>
            {typ.parameter.map(p => (
              <Regler key={p.schluessel} p={p} wert={t.werte[p.schluessel] ?? p.standard}
                onWert={w => aktionen.teilWerte(t.id, { [p.schluessel]: w })} />
            ))}
            <label className="flex flex-col gap-1">
              <span className="flex justify-between">
                <span className="text-[var(--text-muted)]">Drehung</span>
                <b className="tabular-nums">{Math.round(grad(t.winkel))}°</b>
              </span>
              <input type="range" min={-180} max={180} step={1} value={Math.round(grad(t.winkel))}
                onChange={e => aktionen.drehe(t.id, bogen(Number(e.target.value)))} className="accent-[var(--accent)]" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => aktionen.anWand(t.id, anWand === "schraube" ? null : "schraube", stelle)}
                aria-pressed={anWand === "schraube"}
                className={`${knopf} ${anWand === "schraube" ? "border-[var(--accent)] text-[var(--accent)] font-bold" : ""}`}
                title="Fest an die Lochwand. Nochmal tippen löst es."
              >🔩 An die Wand</button>
              <button
                onClick={() => aktionen.anWand(t.id, anWand === "achse" ? null : "achse", stelle)}
                aria-pressed={anWand === "achse"}
                className={`${knopf} ${anWand === "achse" ? "border-[var(--accent)] text-[var(--accent)] font-bold" : ""}`}
                title="Drehbar an die Lochwand. Nochmal tippen löst es."
              >⚙️ Drehbar</button>
            </div>
            {anWand && (
              <label className="flex flex-col gap-1">
                <span className="flex justify-between">
                  {/* Ein Hebel lebt davon, dass der Drehpunkt nicht in der Mitte sitzt. */}
                  <span className="text-[var(--text-muted)]">Aufhängung</span>
                  <b className="tabular-nums">{stelle === 0 ? "Mitte" : `${Math.round(stelle * 100)} %`}</b>
                </span>
                <input type="range" min={-100} max={100} step={1} value={Math.round(stelle * 100)}
                  onChange={e => aktionen.anWand(t.id, anWand, Number(e.target.value) / 100)}
                  className="accent-[var(--accent)]" />
              </label>
            )}
            {verbunden.length > 0 && (
              <div className="text-xs text-[var(--text-muted)]">
                Verbunden über {[...anzahl].map(([name, n]) => (n > 1 ? `${n} × ${name}` : name)).join(", ")}.
              </div>
            )}
            <button onClick={() => aktionen.entferne(auswahl)} className="rounded-xl border border-rose-400/40 text-rose-300 px-3 py-2 hover:bg-rose-500/10">🗑️ Entfernen</button>
          </>
        )}
      </div>
    );
  }

  const v = aufbau.verbinder.find(x => x.id === auswahl.id);
  const typ = v ? verbinderTyp(v.art) : undefined;
  if (!v || !typ) return <div className={rahmen} role="region" aria-label="Einstellungen" />;
  const kraft = versuch ? welt?.kraft(v.id) : undefined;
  const offen = geloest.has(v.id);

  return (
    <div className={rahmen} role="region" aria-label="Einstellungen">
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">{typ.icon}</span>
        <span className="font-black">{typ.name}</span>
        <span className="text-xs text-[var(--text-muted)]">{v.a.teil === null || v.b.teil === null ? "an der Wand" : "zwischen zwei Teilen"}</span>
      </div>

      {versuch && (
        <>
          <div className="rounded-xl bg-[var(--surface-hover)] px-3 py-2 flex justify-between">
            <span className="text-[var(--text-muted)]">{v.art === "seil" ? "Seilkraft" : v.art === "feder" ? "Federkraft" : "Kraft im Lager"}</span>
            <b className="tabular-nums">{offen ? "gelöst" : formatiere(kraft?.betrag ?? 0, "N")}</b>
          </div>
          {!offen && (
            <button onClick={() => aktionen.loese(v.id)} className="rounded-xl border border-[var(--accent)] text-[var(--accent)] px-3 py-2 font-bold hover:bg-[var(--surface-hover)]">
              ✂️ Lösen
            </button>
          )}
        </>
      )}

      {typ.parameter.filter(p => !versuch || p.bedienung).map(p => (
        <Regler key={p.schluessel} p={p} wert={v.werte[p.schluessel] ?? p.standard}
          onWert={w => aktionen.verbinderWerte(v.id, { [p.schluessel]: w })} />
      ))}

      {!versuch && (
        <button onClick={() => aktionen.entferne(auswahl)} className="rounded-xl border border-rose-400/40 text-rose-300 px-3 py-2 hover:bg-rose-500/10">🗑️ Entfernen</button>
      )}
    </div>
  );
}

/**
 * Was ein elektrisches Bauteil gerade tut — an seinen Klemmen abgelesen.
 *
 * Bei der Batterie zeigt die Anzeige, was sie *abgibt*: sonst stünde dort ein
 * Minus, nur weil der Strom in ihr von Minus nach Plus läuft. Beim Motor bleibt
 * das Zeichen stehen — es kippt, sobald er als Dynamo arbeitet, und genau das
 * soll man sehen.
 */
function Stromwerte({ welt, id, art }: { welt: Welt | null; id: string; art: string }) {
  const m = welt?.stromMessung(id);
  if (!m) return null;
  const quelle = art === "batterie";
  const dreh = quelle ? -1 : 1;
  const zeilen: [string, string, string][] = [
    ["Spannung", formatiere(m.spannung, "V"), ""],
    [quelle ? "Abgegebener Strom" : "Strom", formatiere(dreh * m.strom, "A"), ""],
    [quelle ? "Abgegebene Leistung" : "Leistung", formatiere(dreh * m.leistung, "W"), "P = U · I"],
    ["Temperatur", formatiere(welt?.temperatur(id) ?? 0, "K", "°C"), ""],
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {zeilen.map(([name, wert, formel]) => (
        <div key={name}>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">{name}</span><b className="tabular-nums">{wert}</b></div>
          {formel && <div className="text-xs text-[var(--text-muted)] font-mono">{formel}</div>}
        </div>
      ))}
    </div>
  );
}

/** Die Werte eines Teils im laufenden Versuch — jeweils mit der Formel dahinter. */
function Messwerte({ welt, id, masse }: { welt: Welt | null; id: string; masse: number }) {
  const z = welt?.zustand(id);
  if (!z) return null;
  // Ein liegendes Teil zittert im Löser um Mikrometer je Sekunde. Das ist
  // Stillstand; als »1,5 µm/s« angezeigt, sähe es nach Bewegung aus.
  const roh = Math.hypot(z.vx, z.vy);
  const v = roh < 1e-3 ? 0 : roh;
  const zeilen: [string, string, string][] = [
    ["Geschwindigkeit", formatiere(v, "m/s"), ""],
    ["Höhe über dem Boden", formatiere(z.y, "m"), ""],
    ["Bewegungsenergie", formatiere(0.5 * masse * v * v, "J"), "E_kin = ½ · m · v²"],
    ["Lageenergie", formatiere(masse * G * Math.max(0, z.y), "J"), "E_pot = m · g · h"],
    ["Temperatur", formatiere(welt?.temperatur(id) ?? 0, "K", "°C"), ""],
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {zeilen.map(([name, wert, formel]) => (
        <div key={name}>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">{name}</span><b className="tabular-nums">{wert}</b></div>
          {formel && <div className="text-xs text-[var(--text-muted)] font-mono">{formel}</div>}
        </div>
      ))}
    </div>
  );
}

function Regler({ p, wert, onWert }: { p: ParameterDef; wert: number; onWert: (w: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between">
        <span className="text-[var(--text-muted)]">{p.name}</span>
        <b className="tabular-nums">
          {p.optionen ? (p.optionen.find(o => o.wert === wert)?.name ?? "—") : formatiere(wert, p.einheit, p.anzeige)}
        </b>
      </span>
      {p.optionen ? (
        <select value={wert} onChange={e => onWert(Number(e.target.value))}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
          {p.optionen.map(o => <option key={o.wert} value={o.wert}>{o.name}</option>)}
        </select>
      ) : (
        <input type="range" min={p.min} max={p.max} step={(p.max - p.min) / 400} value={wert}
          onChange={e => onWert(Number(e.target.value))} className="accent-[var(--accent)]" />
      )}
    </label>
  );
}
