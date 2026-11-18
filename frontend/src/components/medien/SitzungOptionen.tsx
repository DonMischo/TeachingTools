"use client";
/**
 * Einstellung einer Sitzung »Geschichte der Medien«: Alles freischalten —
 * dann sind für alle, die mit dem Code beitreten, alle Stationen, Fotos und
 * Flops offen (etwa für eine Recherche-Stunde). Der Fortschritt bleibt, wie er ist.
 */
import { useState } from "react";
import { api, type ToolSessionOut } from "@/lib/api";

export const sitzungAllesFrei = (s: { settings?: Record<string, unknown> } | null | undefined) => s?.settings?.allesFrei === true;

export default function MedienSitzungOptionen({ session }: { session: ToolSessionOut }) {
  const [an, setAn] = useState(sitzungAllesFrei(session));
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const umschalten = async (neu: boolean) => {
    setSpeichert(true); setFehler(null);
    try {
      const s = await api.toolSessions.einstellungen(session.code, { ...(session.settings ?? {}), allesFrei: neu });
      session.settings = s.settings;
      setAn(sitzungAllesFrei(s));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Nicht gespeichert.");
    } finally { setSpeichert(false); }
  };
  return (
    <>
      <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
        <input type="checkbox" checked={an} disabled={speichert} onChange={e => umschalten(e.target.checked)} />
        🔓 Alle Stationen freischalten
      </label>
      <p className="text-xs text-muted leading-relaxed">
        Für alle, die mit diesem Code beitreten: Jede Station, jedes Foto und jedes Grab im Flop-Museum ist offen —
        gut für eine Recherche- oder Vortragsstunde. Gespeichert und gezählt wird weiter nur, was jemand wirklich schafft.
        Wer schon drin ist, sieht die Änderung beim nächsten Neuladen.
      </p>
      {fehler && <p className="text-xs text-bad">{fehler}</p>}
    </>
  );
}
