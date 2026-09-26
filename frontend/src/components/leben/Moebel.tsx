"use client";
/** Einrichten: neu kaufen (IKEA-/Elektromarkt-Preise) oder gebraucht über Kleinanzeigen. */
import { useMemo, useState } from "react";
import { kleinanzeigen, type Kleinanzeige } from "@/lib/leben/aktionen";
import { MOEBEL, MOEBEL_DEF, type MoebelDef } from "@/lib/leben/kern";
import type { Spielstand } from "@/lib/leben/typen";
import { euro, Fenster, Hinweis, Knopf, Reiter } from "./ui";

const RAEUME: { id: MoebelDef["raum"] | "alle"; name: string }[] = [
  { id: "alle", name: "Alles" }, { id: "schlafen", name: "🛏️ Schlafen" }, { id: "kueche", name: "🍳 Küche" },
  { id: "bad", name: "🚿 Bad" }, { id: "wohnen", name: "🛋️ Wohnen" }, { id: "flur", name: "🚪 Flur" }, { id: "technik", name: "💻 Technik" },
];
/** Was man zum Wohnen wirklich braucht — je Bedarf mehrere mögliche Möbel. */
const GRUNDAUSSTATTUNG: { name: string; ids: string[]; ebk?: boolean }[] = [
  { name: "Schlafplatz (Matratze oder Schlafsofa)", ids: ["matratze-90", "matratze-140", "schlafsofa"] },
  { name: "Bettdecke & Kissen", ids: ["bettdecke-kissen-set"] },
  { name: "Bettwäsche", ids: ["bettwaesche-set"] },
  { name: "Handtücher", ids: ["handtuch-set"] },
  { name: "Licht", ids: ["deckenlampe", "stehlampe"] },
  { name: "Kochgelegenheit", ids: ["standherd-backofen", "doppelkochplatte", "einbaukueche-kuchenzeile"], ebk: true },
  { name: "Kühlschrank", ids: ["kuehlschrank-kombi", "mini-kuehlschrank", "einbaukueche-kuchenzeile"], ebk: true },
  { name: "Topf oder Pfanne", ids: ["toepfe-set", "pfanne-set"] },
  { name: "Geschirr & Besteck", ids: ["geschirr-set", "besteck-set"] },
  { name: "Duschvorhang", ids: ["duschvorhang"] },
  { name: "Klobürste", ids: ["kloburste"] },
  { name: "Mülleimer", ids: ["muelleimer-trennung"] },
  { name: "Besen & Wischmopp", ids: ["besen-kehrblech", "staubsauger"] },
];

const STUFE = { pflicht: "Muss", wichtig: "Wichtig", komfort: "Komfort", luxus: "Luxus" };
const STUFE_FARBE = { pflicht: "bg-rose-600", wichtig: "bg-amber-500 text-black", komfort: "bg-sky-600", luxus: "bg-fuchsia-600" };

