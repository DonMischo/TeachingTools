"use client";
/**
 * Der Reiter »Atommodelle« im Periodensystem.
 *
 * Links im Raster wird das Element gewählt, hier steht das Bild dazu — in dem
 * Modell, das gerade an der Reihe ist. Die fünf Modelle stehen in der
 * Reihenfolge des Unterrichts, und bei jedem steht, was es erklärt und wo es
 * aufhört; das nächste schließt genau diese Lücke.
 *
 * Dazu das Bindungslabor: bis zu acht Atome zusammenstecken und sehen, wie die
 * geteilten Elektronenpaare zwischen den Schalen pendeln.
 */
import { useState } from "react";
import {
  aussen, bindigkeit, MODELLE, neutronen, orbitale, schalen, type ModellId,
} from "@/lib/pse/atommodell";
import { baue, BAUSTEINE, MAX_ATOME, VORLAGEN, VORLAGENGRUPPEN } from "@/lib/pse/bindung";
import { pseElement, type PseElement } from "@/lib/pse/elemente";
import Atombild from "./Atombild";
import Bindungsbild from "./Bindungsbild";
import Lewisbild from "./Lewisbild";

/** Bor ist der rote Faden dieses Reiters — darum steht es vorn. */
const SCHNELL = ["B", "H", "He", "C", "N", "O", "Na", "Cl", "Fe"];

/** Was Bor besonders macht — der Grund, warum es hier im Mittelpunkt steht. */
const BOR_TEXT = [
  "Bor hat drei Außenelektronen und gibt alle drei in Bindungen — und kommt damit nur auf sechs statt acht.",
  "Dieses Elektronensextett ist eine Lücke, und Lücken ziehen an: BF₃ nimmt freie Elektronenpaare auf, etwa vom Ammoniak. Erst dann hat Bor sein Oktett.",
  "Bor ist außerdem das Halbmetall, mit dem man Glas hitzebeständig macht (Borosilicatglas) und Silicium dotiert.",
];

