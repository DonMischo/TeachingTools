"use client";
/**
 * Kartentool — Deutschland politisch, topographisch oder stumm.
 *
 * Ansehen: Ebenen einzeln an/aus, Namen an/aus.
 * Auswählen: Objekte per Klick oder Suche wählen, je Ebene »alle zeigen« oder
 * »nur Auswahl«, Nummern (1, a, A, I) für stumme Karten und Tests, darunter das
 * Arbeitsblatt zum Ausfüllen. Gespeichert wird das als Kartensatz (nur ids;
 * die Ebenen selbst bleiben unverändert).
 */
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { auswahlFuer, baueStil, GRUPPEN, KARTENARTEN, region, REGIONEN, wendeSatzAn, type Ebene, type Kartenart } from "@/lib/karten/stil";
import { ankerpunkt, vergibNummern } from "@/lib/karten/nummern";
import { schalteObjekt, type Ausschnitt, type KartenSatz, type SatzInhalt } from "@/lib/karten/satz";
import KartenAnsicht, { type KartenBild, type Treffer } from "./KartenAnsicht";
import SatzLeiste from "./SatzLeiste";
import AuswahlPanel from "./AuswahlPanel";
import Arbeitsblatt from "./Arbeitsblatt";
import EigeneEbenen from "./EigeneEbenen";

const START_ART: Kartenart = "topographisch";
const neuerInhalt = (art: Kartenart): SatzInhalt => ({ art, region: "deutschland", ...auswahlFuer(art, "de"), ausschnitt: null, auswahl: {} });
/** Um Deutschland herum sind diese Weltebenen der Rahmen */
const UMLAND = ["welt-staaten", "welt-hoehen", "welt-staedte"];

