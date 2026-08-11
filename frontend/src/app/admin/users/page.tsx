"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, ClassOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

type UserType = "student" | "teacher" | "admin";

const TYPE_LABEL: Record<UserType, string> = {
  student: "Schüler:in",
  teacher: "Lehrkraft",
  admin: "Admin",
};

type CreatedCred = { name: string; type: UserType; username: string; password: string | null };

export default function AdminCreateUserPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [type, setType] = useState<UserType>("teacher");
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [klasse, setKlasse] = useState("");
  const [geschlecht, setGeschlecht] = useState("");
  const [email, setEmail] = useState("");
  const [profession, setProfession] = useState("");
  const [created, setCreated] = useState<CreatedCred[]>([]);

  useEffect(() => {
    if (auth !== null && auth.role !== "admin") router.replace("/");
  }, [auth, router]);

  const isAdmin = auth?.role === "admin";
  const { data: classes = [] } = useQuery<ClassOut[]>({
    queryKey: ["classes"],
    queryFn: api.classes.list,
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: async (): Promise<CreatedCred> => {
      const first = vorname.trim();
      const last = nachname.trim();
      if (type === "student") {
        const res = await api.students.create({ vorname: first, nachname: last, klasse: klasse.trim(), geschlecht });
        return { name: `${res.nachname}, ${res.vorname}`, type, username: res.username, password: res.password };
      }
      const res = await api.teachers.create({
        first_name: first,
        last_name: last,
        role: type === "admin" ? "admin" : "teacher",
        email: email.trim() || null,
        teacher_role: profession || null,
      });
      return { name: `${res.last_name}, ${res.first_name}`, type, username: res.username, password: res.password };
    },
    onSuccess: (row) => {
      setCreated(prev => [row, ...prev]);
      setVorname(""); setNachname(""); setKlasse(""); setGeschlecht(""); setEmail(""); setProfession("");
      toast(`${TYPE_LABEL[row.type]} angelegt: ${row.username}`, "success");
    },
    onError: (e: any) => toast(e?.message ?? "Fehler beim Anlegen", "error"),
  });

  if (!auth || auth.role !== "admin") return null;

  const namesOk = vorname.trim() && nachname.trim();
  const canSubmit = type === "student"
    ? Boolean(namesOk && klasse.trim() && geschlecht)
    : Boolean(namesOk);

  return (
    <div className="flex flex-col gap-8 p-6 max-w-2xl mx-auto w-full">
      <div>
        <button onClick={() => router.push("/admin")} className="mb-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">← Zurück</button>
        <h1 className="text-2xl font-black tracking-tight">➕ Benutzer anlegen</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Einzelnes Konto manuell erstellen · Rolle wählen · Zugangsdaten werden sofort erzeugt</p>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-4">
        {/* Type / role selector */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--text-muted)]">Rolle</span>
          <div className="flex gap-2 flex-wrap">
            {(["student", "teacher", "admin"] as UserType[]).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                  type === t
                    ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-transparent"
                    : "border-[var(--border)] hover:border-[var(--accent)]"
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
            Vorname
            <input className="input text-sm py-2" value={vorname} onChange={e => setVorname(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
            Nachname
            <input className="input text-sm py-2" value={nachname} onChange={e => setNachname(e.target.value)} />
          </label>

          {type === "student" && (
            <>
              <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
                Klasse
                <select className="input text-sm py-2" value={klasse} onChange={e => setKlasse(e.target.value)}>
                  <option value="">— wählen —</option>
                  {classes.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
                Geschlecht
                <select className="input text-sm py-2" value={geschlecht} onChange={e => setGeschlecht(e.target.value)}>
                  <option value="">— wählen —</option>
                  <option value="m">männlich</option>
                  <option value="w">weiblich</option>
                </select>
              </label>
            </>
          )}

          {type !== "student" && (
            <>
              <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
                E-Mail <span className="opacity-60">(optional)</span>
                <input className="input text-sm py-2" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
                Profession <span className="opacity-60">(optional)</span>
                <select className="input text-sm py-2" value={profession} onChange={e => setProfession(e.target.value)}>
                  <option value="">— keine —</option>
                  <option value="Lehrer">Lehrer</option>
                  <option value="SPF">SPF</option>
                </select>
              </label>
            </>
          )}
        </div>

        <div>
          <button
            onClick={() => createMut.mutate()}
            disabled={!canSubmit || createMut.isPending}
            className="btn-primary text-sm py-2 px-5 disabled:opacity-40"
          >
            {createMut.isPending ? "Lege an…" : `${TYPE_LABEL[type]} anlegen`}
          </button>
        </div>
      </section>

      {created.length > 0 && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-3">
          <h2 className="font-semibold text-sm">Erzeugte Zugangsdaten</h2>
          <p className="text-xs text-[var(--text-muted)]">Passwörter werden nur hier angezeigt — bitte notieren. Später sind sie über den CSV-Export der jeweiligen Übersicht abrufbar.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  <th className="text-left py-2 pr-4">Rolle</th>
                  <th className="text-left py-2 pr-4">Name</th>
                  <th className="text-left py-2 pr-4">Benutzername</th>
                  <th className="text-left py-2">Passwort</th>
                </tr>
              </thead>
              <tbody>
                {created.map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border)]/50">
                    <td className="py-1.5 pr-4">{TYPE_LABEL[row.type]}</td>
                    <td className="py-1.5 pr-4">{row.name}</td>
                    <td className="py-1.5 pr-4 font-mono">{row.username}</td>
                    <td className="py-1.5 font-mono">{row.password ?? <span className="opacity-40">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
