"use client";
/** Ausgehen in Erfurt: Ort, Dauer, Getränke, Heimweg — mit Promille-Schätzung und Jugendschutz. */
import { useState } from "react";
import { AUSGEHEN, GETRAENKE, promille } from "@/lib/leben/aktionen";
import { alter } from "@/lib/leben/kern";
import type { Spielstand } from "@/lib/leben/typen";
import { wochentag } from "@/lib/leben/zeit";
import { euro, Fenster, Hinweis, Knopf } from "./ui";

export function Ausgehen({ s, onLos, onZu }: {
  s: Spielstand;
  onLos: (ort: string, getraenke: Record<string, number>, heimweg: "bahn" | "taxi" | "rad" | "fuss", stunden: number) => void;
  onZu: () => void;
}) {
  const a = alter(s);
  const [ort, setOrt] = useState(AUSGEHEN[0].id);
  const o = AUSGEHEN.find((x) => x.id === ort)!;
  const [stunden, setStunden] = useState(o.dauer);
  const [getraenke, setGetraenke] = useState<Record<string, number>>({});
  const [heimweg, setHeimweg] = useState<"bahn" | "taxi" | "rad" | "fuss">("bahn");
  const gramm = Object.entries(getraenke).reduce((sum, [id, n]) => sum + (GETRAENKE.find((g) => g.id === id)?.alkoholG ?? 0) * n, 0);
  const trinken = Object.entries(getraenke).reduce((sum, [id, n]) => sum + (GETRAENKE.find((g) => g.id === id)?.preis ?? 0) * n, 0);
  const kinotag = o.id === "kino" && wochentag(s.tag) === 1;
  const kosten = (kinotag ? 6.9 : o.eintritt) + trinken + (o.essen?.preis ?? 0) + (o.id === "freunde" ? 6 : 0);
  const spitze = promille(gramm, stunden / 2);
  const ende = s.stunde + stunden;
  const hatRad = s.moebel.some((m) => m.id === "fahrrad-schloss");

  return (
    <Fenster titel="Ausgehen" icon="🎉" onZu={onZu} breit
      fuss={<div className="flex flex-wrap items-center gap-3 text-sm">
        <span>Kosten etwa <b className="text-amber-300">{euro(kosten)}</b>{heimweg === "taxi" ? " + Taxi" : ""} · zurück gegen {String(Math.floor(ende % 24)).padStart(2, "0")}:{ende % 1 ? "30" : "00"} Uhr</span>
        <span className="ml-auto" />
        <Knopf art="haupt" onClick={() => onLos(ort, getraenke, heimweg, stunden)}>Los!</Knopf>
      </div>}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          {AUSGEHEN.map((x) => (
            <button key={x.id} type="button" onClick={() => { setOrt(x.id); setStunden(x.dauer); }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${ort === x.id ? "bg-amber-500/25 ring-1 ring-amber-400" : "bg-white/5 hover:bg-white/10"} ${x.ab > a ? "opacity-50" : ""}`}>
              <span className="text-xl">{x.icon}</span>
              <span className="flex-1"><b>{x.name}</b><br /><span className="text-xs text-slate-400">{x.text}</span></span>
              <span className="text-xs">{x.eintritt ? euro(x.eintritt) : "frei"}{x.ab ? ` · ab ${x.ab}` : ""}</span>
            </button>
          ))}
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold">Wie lange? {stunden} Stunden
            <input type="range" min={1} max={8} value={stunden} onChange={(e) => setStunden(Number(e.target.value))} className="w-full" />
          </label>
          {o.getraenke && (
            <div className="mb-2">
              <div className="mb-1 text-sm font-bold">Was trinkst du über den Abend?</div>
              {GETRAENKE.map((g) => {
                const n = getraenke[g.id] ?? 0;
                const gesperrt = g.ab > a;
                return (
                  <div key={g.id} className={`flex items-center gap-2 py-0.5 text-sm ${gesperrt ? "opacity-40" : ""}`}>
                    <span className="flex-1">{g.name} <span className="text-xs text-slate-400">{euro(g.preis)}{g.alkoholG ? ` · ${g.alkoholG} g Alkohol` : ""}{g.ab ? ` · ab ${g.ab}` : ""}</span></span>
                    <button type="button" className="h-6 w-6 rounded-sm bg-white/10" onClick={() => setGetraenke({ ...getraenke, [g.id]: Math.max(0, n - 1) })}>−</button>
                    <span className="w-5 text-center">{n}</span>
                    <button type="button" disabled={gesperrt} className="h-6 w-6 rounded-sm bg-amber-500 text-black disabled:opacity-30" onClick={() => setGetraenke({ ...getraenke, [g.id]: n + 1 })}>+</button>
                  </div>
                );
              })}
            </div>
          )}
          {gramm > 0 && (
            <div className={`rounded-lg p-2 text-sm ${spitze >= 2 ? "bg-rose-600/30" : spitze >= 1 ? "bg-amber-500/20" : "bg-white/5"}`}>
              Geschätzter Blutalkohol: <b>{spitze.toFixed(1)} ‰</b> ({gramm} g reiner Alkohol).
              {spitze >= 2 ? " Lebensgefährlich — Alkoholvergiftung möglich!" : spitze >= 1.1 ? " Deutlich betrunken. Morgen droht ein Kater." : spitze >= 0.5 ? " Angetrunken." : ""}
            </div>
          )}
          <div className="mt-2 text-sm font-bold">Heimweg</div>
          <div className="flex flex-wrap gap-1">
            {([["bahn", "🚋 Nachtbahn/-bus"], ["taxi", "🚕 Taxi"], ["rad", "🚲 Fahrrad"], ["fuss", "🚶 Laufen"]] as const).map(([id, n]) => (
              <button key={id} type="button" disabled={id === "rad" && !hatRad} onClick={() => setHeimweg(id)}
                className={`rounded-lg px-2 py-1 text-sm ${heimweg === id ? "bg-white text-black" : "bg-white/5"} disabled:opacity-30`}>{n}</button>
            ))}
          </div>
          {a < 18 && <Hinweis art="warnung">Jugendschutz: Mit {a} darfst du ohne Eltern bis 24 Uhr weg{a >= 16 ? ", Bier und Wein ja, Schnaps nein" : ", Alkohol gar nicht"}. Clubs lassen meist erst ab 18 rein.</Hinweis>}
          {heimweg === "rad" && spitze >= 0.5 && <Hinweis art="fehler">Ab 1,6 ‰ auf dem Fahrrad ist eine Straftat — mit MPU, bevor du je einen Führerschein machen darfst.</Hinweis>}
          {kinotag && <Hinweis art="tipp">Heute ist Kinotag — günstiger!</Hinweis>}
        </div>
      </div>
    </Fenster>
  );
}
