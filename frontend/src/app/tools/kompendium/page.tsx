"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAvailability } from "@/hooks/useAvailability";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import HelpButton from "@/components/HelpButton";

/**
 * Methoden-Kompendium: Methoden aus Didaktik, Pädagogik und Psychologie mit
 * Ablauf, Evidenz und Quellen. Die Inhalte liegen als JSON + SVG in
 * public/kompendium und werden aus data/methoden_kompendium gebaut
 * (python data/methoden_kompendium/build.py && python …/svgs.py).
 */

type Evidenz = "stark" | "mittel" | "begrenzt" | "praxis" | "umstritten";
type Methode = {
  id: string; name: string; aliase?: string[]; kategorie: string; unterkategorie?: string; phasen: string[];
  setting: string[]; zielgruppen: string[]; anwendung: string[]; dauer?: string; kurz: string;
  ablauf?: string[]; varianten?: string[]; stolpersteine?: string[];
  evidenz: { stufe: Evidenz; text: string }; qualifikation: string; quellen: string[];
};
type Abschnitt = { id: string; titel: string; zusammenfassung: string; kernpunkte?: string[]; quellen: string[]; svg?: string };
type Kapitel = { nummer: number; kategorie: string; titel: string; abschnitte: Abschnitt[] };
type Quelle = { id: string; autor: string; jahr: number; titel: string; erschienen_in: string; doi?: string; url?: string };
type Mythos = { id: string; behauptung: string; befund: string; quellen: string[] };
type Kompendium = {
  meta: { total_methoden: number; total_kapitel: number; total_quellen: number; total_mythen: number; generated: string };
  legende: Record<string, Record<string, string>> & { unterkategorien: Record<string, Record<string, string>> };
  kapitel: Kapitel[]; methoden: Methode[]; mythen: Mythos[]; quellen: Quelle[];
  svg_assets: { filename: string; title: string; abschnitt: string }[];
};

const BASIS = "/kompendium/";
const REITER = [
  ["methoden", "Methoden"], ["grundlagen", "Grundlagen"], ["grafiken", "Grafiken"],
  ["mythen", "Mythen-Check"], ["quellen", "Quellen"],
] as const;
type Reiter = typeof REITER[number][0];

// Kategorie- und Evidenzfarben als feste Signalfarben (wie in den SVG-Grafiken)
const KAT_FARBE: Record<string, string> = { didaktik: "#3D7DCA", paedagogik: "#2E9466", psychologie: "#C2652E" };
const EVI_FARBE: Record<Evidenz, string> = {
  stark: "#2E9466", mittel: "#3D7DCA", begrenzt: "#B8860B", praxis: "#6B7B8C", umstritten: "#B03A2E",
};
const KAT_NAME: Record<string, string> = { uebergreifend: "Übergreifend", didaktik: "Didaktik", paedagogik: "Pädagogik", psychologie: "Psychologie" };

const FILTER = ["kategorien", "phasen", "setting", "zielgruppen", "anwendung", "evidenz", "qualifikation"] as const;
type Filter = typeof FILTER[number];
const FILTER_NAME: Record<Filter, string> = {
  kategorien: "Kategorie", phasen: "Phase", setting: "Setting", zielgruppen: "Zielgruppe",
  anwendung: "Anwendungsgebiet", evidenz: "Evidenz", qualifikation: "Qualifikation",
};
const WERTE: Record<Filter, (m: Methode) => string[]> = {
  kategorien: m => [m.kategorie], phasen: m => m.phasen, setting: m => m.setting,
  zielgruppen: m => m.zielgruppen, anwendung: m => m.anwendung,
  evidenz: m => [m.evidenz.stufe], qualifikation: m => [m.qualifikation],
};

// Persönliche Markierungen je Methode; liegen in der Datenbank, je Konto
type Marke = "favorit" | "einarbeiten" | "unnoetig";
const MARKEN: { wert: Marke; symbol: string; name: string }[] = [
  { wert: "favorit", symbol: "★", name: "Favorit" },
  { wert: "einarbeiten", symbol: "📌", name: "Einarbeiten" },
  { wert: "unnoetig", symbol: "🚫", name: "Brauch ich nicht" },
];

