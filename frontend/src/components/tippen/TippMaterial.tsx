"use client";
/**
 * Auswahl und Verwaltung des Tippmaterials — eingebaute Lektionen oder eine
 * hochgeladene Sammlung (Diktate, Fachbegriffe).
 *
 * Steht bewusst in einer eigenen Datei und wird nur auf der Werkzeugseite
 * gerendert, nicht auf der Beitrittsseite: Gäste ohne Konto sollen hier keine
 * Anfrage auslösen, die ohnehin mit 401 zurückkäme.
 */
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type TippSammlung } from "@/lib/api";
import { useAvailability } from "@/hooks/useAvailability";
import { VorlagenEditor } from "@/components/vorlagen/VorlagenEditor";
import { TipptexteForm, type TipptexteJson } from "@/components/vorlagen/TipptexteForm";

export default function TippMaterial({
  gewaehlt,
  onWaehlen,
}: {
  gewaehlt: TippSammlung | null;
  onWaehlen: (s: TippSammlung | null) => void;
}) {
  const { can } = useAvailability();
  const qc = useQueryClient();
  const dateiRef = useRef<HTMLInputElement>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const { data: sammlungen = [] } = useQuery({
    queryKey: ["tipptexte"],
    queryFn: api.tipptexte.list,
  });

  const hochladen = useMutation({
    mutationFn: (datei: File) => api.tipptexte.upload(datei),
    onSuccess: neu => {
      setFehler(null);
      qc.invalidateQueries({ queryKey: ["tipptexte"] });
      onWaehlen(neu);
    },
    onError: (e: Error) => setFehler(e.message || "Die Datei ließ sich nicht laden."),
  });

  const loeschen = useMutation({
    mutationFn: (id: number) => api.tipptexte.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tipptexte"] });
      onWaehlen(null);
    },
    onError: (e: Error) => setFehler(e.message || "Löschen nicht möglich."),
  });

  async function waehlen(wert: string) {
    setFehler(null);
    if (wert === "") return onWaehlen(null);
    try {
      onWaehlen(await api.tipptexte.get(Number(wert)));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Die Sammlung ließ sich nicht laden.");
    }
  }

  async function vorlage() {
    const daten = await api.tipptexte.template();
    const blob = new Blob([JSON.stringify(daten, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tipptexte_vorlage.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const darfHochladen = can("tippen", "upload");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Material"
        value={gewaehlt?.id ?? ""}
        onChange={e => waehlen(e.target.value)}
        className="text-sm bg-surface border border-line rounded-lg px-3 py-1.5"
      >
        <option value="">📚 Eingebaute Lektionen</option>
        {sammlungen.map(s => (
          <option key={s.id} value={s.id}>
            {s.title} ({s.anzahl_texte} Texte)
          </option>
        ))}
      </select>

      {gewaehlt && (
        <span className="text-xs text-muted">
          {gewaehlt.words.length > 0 && `${gewaehlt.words.length} Wörter fürs Spiel · `}
          {gewaehlt.settings.lock_on_error === false ? "ohne Fehlersperre" : "mit Fehlersperre"}
        </span>
      )}

      <div className="flex-1" />

      {darfHochladen && (
        <>
          <input
            ref={dateiRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={e => {
              const datei = e.target.files?.[0];
              if (datei) hochladen.mutate(datei);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => dateiRef.current?.click()}
            disabled={hochladen.isPending}
            className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent disabled:opacity-50"
          >
            {hochladen.isPending ? "lädt …" : "⬆️ Hochladen"}
          </button>
          <button
            onClick={vorlage}
            title="Leere JSON-Vorlage mit Anleitung herunterladen"
            className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent"
          >
            📄 Vorlage
          </button>
          {gewaehlt && (
            <VorlagenEditor
              key={gewaehlt.id}
              label="✎"
              title={`»${gewaehlt.title}« bearbeiten`}
              render={(v, set) => <TipptexteForm value={v} onChange={set} />}
              load={async (): Promise<TipptexteJson> => {
                const { title, description, texts, words, settings } = await api.tipptexte.get(gewaehlt.id);
                return { title, description, texts, words, settings };
              }}
              save={data => api.tipptexte.update(gewaehlt.id, data)}
              fileName={`tipptexte_${gewaehlt.id}.json`}
              onSaved={neu => {
                qc.invalidateQueries({ queryKey: ["tipptexte"] });
                onWaehlen(neu);
              }}
            />
          )}
          {gewaehlt && (
            <button
              onClick={() => loeschen.mutate(gewaehlt.id)}
              title={`»${gewaehlt.title}« löschen`}
              className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-bad"
            >
              🗑️
            </button>
          )}
        </>
      )}

      {fehler && <p className="w-full text-sm text-bad">{fehler}</p>}
    </div>
  );
}
