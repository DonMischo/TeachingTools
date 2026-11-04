"use client";
/** Curriculum-Abgleich: Pläne der Fachschaften (jede Lehrkraft sieht und bearbeitet alle). */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAvailability } from "@/hooks/useAvailability";
import { useToast } from "@/contexts/ToastContext";
import { api } from "@/lib/api";
import HelpButton from "@/components/HelpButton";
import { antwortLesen } from "@/lib/curriculum/kiPrompt";

/** Öffentliche Lehrplan-Karten (Thüringen) als Startpunkt. */
const STARTVORLAGEN = {
  mathe: { datei: "/curriculum/mathematik_thueringen.json", text: "Thüringer Mathe-Lehrpläne (RS 2011 / GY 2018 → 2026) mit Abgleich" },
  physik: { datei: "/curriculum/physik_thueringen.json", text: "Thüringer Physik-Lehrpläne 2026 (RS + GY, Kl. 7–10), ohne alten Plan" },
} as const;
type Start = keyof typeof STARTVORLAGEN;

export default function CurriculumListe() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { can, ready } = useAvailability();
  const { data: plaene } = useQuery({ queryKey: ["curriculum-plaene"], queryFn: api.curriculum.list });
  const [name, setName] = useState("");
  const [quelle, setQuelle] = useState<Start | "leer" | "datei">("mathe");
  const [datei, setDatei] = useState<File | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    if (ready && !can("curriculum", "use")) router.replace("/tools");
  }, [ready, can, router]);

  const anlegen = async () => {
    setLaeuft(true);
    try {
      let data: unknown;
      if (quelle in STARTVORLAGEN) data = await fetch(STARTVORLAGEN[quelle as Start].datei).then(r => { if (!r.ok) throw new Error("Startvorlage fehlt"); return r.json(); });
      if (quelle === "datei" && datei) data = antwortLesen(await datei.text());
      const plan = await api.curriculum.create({ name: name.trim(), fach: (data as any)?.fach ?? "Mathematik", data });
      qc.invalidateQueries({ queryKey: ["curriculum-plaene"] });
      router.push(`/tools/curriculum/${plan.id}`);
    } catch (e: any) {
      toast(e.message ?? "Anlegen fehlgeschlagen", "error");
      setLaeuft(false);
    }
  };

  return (
    <div className="max-w-seite mx-auto p-6">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold flex-1">🧭 Curriculinator</h1>
        <HelpButton slug="curriculum" />
      </div>
      <p className="text-muted mb-6">Schulinternes Curriculum gegen alten und neuen Lehrplan legen: Was bleibt, was ist neu, was wandert in eine andere Klasse — und wie viele Wochen bleiben dafür.</p>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))] mb-8">
        {plaene?.map(p => (
          <Link key={p.id} href={`/tools/curriculum/${p.id}`} className="card p-4 hover:bg-surface-hover">
            <div className="font-semibold">{p.name}</div>
            <div className="text-sm text-muted">{p.fach} · angelegt von {p.owner_name}</div>
            {p.zuletzt_von && <div className="text-xs text-muted mt-1">zuletzt geändert von {p.zuletzt_von}</div>}
          </Link>
        ))}
        {plaene?.length === 0 && <p className="text-muted">Noch kein Plan angelegt.</p>}
      </div>

      <div className="card p-4 max-w-xl">
        <h2 className="font-bold mb-3">Neuer Plan</h2>
        <label className="flex flex-col gap-1 mb-3"><span className="label">Name</span>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="z. B. Mathematik Sek I" /></label>
        <div className="flex flex-col gap-1 mb-3 text-sm">
          {(Object.keys(STARTVORLAGEN) as Start[]).map(k => (
            <label key={k} className="flex items-center gap-2"><input type="radio" checked={quelle === k} onChange={() => setQuelle(k)} />
              {STARTVORLAGEN[k].text}, Curriculum leer</label>
          ))}
          <label className="flex items-center gap-2"><input type="radio" checked={quelle === "leer"} onChange={() => setQuelle("leer")} />
            Leer (Lehrpläne später per KI-Prompt)</label>
          <label className="flex items-center gap-2"><input type="radio" checked={quelle === "datei"} onChange={() => setQuelle("datei")} />
            Aus Vorlage-Datei (.json)</label>
          {quelle === "datei" && <input type="file" accept=".json,application/json" className="ml-6" onChange={e => setDatei(e.target.files?.[0] ?? null)} />}
        </div>
        <button className="btn-primary" disabled={!name.trim() || laeuft || (quelle === "datei" && !datei)} onClick={anlegen}>
          {laeuft ? "Lege an…" : "Anlegen"}</button>
      </div>
    </div>
  );
}
