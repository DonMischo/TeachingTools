"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AvatarPicker, AvatarDisplay, AVATARS } from "@/components/AvatarPicker";

export type Team = { id: number; name: string; color: string | null };

interface Props {
  gameCode: string;
  gameIcon?: string;
  gameTitle?: string;
  error?: string | null;
  submitting?: boolean;
  onJoin: (name: string, avatar: string, teamId?: number | null) => void;
  /** Optional team selection (Caputh team mode). Selection required when non-empty. */
  teams?: Team[];
  /** Saved session from a previous visit — renders a rejoin card first. */
  savedSession?: { name: string; avatar: string } | null;
  onRejoin?: () => void;
}

export function PlayerIdentityForm({
  gameCode, gameIcon = "🎮", gameTitle, error, submitting, onJoin,
  teams = [], savedSession = null, onRejoin,
}: Props) {
  const { auth } = useAuth();
  const [nameInput, setNameInput] = useState("");
  const [avatar, setAvatar] = useState<string>(() => AVATARS[Math.floor(Math.random() * AVATARS.length)].id);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const lockedName = auth?.student
    ? (auth.student.username ?? `${auth.student.vorname} ${auth.student.nachname}`)
    : null;

  const needsTeam = teams.length > 0 && selectedTeamId === null;

  function handleSubmit() {
    const n = lockedName ?? nameInput.trim();
    if (!n || needsTeam) return;
    onJoin(n, avatar, teams.length > 0 ? selectedTeamId : undefined);
  }

  if (!mounted) return null;

  const shell = (children: React.ReactNode) => (
    <div
      style={{ minHeight: "100svh", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}
      className="flex flex-col items-center justify-center gap-6 p-6"
    >
      <div className="text-5xl">{gameIcon}</div>
      {gameTitle && <h1 className="text-xl font-black tracking-tight text-center text-white">{gameTitle}</h1>}
      <p className="font-mono tracking-widest text-indigo-300 text-sm">{gameCode}</p>

      {error && (
        <p className="text-red-400 text-sm text-center bg-red-400/10 rounded-xl px-4 py-2">{error}</p>
      )}

      <div className="w-full max-w-xs flex flex-col gap-4">{children}</div>
    </div>
  );

  // ── Rejoin card (saved session, user hasn't asked for a new identity) ──
  if (savedSession && onRejoin && !showNewForm) {
    return shell(
      <>
        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <AvatarDisplay avatarId={savedSession.avatar} size="lg" />
          <div>
            <p className="text-white font-bold text-lg leading-tight">{savedSession.name}</p>
            <p className="text-white/50 text-sm">Gespeicherte Sitzung</p>
          </div>
        </div>

        <button
          onClick={onRejoin}
          disabled={submitting}
          className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          {submitting ? "Verbinde…" : `Weiter als ${savedSession.name} →`}
        </button>

        <button
          onClick={() => setShowNewForm(true)}
          className="w-full py-2 text-white/50 text-sm hover:text-white/80 transition-colors"
        >
          Neuer Spieler
        </button>
      </>
    );
  }

  // ── New-player form ─────────────────────────────────────────────────
  return shell(
    <>
      {lockedName ? (
        <div className="flex flex-col items-center gap-3">
          <AvatarDisplay avatarId={avatar} size="lg" />
          <div className="flex items-center gap-2 rounded-xl px-4 py-2 border border-white/20 bg-white/10">
            <span className="text-white font-semibold">{lockedName}</span>
            <span className="text-white/40 text-xs">eingeloggt</span>
          </div>
        </div>
      ) : (
        <input
          autoFocus
          className="w-full rounded-xl px-4 py-3 text-center text-lg font-semibold outline-none border border-white/20 bg-white/10 text-white placeholder-white/40 focus:border-indigo-400"
          placeholder="Dein Name"
          maxLength={30}
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="text-xs text-white/50 mb-2 text-center">Avatar wählen</p>
        <AvatarPicker selected={avatar} onSelect={(id) => setAvatar(id)} />
      </div>

      {teams.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-white/70 text-sm text-center">Team wählen</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {teams.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all ${selectedTeamId === t.id ? "border-yellow-400 bg-yellow-400/20 text-yellow-200" : "border-white/20 text-white/70 hover:border-white/50"}`}
                style={t.color ? { borderColor: selectedTeamId === t.id ? undefined : t.color + "88" } : undefined}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || (!lockedName && !nameInput.trim()) || needsTeam}
        className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
      >
        {submitting ? "Verbinde…" : "Beitreten"}
      </button>

      {savedSession && onRejoin && (
        <button
          onClick={() => setShowNewForm(false)}
          className="w-full py-2 text-white/50 text-sm hover:text-white/80 transition-colors"
        >
          ← Zurück
        </button>
      )}
    </>
  );
}
