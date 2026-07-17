"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, GeneratorDefOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

const EXAMPLE_LEVELS = [
  { template: "Löse nach $x$ auf: $${{a}}x + {{b}} = {{c}}$$",
    vars: { a: [2, 4], b: [1, 9], c: [10, 20] }, answer_expr: "(c - b) / a",
    hint: "Bringe zuerst die Zahl ohne x auf die andere Seite, dann teile durch den Vorfaktor." },
  { template: "Löse nach $x$ auf: $${{a}}x + {{b}} = {{c}}x + {{d}}$$",
    vars: { a: [4, 8], c: [1, 3], b: [1, 9], d: [10, 30] }, answer_expr: "(d - b) / (a - c)",
    hint: "Bring alle x-Terme auf eine Seite." },
];

export default function AdminGeneratorsPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (auth !== null && auth.role !== "admin") router.replace("/");
  }, [auth, router]);

  const { data: defs = [] } = useQuery<GeneratorDefOut[]>({
    queryKey: ["admin-generators"], queryFn: api.generators.adminList,
  });

  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [subject, setSubject] = useState("mathe");
  const [description, setDescription] = useState("");
  const [levelsJson, setLevelsJson] = useState(JSON.stringify(EXAMPLE_LEVELS, null, 2));
  const [errors, setErrors] = useState<string[]>([]);

  const createMut = useMutation({
    mutationFn: () => {
      let levels;
      try {
        levels = JSON.parse(levelsJson);
      } catch {
        throw new Error("'levels' ist kein gültiges JSON");
      }
      return api.generators.create({ slug, label, subject, description, levels });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-generators"] });
      qc.invalidateQueries({ queryKey: ["practice-topics"] });
      toast("Generator gespeichert", "success");
      setSlug(""); setLabel(""); setDescription("");
      setErrors([]);
    },
    onError: (e: any) => {
      try {
        const parsed = JSON.parse(e.message);
        setErrors(parsed.detail?.errors ?? [parsed.detail?.message ?? e.message]);
      } catch {
        setErrors([e.message ?? "Fehler"]);
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: (s: string) => api.generators.delete(s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-generators"] }),
  });

  if (!auth || auth.role !== "admin") return null;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      <Link href="/admin" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← Zurück</Link>
      <div>
        <h1 className="text-2xl font-black tracking-tight">🧮 Aufgaben-Generatoren</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Neue Übungsthemen ohne Programmierung registrieren — eine Frage-Vorlage mit Variablen und einer
          Rechenformel für die Lösung. Kein Code, nur Zahlen und die vier Grundrechenarten (sicher gegen Missbrauch).
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
        <h2 className="font-semibold text-sm">Neuer Generator</h2>
        <div className="grid grid-cols-2 gap-2">
          <input className="input text-sm py-1.5" placeholder="slug (z.B. bruchrechnen)" value={slug} onChange={e => setSlug(e.target.value)} />
          <input className="input text-sm py-1.5" placeholder="Anzeigename" value={label} onChange={e => setLabel(e.target.value)} />
          <input className="input text-sm py-1.5" placeholder="Fach (z.B. mathe)" value={subject} onChange={e => setSubject(e.target.value)} />
          <input className="input text-sm py-1.5" placeholder="Beschreibung" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Stufen (JSON, 1–5 Einträge, aufsteigend schwerer). Vorlagen-Platzhalter: <code>{"{{name}}"}</code> (Doppelklammern,
          nicht mit KaTeX-<code>{"{...}"}</code> verwechseln). answer_expr: nur Variablen, + − * / ( ).
          <textarea className="input text-xs py-2 font-mono min-h-[16rem]" value={levelsJson} onChange={e => setLevelsJson(e.target.value)} />
        </label>
        {errors.length > 0 && (
          <ul className="text-xs text-red-400 flex flex-col gap-0.5">
            {errors.map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
        )}
        <button onClick={() => createMut.mutate()} disabled={!slug || !label || createMut.isPending}
          className="btn-primary text-sm py-1.5 px-4 self-start disabled:opacity-40">
          {createMut.isPending ? "Speichere…" : "Generator speichern"}
        </button>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2">
        <h2 className="font-semibold text-sm">Registrierte Generatoren</h2>
        {defs.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Noch keine eigenen Generatoren.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {defs.map(d => (
              <li key={d.id} className="py-2 flex items-center gap-3">
                <span className="text-sm font-medium">{d.label}</span>
                <span className="text-xs text-[var(--text-muted)]">({d.slug} · {d.subject} · {d.levels.length} Stufen)</span>
                <div className="flex-1" />
                <button onClick={() => { if (confirm(`"${d.label}" löschen?`)) deleteMut.mutate(d.slug); }}
                  className="text-xs text-red-400 hover:underline">Löschen</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