export default function Karten({ action }: { action?: ReactNode }) {
  const { auth } = useAuth();
  const lehrkraft = auth?.user_type === "teacher";
  const { data: katalog, error } = useQuery({ queryKey: ["karten", "katalog"], queryFn: api.karten.katalog, staleTime: Infinity });
  const [inhalt, setInhalt] = useState<SatzInhalt>(() => neuerInhalt(START_ART));
  const [satz, setSatz] = useState<Pick<KartenSatz, "id" | "titel" | "geteilt" | "eigen"> | null>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [aktiveEbene, setAktiveEbene] = useState("de-staedte");
  const [ziel, setZiel] = useState<Ausschnitt | null>(null);
  const ausschnitt = useRef<Ausschnitt | null>(null);
  // Export: Karte kurz ohne Namen und ohne Auswahl-Markierung zeichnen, dann das Bild abgreifen
  const [druck, setDruck] = useState(false);
  const bildRef = useRef<KartenBild | null>(null);
  const holeBild = async () => {
    setDruck(true);
    try {
      await new Promise((weiter) => setTimeout(weiter, 80)); // React setzt den Druck-Stil
      return await bildRef.current!();
    } finally {
      setDruck(false);
    }
  };

  // Objektlisten der Ebenen mit Auswahl (für Namen, Suche und Markenpunkte)
  const benoetigt = useMemo(() => [...new Set([...Object.keys(inhalt.auswahl), ...(bearbeiten ? [aktiveEbene] : [])])],
    [inhalt.auswahl, bearbeiten, aktiveEbene]);
  const abfragen = useQueries({
    queries: benoetigt.map((id) => ({ queryKey: ["karten", "ebene", id], queryFn: () => api.karten.ebene(id), staleTime: Infinity })),
  });
  const daten: Record<string, FeatureCollection | undefined> = Object.fromEntries(benoetigt.map((id, i) => [id, abfragen[i].data]));
  // Fester Schlüssel für useMemo: ändert sich, sobald eine Ebene (neu) geladen ist
  const datenStand = benoetigt.map((id, i) => `${id}@${abfragen[i].dataUpdatedAt}`).join(",");

  const reihenfolge = katalog?.ebenen.map((e) => e.id) ?? [];
  const nummern = useMemo(() => vergibNummern(inhalt.auswahl, reihenfolge), [inhalt.auswahl, katalog]); // eslint-disable-line react-hooks/exhaustive-deps

  const stil = useMemo(() => {
    if (!katalog) return null;
    const grund = baueStil(katalog, { ...inhalt, beschriftung: inhalt.beschriftung && !druck }, inhalt.art);
    const anker: FeatureCollection = { type: "FeatureCollection", features: [] };
    for (const [ebene, marken] of Object.entries(nummern)) {
      if (!inhalt.ebenen.includes(ebene)) continue;
      for (const f of daten[ebene]?.features ?? []) {
        const marke = marken[String(f.properties?.id)];
        const p = marke ? ankerpunkt(f.geometry) : null;
        if (p) anker.features.push({ type: "Feature", geometry: { type: "Point", coordinates: p }, properties: { marke } });
      }
    }
    return wendeSatzAn(grund, katalog, { auswahl: inhalt.auswahl, nummern, anker, bearbeiten: bearbeiten && !druck });
  }, [katalog, inhalt, nummern, bearbeiten, druck, datenStand]); // eslint-disable-line react-hooks/exhaustive-deps

  const bereich = region(inhalt.region).bereich;
  const waehleArt = (art: Kartenart) => setInhalt((v) => ({ ...v, art, ...auswahlFuer(art, region(v.region).bereich) }));
  const waehleRegion = (id: string) => {
    const r = region(id);
    setInhalt((v) => ({ ...v, region: r.id, ...(region(v.region).bereich !== r.bereich ? auswahlFuer(v.art, r.bereich) : {}) }));
    const [west, sued, ost, nord] = r.ausschnitt;
    setZiel({ west, sued, ost, nord });
  };
  const schalteEbene = (id: string) => setInhalt((v) => ({
    ...v, ebenen: v.ebenen.includes(id) ? v.ebenen.filter((e) => e !== id) : [...v.ebenen, id],
  }));
  const klick = (treffer: Treffer[]) => {
    const t = bearbeiten && treffer.find((x) => x.ebene === aktiveEbene);
    if (t) setInhalt((v) => schalteObjekt(v, t.ebene, t.id));
  };
  const lade = (s: KartenSatz | null) => {
    setSatz(s && { id: s.id, titel: s.titel, geteilt: s.geteilt, eigen: s.eigen });
    setInhalt(s ? { ...s.inhalt, region: s.inhalt.region ?? "deutschland" } : neuerInhalt(START_ART));
    setZiel(s?.inhalt.ausschnitt ?? null);
  };

  const quizEbenen = katalog?.ebenen.filter((e) => e.quiz && inhalt.ebenen.includes(e.id)) ?? [];

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🗺️ Karten</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Deutschland politisch und topographisch — Objekte auswählen, nummerieren und als Kartensatz speichern.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      {lehrkraft && <SatzLeiste satz={satz} inhalt={inhalt} ausschnitt={() => ausschnitt.current} onLaden={lade}
        onGespeichert={(s) => setSatz({ id: s.id, titel: s.titel, geteilt: s.geteilt, eigen: s.eigen })} />}

      <div className="flex flex-wrap items-center gap-3">
        <select value={inhalt.region} onChange={(e) => waehleRegion(e.target.value)} aria-label="Region"
          className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-bold">
          {REGIONEN.map((r) => <option key={r.id} value={r.id}>🌍 {r.name}</option>)}
        </select>
        <div className="inline-flex flex-wrap rounded-xl border border-[var(--border)] p-1 bg-[var(--surface)]">
          {KARTENARTEN.map((k) => (
            <button key={k.id} onClick={() => waehleArt(k.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                inhalt.art === k.id ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
              {k.icon} {k.name}
            </button>
          ))}
        </div>
        {lehrkraft && <div className="inline-flex rounded-xl border border-[var(--border)] p-1 bg-[var(--surface)]">
          {([[false, "👁️ Ansehen"], [true, "🎯 Auswählen"]] as const).map(([wert, text]) => (
            <button key={text} onClick={() => setBearbeiten(wert)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                bearbeiten === wert ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
              {text}
            </button>
          ))}
        </div>}
      </div>

      {error && <p className="text-[var(--red)] text-sm">Karten konnten nicht geladen werden.</p>}
      {katalog && stil && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
          <div className="flex flex-col gap-4 min-w-0">
            <KartenAnsicht stil={stil} katalog={katalog} namenZeigen={inhalt.beschriftung || bearbeiten} onKlick={klick}
              ziel={ziel} onAusschnitt={(a) => { ausschnitt.current = a; }} bildRef={bildRef} />
            <Arbeitsblatt katalog={katalog} inhalt={inhalt} nummern={nummern} daten={daten} titel={satz?.titel ?? "Karte"}
              holeBild={lehrkraft ? holeBild : undefined} />
          </div>
          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-4 text-sm">
            {bearbeiten ? (
              <AuswahlPanel ebenen={quizEbenen} aktiv={aktiveEbene} setAktiv={setAktiveEbene}
                inhalt={inhalt} setInhalt={setInhalt} daten={daten} nummern={nummern} />
            ) : (
              <>
                <label className="flex items-center gap-2 font-bold">
                  <input type="checkbox" checked={inhalt.beschriftung}
                    onChange={() => setInhalt((v) => ({ ...v, beschriftung: !v.beschriftung }))} />
                  Namen zeigen
                </label>
                {GRUPPEN.map((gruppe) => {
                  const ebenen = katalog.ebenen
                    .filter((e) => e.gruppe === gruppe.id && (e.bereich === bereich || (bereich === "de" && UMLAND.includes(e.id))))
                    .map((e) => (bereich === "de" && e.id === "welt-staedte" ? { ...e, name: "Hauptstädte der Nachbarländer" } : e));
                  return ebenen.length > 0 && (
                    <EbenenGruppe key={gruppe.id} titel={gruppe.name} ebenen={ebenen} an={inhalt.ebenen} schalte={schalteEbene} />
                  );
                })}
                <EigeneEbenen ebenen={katalog.ebenen.filter((e) => e.bereich === "eigen")} an={inhalt.ebenen}
                  schalte={schalteEbene} lehrkraft={lehrkraft} />
                {katalog.ebenen.filter((e) => e.darstellung && inhalt.ebenen.includes(e.id)).map((e) => <Themenlegende key={e.id} ebene={e} />)}
                {inhalt.ebenen.includes("de-hoehen") && <Hoehenlegende ebene={katalog.ebenen.find((e) => e.id === "de-hoehen")} />}
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function EbenenGruppe({ titel, ebenen, an, schalte }: { titel: string; ebenen: Ebene[]; an: string[]; schalte: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{titel}</h3>
      {ebenen.map((e) => (
        <label key={e.id} className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={an.includes(e.id)} onChange={() => schalte(e.id)} />
          <span>{e.name}</span>
        </label>
      ))}
    </div>
  );
}

function Themenlegende({ ebene }: { ebene: Ebene }) {
  const d = ebene.darstellung!;
  const stufen = d.art === "stufen";
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{ebene.name}{d.einheit ? ` (${d.einheit})` : ""}</h3>
      {d.werte.map((w, i) => (
        <div key={String(w.wert)} className="flex items-center gap-2 text-xs">
          <span className={`w-6 h-3.5 border border-black/20 ${ebene.geometrie === "punkt" ? "rounded-full w-3.5" : "rounded-sm"}`}
            style={{ background: w.farbe }} />
          {stufen && !w.text ? `${i === 0 ? "unter" : "ab"} ${Number(i === 0 ? d.werte[1]?.wert : w.wert).toLocaleString("de-DE")}` : w.text}
        </div>
      ))}
      {d.groesse && <p className="text-[10px] text-[var(--text-muted)]">Kreisgröße nach {d.groesse.feld === "leistung" ? "Leistung (MW)" : d.groesse.feld}</p>}
    </div>
  );
}

function Hoehenlegende({ ebene }: { ebene?: Ebene }) {
  if (!ebene?.stufen) return null;
  // Von oben (hoch) nach unten; die Stufe unter 0 m ist nur Übergang
  const stufen = ebene.stufen.filter((s) => s.ab >= 0).reverse();
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Höhe über NN</h3>
      {stufen.map((s) => (
        <div key={s.ab} className="flex items-center gap-2 text-xs">
          <span className="w-6 h-3.5 rounded-sm border border-black/20" style={{ background: s.farbe }} />
          ab {s.ab.toLocaleString("de-DE")} m
        </div>
      ))}
    </div>
  );
}