export function Moebel({ s, onNeu, onGebraucht, onVerkaufen, onZu }: {
  s: Spielstand;
  onNeu: (id: string, liefern: boolean) => void;
  onGebraucht: (a: Kleinanzeige) => void;
  onVerkaufen: (uid: number) => void;
  onZu: () => void;
}) {
  const [raum, setRaum] = useState<MoebelDef["raum"] | "alle">("alle");
  const [modus, setModus] = useState<"neu" | "gebraucht" | "besitz">("neu");
  const [offen, setOffen] = useState<string | null>(null);
  const liste = MOEBEL.filter((m) => raum === "alle" || m.raum === raum);
  const hat = (id: string) => s.moebel.some((m) => m.id === id);
  // Grundausstattung als Bedarf mit Alternativen (Matratze ODER Schlafsofa …)
  const fehlend = GRUNDAUSSTATTUNG.filter((g) => !(g.ebk && s.wohnung.ebk) && !g.ids.some(hat));
  const pflichtSumme = fehlend.reduce((a, g) => a + Math.min(...g.ids.map((id) => MOEBEL_DEF.get(id)?.neu.preis ?? 0)), 0);

  return (
    <Fenster titel="Einrichten" icon="🛋️" onZu={onZu} breit>
      {s.wohnung.form === "eltern" && <Hinweis>Du wohnst noch bei den Eltern — dein Zimmer ist eingerichtet. Du kannst trotzdem schon Sachen für später kaufen.</Hinweis>}
      {s.wohnung.form !== "eltern" && fehlend.length > 0 && (
        <Hinweis art="warnung">
          Es fehlt noch Grundausstattung (neu, jeweils günstigste Variante, zusammen ab {euro(pflichtSumme)}): <b>{fehlend.map((g) => g.name).join(", ")}</b>.
        </Hinweis>
      )}
      <Reiter aktiv={modus} onWahl={setModus} reiter={[{ id: "neu", name: "🏬 Neu kaufen" }, { id: "gebraucht", name: "🤝 Kleinanzeigen" }, { id: "besitz", name: `📦 Meine Sachen (${s.moebel.length})` }]} />
      {modus !== "besitz" && (
        <div className="mb-2 flex flex-wrap gap-1">
          {RAEUME.map((r) => (
            <button key={r.id} type="button" onClick={() => setRaum(r.id)}
              className={`rounded-lg px-2 py-1 text-xs font-bold ${raum === r.id ? "bg-white text-black" : "bg-white/5"}`}>{r.name}</button>
          ))}
        </div>
      )}
      {modus === "neu" && (
        <div className="grid gap-1.5 md:grid-cols-2">
          {liste.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
              <span className="text-2xl">{m.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{m.name} {hat(m.id) && <span className="text-emerald-300">✓</span>}</div>
                <div className="text-xs text-slate-400">
                  <span className={`mr-1 rounded px-1 font-bold ${STUFE_FARBE[m.stufe]}`}>{STUFE[m.stufe]}</span>
                  {m.neu.laden}{m.aufbau ? ` · Aufbau ${m.aufbau} h` : ""}{m.strom ? ` · ${m.strom} kWh/Jahr` : ""}
                </div>
                {m.hinweis && <div className="text-xs text-sky-300">{m.hinweis}</div>}
              </div>
              <div className="text-right text-sm font-black">{euro(m.neu.preis)}</div>
              <div className="flex flex-col gap-1">
                <Knopf klein onClick={() => onNeu(m.id, false)}>Mitnehmen</Knopf>
                {m.masse.b * m.masse.t > 6000 && <Knopf klein art="leise" onClick={() => onNeu(m.id, true)}>Liefern</Knopf>}
              </div>
            </div>
          ))}
        </div>
      )}
      {modus === "gebraucht" && (
        <div>
          <Hinweis art="tipp">Kleinanzeigen: viel günstiger, aber ohne Garantie. Ansehen, ausprobieren, <b>bar bei Abholung</b> zahlen — nie per Vorkasse oder »PayPal Freunde« an Fremde. Große Teile brauchen ein Auto (Kumpel, Spritgeld).</Hinweis>
          <div className="space-y-1.5">
            {liste.filter((m) => m.gebraucht).map((m) => (
              <div key={m.id} className="rounded-lg bg-white/5 px-2 py-1.5">
                <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setOffen(offen === m.id ? null : m.id)}>
                  <span className="text-2xl">{m.icon}</span>
                  <span className="flex-1 text-sm font-bold">{m.name}</span>
                  <span className="text-xs text-slate-400">neu {euro(m.neu.preis)} · gebraucht {m.gebraucht!.min}–{m.gebraucht!.max} €</span>
                  <span>{offen === m.id ? "▲" : "▼"}</span>
                </button>
                {offen === m.id && <Anzeigen s={s} id={m.id} onKaufen={onGebraucht} />}
              </div>
            ))}
          </div>
        </div>
      )}
      {modus === "besitz" && (
        <div className="space-y-1">
          {s.moebel.length === 0 && <p className="text-sm text-slate-400">Noch nichts.</p>}
          {s.moebel.map((m) => {
            const d = MOEBEL_DEF.get(m.id);
            return (
              <div key={m.uid} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1 text-sm">
                <span className="text-xl">{d?.icon}</span>
                <span className="flex-1">{d?.name} {m.gebraucht && <span className="text-xs text-slate-400">(gebraucht)</span>} {m.defekt && <span className="text-xs font-bold text-rose-400">defekt</span>}</span>
                <span className="text-slate-400">{euro(m.preis)}</span>
                <Knopf klein art="leise" onClick={() => onVerkaufen(m.uid)}>{m.defekt ? "Entsorgen" : "Verkaufen"}</Knopf>
              </div>
            );
          })}
        </div>
      )}
    </Fenster>
  );
}

function Anzeigen({ s, id, onKaufen }: { s: Spielstand; id: string; onKaufen: (a: Kleinanzeige) => void }) {
  const liste = useMemo(() => kleinanzeigen(s, id), [s, id]);
  return (
    <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
      {liste.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded bg-white/10 px-1 text-xs">{a.zustand}</span>
          <span className="flex-1 text-slate-300">„{a.text}“ <span className="text-xs text-slate-400">— {a.ort}</span></span>
          <b>{euro(a.preis)}</b>
          <Knopf klein art={a.betrug ? "leise" : "normal"} onClick={() => onKaufen(a)}>{a.versand ? "Überweisen" : "Abholen (bar)"}</Knopf>
        </div>
      ))}
      <p className="text-xs text-slate-400">Neue Anzeigen gibt es jede Woche.</p>
    </div>
  );
}
