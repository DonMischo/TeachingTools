"use client";
/**
 * Geschichte der Medien — von der Höhlenwand bis zum Chatbot.
 * Leitfrage überall: Wie kommt eine Information weiter, schneller,
 * haltbarer oder zu mehr Menschen?
 *
 * Kennenlernen: Zeitreise (Stationen nacheinander freischalten), Vergleich, Flop-Museum, Galerie
 * Anwenden:     Eilbote (welches Medium passt?), Wer war zuerst? (sortieren)
 */
import { useEffect, useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import { MEDIEN } from "@/lib/medien/medien";
import { GALERIE, BEREICHE, nachweisFuer } from "@/lib/medien/galerie";
import { lies, type Fortschritt } from "@/lib/medien/fortschritt";
import FotoGalerie from "@/components/galerie/FotoGalerie";
import Zeitreise from "./Zeitreise";
import Vergleich from "./Vergleich";
import FlopMuseum from "./FlopMuseum";
import Eilbote from "./Eilbote";
import WerWarZuerst from "./WerWarZuerst";

const REITER = [
  { id: "zeitreise", ebene: "kennen", icon: "🕰️", label: "Zeitreise" },
  { id: "vergleich", ebene: "kennen", icon: "📈", label: "Vergleich" },
  { id: "flops", ebene: "kennen", icon: "🪦", label: "Flop-Museum" },
  { id: "galerie", ebene: "kennen", icon: "📷", label: "Galerie" },
  { id: "eilbote", ebene: "anwenden", icon: "🏃", label: "Eilbote" },
  { id: "sortieren", ebene: "anwenden", icon: "🧩", label: "Wer war zuerst?" },
] as const;
type Reiter = (typeof REITER)[number]["id"];

const chip = (an: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;

/** `vorgabe` (TaskCrawler-Station): { reiter?: "zeitreise" | "vergleich" | "flops" | "galerie" | "eilbote" | "sortieren" } */
export default function Medien({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const fest = wahl(vorgabe, "reiter", REITER.map(r => r.id));
  const [reiter, setReiter] = useState<Reiter>(fest ?? "zeitreise");
  const [f, setF] = useState<Fortschritt>({ geschafft: [], eilbote: 0, sortieren: 0 });
  // Nur lesen; geschrieben wird in den Handlern (lib/medien/fortschritt.ts)
  useEffect(() => { setF(lies()); }, []);

  const frei = GALERIE.filter(b => f.geschafft.includes(b.medium)).length;
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-seite mx-auto w-full" data-sim="medien">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">📜 Geschichte der Medien</h1>
          <p className="text-muted text-sm mt-1 max-w-3xl">
            Wie kommt eine Nachricht von A nach B — weiter, schneller, haltbarer, zu mehr Menschen? 40 000 Jahre in {MEDIEN.length} Stationen,
            mit Flops, Kuriosem und Fotos zum Freischalten.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {!fest && <div className="inline-flex flex-wrap rounded-xl border border-line p-1 bg-surface gap-1">
          <span className="self-center px-2 text-xs font-bold text-muted uppercase">Kennenlernen</span>
          {REITER.filter(r => r.ebene === "kennen").map(r => <button key={r.id} onClick={() => setReiter(r.id)} className={chip(reiter === r.id)}>{r.icon} {r.label}</button>)}
          <span className="self-center px-2 text-xs font-bold text-muted uppercase border-l border-line ml-1">Anwenden</span>
          {REITER.filter(r => r.ebene === "anwenden").map(r => <button key={r.id} onClick={() => setReiter(r.id)} className={chip(reiter === r.id)}>{r.icon} {r.label}</button>)}
        </div>}
        <div className="ml-auto flex gap-2 text-sm">
          <span className="chip" title="Geschaffte Stationen">🏁 {f.geschafft.length} / {MEDIEN.length}</span>
          <span className="chip" title="Freigeschaltete Fotos">📷 {frei} / {GALERIE.length}</span>
        </div>
      </div>

      {reiter === "zeitreise" && <Zeitreise fortschritt={f} setFortschritt={setF} />}
      {reiter === "vergleich" && <Vergleich />}
      {reiter === "flops" && <FlopMuseum geschafft={f.geschafft} />}
      {reiter === "galerie" && (
        <FotoGalerie bilder={GALERIE} bereiche={BEREICHE} nachweisFuer={nachweisFuer}
          gesperrt={b => {
            const m = MEDIEN.find(x => x.id === (b as (typeof GALERIE)[number]).medium);
            return m && !f.geschafft.includes(m.id) ? `Schaff die Station ${m.icon} ${m.name} in der Zeitreise.` : null;
          }}
          einleitung={<>Echte Fotos der Medien aus {MEDIEN.length} Stationen. Jedes Foto wird freigeschaltet, sobald du die passende Station der Zeitreise geschafft hast. Bisher: <b>{frei} von {GALERIE.length}</b>.</>} />
      )}
      {reiter === "eilbote" && <Eilbote rekord={f.eilbote} setFortschritt={setF} />}
      {reiter === "sortieren" && <WerWarZuerst rekord={f.sortieren} setFortschritt={setF} />}
    </div>
  );
}
