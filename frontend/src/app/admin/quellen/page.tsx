"use client";
/**
 * Quellen und Lizenzen, nach Werkzeug gruppiert. Zusammengesetzt aus dem Register
 * (lib/quellen/register.ts) und den Nachweisen, die die Werkzeuge selbst mitbringen:
 * Kartenkatalog, Bildnachweise (bilder.json), Tux, Leviathan-Studien, npm-Pakete.
 * Ungeklärte Rechte sind mit ⚠ markiert.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { NENNUNG_PFLICHT, REGISTER, type QuellenEintrag, type WerkzeugQuellen } from "@/lib/quellen/register";
import PAKETE from "@/lib/quellen/pakete.json";
import TUX from "../../../../public/verkehr/tux.lizenz.json";
import { QUELLEN as LEVIATHAN } from "@/lib/leviathan/quellen";

type Bild = { titel?: string; seite?: string; lizenz?: string; lizenzUrl?: string; urheber?: string };

/** Bildnachweise (Wikimedia Commons u. a.) zu Einträgen, gleiche Lizenz zusammengezählt. */
function bilderAlsEintraege(bilder: Record<string, Bild>, verwendung: string): { eintraege: QuellenEintrag[]; einzeln: Bild[] } {
  const je = new Map<string, number>();
  for (const b of Object.values(bilder)) je.set(b.lizenz ?? "nicht angegeben", (je.get(b.lizenz ?? "nicht angegeben") ?? 0) + 1);
  return {
    eintraege: [...je].map(([lizenz, n]) => ({
      quelle: `${n} Bild${n === 1 ? "" : "er"} (Wikimedia Commons u. a.)`, lizenz, verwendung,
      pruefen: lizenz === "nicht angegeben",
    })),
    einzeln: Object.values(bilder),
  };
}

