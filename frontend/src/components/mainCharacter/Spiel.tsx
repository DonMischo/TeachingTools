"use client";
/**
 * Spiel mit dem eigenen Charakter: Bühne mit Talenten, Stärken, Baustellen
 * und Wochenplan. Plan und Klasse lassen sich mitten im Lauf ändern. Am Ende
 * gibt es das Zeugnis als PDF. In eine Sitzung gehen nur Klasse, Woche und
 * Werte (alle 5 Wochen und am Ende), nichts sonst.
 */
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  ABSCHLUSS, BAUSTELLEN, KLASSEN, STAERKEN, WERT_INFO, werte,
  type BaustelleId, type KlasseId, type Zustand,
} from "@/lib/mainCharacter";
import { speichereZeugnisPdf, zeugnisText } from "@/lib/mainCharacterZeugnis";
import { Buehne } from "./Buehne";
import { PlanRegler } from "./Charakterbogen";
import type { Charakter } from "./speicher";
import { Steuerung, figurKlasse, mottoFuer } from "./Steuerung";
import { useLauf } from "./useLauf";

export const MELDE_TAKT = 5;

export function Spiel({ c, onC, zugang, onBogen }: {
  c: Charakter;
  onC: (c: Charakter) => void;
  /** Sitzung, in die der anonyme Stand gemeldet wird */
  zugang?: { code: string; token: string | null } | null;
  onBogen: () => void;
}) {
  const [meldefehler, setMeldefehler] = useState(false);
  const klasseRef = useRef<KlasseId>(c.klasse);
  klasseRef.current = c.klasse;
  const melden = (z: Zustand) => {
    if (!zugang) return;
    if (z.woche % MELDE_TAKT !== 0 && z.woche < ABSCHLUSS) return;
    api.mainCharacter.stand(zugang, { klasse: klasseRef.current, woche: z.woche, werte: werte(z) })
      .then(() => setMeldefehler(false))
      .catch(() => setMeldefehler(true));
  };
  const lauf = useLauf({ klasse: c.klasse, profil: c.profil, plan: c.plan ?? undefined, onWoche: melden });
  const waehleKlasse = (k: KlasseId) => onC({ ...c, klasse: k, plan: null });

  return (
    <div className="flex flex-col gap-4">
      <Buehne klasse={c.klasse} stand={lauf.stand} motto={mottoFuer(c.klasse, lauf.ich)}
        onFigur={i => waehleKlasse(figurKlasse(i, c.klasse))}
        steuerung={<Steuerung klasse={c.klasse} onKlasse={waehleKlasse} mitNpc={false}
          laeuft={lauf.laeuft} onLos={lauf.umschalten} onNeu={lauf.neu} ich={lauf.ich} />} />
      {meldefehler && <p className="text-sm text-bad">Dein Stand kam gerade nicht bei der Klassenübersicht an. Das Spiel läuft trotzdem weiter.</p>}

      {lauf.fertig && <Ende c={c} ich={lauf.ich} npc={lauf.npc} />}

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
        <section className="card p-4 flex flex-col gap-2">
          <h2 className="font-semibold">Wochenplan {lauf.laeuft && <span className="text-xs text-muted font-normal">(gilt ab nächster Woche)</span>}</h2>
          <PlanRegler c={c} onC={onC} />
        </section>
        <section className="card p-4 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">{c.spitzname || "Dein Charakter"}</h2>
            <button type="button" className="text-sm underline text-muted" onClick={onBogen}>Charakterbogen</button>
          </div>
          {c.profil.staerken.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {c.profil.staerken.map(s => <span key={s} className="chip chip-on text-xs" title={STAERKEN[s].text}>{STAERKEN[s].name}</span>)}
            </div>
          )}
          {c.profil.baustellen.length > 0 ? (
            <ul className="grid gap-2">
              {c.profil.baustellen.map(b => <BaustellenZeile key={b} id={b} rest={lauf.ich.rest[b] ?? 0} />)}
            </ul>
          ) : <p className="text-sm text-muted">Keine Baustellen gewählt.</p>}
        </section>
      </div>
    </div>
  );
}

function BaustellenZeile({ id, rest }: { id: BaustelleId; rest: number }) {
  const info = BAUSTELLEN[id];
  const fertig = rest <= 0;
  return (
    <li className="flex flex-col gap-1 text-sm">
      <div className="flex justify-between gap-2">
        <span>{info.name}</span>
        <span className={`tabular-nums ${fertig ? "text-ok font-semibold" : "text-muted"}`}>
          {fertig ? "Baustelle geschafft ✓" : `noch ${Math.round(rest)} %`}
        </span>
      </div>
      <div className="h-1.5 rounded bg-surface-hover overflow-hidden">
        <div className="h-full bg-accent transition-all" style={{ width: `${rest}%` }} />
      </div>
      {!fertig && <span className="text-xs text-muted">Schrumpft durch Zeit für {WERT_INFO[info.durch].name}.</span>}
    </li>
  );
}

function Ende({ c, ich, npc }: { c: Charakter; ich: Zustand; npc: Zustand }) {
  const [laedt, setLaedt] = useState(false);
  const daten = {
    spitzname: c.spitzname, klasse: c.klasse, profil: c.profil, werte: werte(ich), npc: werte(npc),
    rest: ich.rest, woche: ich.woche,
  };
  const t = zeugnisText(daten);
  return (
    <section className="card p-5 flex flex-col gap-3 border-accent" aria-live="polite">
      <h2 className="text-xl font-semibold">Abschluss 2028 — geschafft!</h2>
      <p><b>Das kannst du:</b> {t.kannst.map(k => WERT_INFO[k.wert].name).join(", ")}.
        {t.vorNpc.length > 0 && <> Vor dem NPC liegst du bei {t.vorNpc.map(w => WERT_INFO[w].name).join(", ")}.</>}</p>
      {t.geschafft.length > 0 && <p>Geschaffte Baustellen: {t.geschafft.map(b => BAUSTELLEN[b].name).join(", ")}.</p>}
      <p className="text-sm text-muted">Mehr Fokus lohnt sich bei {t.fokus.map(f => WERT_INFO[f.wert].name).join(" und ")}. Die Tipps stehen im Zeugnis.</p>
      <div>
        <button type="button" className="btn-primary" disabled={laedt}
          onClick={() => { setLaedt(true); speichereZeugnisPdf(daten).finally(() => setLaedt(false)); }}>
          {laedt ? "Zeugnis wird erstellt …" : "📄 Zeugnis als PDF"}
        </button>
      </div>
      <p className="text-xs text-muted">Klasse am Ende: {KLASSEN[c.klasse].name}. Probier gern einen anderen Plan — wo landest du dann?</p>
    </section>
  );
}
