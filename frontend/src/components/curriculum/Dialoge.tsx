"use client";
/**
 * Dialoge des Curriculum-Abgleichs: Unterrichtseinheit, Karte (mit Paar), KI-Prompt,
 * Hochladen und Teilen (QR). Jeder Dialog gibt fertige Operationen an
 * `onOps` — geschrieben wird im Editor.
 */
import { useMemo, useRef, useState, type ReactNode } from "react";
import { JoinQR } from "@/components/JoinQR";
import { useLanUrl } from "@/hooks/useLanUrl";
import {
  BLOECKE, NIVEAUS, NIVEAU_NAME, STATUS, blockVon, neueId, niveauGilt, zuordnen, type Block, type Index, type KarteMitPlan,
  type Karte, type Paar, type Status, type Thema, type Vorlage,
} from "@/lib/curriculum/modell";
import { antwortLesen, vergleichPrompt, zuordnungPrompt } from "@/lib/curriculum/kiPrompt";
import type { CurriculumPlanOut } from "@/lib/api";

type Op = Record<string, unknown>;

export function Fenster({ titel, onClose, children, breit }: { titel: string; onClose: () => void; children: ReactNode; breit?: boolean }) {
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
    if (wohin && plan.rolle === "neu" && niveaus.R && !niveaus.H && niveauGilt("H", wohin.kl)) niveaus.H = niveaus.R;
    const ops: Op[] = [{ op: "karte", lehrplan: plan.id, karte: { ...k, niveaus } }];
    ps.forEach((p, i) => { if (JSON.stringify(p) !== JSON.stringify(paare[i])) ops.push({ op: "paar", paar: p }); });
    if (wohin) ops.push(...zuordnenOps(wohin.t, wohin.kl, [karte.id]).filter(o => o.op !== "karte"));
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
      {NIVEAUS.map(n => (
        <label key={n} className="flex flex-col gap-1 mb-2">
          <span className="label">{NIVEAU_NAME[n]}</span>
          <textarea className="input min-h-[3rem] text-sm" value={k.niveaus[n] ?? ""} disabled={nurLesen}
            onChange={e => setK({ ...k, niveaus: { ...k.niveaus, [n]: e.target.value } })} />
        </label>
      ))}

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

export function KiDialog({ doc, onClose }: { doc: Vorlage; onClose: () => void }) {
  const [art, setArt] = useState<"vergleich" | "zuordnung">("vergleich");
  const [schulart, setSchulart] = useState<"RS" | "GY">("RS");
  const [rolle, setRolle] = useState<"alt" | "neu">("neu");
  const [mit, setMit] = useState(true);
  const [nurOhne, setNurOhne] = useState(false);
  const [status, setStatus] = useState("");
  const feld = useRef<HTMLTextAreaElement>(null);
  const alt = doc.lehrplaene.find(l => l.rolle === "alt" && l.schulart === schulart)?.id ?? `${schulart.toLowerCase()}_alt`;
  const neu = doc.lehrplaene.find(l => l.rolle === "neu" && l.schulart === schulart)?.id ?? `${schulart.toLowerCase()}_neu`;
  const prompt = art === "vergleich"
    ? vergleichPrompt(doc, { schulart, altId: alt, neuId: neu, alteKartenMit: mit })
    : zuordnungPrompt(doc, { rolle, nurOhne });
  const kopieren = async () => {
    try { await navigator.clipboard.writeText(prompt); setStatus("Kopiert ✓"); }
    catch { feld.current?.select(); setStatus("Markiert — mit Strg+C kopieren"); }
    setTimeout(() => setStatus(""), 2500);
  };
  return (
    <Fenster titel="KI-Prompt" onClose={onClose} breit>
      <ol className="list-decimal pl-5 text-xs text-muted mb-3 leading-relaxed">
        <li>Art wählen, Prompt kopieren und in einen KI-Chat einfügen.</li>
        {art === "vergleich" && <li>Beide Lehrplan-PDFs (alt und neu) im Chat anhängen.</li>}
        <li>Die Antwort (JSON) über »⬆ Hochladen« einfügen. Nur die mitgeschickten Teile werden ersetzt.</li>
        <li>Prüfen! Die KI kann Karten auslassen oder falsch zuordnen.</li>
      </ol>
      <div className="flex flex-wrap gap-1 mb-3">
        <button className={`chip ${art === "vergleich" ? "chip-on" : ""}`} onClick={() => setArt("vergleich")}>Zwei Lehrpläne vergleichen</button>
        <button className={`chip ${art === "zuordnung" ? "chip-on" : ""}`} onClick={() => setArt("zuordnung")}>Curriculum zuordnen</button>
      </div>
      {art === "vergleich" ? (
        <div className="flex flex-wrap gap-3 items-center mb-3 text-sm">
          {(["RS", "GY"] as const).map(s => (
            <button key={s} className={`chip ${schulart === s ? "chip-on" : ""}`} onClick={() => setSchulart(s)}>
              {s === "RS" ? "Regelschule (R + H)" : "Gymnasium"}</button>
          ))}
          <label className="flex items-center gap-1"><input type="checkbox" checked={mit} onChange={e => setMit(e.target.checked)} />
            vorhandene alte Karten mitschicken (ids bleiben gleich)</label>
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
  const teile = [
    ...(daten.lehrplaene ?? []).map((l: any) => `Lehrplan ${l.id} (${l.karten?.length ?? 0} Karten)`),
    ...(daten.abgleich ? [`Abgleich (${daten.abgleich.length} Paare) — ersetzt den bisherigen`] : []),
    ...(daten.curriculum ? [`Curriculum (${daten.curriculum.klassen?.length ?? 0} Klassen) — ersetzt das bisherige`] : []),
  ];
  if (!teile.length) throw new Error("Weder lehrplaene, abgleich, curriculum noch zuordnung gefunden");
  return { ops: [{ op: "import", daten }], text: teile.join(" · ") };
}

export function ImportDialog({ doc, idx, onOps, onClose }: { doc: Vorlage; idx: Index; onOps: (ops: Op[]) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const { vorschau, fehler } = useMemo(() => {
    if (!text.trim()) return { vorschau: null, fehler: "" };
    try { return { vorschau: importOps(antwortLesen(text), doc, idx), fehler: "" }; }
    catch (e: any) { return { vorschau: null, fehler: String(e?.message ?? e) }; }
  }, [text, doc, idx]);
  return (
    <Fenster titel="Vorlage hochladen" onClose={onClose} breit>
      <p className="text-sm text-muted mb-2">JSON-Datei wählen oder die KI-Antwort einfügen. Lehrpläne werden nach id ersetzt, Abgleich und Curriculum nur, wenn sie mitkommen.</p>
      <input type="file" accept=".json,application/json" className="mb-2 text-sm"
        onChange={async e => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
      <textarea className="input font-mono text-[11px] h-48 mb-2" value={text} placeholder="{ … } oder ```json … ```"
        onChange={e => setText(e.target.value)} />
      {vorschau ? <p className="text-sm text-ok mb-3">✓ {vorschau.text}</p> : fehler && <p className="text-sm text-bad mb-3">{fehler}</p>}
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

