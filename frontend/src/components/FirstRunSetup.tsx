"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function FirstRunSetup({ onComplete }: { onComplete: () => void }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!username.trim()) { setError("Bitte Benutzernamen eingeben."); return; }
    if (password !== confirm) { setError("Passwörter stimmen nicht überein."); return; }
    if (password.length < 6) { setError("Passwort muss mindestens 6 Zeichen haben."); return; }

    setLoading(true);
    try {
      const res = await api.setup.createAdmin(username.trim(), password);
      localStorage.setItem("hp_token", res.access_token);
      localStorage.setItem("hp_teacher", JSON.stringify(res.teacher));
      onComplete();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8">
        <h1 className="text-2xl font-bold mb-1">Willkommen bei Hauspunkte</h1>
        <p className="text-[var(--text-muted)] text-sm mb-6">
          Erstelle den ersten Admin-Account um loszulegen.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label">Benutzername</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
          </div>

          <div>
            <label className="label">Passwort</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div>
            <label className="label">Passwort bestätigen</label>
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading ? "Erstelle Account…" : "Admin-Account erstellen"}
          </button>
        </form>
      </div>
    </div>
  );
}
