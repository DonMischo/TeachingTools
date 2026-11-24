"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAvailability } from "@/hooks/useAvailability";
import { useToast } from "@/contexts/ToastContext";
import HelpButton from "@/components/HelpButton";
import { api } from "@/lib/api";
import { alsMarkdown, eintragAlsMarkdown, filtern } from "@/lib/featureListe";

/**
 * »Was kann TT?«: die Feature-Liste aus features.yml zum Durchsuchen und Aufklappen,
 * dazu als Markdown zum Kopieren in eine externe KI (in TT selbst steckt keine KI).
 */
export default function UeberblickPage() {
  const router = useRouter();
  const { can, ready } = useAvailability();
  const { toast } = useToast();
  const { data, isError } = useQuery({ queryKey: ["ueberblick"], queryFn: api.ueberblick.liste, staleTime: 60_000 });
  const [suche, setSuche] = useState("");
  const [bereich, setBereich] = useState("");
  // Aufgeklappte Einträge; »alle« schaltet jeden sichtbaren Eintrag
  const [offen, setOffen] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (ready && !can("ueberblick", "use")) router.replace("/tools");
  }, [ready, can, router]);

  const treffer = useMemo(() => (data ? filtern(data.bereiche, suche, bereich) : []), [data, suche, bereich]);
  const anzahl = treffer.reduce((n, b) => n + b.eintraege.length, 0);
  const schluessel = (b: string, e: string) => `${b}/${e}`;

  async function kopieren(text: string, was: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${was} kopiert — in einen KI-Chat einfügen und Fragen stellen.`, "success");
    } catch {
      toast("Kopieren ging nicht — bitte »Als Markdown« herunterladen.", "error");
    }
  }

  function herunterladen() {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([alsMarkdown(data, treffer, false)], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url; a.download = "TT-Funktionen.md"; a.click();
    URL.revokeObjectURL(url);
  }

  if (isError) return <div className="page"><p className="text-bad">Die Funktionsliste konnte nicht geladen werden.</p></div>;
  if (!data) return <div className="page"><p className="text-muted">Lade Funktionsliste …</p></div>;

  const gesamt = data.bereiche.reduce((n, b) => n + b.eintraege.length, 0);
  const gefiltert = suche.trim() !== "" || bereich !== "";

  return (
    <div className="page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🧾 Was kann TT?</h1>
          <p className="text-muted text-sm mt-1 max-w-3xl">
            Alle Aktivitäten, Simulationen und Werkzeuge mit dem, was sie können. Suchen, aufklappen oder die Liste
            in einen KI-Chat kopieren und dort fragen, etwa »Was passt für Geschichte in Klasse 8?«.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-primary" onClick={() => kopieren(alsMarkdown(data, treffer), gefiltert ? `${anzahl} Einträge` : "Die ganze Liste")}
            title="Kopiert die angezeigten Einträge als Markdown mit einer kurzen Anleitung für die KI">
            🤖 {gefiltert ? "Auswahl" : "Alles"} für KI kopieren
          </button>
          <button className="btn" onClick={herunterladen}>⬇ Als Markdown</button>
          <HelpButton slug="ueberblick" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input className="input flex-1 min-w-[220px]" type="search" placeholder="Suchen, z. B. »Quiz«, »Chemie«, »QR«, »PDF«"
          aria-label="Funktionen durchsuchen" value={suche} onChange={e => setSuche(e.target.value)} autoFocus />
        <span className="text-sm text-muted tabular-nums">{anzahl} von {gesamt}</span>
        <button className="btn" onClick={() => setOffen(new Set(treffer.flatMap(b => b.eintraege.map(e => schluessel(b.id, e.id)))))}>Alle auf</button>
        <button className="btn" onClick={() => setOffen(new Set())}>Alle zu</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={`chip ${bereich === "" ? "chip-on" : ""}`} onClick={() => setBereich("")}>Alle</button>
        {data.bereiche.map(b => (
          <button key={b.id} className={`chip ${bereich === b.id ? "chip-on" : ""}`} onClick={() => setBereich(bereich === b.id ? "" : b.id)}>
            {b.name} <span className="text-muted tabular-nums">{b.eintraege.length}</span>
          </button>
        ))}
      </div>

      {treffer.length === 0 && <p className="text-muted">Nichts gefunden.</p>}
      {treffer.map(b => (
        <section key={b.id} className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">{b.name} <span className="text-sm font-normal text-muted tabular-nums">{b.eintraege.length}</span></h2>
          <div className="grid gap-2 items-start" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))" }}>
            {b.eintraege.map(e => {
              const k = schluessel(b.id, e.id);
              // Beim Suchen ist alles offen, damit man die Treffer sieht
              const auf = suche.trim() !== "" || offen.has(k);
              return (
                <details key={k} className="card p-3" open={auf}
                  onToggle={ev => {
                    const jetzt = (ev.currentTarget as HTMLDetailsElement).open;
                    if (jetzt === offen.has(k)) return;
                    setOffen(o => { const n = new Set(o); if (jetzt) n.add(k); else n.delete(k); return n; });
                  }}>
                  <summary className="cursor-pointer font-semibold flex items-baseline gap-2">
                    <span className="flex-1">{e.name}{e.typ && <span className="text-xs text-muted font-normal"> · {e.typ}</span>}</span>
                    <span className="text-xs text-muted font-normal tabular-nums">{e.kann.length}</span>
                  </summary>
                  <ul className="list-disc pl-5 mt-2 text-sm flex flex-col gap-1">
                    {e.kann.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                  <button className="btn text-xs mt-2" onClick={() => kopieren(eintragAlsMarkdown(b, e), e.name)}>🤖 Für KI kopieren</button>
                </details>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
