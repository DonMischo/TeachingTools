"use client";
/**
 * Wissen zu Vulkanen: Liste nach Gruppen links, Eintrag mit Text, Fakten,
 * Fotos (aus der Galerie, mit Nachweis) und Hinweis zur Simulation rechts.
 */
import { BildStreifen } from "@/components/galerie/FotoGalerie";
import { GALERIE, nachweisFuer } from "@/lib/vulkan/galerie";
import { GRUPPEN, WISSEN } from "@/lib/vulkan/wissen";

export default function VulkanWissen({ eintrag, waehlen }: { eintrag: string; waehlen: (id: string) => void }) {
  const e = WISSEN.find(w => w.id === eintrag) ?? WISSEN[0];
  const bilder = e.bilder.map(id => GALERIE.find(b => b.id === id)!).filter(Boolean);
  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <nav className="flex flex-col gap-3" aria-label="Wissen">
        {GRUPPEN.map(g => (
          <div key={g.id}>
            <div className="mb-1 text-xs font-black uppercase tracking-wide text-muted">{g.icon} {g.name}</div>
            <div className="flex flex-col">
              {WISSEN.filter(w => w.gruppe === g.id).map(w => (
                <button key={w.id} onClick={() => waehlen(w.id)}
                  className={`rounded-lg px-2 py-1.5 text-left text-sm ${w.id === e.id ? "bg-accent text-accent-fg font-bold" : "hover:bg-surface-hover"}`}>
                  {w.icon} {w.titel}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <article className="card flex min-w-0 flex-col gap-3 p-4">
        <h2 className="text-xl font-black">{e.icon} {e.titel}</h2>
        <p className="font-bold text-muted">{e.kurz}</p>
        {e.absaetze.map((a, i) => <p key={i} className="leading-relaxed">{a}</p>)}
        {e.fakten && (
          <table className="w-full text-sm">
            <tbody>
              {e.fakten.map(([k, v]) => (
                <tr key={k} className="border-t border-line">
                  <th className="w-40 py-1 pr-3 text-left align-top font-bold">{k}</th>
                  <td className="py-1">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {e.sim && <p className="rounded-lg bg-accent/15 p-3 text-sm">🌋 <b>In der Simulation:</b> {e.sim}</p>}
        {bilder.length > 0 && (
          <div>
            <div className="mb-1 text-sm font-bold">📷 Fotos (antippen vergrößert, mit Bildnachweis)</div>
            <BildStreifen key={e.id} bilder={bilder} nachweisFuer={nachweisFuer} />
          </div>
        )}
      </article>
    </div>
  );
}