export default function KompendiumPage() {
  const router = useRouter();
  const { can, ready } = useAvailability();
  const { auth } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: markenDaten } = useQuery({
    queryKey: ["kompendium-marken"],
    queryFn: api.kompendium.marken,
    enabled: !!auth,
  });
  const marken = markenDaten ? { werte: markenDaten as Record<string, Marke> } : null;
  const [markenFilter, setMarkenFilter] = useState("");
  const [unterkategorie, setUnterkategorie] = useState("");
  // Gewählter Eintrag je Lesereiter (Seitenleiste links, Inhalt rechts)
  const [auswahl, setAuswahl] = useState<Record<string, string>>({});
  function waehle(reiterId: string, id: string) {
    setAuswahl(a => ({ ...a, [reiterId]: id }));
  }
  const [daten, setDaten] = useState<Kompendium | null>(null);
  const [fehler, setFehler] = useState(false);
  const [reiter, setReiter] = useState<Reiter>("methoden");
  const [suche, setSuche] = useState("");
  const [filter, setFilter] = useState<Record<Filter, string>>(
    Object.fromEntries(FILTER.map(f => [f, ""])) as Record<Filter, string>,
  );

  useEffect(() => {
    if (ready && !can("kompendium", "use")) router.replace("/tools");
  }, [ready, can, router]);

  useEffect(() => {
    fetch(BASIS + "methoden_kompendium.json")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setDaten)
      .catch(() => setFehler(true));
  }, []);

  async function markieren(id: string, marke: Marke) {
    if (!marken) return;
    const neu = marken.werte[id] === marke ? null : marke;
    const vorher = marken.werte;
    const werte = { ...vorher };
    if (neu) werte[id] = neu; else delete werte[id];
    qc.setQueryData(["kompendium-marken"], werte);
    try {
      qc.setQueryData(["kompendium-marken"], await api.kompendium.markieren(id, neu));
    } catch {
      qc.setQueryData(["kompendium-marken"], vorher);
      toast("Markierung konnte nicht gespeichert werden.", "error");
    }
  }
  const markeVon = (id: string) => marken?.werte[id];

  const quellen = useMemo(
    () => Object.fromEntries((daten?.quellen ?? []).map(q => [q.id, q])),
    [daten],
  );

  const treffer = useMemo(() => {
    if (!daten) return [];
    const q = suche.trim().toLowerCase();
    return daten.methoden.filter(m =>
      FILTER.every(f => !filter[f] || WERTE[f](m).includes(filter[f]))
      && (!unterkategorie || m.unterkategorie === unterkategorie)
      && (markenFilter === "ohne" ? !marken?.werte[m.id]
        : markenFilter ? marken?.werte[m.id] === markenFilter
        : marken?.werte[m.id] !== "unnoetig")
      && (!q || [m.name, m.kurz, ...(m.aliase ?? [])].join(" ").toLowerCase().includes(q)));
  }, [daten, suche, filter, markenFilter, marken, unterkategorie]);

  if (fehler) return <div className="page"><p className="text-bad">Das Kompendium konnte nicht geladen werden.</p></div>;
  if (!daten) return <div className="page"><p className="text-muted">Lade Kompendium …</p></div>;

  const L = (gruppe: string, wert: string) => daten.legende[gruppe]?.[wert] ?? wert;
  const Ref = ({ ids }: { ids: string[] }) => (
    <p className="text-xs text-muted">
      {ids.map((id, i) => {
        const q = quellen[id];
        if (!q) return null;
        const text = `${q.autor} (${q.jahr})`;
        return (
          <span key={id}>
            {i > 0 && " · "}
            {q.url
              ? <a href={q.url} target="_blank" rel="noopener noreferrer" title={q.titel} className="underline hover:text-accent">{text}</a>
              : <span title={q.titel}>{text}</span>}
          </span>
        );
      })}
    </p>
  );

  return (
    <div className="page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">📚 Methoden-Kompendium</h1>
          <p className="text-muted text-sm mt-1 max-w-3xl">
            Methoden aus Didaktik, Pädagogik und Psychologie für Einstieg, Hauptteil und Abschluss –
            für Einzel- und Gruppensettings mit Kindern, Jugendlichen und Erwachsenen, jeweils mit Ablauf,
            Stolpersteinen, Evidenzeinschätzung und Quellen.
          </p>
          <p className="text-xs text-muted mt-2 tabular-nums">
            {daten.meta.total_methoden} Methoden · {daten.meta.total_kapitel} Grundlagenkapitel ·{" "}
            {daten.meta.total_mythen} Mythen · {daten.meta.total_quellen} Quellen · Stand {daten.meta.generated}
          </p>
        </div>
        <HelpButton slug="kompendium" />
      </div>

      <p className="text-xs text-muted max-w-4xl">
        Die Methodenbeschreibungen sind eigene Zusammenfassungen mit Quellenangabe. Genannte Programm- und Markennamen
        (z. B. Triple P, KiVa, Mental Health First Aid, Six Thinking Hats, Pomodoro, Social Stories) gehören ihren Inhabern;
        lizenzierte Programme und Fragebögen nur über die jeweiligen Anbieter einsetzen.
      </p>

      <div className="flex flex-wrap gap-2" role="tablist">
        {REITER.map(([id, name]) => (
          <button key={id} role="tab" aria-selected={reiter === id}
            className={`chip ${reiter === id ? "chip-on" : ""}`} onClick={() => setReiter(id)}>
            {name}
          </button>
        ))}
      </div>

      {reiter === "methoden" && (
        <>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
            <label className="col-span-full sm:col-span-2">
              <span className="label">Suche</span>
              <input className="input" type="search" value={suche} onChange={e => setSuche(e.target.value)}
                placeholder="z. B. Gruppenpuzzle, Feedback, Stress" />
            </label>
            <label>
              <span className="label">Meine Markierung</span>
              <select className="input" value={markenFilter} onChange={e => setMarkenFilter(e.target.value)}>
                <option value="">alle außer »Brauch ich nicht«</option>
                {MARKEN.map(k => <option key={k.wert} value={k.wert}>{k.symbol} {k.name}</option>)}
                <option value="ohne">ohne Markierung</option>
              </select>
            </label>
            {FILTER.map(f => (<Fragment key={f}>
              <label>
                <span className="label">{FILTER_NAME[f]}</span>
                <select className="input" value={filter[f]} onChange={e => {
                  setFilter({ ...filter, [f]: e.target.value });
                  if (f === "kategorien") setUnterkategorie("");
                }}>
                  <option value="">alle</option>
                  {Object.entries(daten.legende[f]).map(([wert, name]) => <option key={wert} value={wert}>{name}</option>)}
                </select>
              </label>
              {f === "kategorien" && (
                <label>
                  <span className="label">Unterkategorie</span>
                  <select className="input" value={unterkategorie} onChange={e => setUnterkategorie(e.target.value)}>
                    <option value="">alle</option>
                    {Object.entries(daten.legende.unterkategorien ?? {})
                      .filter(([kat]) => !filter.kategorien || kat === filter.kategorien)
                      .map(([kat, unter]) => (
                        <optgroup key={kat} label={KAT_NAME[kat]}>
                          {Object.entries(unter).map(([wert, name]) => <option key={wert} value={wert}>{name}</option>)}
                        </optgroup>
                      ))}
                  </select>
                </label>
              )}
            </Fragment>))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {Object.entries(daten.legende.evidenz).map(([stufe, text]) => (
              <span key={stufe} className="flex items-center gap-1.5">
                <EvidenzMarke stufe={stufe as Evidenz} /> {text}
              </span>
            ))}
          </div>
          <p className="text-sm text-muted tabular-nums">{treffer.length} von {daten.methoden.length} Methoden</p>
          <nav aria-label="Inhalt" className="flex flex-wrap gap-2">
            {Object.keys(KAT_FARBE).map(k => {
              const erste = treffer.find(m => m.kategorie === k);
              return erste ? <a key={k} href={`#${erste.id}`} className="chip">{KAT_NAME[k]} ({treffer.filter(m => m.kategorie === k).length})</a> : null;
            })}
          </nav>
          {treffer.length === 0 && <p className="text-muted">Keine Methode passt zu dieser Filterkombination. Setzen Sie einen Filter auf »alle« zurück.</p>}
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(320px,1fr))] grid-flow-row-dense">
            {treffer.map(m => (
              <details key={m.id} id={m.id} className={`group card overflow-hidden open:col-span-full ${markeVon(m.id) === "unnoetig" ? "opacity-50" : ""}`} style={{ borderTop: `4px solid ${KAT_FARBE[m.kategorie]}` }}>
                <summary className="cursor-pointer list-none p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-1.5 items-center overflow-hidden whitespace-nowrap min-w-0">
                      <span className="text-xs font-semibold" style={{ color: KAT_FARBE[m.kategorie] }}
                        title={m.unterkategorie ? daten.legende.unterkategorien?.[m.kategorie]?.[m.unterkategorie] : undefined}>{KAT_NAME[m.kategorie]}</span>
                      {m.phasen.map(p => <span key={p} className="chip !py-0">{L("phasen", p).split(" /")[0]}</span>)}
                      <EvidenzMarke stufe={m.evidenz.stufe} />
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      {MARKEN.map(k => {
                        const an = markeVon(m.id) === k.wert;
                        return (
                          <button key={k.wert} type="button" aria-pressed={an} title={k.name} aria-label={`${k.name}: ${m.name}`}
                            onClick={e => { e.preventDefault(); e.stopPropagation(); markieren(m.id, k.wert); }}
                            className={`rounded-md px-1.5 text-sm leading-6 transition ${an ? "bg-accent/20 opacity-100" : "opacity-35 grayscale hover:opacity-80 hover:grayscale-0"}`}>
                            {k.symbol}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <h3 className="font-bold text-lg leading-tight line-clamp-2 min-h-[2.5em] group-open:min-h-0 group-open:line-clamp-none">{m.name}</h3>
                  <p className="text-xs text-muted line-clamp-1 min-h-[1rem] group-open:line-clamp-none">{m.aliase?.join(" · ")}</p>
                  <p className="text-sm line-clamp-4 min-h-[5em] group-open:line-clamp-none group-open:min-h-0">{m.kurz}</p>
                </summary>
                <div className="px-4 pb-4 flex flex-col gap-3 text-sm">
                  <p className="text-xs text-muted">
                    {m.dauer} · {m.setting.map(s => L("setting", s)).join(", ")} ·{" "}
                    {m.zielgruppen.map(z => L("zielgruppen", z).split(" (")[0]).join(", ")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.anwendung.map(a => <span key={a} className="chip !py-0">{L("anwendung", a)}</span>)}
                  </div>
                  <p className={`text-xs ${m.qualifikation === "fachkraft" ? "text-bad font-semibold" : "text-muted"}`}>
                    Qualifikation: {L("qualifikation", m.qualifikation)}
                  </p>
                  <Liste titel="Ablauf" punkte={m.ablauf} nummeriert />
                  <Liste titel="Varianten" punkte={m.varianten} />
                  <Liste titel="Stolpersteine" punkte={m.stolpersteine} />
                  <div className="border-l-2 border-line pl-3">
                    <p className="label uppercase tracking-wide">Evidenz · {m.evidenz.stufe}</p>
                    <p>{m.evidenz.text}</p>
                  </div>
                  <Ref ids={m.quellen} />
                </div>
              </details>
            ))}
          </div>
        </>
      )}

      {reiter === "grundlagen" && (() => {
        const k = daten.kapitel.find(x => `kap-${x.nummer}` === auswahl.grundlagen) ?? daten.kapitel[0];
        return (
          <Leseansicht aktiv={`kap-${k.nummer}`} waehlen={id => waehle("grundlagen", id)} eintraege={daten.kapitel.map(x => ({
            id: `kap-${x.nummer}`, text: `${x.nummer} ${x.titel}`,
            unter: x.abschnitte.map(a => ({ id: `abs-${a.id}`, text: `${a.id} ${a.titel}` })),
          }))}>
            <section className="card p-5 flex flex-col gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">{KAT_NAME[k.kategorie]} · Kapitel {k.nummer}</p>
                <h2 className="text-xl font-bold mt-1">{k.titel}</h2>
              </div>
              {k.abschnitte.map(a => (
                <div key={a.id} id={`abs-${a.id}`} className="flex flex-col gap-2 scroll-mt-4">
                  <h3 className="font-semibold">{a.id} {a.titel}</h3>
                  <p className="text-sm max-w-4xl">{a.zusammenfassung}</p>
                  {a.kernpunkte?.length ? <ul className="list-disc pl-5 text-sm max-w-4xl">{a.kernpunkte.map(p => <li key={p}>{p}</li>)}</ul> : null}
                  <Ref ids={a.quellen} />
                  {a.svg && <Grafik datei={a.svg} titel={daten.svg_assets.find(s => s.filename === a.svg)?.title ?? ""} />}
                </div>
              ))}
            </section>
          </Leseansicht>
        );
      })()}

      {reiter === "grafiken" && (() => {
        const g = daten.svg_assets.find(x => x.filename === auswahl.grafiken) ?? daten.svg_assets[0];
        return (
          <Leseansicht aktiv={g.filename} waehlen={id => waehle("grafiken", id)}
            eintraege={daten.svg_assets.map(x => ({ id: x.filename, text: x.title }))}>
            <figure className="card p-5 flex flex-col gap-3 m-0">
              <figcaption className="font-semibold">{g.title} <span className="text-xs text-muted">· Abschnitt {g.abschnitt}</span></figcaption>
              <Grafik datei={g.filename} titel={g.title} />
            </figure>
          </Leseansicht>
        );
      })()}

      {reiter === "mythen" && daten.mythen.map(x => (
        <div key={x.id} className="card p-4 flex flex-col gap-2 max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-bad">Behauptung</p>
          <p className="font-semibold">{x.behauptung}</p>
          <p className="text-sm"><span className="font-semibold">Befund:</span> {x.befund}</p>
          <Ref ids={x.quellen} />
        </div>
      ))}

      {reiter === "quellen" && (() => {
        const buchstaben = [...new Set(daten.quellen.map(q => q.autor[0].toUpperCase()))];
        const b = buchstaben.includes(auswahl.quellen) ? auswahl.quellen : buchstaben[0];
        return (
          <Leseansicht aktiv={b} waehlen={id => waehle("quellen", id)}
            eintraege={buchstaben.map(x => ({ id: x, text: `${x} (${daten.quellen.filter(q => q.autor[0].toUpperCase() === x).length})` }))}>
            <ol className="card p-5 flex flex-col gap-2 text-sm">
              {daten.quellen.filter(q => q.autor[0].toUpperCase() === b).map(q => (
                <li key={q.id} className="pl-6 -indent-6">
                  {q.autor} ({q.jahr}). <i>{q.titel}</i>. {q.erschienen_in}.{" "}
                  {q.url && <a href={q.url} target="_blank" rel="noopener noreferrer" className="text-accent underline break-all">{q.doi ? `doi:${q.doi}` : q.url}</a>}
                </li>
              ))}
            </ol>
          </Leseansicht>
        );
      })()}
    </div>
  );
}

function EvidenzMarke({ stufe }: { stufe: Evidenz }) {
  return (
    <span className="rounded-full px-2 text-xs font-semibold text-white" style={{ background: EVI_FARBE[stufe] }}>
      {stufe}
    </span>
  );
}

function Liste({ titel, punkte, nummeriert }: { titel: string; punkte?: string[]; nummeriert?: boolean }) {
  if (!punkte?.length) return null;
  const Tag = nummeriert ? "ol" : "ul";
  return (
    <div>
      <p className="label uppercase tracking-wide">{titel}</p>
      <Tag className={`${nummeriert ? "list-decimal" : "list-disc"} pl-5 flex flex-col gap-0.5`}>
        {punkte.map(p => <li key={p}>{p}</li>)}
      </Tag>
    </div>
  );
}

function Grafik({ datei, titel }: { datei: string; titel: string }) {
  return (
    <div className="overflow-x-auto">
      <img src={BASIS + datei} alt={titel} loading="lazy" className="block w-full min-w-[600px] max-w-[960px] rounded-xl" />
    </div>
  );
}

type InhaltEintrag = { id: string; text: string; unter?: { id: string; text: string }[] };

/** Inhaltsverzeichnis als Seitenleiste, der gewählte Eintrag steht allein im Hauptbereich. */
function Leseansicht({ eintraege, aktiv, waehlen, children }: {
  eintraege: InhaltEintrag[]; aktiv: string; waehlen: (id: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(220px,300px)_1fr] items-start">
      <nav aria-label="Inhalt" className="card p-3 md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] overflow-y-auto">
        <p className="label uppercase tracking-wide px-2">Inhalt</p>
        <ol className="flex flex-col gap-0.5 text-sm">
          {eintraege.map(e => (
            <li key={e.id}>
              <button type="button" onClick={() => { waehlen(e.id); window.scrollTo({ top: 0 }); }}
                aria-current={e.id === aktiv ? "true" : undefined}
                className={`w-full text-left rounded-lg px-2 py-1 transition ${e.id === aktiv ? "bg-accent/15 text-accent font-semibold" : "hover:bg-surface-hover"}`}>
                {e.text}
              </button>
              {e.id === aktiv && e.unter?.length ? (
                <ol className="pl-4 my-1 flex flex-col gap-0.5 text-xs text-muted">
                  {e.unter.map(u => (
                    <li key={u.id}>
                      <button type="button" className="text-left hover:text-accent"
                        onClick={() => document.getElementById(u.id)?.scrollIntoView({ behavior: "smooth" })}>
                        {u.text}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
