"use client";
/**
 * Dialoge des Curriculum-Abgleichs: Unterrichtseinheit, Karte (mit Paar), KI-Prompt,
 * Hochladen und Teilen (QR). Jeder Dialog gibt fertige Operationen an
 * `onOps` — geschrieben wird im Editor.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { JoinQR } from "@/components/JoinQR";
import { useLanUrl } from "@/hooks/useLanUrl";
import {
  BLOECKE, NIVEAUS, NIVEAU_NAME, STATUS, blockVon, einheitenAusLehrplan, nachImport, neueId, neuVerteilen, niveauGilt, nurLeereEinheiten, zielNiveaus, zuordnen,
  type Block, type Index, type KarteMitPlan,
  type Karte, type Paar, type Status, type Thema, type Vorlage,
} from "@/lib/curriculum/modell";
import { antwortLesen, vergleichPrompt, zuordnungPrompt, type KiArt, type Schulart } from "@/lib/curriculum/kiPrompt";
import { JsonEingabe } from "./JsonEingabe";
import { api, type CurriculumPlanOut } from "@/lib/api";

type Op = Record<string, unknown>;

export function Fenster({ titel, onClose, children, breit }: { titel: string; onClose: () => void; children: ReactNode; breit?: boolean }) {
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div className={`card w-full ${breit ? "max-w-3xl" : "max-w-xl"} mt-10 p-5`} onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center mb-4">
          <h2 className="text-lg font-bold flex-1">{titel}</h2>
          <button className="btn-secondary px-2 py-1" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Thema ────────────────────────────────────────────────────────────────────

export function ThemaDialog({ thema, klasse, idx, onOps, onClose, nurLesen }: {
  thema: Thema; klasse: number; idx: Index; onOps: (ops: Op[]) => void; onClose: () => void; nurLesen: boolean;
}) {
  const [t, setT] = useState<Thema>(thema);
  const [kl, setKl] = useState(klasse);
  const speichern = () => {
    onOps([{ op: "thema", klasse: kl, thema: t }]);
    onClose();
  };
  return (
    <Fenster titel={`Unterrichtseinheit · Klasse ${klasse}`} onClose={onClose} breit>
      <div className="grid grid-cols-[1fr_7rem_7rem] gap-2 mb-3">
        <label className="flex flex-col gap-1"><span className="label">Titel</span>
          <input className="input" value={t.titel} onChange={e => setT({ ...t, titel: e.target.value })} disabled={nurLesen} /></label>
        <label className="flex flex-col gap-1"><span className="label">Wochen</span>
          <input className="input" type="number" step="0.5" min="0" value={t.wochen ?? ""} disabled={nurLesen}
            onChange={e => setT({ ...t, wochen: e.target.value === "" ? null : Number(e.target.value) })} /></label>
        <label className="flex flex-col gap-1"><span className="label">Klasse</span>
          <select className="input" value={kl} onChange={e => setKl(Number(e.target.value))} disabled={nurLesen}>
            {[5, 6, 7, 8, 9, 10].map(k => <option key={k} value={k}>{k}</option>)}
          </select></label>
      </div>
      {NIVEAUS.map(n => (
        <label key={n} className="flex flex-col gap-1 mb-2">
          <span className="label">Unser Inhalt · {NIVEAU_NAME[n]}{!niveauGilt(n, kl) && " (nach Kl. 9 kein Hauptschulniveau)"}</span>
          <textarea className="input min-h-[3.5rem] text-sm" value={t.inhalte[n] ?? ""} disabled={nurLesen}
            onChange={e => setT({ ...t, inhalte: { ...t.inhalte, [n]: e.target.value } })} />
        </label>
      ))}
      <label className="flex flex-col gap-1 mb-3"><span className="label">Notiz</span>
        <input className="input" value={t.notiz ?? ""} disabled={nurLesen} onChange={e => setT({ ...t, notiz: e.target.value })} /></label>
      <div className="label mb-1">Karten des alten Lehrplans</div>
      <div className="flex flex-wrap gap-1 mb-4">
        {t.karten.length === 0 && <span className="text-xs text-muted">keine — alte Karten in die Spalte ziehen</span>}
        {t.karten.map(id => (
          <span key={id} className="chip text-xs">
            {idx.karten.get(id)?.plan.schulart} {idx.karten.get(id)?.plan.rolle} · {idx.karten.get(id)?.titel ?? id}
            {!nurLesen && <button className="ml-1 text-bad" onClick={() => setT({ ...t, karten: t.karten.filter(x => x !== id) })}>✕</button>}
          </span>
        ))}
      </div>
      {!nurLesen && (
        <div className="flex gap-2">
          <button className="btn-primary" onClick={speichern}>Speichern</button>
          <span className="flex-1" />
          <button className="btn-danger" onClick={() => { if (confirm(`Unterrichtseinheit »${t.titel}« löschen?`)) { onOps([{ op: "thema_loeschen", id: t.id }]); onClose(); } }}>🗑 Löschen</button>
        </div>
      )}
    </Fenster>
  );
}

// ── Karte (+ Paar) ───────────────────────────────────────────────────────────

export function KarteDialog({ karte, idx, doc, onOps, onClose, nurLesen, zuordnenOps }: {
  karte: KarteMitPlan; idx: Index; doc: Vorlage; onOps: (ops: Op[]) => void; onClose: () => void; nurLesen: boolean;
  zuordnenOps: (thema: Thema, klasse: number, ids: string[]) => Op[];
}) {
  const { plan, ...roh } = karte;
  const [k, setK] = useState(roh);
  const paare = (plan.rolle === "alt" ? idx.paareAlt : idx.paareNeu).get(karte.id) ?? [];
  const [ps, setPs] = useState<Paar[]>(paare);
  const themen = doc.curriculum.klassen.filter(kl => blockVon(kl.klasse) === karte.block)
    .flatMap(kl => kl.themen.map(t => ({ kl: kl.klasse, t })));
  const [ziel, setZiel] = useState("");
  const [wochen, setWochen] = useState("");

  const speichern = () => {
    const niveaus = Object.fromEntries(Object.entries(k.niveaus).filter(([, v]) => v?.trim())) as Karte["niveaus"];
    let wohin: { kl: number; t: Thema } | null = null;
    if (ziel.startsWith("t:")) wohin = themen.find(x => x.t.id === ziel.slice(2)) ?? null;
    if (ziel.startsWith("k:")) {
      const kl = Number(ziel.slice(2));
      wohin = { kl, t: { id: neueId(doc, kl), titel: k.titel ?? "Neue Unterrichtseinheit", wochen: wochen === "" ? null : Number(wochen), inhalte: {}, karten: [], notiz: "" } };
    }
    // Zuordnen kopiert R nach H, wenn H fehlt — hier in die eigene Kartenänderung, damit Eingaben im Dialog bleiben.
    if (wohin && plan.rolle === "neu" && !k.voll && niveaus.R && !niveaus.H && niveauGilt("H", wohin.kl)) niveaus.H = niveaus.R;
    const gespeichert: Karte = { ...k, niveaus };
    const ops: Op[] = [{ op: "karte", lehrplan: plan.id, karte: gespeichert }];
    ps.forEach((p, i) => { if (JSON.stringify(p) !== JSON.stringify(paare[i])) ops.push({ op: "paar", paar: p }); });
    if (plan.rolle === "neu") {
      // In allen Einheiten, in denen die Karte liegt, nach dem neuen Text auf G/R/H verteilen …
      const themenNeu = new Map<string, { kl: number; t: Thema }>();
      for (const kl of doc.curriculum.klassen) for (const t of kl.themen) {
        const t2 = neuVerteilen(t, gespeichert, kl.klasse);
        if (t2 !== t) themenNeu.set(t.id, { kl: kl.klasse, t: t2 });
      }
      // … und, falls gewählt, in die Ziel-Einheit dazu.
      if (wohin) {
        const basis = themenNeu.get(wohin.t.id)?.t ?? wohin.t;
        const z = { ...(basis.zuordnung ?? {}) };
        for (const n of zielNiveaus(gespeichert, wohin.kl)) if (!z[n]?.includes(karte.id)) z[n] = [...(z[n] ?? []), karte.id];
        themenNeu.set(wohin.t.id, { kl: wohin.kl, t: { ...basis, zuordnung: z } });
      }
      for (const { kl, t } of themenNeu.values()) ops.push({ op: "thema", klasse: kl, thema: t });
    } else if (wohin) {
      ops.push(...zuordnenOps(wohin.t, wohin.kl, [karte.id]).filter(o => o.op !== "karte"));
    }
    onOps(ops);
    onClose();
  };
  const partner = (p: Paar) => (plan.rolle === "alt" ? p.neu : p.alt).map(id => idx.karten.get(id)?.titel ?? id).join(", ");

  return (
    <Fenster titel={`${plan.titel ?? plan.id} · Kl. ${karte.block}`} onClose={onClose} breit>
      <label className="flex flex-col gap-1 mb-2"><span className="label">Kurztitel</span>
        <input className="input" value={k.titel ?? ""} disabled={nurLesen} onChange={e => setK({ ...k, titel: e.target.value })} /></label>
      <p className="text-xs text-muted mb-2">
        {karte.lernbereich}{karte.seite ? ` · S. ${karte.seite}` : ""}. Fehlt ein Niveau (oft H, LB, GE), hier ergänzen.
      </p>
      {k.voll && <p className="text-xs text-muted mb-2">Zusammengeführt aus Regelschule und Gymnasium: R und G enthalten nur, was über das Niveau darunter hinausgeht.</p>}
      {NIVEAUS.map(n => (
        <label key={n} className="flex flex-col gap-1 mb-2">
          <span className="label">{NIVEAU_NAME[n]}{k.voll && (n === "R" || n === "G") ? " — nur der Zusatz" : ""}</span>
          <textarea className="input min-h-[3rem] text-sm" value={k.niveaus[n] ?? ""} disabled={nurLesen}
            onChange={e => setK({ ...k, niveaus: { ...k.niveaus, [n]: e.target.value } })} />
        </label>
      ))}
      {k.voll && (
        <details className="mb-2 text-sm">
          <summary className="cursor-pointer text-muted">Originalwortlaut der Lehrpläne</summary>
          {(["H", "R", "G"] as const).filter(n => k.voll?.[n]).map(n => (
            <p key={n} className="text-xs mt-1"><b>{n}:</b> {k.voll![n]}</p>
          ))}
        </details>
      )}

      {ps.length > 0 && <div className="label mt-3 mb-1">Abgleich</div>}
      {ps.map((p, i) => (
        <div key={p.id} className="rounded-lg border border-line p-2 mb-2 text-sm">
          <div className="text-xs text-muted mb-1">{plan.rolle === "alt" ? "→ neu" : "← alt"}: {partner(p) || "—"}</div>
          <div className="flex gap-2 mb-1">
            <select className="input w-36" value={p.status} disabled={nurLesen}
              onChange={e => setPs(ps.map((x, j) => j === i ? { ...x, status: e.target.value as Status } : x))}>
              {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {p.status === "verschoben" && (["von", "nach"] as const).map(f => (
              <select key={f} className="input w-24" value={p[f] ?? ""} disabled={nurLesen}
                onChange={e => setPs(ps.map((x, j) => j === i ? { ...x, [f]: e.target.value as Block } : x))}>
                <option value="">{f}</option>
                {BLOECKE.map(b => <option key={b} value={b}>{f} {b}</option>)}
              </select>
            ))}
          </div>
          <input className="input text-sm" placeholder="Unterschied" value={p.unterschied ?? ""} disabled={nurLesen}
            onChange={e => setPs(ps.map((x, j) => j === i ? { ...x, unterschied: e.target.value } : x))} />
        </div>
      ))}

      {!nurLesen && (
        <>
          <div className="label mt-3 mb-1">Ins Curriculum übernehmen</div>
          <div className="flex gap-2 mb-4">
            <select className="input flex-1" value={ziel} onChange={e => setZiel(e.target.value)}>
              <option value="">— nicht zuordnen —</option>
              {themen.map(({ kl, t }) => <option key={t.id} value={`t:${t.id}`}>zu Kl. {kl}: {t.titel}</option>)}
              {(karte.block === "5/6" ? [5, 6] : karte.block === "7/8" ? [7, 8] : [9, 10]).map(kl =>
                <option key={kl} value={`k:${kl}`}>als neue Unterrichtseinheit in Kl. {kl}</option>)}
            </select>
            {ziel.startsWith("k:") && (
              <input className="input w-28" type="number" step="0.5" min="0" placeholder="Wochen" value={wochen} onChange={e => setWochen(e.target.value)} />
            )}
          </div>
          <button className="btn-primary" onClick={speichern}>Speichern</button>
        </>
      )}
    </Fenster>
  );
}

// ── KI-Prompt ────────────────────────────────────────────────────────────────

/**
 * »vergleich« (Lehrpläne erfassen) sitzt auf der Startseite neben »Neuer Plan« —
 * die Antwort wird dort als Vorlage-Datei angelegt. »zuordnung« braucht die
 * Unterrichtseinheiten eines Plans und sitzt deshalb im Plan.
 */