export default function Atommodelle({ e, onWahl }: { e: PseElement; onWahl: (e: PseElement) => void }) {
  const [blick, setBlick] = useState<"atom" | "bindung">("atom");
  const [modell, setModell] = useState<ModellId>("schalen");
  const [laufen, setLaufen] = useState(true);
  const [teile, setTeile] = useState<string[]>(["B", "F", "F", "F"]);

  const m = MODELLE.find(x => x.id === modell)!;
  const sch = schalen(orbitale(e));
  const v = baue(teile);

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-black">⚛️ Atommodelle</h2>
        <button onClick={() => setLaufen(l => !l)}
          className="px-2 py-1 rounded-lg border border-line text-xs text-muted hover:text-fg">
          {laufen ? "⏸ anhalten" : "▶ weiter"}
        </button>
      </div>

      <div className="inline-flex self-start rounded-xl border border-line p-1 bg-surface">
        {([["atom", "Ein Atom"], ["bindung", "Verbindungen"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setBlick(id)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              blick === id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
            {label}
          </button>
        ))}
      </div>

      {blick === "atom" ? (
        <>
          {/* Die Leiter der Modelle: jedes erklärt mehr als das vorige. */}
          <div className="flex flex-wrap gap-1">
            {MODELLE.map(x => (
              <button key={x.id} onClick={() => setModell(x.id)}
                className={`px-2.5 py-1 rounded-lg border text-xs leading-tight text-left ${
                  modell === x.id ? "border-accent bg-accent/15 font-bold" : "border-line text-muted hover:text-fg"}`}>
                {x.name}
                <span className="block text-[10px] opacity-70 font-normal">{x.jahr}</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-black/10 dark:bg-white/5 p-2">
            <Atombild e={e} modell={modell} laufen={laufen} />
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold">{e.name} — {m.name}</h3>
            <span className="text-xs text-muted">{m.wer}, {m.jahr}</span>
          </div>
          <p className="text-sm">{m.idee}</p>
          <p className="text-xs rounded-lg bg-ok/10 px-3 py-2">
            <strong>Erklärt: </strong>{m.kann}
          </p>
          <p className="text-xs rounded-lg bg-bad/10 px-3 py-2">
            <strong>Hört auf bei: </strong>{m.luecke}
          </p>

          <dl className="text-xs grid grid-cols-2 gap-x-3">
            <div className="flex justify-between border-b border-line/50 py-0.5">
              <dt className="text-muted">Protonen</dt><dd className="font-medium tabular-nums">{e.z}</dd>
            </div>
            <div className="flex justify-between border-b border-line/50 py-0.5">
              <dt className="text-muted">Neutronen</dt>
              <dd className="font-medium tabular-nums">{neutronen(e) ?? "—"}</dd>
            </div>
            <div className="flex justify-between border-b border-line/50 py-0.5">
              <dt className="text-muted">Schalen</dt>
              <dd className="font-medium tabular-nums">{sch.join("·")}</dd>
            </div>
            <div className="flex justify-between border-b border-line/50 py-0.5">
              <dt className="text-muted">Außen</dt>
              <dd className="font-medium tabular-nums">{aussen(sch)}e⁻</dd>
            </div>
            <div className="flex justify-between py-0.5">
              <dt className="text-muted">Bindigkeit</dt>
              <dd className="font-medium tabular-nums">{bindigkeit(e) || "—"}</dd>
            </div>
          </dl>

          {e.z === 5 && (
            <div className="rounded-lg bg-accent/10 px-3 py-2 text-xs flex flex-col gap-1">
              <strong>Warum Bor?</strong>
              {BOR_TEXT.map(t => <span key={t}>{t}</span>)}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">
              Element wählen — im Raster anklicken oder hier:
            </span>
            <div className="flex flex-wrap gap-1">
              {SCHNELL.map(s => {
                const x = pseElement(s)!;
                return (
                  <button key={s} onClick={() => onWahl(x)} title={x.name}
                    className={`px-2 py-0.5 rounded-lg border text-xs ${
                      e.z === x.z ? "border-accent bg-accent/15 font-bold" : "border-line text-muted hover:text-fg"}`}>
                    {x.symbol}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl bg-black/10 dark:bg-white/5 p-2">
            <Bindungsbild v={v} laufen={laufen} />
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold">
              {v.gesetzt || "—"}{v.name ? <span className="text-muted font-normal"> · {v.name}</span> : null}
            </h3>
            <span className="text-xs text-muted">{v.bindungen.length} Bindung{v.bindungen.length === 1 ? "" : "en"}</span>
          </div>

          <p className="text-xs text-muted">
            Jedes Atom hat seine Farbe, und jedes seiner Elektronen trägt sie. Ein bindendes Paar
            besteht aus je einem Elektron beider Partner — beide laufen um <em>beide</em> Kerne.
            Darum zählt dasselbe Elektron bei zwei Atomen mit, und darum stehen unter den Atomen
            zusammen mehr Elektronen, als überhaupt da sind.
          </p>

          {/* Dieselbe Verbindung als Kurzschrift fürs Heft. */}
          <div className="rounded-xl border border-line p-2">
            <div className="text-[11px] text-muted mb-1">
              Valenzstrichformel — ein Strich ist ein Elektronenpaar
            </div>
            <Lewisbild v={v} />
          </div>

          {v.hinweise.map(h => (
            <p key={h} className={`text-xs rounded-lg px-3 py-2 ${
              h.startsWith("Alle Atome") ? "bg-ok/10" : "bg-accent/10"}`}>{h}</p>
          ))}

          {VORLAGENGRUPPEN.map(gruppe => (
            <div key={gruppe} className="flex flex-col gap-1">
              <span className="text-xs text-muted">{gruppe}</span>
              <div className="flex flex-wrap gap-1">
                {VORLAGEN.filter(x => x.gruppe === gruppe).map(x => (
                  <button key={x.label} onClick={() => setTeile(x.symbole)}
                    className={`px-2 py-0.5 rounded-lg border text-xs ${
                      v.gesetzt === x.label ? "border-accent bg-accent/15 font-bold" : "border-line text-muted hover:text-fg"}`}>
                    {x.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">
              Atome dazunehmen ({teile.length}/{MAX_ATOME})
            </span>
            <div className="flex flex-wrap gap-1">
              {BAUSTEINE.map(s => (
                <button key={s} disabled={teile.length >= MAX_ATOME}
                  onClick={() => setTeile(t => [...t, s])}
                  className="px-2 py-0.5 rounded-lg border border-line text-xs hover:border-accent disabled:opacity-30">
                  +{s}
                </button>
              ))}
            </div>
          </div>

          {teile.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">Anklicken entfernt wieder:</span>
              <div className="flex flex-wrap gap-1">
                {teile.map((s, i) => (
                  <button key={`${s}${i}`} onClick={() => setTeile(t => t.filter((_, k) => k !== i))}
                    className="px-2 py-0.5 rounded-lg border border-line bg-surface text-xs hover:border-bad">
                    {s} ×
                  </button>
                ))}
                <button onClick={() => setTeile([])}
                  className="px-2 py-0.5 rounded-lg text-xs text-muted hover:text-fg">alles leeren</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
