"use client";
/**
 * Werkzeug auswählen und als ToolLink einbinden — Stundenplaner-Phasen und
 * Curriculinator (Unterrichtseinheiten, Karten). Die Liste kommt aus
 * api/tool_registry.py (GET stundenplaner/tool-refs), dazu ein freier Link.
 */
import { useEffect, useState } from "react";
import { api, type ToolLink, type ToolRefs } from "@/lib/api";

// ---------------------------------------------------------------------------
// Tool Picker Modal
// ---------------------------------------------------------------------------

const LINK_TYPE = "link";
const LINK_LABEL = "🔗 Link / URL";

export function ToolPicker({ refs: start, onConfirm, onClose, sammlung, nurTypen }: {
  refs: ToolRefs;
  onConfirm: (link: ToolLink) => void;
  onClose: () => void;
  /** nur Fragmente dieser Sammlung anbieten (Curriculinator) */
  sammlung?: number | null;
  /** nur diese Typen anbieten (z. B. ["fragmente", "link"]) */
  nurTypen?: string[];
}) {
  // Frisch halten: beim Öffnen, beim Zurückkehren ins Fenster und alle 5 s — ein eben in
  // Fragmente angelegtes Clipping steht so gleich in der Liste.
  const [alleRefs, setRefs] = useState<ToolRefs>(start);
  useEffect(() => {
    const laden = () => api.stundenplaner.toolRefs().then(setRefs, () => {});
    laden();
    const takt = setInterval(laden, 5000);
    window.addEventListener("focus", laden);
    return () => { clearInterval(takt); window.removeEventListener("focus", laden); };
  }, []);
  const [type, setType] = useState<string>("");
  const [refId, setRefId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");

  const gefiltert = nurTypen ? alleRefs.filter(t => nurTypen.includes(t.type)) : alleRefs;
  const refs = sammlung == null ? gefiltert : gefiltert.map(t => t.type !== "fragmente" ? t
    : { ...t, items: t.items.filter(i => i.ref_id === `c${sammlung}` || !!i.ref_id?.startsWith(`c${sammlung}:`)) });
  const tool = refs.find(t => t.type === type);
  const isLink = type === LINK_TYPE;

  function handleTypeChange(t: string) {
    setType(t);
    setRefId(null);
    setUrl("");
    setLabel("");
    const info = refs.find(x => x.type === t);
    if (info && !info.requires_ref) {
      setLabel(info.items[0]?.label ?? info.label);
    }
  }

  function handleRefChange(rid: string) {
    setRefId(rid || null);
    const item = tool?.items.find(r => r.ref_id === rid);
    setLabel(item?.label ?? "");
  }

  const urlOk = /^https?:\/\/.+/i.test(url.trim());
  const canConfirm = isLink ? urlOk : (tool && (!tool.requires_ref || refId));

  function confirm() {
    if (isLink) {
      if (!urlOk) return;
      onConfirm({ type: LINK_TYPE, ref_id: null, url: url.trim(), label: label.trim() || url.trim() });
    } else if (tool && canConfirm) {
      onConfirm({ type: tool.type as ToolLink["type"], ref_id: refId, label: label || tool.label });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="card p-6 w-full max-w-sm mx-4 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="font-bold text-base">Tool einbinden</div>

        <div>
          <label className="text-xs text-muted block mb-1">Tool-Typ</label>
          <div className="grid grid-cols-2 gap-2">
            {[...refs, ...(!nurTypen || nurTypen.includes(LINK_TYPE) ? [{ type: LINK_TYPE, label: LINK_LABEL }] : [])].map(t => (
              <button key={t.type} onClick={() => handleTypeChange(t.type)}
                className="text-left px-3 py-2 rounded-lg border text-sm transition-colors"
                style={{
                  border: type === t.type ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                  background: type === t.type ? "rgba(255,235,59,0.08)" : "var(--bg)",
                  color: type === t.type ? "var(--accent)" : "var(--text)",
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {isLink && (
          <div>
            <label className="text-xs text-muted block mb-1">URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" className="input text-sm py-2 w-full" />
            {url.trim() && !urlOk && (
              <p className="text-xs text-red-400 mt-1">Bitte eine gültige http(s)-Adresse eingeben.</p>
            )}
          </div>
        )}

        {tool && tool.requires_ref && (
          <div>
            <label className="text-xs text-muted block mb-1">Welcher Inhalt?</label>
            {tool.items.length === 0 ? (
              <p className="text-xs text-muted">Keine Inhalte gefunden. Erstelle zuerst eins im jeweiligen Tool.</p>
            ) : (
              <select value={refId ?? ""} onChange={e => handleRefChange(e.target.value)} className="input text-sm py-2 w-full">
                <option value="">— bitte wählen —</option>
                {tool.items.map(r => (
                  <option key={r.ref_id} value={r.ref_id ?? ""}>{r.label}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {(tool || isLink) && (
          <div>
            <label className="text-xs text-muted block mb-1">Anzeigetext (optional)</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder={isLink ? "z.B. Erklärvideo" : tool?.label} className="input text-sm py-2 w-full" />
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary text-sm py-1.5 px-4">Abbrechen</button>
          <button
            onClick={confirm}
            disabled={!canConfirm}
            className="btn-primary text-sm py-1.5 px-4">
            Einbinden
          </button>
        </div>
      </div>
    </div>
  );
}