export default function QuellenSeite() {
  const { auth } = useAuth();
  const router = useRouter();
  useEffect(() => { if (auth !== null && auth.role !== "admin") router.replace("/"); }, [auth, router]);
  const { data: katalog } = useQuery({ queryKey: ["karten", "katalog"], queryFn: api.karten.katalog, enabled: auth?.role === "admin" });
  const [bilder, setBilder] = useState<{ sonne: Record<string, Bild>; kueste: Record<string, Bild>; pse: Record<string, Bild> } | null>(null);
  useEffect(() => {
    // Groß (Sonnensystem ~2 MB) — erst hier laden
    Promise.all([import("@/lib/sonnensystem/bilder.json"), import("@/lib/kueste/bilder.json"), import("@/lib/pse/bilder.json")])
      .then(([s, k, p]) => setBilder({ sonne: s.default as Record<string, Bild>, kueste: k.default as Record<string, Bild>, pse: p.default as Record<string, Bild> }));
  }, []);

  const werkzeuge = useMemo<(WerkzeugQuellen & { einzeln?: Bild[] })[]>(() => {
    const liste: (WerkzeugQuellen & { einzeln?: Bild[] })[] = REGISTER.map((w) => ({ ...w, eintraege: [...w.eintraege] }));
    const finde = (slug: string, name: string) => {
      let w = liste.find((x) => x.slug === slug);
      if (!w) { w = { slug, name, eintraege: [] }; liste.push(w); }
      return w;
    };
    if (katalog) {
      const quellen = new Map<string, QuellenEintrag>();
      for (const e of katalog.ebenen) {
        if (e.bereich === "eigen") continue;
        const alt = quellen.get(e.quelle.name);
        quellen.set(e.quelle.name, { quelle: e.quelle.name, lizenz: e.quelle.lizenz, url: e.quelle.url,
          verwendung: alt ? `${alt.verwendung}, ${e.name}` : `Ebenen: ${e.name}` });
      }
      finde("karten", "🗺️ Karten").eintraege.unshift(...quellen.values());
    }
    finde("verkehr", "🚦 GTA – Verkehr").eintraege.push({ quelle: `Tux (${TUX.datei})`, urheber: TUX.urheber, lizenz: TUX.lizenz, url: TUX.quelle, verwendung: TUX.verwendung });
    if (bilder) {
      const s = bilderAlsEintraege(bilder.sonne, "Fotos, Texturen, Galerie");
      Object.assign(finde("sonnensystem", "🪐 Sonnensystem"), { einzeln: s.einzeln }).eintraege.push(...s.eintraege);
      const k = bilderAlsEintraege(bilder.kueste, "Galerie »Echte Küsten«");
      Object.assign(finde("kueste", "🌊 Küstendynamik"), { einzeln: k.einzeln }).eintraege.push(...k.eintraege);
      const p = bilderAlsEintraege(bilder.pse, "Fotos der Stoffproben im Steckbrief");
      Object.assign(finde("pse", "🧪 Periodensystem"), { einzeln: p.einzeln }).eintraege.push(...p.eintraege);
    }
    finde("leviathan", "🐋 Leviathan").literatur = Object.values(LEVIATHAN).map((q) => `${q.kurz} — ${q.url}`);
    return liste;
  }, [katalog, bilder]);

  if (auth?.role !== "admin") return null;
  return (
    <div className="page">
      <div>
        <h1 className="text-2xl font-black">📚 Quellen und Lizenzen</h1>
        <p className="text-sm text-muted mt-1">
          Fremde Daten, Bilder, Schriften und Programme, nach Werkzeug. Lizenzen mit Namensnennung (CC BY, dl-de/by, ODbL, ODC-BY)
          verlangen die Quellenangabe dort, wo das Werk zu sehen ist — die Werkzeuge zeigen sie an. ⚠ = Rechte noch nicht geklärt.
        </p>
      </div>

      {werkzeuge.map((w) => (
        <section key={w.slug} className="card p-4 flex flex-col gap-2">
          <h2 className="font-black text-lg">{w.name}</h2>
          {w.eintraege.length > 0 && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted"><th>Quelle</th><th>Lizenz</th><th>Verwendung</th></tr></thead>
              <tbody>
                {w.eintraege.map((e, i) => (
                  <tr key={i} className="border-t border-line align-top">
                    <td className="py-1.5 pr-3">
                      {e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="underline">{e.quelle}</a> : e.quelle}
                      {e.urheber && <div className="text-xs text-muted">{e.urheber}</div>}
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {e.pruefen && <span title="Rechte prüfen">⚠ </span>}{e.lizenz}
                      {NENNUNG_PFLICHT.test(e.lizenz) && <div className="text-[10px] text-muted">Namensnennung</div>}
                    </td>
                    <td className="py-1.5 text-xs">{e.verwendung}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {w.einzeln && (
            <details className="text-xs">
              <summary className="cursor-pointer">Alle {w.einzeln.length} Bildnachweise</summary>
              <ul className="mt-1 flex flex-col gap-0.5">
                {w.einzeln.map((b, i) => (
                  <li key={i}>{b.seite ? <a href={b.seite} target="_blank" rel="noreferrer" className="underline">{b.titel}</a> : b.titel}
                    {" — "}{b.urheber ?? "unbekannt"}, {b.lizenzUrl ? <a href={b.lizenzUrl} target="_blank" rel="noreferrer" className="underline">{b.lizenz}</a> : b.lizenz}</li>
                ))}
              </ul>
            </details>
          )}
          {w.literatur && (
            <details className="text-xs">
              <summary className="cursor-pointer">Zitierte Literatur ({w.literatur.length})</summary>
              <ul className="mt-1 list-disc pl-5 flex flex-col gap-0.5">{w.literatur.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </details>
          )}
        </section>
      ))}

      <section className="card p-4 flex flex-col gap-2">
        <h2 className="font-black text-lg">🧰 Programmbibliotheken (npm)</h2>
        <p className="text-xs text-muted">Aus node_modules gelesen (npm run quellen:pakete). »build« = nur zum Erzeugen der Kartendaten.</p>
        <table className="w-full text-sm">
          <tbody>
            {PAKETE.map((p) => (
              <tr key={p.name} className="border-t border-line">
                <td className="py-1 pr-3">{p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="underline">{p.name}</a> : p.name}</td>
                <td className="py-1 pr-3 text-xs">{p.version}</td>
                <td className="py-1 pr-3">{p.lizenz}</td>
                <td className="py-1 text-xs text-muted">{p.art === "build" ? "build" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
