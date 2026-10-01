"use client";
/** Formular für eine Tipptexte-Sammlung im Upload-Format. */
import type { TippSammlung } from "@/lib/api";
import { Feld, Gruppe, Karte, ListenFeld, ZeilenKnoepfe, move } from "./felder";

export type TipptexteJson = Pick<TippSammlung, "title" | "description" | "texts" | "words" | "settings">;

export function TipptexteForm({ value, onChange }: { value: TipptexteJson; onChange: (v: TipptexteJson) => void }) {
  const set = (patch: Partial<TipptexteJson>) => onChange({ ...value, ...patch });
  const texts = value.texts;
  return (
    <div className="flex flex-col gap-4">
      <Feld label="Titel *"><input className="input" value={value.title} onChange={e => set({ title: e.target.value })} /></Feld>
      <Feld label="Beschreibung">
        <input className="input" value={value.description ?? ""} onChange={e => set({ description: e.target.value || null })} />
      </Feld>
      <Gruppe label={`Texte (${texts.length})`} hint="Ganze Sätze, 100–600 Zeichen. Nicht erlaubt: ^ ´ ` sowie @ € [ ] { } \ ~ | ² ³ µ.">
        {texts.map((t, i) => (
          <Karte key={i} offen={texts.length <= 3 || !t.text}
            titel={<>{i + 1}. {t.title || <em className="text-[var(--text-muted)]">ohne Titel</em>}</>}
            knoepfe={<ZeilenKnoepfe index={i} count={texts.length} what="Text"
              onMove={d => set({ texts: move(texts, i, d) })}
              onRemove={() => set({ texts: texts.filter((_, j) => j !== i) })} />}>
            <Feld label="Titel">
              <input className="input" value={t.title} onChange={e => set({ texts: texts.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} />
            </Feld>
            <Feld label="Text zum Abtippen" hint={`${t.text.length} Zeichen`}>
              <textarea className="input" rows={4} value={t.text}
                onChange={e => set({ texts: texts.map((x, j) => j === i ? { ...x, text: e.target.value } : x) })} />
            </Feld>
          </Karte>
        ))}
        <button type="button" className="text-xs text-[var(--accent)] hover:underline self-start"
          onClick={() => set({ texts: [...texts, { title: "", text: "" }] })}>+ Text</button>
      </Gruppe>
      <Feld label="Wörter für den Wortregen (optional)" hint="Einzelne Wörter, durch Kommas getrennt.">
        <ListenFeld value={value.words} onChange={words => set({ words })} trenner={/[,;\s]+/} />
      </Feld>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.settings.lock_on_error !== false}
          onChange={e => set({ settings: { ...value.settings, lock_on_error: e.target.checked } })} />
        Fehlersperre: Bei einem Fehler geht es erst mit der richtigen Taste weiter
      </label>
    </div>
  );
}
