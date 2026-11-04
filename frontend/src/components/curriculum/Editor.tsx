"use client";
/**
 * Curriculum-Abgleich, transponiert: je Klasse eine Tabelle mit den
 * Unterrichtseinheiten als Spalten und diesen Zeilen:
 *
 *   Unterrichtseinheit (Titel, Wochen)
 *   alter Lehrplan     — zugeordnete alte Karten, aufklappbar
 * Klassen und Karten lassen sich auf- und zuklappen (Karten starten zu);
 * »Endfassung« blendet Durchgestrichenes und Markierungen aus.
 *   G / R / H / LB / GE — unser Inhalt je Niveau + zugeordnete neue Karten
 *   neuer Lehrplan     — Vorschläge: Partner der alten Karten aus dem Abgleich
 *
 * Neue Karten zieht man in eine Spalte: GY landet in G, RS in R und H (fehlt
 * der H-Text, wird R kopiert). Auf eine Niveau-Zeile gezogen landet sie nur
 * dort. Unter jedem Block stehen die neuen Karten, die noch keine Einheit hat.
 * Einheiten zieht man am Kopf in eine andere Spalte oder Klasse.
 *
 * Gespeichert wird über Operationen (api/curriculum_ops.py); alle paar
 * Sekunden fragt die Seite, ob jemand anderes etwas geändert hat.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type CurriculumPlanOut } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import {
  BLOECKE, KLASSEN_JE_BLOCK, NIVEAUS, NIVEAU_FARBE, NIVEAU_NAME, OHNE_BEREICH, bereicheVon, einheitenAusLehrplan, freieAlteKarten, index, loesen, nachBereich, neueId, niveauGilt,
  offeneKarten, themaSicht, wochenSumme, zuordnen,
  type Block, type KarteMitPlan, type Klasse, type Niveau, type Thema,
} from "@/lib/curriculum/modell";
import { KarteBox, KartenAnsicht, StatusChip } from "./KarteBox";
import { ExportDialog, ImportDialog, KarteDialog, KiDialog, TeilenDialog, ThemaDialog } from "./Dialoge";

type Op = Record<string, unknown>;
type Offen =
  | { art: "thema"; thema: Thema; klasse: number }
  | { art: "karte"; karte: KarteMitPlan }
  | { art: "ki" } | { art: "import" } | { art: "teilen" } | { art: "export" }
  | null;

const POLL_MS = 4000;


export function CurriculumEditor({ start, guestToken }: { start: CurriculumPlanOut; guestToken?: string }) {
  const { toast } = useToast();
  const [plan, setPlan] = useState(start);
  const [offen, setOffen] = useState<Offen>(null);
  const [niveaus, setNiveaus] = useState<Set<Niveau>>(new Set(NIVEAUS));
  const [schularten, setSchularten] = useState<Set<string>>(new Set(["RS", "GY"]));
  const [nurKonflikte, setNurKonflikte] = useState(false);
  // leer = alle Bereiche
  const [bereichFilter, setBereichFilter] = useState<Set<string>>(new Set());
  // Karten: alle zu (Standard) oder alle auf, dazu einzeln umgeschaltete Ausnahmen.
  const [kartenAuf, setKartenAuf] = useState(false);
  const [ausnahmen, setAusnahmen] = useState<Set<string>>(new Set());
  const [endfassung, setEndfassung] = useState(false);
  const [zuKlassen, setZuKlassen] = useState<Set<number>>(new Set());
  // Auswahl per Strg-Klick; Strg+C merkt sie, Strg+V setzt sie in die angeklickte Zelle.
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [kopiert, setKopiert] = useState<string[]>([]);
  const [zielZelle, setZielZelle] = useState<{ themaId: string; klasse: number; niveau: Niveau } | null>(null);
  const ansicht = useMemo(() => ({
    offen: (id: string) => kartenAuf !== ausnahmen.has(id),
    umschalten: (id: string) => setAusnahmen(a => { const x = new Set(a); x.has(id) ? x.delete(id) : x.add(id); return x; }),
    endfassung,
    gewaehlt: (id: string) => auswahl.has(id),
    waehlen: (id: string) => setAuswahl(a => { const x = new Set(a); x.has(id) ? x.delete(id) : x.add(id); return x; }),
    ziehen: (id: string) => (auswahl.has(id) ? [...auswahl] : [id]),
  }), [kartenAuf, ausnahmen, endfassung, auswahl]);
  const alleKarten = (auf: boolean) => { setKartenAuf(auf); setAusnahmen(new Set()); };
  const [suche, setSuche] = useState("");
  const [ziehZiel, setZiehZiel] = useState<string | null>(null);
  const laeuft = useRef(false);

  const doc = plan.data;
  const idx = useMemo(() => index(doc), [doc]);
  const nurLesen = !plan.darf_bearbeiten;

  const ops = useCallback(async (liste: Op[]) => {
    if (!liste.length) return;
    laeuft.current = true;
    try { setPlan(await api.curriculum.ops(plan.id, liste, guestToken)); }
    catch (e: any) { toast(e.message ?? "Speichern fehlgeschlagen", "error"); }
    finally { laeuft.current = false; }
  }, [plan.id, guestToken, toast]);

  // Änderungen anderer abholen (nicht während eines eigenen Schreibens / offenen Dialogs).
  const version = plan.version;
  useEffect(() => {
    const t = setInterval(async () => {
      if (laeuft.current || offen || document.hidden) return;
      try {
        const r = await api.curriculum.poll(plan.id, version, guestToken);
        if ("data" in r) setPlan(r);
      } catch { /* nächster Versuch */ }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [plan.id, version, guestToken, offen]);

  const bereichListe = useMemo(() => bereicheVon(doc), [doc]);
  const mitAlt = doc.lehrplaene.some(l => l.rolle === "alt");
  const sichtbar = (k: KarteMitPlan) => schularten.has(k.plan.schulart)
    && (bereichFilter.size === 0 || bereichFilter.has(k.bereich || OHNE_BEREICH));
  const passt = (t: Thema) => !suche.trim() || `${t.titel} ${Object.values(t.inhalte).join(" ")}`.toLowerCase().includes(suche.toLowerCase());

  /** Mehrere Karten zuordnen → Operationen (Karten mit kopiertem H-Text zuerst). */
  const zuordnenOps = (thema: Thema, klasse: number, ids: string[], nur?: Niveau): Op[] => {
    const out: Op[] = [];
    let t = thema;
    for (const id of ids) {
      const r = zuordnen(idx, t, id, klasse, nur);
      t = r.thema;
      if (r.karte) out.push({ op: "karte", ...r.karte });
    }
    return [...out, { op: "thema", klasse, thema: t }];
  };

  // ── Strg+C / Strg+V / Esc ─────────────────────────────────────────────────
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (offen || el?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "Escape") { setAuswahl(new Set()); setZielZelle(null); return; }
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "c" && auswahl.size) {
        e.preventDefault();
        setKopiert([...auswahl]);
        toast(`${auswahl.size} Karten kopiert — Zelle anklicken, dann Strg+V`, "info");
      } else if (k === "v" && kopiert.length && !nurLesen) {
        e.preventDefault();
        const z = zielZelle && findeThema(zielZelle.themaId);
        if (!z || !zielZelle) { toast("Erst eine Zelle (Unterrichtseinheit × Niveau) anklicken, dann Strg+V", "info"); return; }
        ops(zuordnenOps(z.thema, z.klasse, kopiert, zielZelle.niveau));
        setAuswahl(new Set());
        toast(`${kopiert.length} Karten in »${z.thema.titel}« (${zielZelle.niveau}) eingefügt`, "success");
      }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  });

  // ── Ziehen & Ablegen ──────────────────────────────────────────────────────
  const findeThema = (id: string) => {
    for (const k of doc.curriculum.klassen) {
      const i = k.themen.findIndex(t => t.id === id);
      if (i >= 0) return { klasse: k.klasse, pos: i, thema: k.themen[i] };
    }
    return null;
  };
  const ablegen = (daten: string, klasse: number, thema?: Thema, nur?: Niveau) => {
    setZiehZiel(null);
    if (nurLesen) return;
    const art = daten.slice(0, daten.indexOf(":"));
    const id = daten.slice(daten.indexOf(":") + 1);
    if (art === "thema") {
      const q = findeThema(id);
      if (!q || q.thema.id === thema?.id) return;
      const kl = doc.curriculum.klassen.find(k => k.klasse === klasse);
      let pos = thema ? kl?.themen.findIndex(t => t.id === thema.id) ?? 0 : kl?.themen.length ?? 0;
      if (q.klasse === klasse && q.pos < pos) pos -= 1;  // eigenes Herausnehmen verschiebt die Stelle
      ops([{ op: "thema", klasse, pos, thema: q.thema }]);
    } else if (art === "karte" && thema) {
      // mehrere ids, wenn eine ausgewählte Karte gezogen wurde
      ops(zuordnenOps(thema, klasse, id.split(","), nur));
      setAuswahl(new Set());
    }
  };
  const ziel = (key: string, klasse: number, thema?: Thema, nur?: Niveau) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setZiehZiel(key); },
    onDragLeave: () => setZiehZiel(z => (z === key ? null : z)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); ablegen(e.dataTransfer.getData("text/plain"), klasse, thema, nur); },
  });
  const hell = (key: string) => (ziehZiel === key ? "ring-2 ring-accent ring-inset" : "");

  const einheitenAnlegen = () => {
    const neu = einheitenAusLehrplan(doc);
    if (!neu.length) { toast("Nichts zu tun — zu jedem Lernbereich gibt es schon eine Unterrichtseinheit.", "info"); return; }
    if (!confirm(`${neu.length} Unterrichtseinheiten anlegen? Je Lernbereich des neuen Lehrplans eine leere Einheit; `
      + `die Karten bleiben unter »Offen« zum Hineinziehen. Einheiten aus Doppeljahrgängen (5/6, 7/8) kommen in beide Klassen — `
      + `nicht benötigte danach löschen.`)) return;
    ops(neu.map(a => ({ op: "thema", klasse: a.klasse, thema: a.thema })));
  };

  const alleVorschlaege = () => {
    if (!confirm("Alle Vorschläge aus dem Abgleich (gleicher Block) den Unterrichtseinheiten zuordnen?")) return;
    const liste: Op[] = [];
    for (const k of doc.curriculum.klassen) for (const t of k.themen) {
      const ids = themaSicht(idx, t, k.klasse).vorschlaege.filter(v => !v.woanders).map(v => v.karte.id);
      if (ids.length) liste.push(...zuordnenOps(t, k.klasse, ids));
    }
    ops(liste);
  };

  const herunterladen = () => {
    const blob = new Blob([JSON.stringify(doc, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${plan.name.replace(/[^\wäöüÄÖÜß-]+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const inkraft = (klasse: number) => [...new Set(doc.lehrplaene.filter(l => l.rolle === "neu" && l.inkraft?.[klasse])
    .map(l => l.inkraft![klasse]))].join(" / ");

  const klasseVon = (nr: number): Klasse =>
    doc.curriculum.klassen.find(k => k.klasse === nr) ?? { klasse: nr, wochen_verfuegbar: 36, themen: [] };

  return (
    <KartenAnsicht.Provider value={ansicht}>
    <div className="flex flex-col gap-3">
      {/* Werkzeugleiste */}
      <div className="flex flex-wrap items-center gap-2 sticky top-0 z-30 bg-page py-2 border-b border-line">
        <div className="flex gap-1" title="Welche Niveau-Zeilen angezeigt werden">
          {NIVEAUS.map(n => (
            <button key={n} className="chip text-xs" title={NIVEAU_NAME[n]}
              style={niveaus.has(n) ? { background: NIVEAU_FARBE[n], color: "#fff", borderColor: NIVEAU_FARBE[n] } : undefined}
              onClick={() => setNiveaus(s => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; })}>{n}</button>
          ))}
        </div>
        <div className="flex items-center gap-1" title="Welche Lehrplan-Karten gezeigt werden — überall: alt, Niveau-Zeilen, Vorschläge, Offen">
          <span className="text-xs text-muted">Karten:</span>
          {([["RS", "GY"], ["RS"], ["GY"]] as string[][]).map(a => (
            <button key={a.join()} className={`chip text-xs ${[...schularten].sort().join() === [...a].sort().join() ? "chip-on" : ""}`}
              onClick={() => setSchularten(new Set(a))}>
              {a.length > 1 ? "RS + GY" : a[0] === "RS" ? "nur Regelschule" : "nur Gymnasium"}</button>
          ))}
        </div>
        <div className="flex gap-1">
          <button className="chip text-xs" onClick={() => alleKarten(true)} title="Alle Karten aufklappen">▾ alle auf</button>
          <button className="chip text-xs" onClick={() => alleKarten(false)} title="Alle Karten zuklappen">▸ alle zu</button>
        </div>
        <button className={`chip text-xs ${endfassung ? "chip-on" : ""}`} onClick={() => setEndfassung(v => !v)}
          title="Durchgestrichenes und Markierungen ausblenden — nur der neue Wortlaut">✓ Endfassung</button>
        {bereichListe.length > 1 && (
          <details className="relative">
            <summary className={`chip text-xs list-none cursor-pointer ${bereichFilter.size ? "chip-on" : ""}`}>
              Bereiche: {bereichFilter.size ? [...bereichFilter].join(", ") : "alle"} ▾
            </summary>
            <div className="absolute z-40 mt-1 card p-2 flex flex-col gap-1 text-sm min-w-[14rem] shadow-lg">
              {bereichListe.map(b => (
                <label key={b} className="flex items-center gap-2 whitespace-nowrap">
                  <input type="checkbox" checked={bereichFilter.has(b)}
                    onChange={() => setBereichFilter(f => { const x = new Set(f); x.has(b) ? x.delete(b) : x.add(b); return x; })} />
                  {b}
                </label>
              ))}
              {bereichFilter.size > 0 && (
                <button className="btn-secondary text-xs py-0.5 mt-1" onClick={() => setBereichFilter(new Set())}>alle zeigen</button>
              )}
            </div>
          </details>
        )}
        <button className={`chip text-xs ${nurKonflikte ? "chip-on" : ""}`} onClick={() => setNurKonflikte(v => !v)}>⚠ nur Konflikte</button>
        <input className="input w-44 text-sm py-1" placeholder="Einheit suchen…" value={suche} onChange={e => setSuche(e.target.value)} />
        <span className="flex-1" />
        <span className="text-xs text-muted">{nurLesen ? "nur lesen · " : ""}v{plan.version}{plan.zuletzt_von ? ` · zuletzt ${plan.zuletzt_von}` : ""}</span>
        {!nurLesen && <button className="btn-secondary text-sm" onClick={einheitenAnlegen} title="Je Lernbereich des neuen Lehrplans eine leere Unterrichtseinheit anlegen — die Karten bleiben im Deck">📚 Einheiten aus Lehrplan</button>}
        {!nurLesen && doc.abgleich.length > 0 && <button className="btn-secondary text-sm" onClick={alleVorschlaege} title="Partner der alten Karten in die Niveau-Zeilen übernehmen">⇣ Vorschläge übernehmen</button>}
        <button className="btn-secondary text-sm" onClick={() => setOffen({ art: "ki" })} title="KI ordnet den Unterrichtseinheiten Lehrplan-Karten zu">🤖 KI-Zuordnung</button>
        {!nurLesen && <button className="btn-secondary text-sm" onClick={() => setOffen({ art: "import" })}>⬆ Hochladen</button>}
        <button className="btn-secondary text-sm" onClick={() => setOffen({ art: "export" })}>⬇ Export</button>
        {!guestToken && <button className="btn-secondary text-sm" onClick={() => setOffen({ art: "teilen" })}>👥 Teilen</button>}
      </div>

      {(auswahl.size > 0 || kopiert.length > 0 || zielZelle) && (
        <div className="sticky top-12 z-20 flex flex-wrap items-center gap-2 text-xs rounded-lg border border-accent/50 bg-accent/10 px-3 py-1.5">
          {auswahl.size > 0 && <span><b>{auswahl.size}</b> ausgewählt · Strg+C kopieren</span>}
          {kopiert.length > 0 && <span><b>{kopiert.length}</b> kopiert · Zelle anklicken, Strg+V einfügen</span>}
          {zielZelle && <span>Ziel: <b>{findeThema(zielZelle.themaId)?.thema.titel}</b> · {zielZelle.niveau} (Kl. {zielZelle.klasse})</span>}
          <span className="flex-1" />
          <button className="btn-secondary text-xs py-0.5" onClick={() => { setAuswahl(new Set()); setKopiert([]); setZielZelle(null); }}>
            Auswahl aufheben (Esc)</button>
        </div>
      )}

      <p className="text-xs text-muted">
        Alt: {doc.lehrplaene.filter(l => l.rolle === "alt").map(l => l.titel ?? l.id).join(" · ")} — Neu: {doc.lehrplaene.filter(l => l.rolle === "neu").map(l => l.titel ?? l.id).join(" · ")}
        {doc.curriculum.stand && ` — Curriculum Stand ${doc.curriculum.stand}`}
      </p>

      {(doc.bloecke?.length ? BLOECKE.filter(b => doc.bloecke.includes(b)) : BLOECKE).map(blockAbschnitt)}

      {offen?.art === "thema" && <ThemaDialog thema={offen.thema} klasse={offen.klasse} idx={idx} onOps={ops} onClose={() => setOffen(null)} nurLesen={nurLesen} />}
      {offen?.art === "karte" && <KarteDialog karte={offen.karte} idx={idx} doc={doc} onOps={ops} onClose={() => setOffen(null)} nurLesen={nurLesen}
        zuordnenOps={zuordnenOps} />}
      {offen?.art === "export" && <ExportDialog planId={plan.id} planName={plan.name} doc={doc} guestToken={guestToken}
        onJson={herunterladen} onClose={() => setOffen(null)} />}
      {offen?.art === "ki" && <KiDialog doc={doc} art="zuordnung" onClose={() => setOffen(null)} />}
      {offen?.art === "import" && <ImportDialog doc={doc} idx={idx} onOps={ops} onClose={() => setOffen(null)} />}
      {offen?.art === "teilen" && (
        <TeilenDialog plan={plan} onClose={() => setOffen(null)}
          onPatch={async b => { try { setPlan(await api.curriculum.patch(plan.id, b)); } catch (e: any) { toast(e.message, "error"); } }}
          onNewCode={async () => { try { setPlan(await api.curriculum.newGuestCode(plan.id)); } catch (e: any) { toast(e.message, "error"); } }} />
      )}
    </div>
    </KartenAnsicht.Provider>
  );

  // Render-Funktionen statt innerer Komponenten: sonst baut React die Zellen bei
  // jedem Render neu auf, und ein laufendes Ziehen bricht ab.
  function blockAbschnitt(block: Block) {
    const offeneNeu = offeneKarten(doc, idx, block).filter(o => sichtbar(o.karte));
    const freieAlt = freieAlteKarten(doc, block).filter(sichtbar);
    return (
      <section key={block} className="rounded-xl border border-line">
        <h2 className="px-3 py-2 font-bold bg-surface rounded-t-xl">Klassen {block}</h2>
        {KLASSEN_JE_BLOCK[block].map(nr => klassenTabelle(klasseVon(nr)))}
        {(offeneNeu.length > 0 || freieAlt.length > 0) && !nurKonflikte && (
          <div className="px-3 py-2 border-t-2 border-dashed border-line bg-surface/40 rounded-b-xl">
            <div className="text-xs text-muted mb-2">
              <b className="text-fg">Offen in {block}: {offeneNeu.length} Karten des neuen Lehrplans</b> hat noch keine
              Unterrichtseinheit — neue Inhalte und solche, die aus einem anderen Block hierher wandern. In eine Spalte
              oder Niveau-Zeile ziehen, oder anklicken und als neue Einheit anlegen.
            </div>
            {nachBereich(offeneNeu, o => o.karte, bereichListe).map(g => (
              <details key={g.bereich} open className="mb-2 group">
                <summary className="text-xs font-semibold mb-1 cursor-pointer select-none">
                  {g.bereich} <span className="text-muted font-normal">({g.eintraege.length})</span>
                  {!nurLesen && (
                    <button className="ml-2 text-[11px] font-normal text-muted hover:text-fg" title="Alle Karten dieses Bereichs auswählen"
                      onClick={e => { e.preventDefault(); setAuswahl(a => new Set([...a, ...g.eintraege.map(o => o.karte.id)])); }}>
                      alle wählen</button>
                  )}
                </summary>
                <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
                  {g.eintraege.map(o => (
                    <KarteBox key={o.karte.id} karte={o.karte} idx={idx} niveaus={niveaus} paar={o.paar} ohneBereich
                      onOpen={() => setOffen({ art: "karte", karte: o.karte })} />
                  ))}
                </div>
              </details>
            ))}
            {freieAlt.length > 0 && (
              <details className="text-xs mt-2">
                <summary className="cursor-pointer text-muted">{freieAlt.length} Karten des alten Lehrplans ohne Unterrichtseinheit</summary>
                {nachBereich(freieAlt, k => k, bereichListe).map(g => (
                  <div key={g.bereich} className="mt-1">
                    <div className="font-semibold mb-1">{g.bereich} <span className="text-muted font-normal">({g.eintraege.length})</span></div>
                    <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
                      {g.eintraege.map(k => <KarteBox key={k.id} karte={k} idx={idx} niveaus={niveaus} ohneBereich onOpen={() => setOffen({ art: "karte", karte: k })} />)}
                    </div>
                  </div>
                ))}
              </details>
            )}
          </div>
        )}
      </section>
    );
  }

  function klassenTabelle(kl: Klasse) {
    const nr = kl.klasse;
    const summe = wochenSumme(kl);
    const ab = inkraft(nr);
    const einheiten = kl.themen.filter(passt)
      .map(t => ({ t, s: themaSicht(idx, t, nr) }))
      .filter(({ s }) => !nurKonflikte || s.konflikte.length > 0);
    const zeilen = NIVEAUS.filter(n => niveaus.has(n));
    const spalten = `7.5rem repeat(${einheiten.length}, minmax(15rem, 19rem))`;
    const kopfZelle = "sticky left-0 z-10 bg-page border-r border-line px-2 py-1.5 text-xs font-semibold";
    const zu = zuKlassen.has(nr);
    const umklappen = () => setZuKlassen(z => { const x = new Set(z); x.has(nr) ? x.delete(nr) : x.add(nr); return x; });

    return (
      <div key={nr} className="border-t border-line">
        <div {...ziel(`k${nr}`, nr)} className={`flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm ${hell(`k${nr}`)}`}>
          <button className="font-semibold flex items-center gap-1" onClick={umklappen} aria-expanded={!zu}
            title={zu ? "Klasse aufklappen" : "Klasse zuklappen"}>
            <span className="text-muted w-4">{zu ? "▸" : "▾"}</span>Klasse {nr}
          </button>
          {zu && <span className="text-xs text-muted">· {kl.themen.length} Unterrichtseinheiten</span>}
          {ab && <span className="text-xs text-muted">· neuer Plan ab {ab}</span>}
          {nr > 9 && <span className="text-xs text-muted">· ohne Hauptschulniveau</span>}
          <span className="flex-1" />
          <span className={`text-xs ${summe > kl.wochen_verfuegbar ? "text-bad font-semibold" : "text-muted"}`}>{summe.toLocaleString("de")} /</span>
          <input type="number" min={0} className="input w-16 py-0.5 text-xs" value={kl.wochen_verfuegbar} disabled={nurLesen}
            onChange={e => ops([{ op: "klasse", klasse: nr, wochen_verfuegbar: Number(e.target.value) }])} />
          <span className="text-xs text-muted">Wochen</span>
          {!nurLesen && (
            <button className="btn-secondary text-xs py-0.5" onClick={() =>
              setOffen({ art: "thema", klasse: nr, thema: { id: neueId(doc, nr), titel: "", wochen: null, inhalte: {}, karten: [] } })}>+ Unterrichtseinheit</button>
          )}
        </div>
        {zu ? null : einheiten.length === 0 ? (
          <div className="px-3 pb-2 text-xs text-muted">Keine Unterrichtseinheiten — hierher ziehen oder anlegen.</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid min-w-full w-max text-sm" style={{ gridTemplateColumns: spalten }}>
              {/* Kopf: Unterrichtseinheiten */}
              <div className={`${kopfZelle} text-muted`}>Unterrichts&shy;einheit</div>
              {einheiten.map(({ t, s }) => (
                <div key={t.id} {...ziel(`h${t.id}`, nr, t)}
                  draggable={!nurLesen}
                  onDragStart={e => { e.dataTransfer.setData("text/plain", `thema:${t.id}`); e.dataTransfer.effectAllowed = "move"; }}
                  onClick={() => setOffen({ art: "thema", thema: t, klasse: nr })}
                  title="Klicken zum Bearbeiten · ziehen zum Verschieben · Karten hierher ziehen ordnet sie nach Niveau zu"
                  className={`border-r border-b-2 border-line p-2 cursor-pointer hover:bg-surface-hover ${s.konflikte.length ? "bg-red-500/10" : "bg-surface"} ${hell(`h${t.id}`)}`}>
                  <div className="flex items-start gap-1">
                    {!nurLesen && <span className="text-muted cursor-grab" aria-hidden>⠿</span>}
                    <span className="font-semibold flex-1 leading-tight">{t.titel || "(ohne Titel)"}</span>
                    <span className="text-xs text-muted whitespace-nowrap">{t.wochen != null ? `${t.wochen.toLocaleString("de")} Wo.` : "? Wo."}</span>
                  </div>
                  {t.notiz && <div className="text-xs text-muted italic">{t.notiz}</div>}
                  {s.konflikte.length > 0 && (
                    <details className="text-xs text-bad mt-1" onClick={e => e.stopPropagation()}>
                      <summary className="cursor-pointer">⚠ {s.konflikte.length} Konflikt{s.konflikte.length > 1 ? "e" : ""}</summary>
                      {s.konflikte.map((k, i) => <div key={i}>• {k}</div>)}
                    </details>
                  )}
                </div>
              ))}

              {/* Alter Lehrplan, aufklappbar — nur, wenn es einen gibt */}
              {mitAlt && <div className={`${kopfZelle} text-muted`}>alter Lehrplan</div>}
              {mitAlt && einheiten.map(({ t, s }) => {
                const alt = s.alt.filter(sichtbar);
                return (
                  <div key={t.id} {...ziel(`a${t.id}`, nr, t)} className={`border-r border-b border-line p-1.5 ${hell(`a${t.id}`)}`}>
                    <details open={kartenAuf} key={String(kartenAuf)}>
                      <summary className="cursor-pointer text-xs text-muted flex flex-wrap items-center gap-1">
                        {alt.length} Karten
                        {[...new Set(alt.map(k => idx.paareAlt.get(k.id)?.[0]?.status ?? "entfallen"))].map(st => <StatusChip key={st} status={st} />)}
                      </summary>
                      <div className="flex flex-col gap-1 mt-1">
                        {alt.map(k => (
                          <KarteBox key={k.id} karte={k} idx={idx} niveaus={niveaus} onOpen={() => setOffen({ art: "karte", karte: k })}
                            onLoesen={nurLesen ? undefined : () => ops([{ op: "thema", klasse: nr, thema: loesen(t, k.id) }])} />
                        ))}
                      </div>
                    </details>
                  </div>
                );
              })}

              {/* Niveau-Zeilen */}
              {zeilen.map(n => (
                <Fragment key={n}>
                  <div className={`${kopfZelle} text-white`} style={{ background: NIVEAU_FARBE[n] }} title={NIVEAU_NAME[n]}>
                    {n} <span className="font-normal opacity-80 hidden xl:inline">· {NIVEAU_NAME[n].replace("niveau", "")}</span>
                  </div>
                  {einheiten.map(({ t, s }) => {
                    const gilt = niveauGilt(n, nr);
                    const key = `${n}${t.id}`;
                    return (
                      <div key={t.id} {...(gilt ? ziel(key, nr, t, n) : {})}
                        onClick={e => {
                          // Zelle als Ziel für Strg+V merken — Klicks auf Karten zählen nicht
                          if (!gilt || nurLesen || (e.target as HTMLElement).closest("[draggable='true'], button")) return;
                          setZielZelle(z => (z?.themaId === t.id && z.niveau === n ? null : { themaId: t.id, klasse: nr, niveau: n }));
                        }}
                        title={gilt && !nurLesen ? "Anklicken = Ziel für Strg+V" : undefined}
                        className={`border-r border-b border-line p-1.5 flex flex-col gap-1 min-h-[2.5rem] ${hell(key)} ${
                          zielZelle?.themaId === t.id && zielZelle.niveau === n ? "ring-2 ring-sky-500 ring-inset" : ""}`}
                        style={{ background: `${NIVEAU_FARBE[n]}12` }}>
                        {!gilt ? <span className="text-xs text-muted">— (Hauptschulniveau endet mit Kl. 9)</span> : (
                          <>
                            {t.inhalte[n]?.trim() && (
                              <div className="text-xs whitespace-pre-line leading-snug cursor-pointer" onClick={() => setOffen({ art: "thema", thema: t, klasse: nr })}>
                                {t.inhalte[n]}
                              </div>
                            )}
                            {(s.niveau[n] ?? []).filter(sichtbar).map(k => (
                              <KarteBox key={k.id} karte={k} idx={idx} niveaus={niveaus} nurNiveau={n}
                                onOpen={() => setOffen({ art: "karte", karte: k })}
                                onLoesen={nurLesen ? undefined : () => ops([{ op: "thema", klasse: nr, thema: loesen(t, k.id, n) }])} />
                            ))}
                          </>
                        )}
                      </div>
                    );
                  })}
                </Fragment>
              ))}

              {/* Neuer Lehrplan: Vorschläge — kommen aus dem Abgleich, ohne alten Plan gibt es keine */}
              {mitAlt && <div className={`${kopfZelle} text-muted`}>neuer Lehrplan<br /><span className="font-normal">Vorschläge</span></div>}
              {mitAlt && einheiten.map(({ t, s }) => {
                const vs = s.vorschlaege.filter(v => sichtbar(v.karte));
                const passend = vs.filter(v => !v.woanders).map(v => v.karte.id);
                return (
                  <div key={t.id} {...ziel(`n${t.id}`, nr, t)} className={`border-r border-line p-1.5 flex flex-col gap-1 ${hell(`n${t.id}`)}`}>
                    {!nurLesen && passend.length > 1 && (
                      <button className="btn-secondary text-xs py-0.5 self-start" onClick={() => ops(zuordnenOps(t, nr, passend))}>
                        ⇡ alle {passend.length} zuordnen</button>
                    )}
                    {vs.map(v => (
                      <KarteBox key={v.karte.id} karte={v.karte} idx={idx} niveaus={niveaus} paar={v.paar} woanders={v.woanders}
                        onOpen={() => setOffen({ art: "karte", karte: v.karte })} />
                    ))}
                    {vs.length === 0 && <span className="text-xs text-muted">—</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
}