export function KiDialog({ doc, art, onClose }: { doc: Vorlage; art: KiArt; onClose: () => void }) {
  const alteErfasst = doc.lehrplaene.some(l => l.rolle === "alt" && l.karten.length);
  const [schularten, setSchularten] = useState<Schulart[]>(["RS"]);
  // Ohne alten Plan im Dokument (z. B. Physik nur 2026) ist »nur neue Pläne erfassen« die Voreinstellung.
  const [mitAlt, setMitAlt] = useState(doc.lehrplaene.some(l => l.rolle === "alt"));
  const [rolle, setRolle] = useState<"alt" | "neu">("neu");
  const [mit, setMit] = useState(true);
  const [nurOhne, setNurOhne] = useState(false);
  const [status, setStatus] = useState("");
  const feld = useRef<HTMLTextAreaElement>(null);
  const prompt = art === "vergleich"
    ? vergleichPrompt(doc, { schularten, mitAlt, alteKartenMit: mit })
    : zuordnungPrompt(doc, { rolle, nurOhne });
  const kopieren = async () => {
    try { await navigator.clipboard.writeText(prompt); setStatus("Kopiert ✓"); }
    catch { feld.current?.select(); setStatus("Markiert — mit Strg+C kopieren"); }
    setTimeout(() => setStatus(""), 2500);
  };
  return (
    <Fenster titel={art === "vergleich" ? `KI-Prompt: Lehrpläne ${doc.fach} erfassen` : "KI-Prompt: Curriculum zuordnen"} onClose={onClose} breit>
      <ol className="list-decimal pl-5 text-xs text-muted mb-3 leading-relaxed">
        <li>Optionen wählen, Prompt kopieren und in einen KI-Chat einfügen.</li>
        {art === "vergleich" && <li>Die Lehrplan-PDFs im Chat anhängen — welche, steht im Prompt unter »Im Anhang«.</li>}
        {art === "vergleich"
          ? <li>Die Antwort als .json-Datei speichern und unter »Neuer Plan« bei »Aus Vorlage-Datei« hochladen (oder in einem Plan über »⬆ Hochladen« ergänzen).</li>
          : <li>Die Antwort als .json-Datei speichern und über »⬆ Hochladen« wählen. Vorhandene Zuordnungen bleiben.</li>}
        <li>Prüfen! Die KI kann Karten auslassen oder falsch zuordnen.</li>
      </ol>
      {art === "vergleich" ? (
        <div className="flex flex-wrap gap-3 items-center mb-3 text-sm">
          {([["RS"], ["GY"], ["RS", "GY"]] as Schulart[][]).map(a => (
            <button key={a.join()} className={`chip ${schularten.join() === a.join() ? "chip-on" : ""}`} onClick={() => setSchularten(a)}>
              {a.length > 1 ? "beide in einem JSON" : a[0] === "RS" ? "Regelschule (R + H)" : "Gymnasium"}</button>
          ))}
          <label className="flex items-center gap-1"><input type="checkbox" checked={mitAlt} onChange={e => setMitAlt(e.target.checked)} />
            mit altem Lehrplan vergleichen</label>
          {mitAlt && alteErfasst && (
            <label className="flex items-center gap-1"><input type="checkbox" checked={mit} onChange={e => setMit(e.target.checked)} />
              schon erfasste alte Karten mitschicken (ids bleiben gleich)</label>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 items-center mb-3 text-sm">
          {(["alt", "neu"] as const).map(r => (
            <button key={r} className={`chip ${rolle === r ? "chip-on" : ""}`} onClick={() => setRolle(r)}>Karten des {r}en Plans</button>
          ))}
          <label className="flex items-center gap-1"><input type="checkbox" checked={nurOhne} onChange={e => setNurOhne(e.target.checked)} />
            nur Unterrichtseinheiten ohne Karten</label>
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <button className="btn-primary" onClick={kopieren}>📋 Prompt kopieren</button>
        <span className="text-sm text-ok">{status}</span>
        <span className="flex-1" />
        <span className="text-xs text-muted">{prompt.length.toLocaleString("de")} Zeichen</span>
      </div>
      <textarea ref={feld} readOnly className="input font-mono text-[11px] h-56" value={prompt} />
    </Fenster>
  );
}

// ── Hochladen ────────────────────────────────────────────────────────────────

/** JSON (Datei oder KI-Antwort) → Operationen; »zuordnung« wird zu Thema-Änderungen. */
export function importOps(daten: any, doc: Vorlage, idx: Index): { ops: Op[]; text: string } {
  if (!daten || typeof daten !== "object") throw new Error("Kein JSON-Objekt");
  if (Array.isArray(daten.zuordnung)) {
    // Alte Karten kommen nach oben, neue verteilen sich auf ihre Niveaus (wie beim Ziehen).
    const ops: Op[] = [];
    let einheiten = 0, n = 0;
    for (const z of daten.zuordnung) {
      const kl = doc.curriculum.klassen.find(k => k.themen.some(t => t.id === z.thema));
      let t = kl?.themen.find(t => t.id === z.thema);
      if (!kl || !t) continue;
      const vorher = JSON.stringify(t);
      for (const id of z.karten ?? []) {
        const r = zuordnen(idx, t, id, kl.klasse);
        if (r.karte) ops.push({ op: "karte", ...r.karte });
        if (JSON.stringify(r.thema) !== JSON.stringify(t)) n++;
        t = r.thema;
      }
      if (JSON.stringify(t) !== vorher) { einheiten++; ops.push({ op: "thema", klasse: kl.klasse, thema: t }); }
    }
    return { ops, text: `${einheiten} Unterrichtseinheiten bekommen zusammen ${n} weitere Karten.` };
  }
  // Ein Curriculum nur aus leeren Einheiten (KI-Antwort, Lehrplan-Vorlage) ersetzt nichts:
  // stattdessen kommen die fehlenden Einheiten zum neuen Lehrplan dazu. Ein Curriculum mit
  // Inhalt (eigene Vorlage, Export) ersetzt das bisherige wie gehabt.
  const curriculumMitInhalt = !!daten.curriculum && !nurLeereEinheiten(daten.curriculum);
  const { curriculum: _leer, ...ohneCurriculum } = daten;
  const importDaten = curriculumMitInhalt ? daten : ohneCurriculum;
  const bringtLehrplan = !!daten.lehrplaene?.length || !!daten.curriculum;
  const einheiten = curriculumMitInhalt || !bringtLehrplan ? [] : einheitenAusLehrplan(nachImport(doc, importDaten));
  const teile = [
    ...(daten.lehrplaene ?? []).map((l: any) => `Lehrplan ${l.id} (${l.karten?.length ?? 0} Karten)`),
    ...(daten.abgleich ? [`Abgleich (${daten.abgleich.length} Paare) — ersetzt den bisherigen`] : []),
    ...(curriculumMitInhalt ? [`Curriculum (${daten.curriculum.klassen?.length ?? 0} Klassen) — ersetzt das bisherige`] : []),
    ...(einheiten.length ? [`${einheiten.length} neue Unterrichtseinheiten (leer, Karten bleiben im Deck)`] : []),
  ];
  if (!teile.length) throw new Error("Weder lehrplaene, abgleich, curriculum noch zuordnung gefunden");
  return {
    ops: [{ op: "import", daten: importDaten }, ...einheiten.map(a => ({ op: "thema", klasse: a.klasse, thema: a.thema }))],
    text: teile.join(" · "),
  };
}

export function ImportDialog({ doc, idx, onOps, onClose }: { doc: Vorlage; idx: Index; onOps: (ops: Op[]) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const { vorschau, fehler } = useMemo(() => {
    if (!text.trim()) return { vorschau: null, fehler: "" };
    try { return { vorschau: importOps(antwortLesen(text), doc, idx), fehler: "" }; }
    catch (e: any) { return { vorschau: null, fehler: String(e?.message ?? e) }; }
  }, [text, doc, idx]);
  return (
    <Fenster titel="Hochladen" onClose={onClose} breit>
      <p className="text-sm text-muted mb-3">Vorlage, Export oder gespeicherte KI-Antwort (z. B. eine Zuordnung). Lehrpläne werden nach id ersetzt, Abgleich und Curriculum nur, wenn sie mitkommen.</p>
      <JsonEingabe onText={setText} />
      <div className="mt-3">
        {vorschau ? <p className="text-sm text-ok mb-3">✓ {vorschau.text}</p> : fehler && <p className="text-sm text-bad mb-3">{fehler}</p>}
      </div>
      <button className="btn-primary" disabled={!vorschau} onClick={() => { onOps(vorschau!.ops); onClose(); }}>Übernehmen</button>
    </Fenster>
  );
}

// ── Teilen ───────────────────────────────────────────────────────────────────

export function TeilenDialog({ plan, onPatch, onNewCode, onClose }: {
  plan: CurriculumPlanOut;
  onPatch: (b: { allow_guests?: boolean; guest_permission?: "read" | "edit" }) => void;
  onNewCode: () => void;
  onClose: () => void;
}) {
  const url = useLanUrl(plan.guest_code ? `/tools/curriculum/join?code=${plan.guest_code}` : "");
  return (
    <Fenster titel="Mit der Fachschaft teilen" onClose={onClose}>
      <p className="text-sm text-muted mb-3">Alle Lehrkräfte mit TT-Konto finden den Plan schon in der Liste und können ihn bearbeiten. Kolleg·innen ohne Konto kommen per QR-Code als Gast dazu.</p>
      {!plan.darf_verwalten ? (
        <p className="text-sm">Den Gastzugang stellt {plan.owner_name} ein.</p>
      ) : (
        <>
          <label className="flex items-center gap-2 mb-2">
            <input type="checkbox" checked={plan.allow_guests} onChange={e => onPatch({ allow_guests: e.target.checked })} /> Gastzugang per QR-Code
          </label>
          {plan.allow_guests && (
            <>
              <div className="flex gap-1 mb-3">
                {(["read", "edit"] as const).map(p => (
                  <button key={p} className={`chip ${plan.guest_permission === p ? "chip-on" : ""}`} onClick={() => onPatch({ guest_permission: p })}>
                    {p === "read" ? "Gäste lesen nur" : "Gäste bearbeiten mit"}</button>
                ))}
              </div>
              <div className="flex gap-4 items-center">
                <JoinQR url={url} size={140} />
                <div>
                  <div className="font-mono text-2xl tracking-widest mb-1">{plan.guest_code}</div>
                  <div className="text-xs text-muted break-all mb-2">{url}</div>
                  <button className="btn-secondary text-sm" onClick={onNewCode}>Neuer Code (alter QR wird ungültig)</button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </Fenster>
  );
}


// ── Export ───────────────────────────────────────────────────────────────────

const EXPORT_FORMATE = [
  { id: "docx", name: "Word (.docx)", info: "zum Weiterbearbeiten, A4 quer" },
  { id: "pdf", name: "PDF", info: "zum Drucken und Verteilen" },
  { id: "svg", name: "SVG", info: "Grafik einer Klasse, z. B. für Präsentationen" },
  { id: "json", name: "JSON-Vorlage", info: "ganzer Plan mit Lehrplänen und Abgleich, zum Wiederhochladen" },
] as const;
type ExportFormat = typeof EXPORT_FORMATE[number]["id"];

export function ExportDialog({ planId, planName, doc, guestToken, onJson, onClose }: {
  planId: number; planName: string; doc: Vorlage; guestToken?: string; onJson: () => void; onClose: () => void;
}) {
  const klassen = doc.curriculum.klassen.map(k => k.klasse);
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [klasse, setKlasse] = useState<number | "alle">("alle");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");
  const nurEine = format === "svg";
  const gewaehlt = nurEine && klasse === "alle" ? klassen[0] : klasse;

  const los = async () => {
    if (format === "json") { onJson(); onClose(); return; }
    setLaeuft(true); setFehler("");
    try {
      const k = gewaehlt === "alle" ? undefined : gewaehlt;
      const blob = await api.curriculum.exportieren(planId, format, k, guestToken);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${planName}${k != null ? ` Klasse ${k}` : ""}.${format}`.replace(/[\/:*?"<>|]+/g, "_");
      a.click();
      URL.revokeObjectURL(a.href);
      onClose();
    } catch (e: any) {
      setFehler(String(e?.message ?? e));
      setLaeuft(false);
    }
  };

  return (
    <Fenster titel="Exportieren" onClose={onClose}>
      <p className="text-sm text-muted mb-3">
        Endfassung wie in euren Curricula: je Klasse eine Tabelle mit den Unterrichtseinheiten (Wochen) als Zeilen und
        G | R | H | LB | GE als Spalten — euer Inhalt und darunter der Wortlaut der zugeordneten Karten des neuen Lehrplans.
      </p>
      <div className="flex flex-col gap-1 mb-3 text-sm">
        {EXPORT_FORMATE.map(f => (
          <label key={f.id} className="flex items-center gap-2">
            <input type="radio" checked={format === f.id} onChange={() => setFormat(f.id)} />
            <b>{f.name}</b> <span className="text-muted">· {f.info}</span>
          </label>
        ))}
      </div>
      {format !== "json" && (
        <label className="flex items-center gap-2 mb-4 text-sm">
          <span className="label">Umfang</span>
          <select className="input w-48" value={String(gewaehlt)} onChange={e => setKlasse(e.target.value === "alle" ? "alle" : Number(e.target.value))}>
            {!nurEine && <option value="alle">alle Klassen</option>}
            {klassen.map(k => <option key={k} value={k}>Klasse {k}</option>)}
          </select>
          {nurEine && <span className="text-xs text-muted">SVG gibt es je Klasse</span>}
        </label>
      )}
      {fehler && <p className="text-sm text-bad mb-3">{fehler}</p>}
      <button className="btn-primary" disabled={laeuft || (nurEine && !klassen.length)} onClick={los}>
        {laeuft ? (format === "pdf" ? "PDF wird erzeugt…" : "Erzeuge…") : "⬇ Herunterladen"}
      </button>
    </Fenster>
  );
}
