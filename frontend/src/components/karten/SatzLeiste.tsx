"use client";
/** Kartensatz laden, benennen, teilen, speichern, löschen. */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { aufgeraeumt, type Ausschnitt, type KartenSatz, type SatzInhalt } from "@/lib/karten/satz";

type Aktuell = Pick<KartenSatz, "id" | "titel" | "geteilt" | "eigen"> | null;

export default function SatzLeiste({ satz, inhalt, ausschnitt, onLaden, onGespeichert, vorschlag }: {
  satz: Aktuell;
  inhalt: SatzInhalt;
  ausschnitt: () => Ausschnitt | null;
  onLaden: (s: KartenSatz | null) => void;
  onGespeichert: (s: KartenSatz) => void;
  /** Titel einer geladenen JSON-Vorlage (noch nicht gespeichert) */
  vorschlag?: string;
}) {
  const qc = useQueryClient();
  const { data: liste = [] } = useQuery({ queryKey: ["karten", "saetze"], queryFn: api.karten.saetze });
  const [titel, setTitel] = useState(satz?.titel ?? "");
  const [geteilt, setGeteilt] = useState(satz?.geteilt ?? false);
  const [meldung, setMeldung] = useState("");
  useEffect(() => { setTitel(satz?.titel ?? ""); setGeteilt(satz?.geteilt ?? false); }, [satz?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (vorschlag) setTitel(vorschlag); }, [vorschlag]);

  const laden = async (id: string) => {
    setMeldung("");
    onLaden(id ? await api.karten.satz(Number(id)) : null);
  };
  const speichern = async (alsNeu: boolean) => {
    if (!titel.trim()) { setMeldung("Bitte einen Namen eingeben."); return; }
    const body = { titel: titel.trim(), geteilt, inhalt: { ...aufgeraeumt(inhalt), ausschnitt: ausschnitt() ?? inhalt.ausschnitt } };
    try {
      const s = satz?.eigen && !alsNeu ? await api.karten.aendern(satz.id, body) : await api.karten.anlegen(body);
      onGespeichert(s);
      setMeldung(`Gespeichert: »${s.titel}«`);
      qc.invalidateQueries({ queryKey: ["karten", "saetze"] });
    } catch (e) {
      setMeldung(`Speichern ging nicht: ${(e as Error).message}`);
    }
  };
  const loeschen = async () => {
    if (!satz?.eigen || !window.confirm(`Kartensatz »${satz.titel}« löschen?`)) return;
    await api.karten.loeschen(satz.id);
    qc.invalidateQueries({ queryKey: ["karten", "saetze"] });
    onLaden(null);
    setMeldung("Gelöscht.");
  };

  const knopf = "px-3 py-1.5 rounded-lg text-sm font-bold border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-40";
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-wrap items-center gap-2 text-sm">
      <select value={satz?.id ?? ""} onChange={(e) => laden(e.target.value)} aria-label="Kartensatz laden"
        className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] max-w-[260px]">
        <option value="">— neuer Kartensatz —</option>
        {liste.map((s) => (
          <option key={s.id} value={s.id}>{s.titel}{s.eigen ? "" : ` (${s.autor})`}</option>
        ))}
      </select>
      <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Name, z. B. »Flüsse Thüringens – Test 7b«"
        className="flex-1 min-w-[200px] px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)]" />
      <label className="flex items-center gap-1.5" title="Andere Lehrkräfte können ihn laden (aber nicht ändern)">
        <input type="checkbox" checked={geteilt} onChange={() => setGeteilt((g) => !g)} /> für Kollegium
      </label>
      <button className={knopf} onClick={() => speichern(false)}>💾 {satz?.eigen ? "Speichern" : "Speichern als neu"}</button>
      {satz?.eigen && <button className={knopf} onClick={() => speichern(true)}>Kopie speichern</button>}
      {satz?.eigen && <button className={knopf} onClick={loeschen} aria-label="Kartensatz löschen">🗑</button>}
      {meldung && <span className="text-[var(--text-muted)]">{meldung}</span>}
    </div>
  );
}
