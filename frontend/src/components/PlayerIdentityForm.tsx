"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AvatarPicker, AvatarDisplay, AVATARS } from "@/components/AvatarPicker";

interface Props {
  gameCode: string;
  gameIcon?: string;
  gameTitle?: string;
  error?: string | null;
  submitting?: boolean;
  onJoin: (name: string, avatar: string) => void;
}

export function PlayerIdentityForm({ gameCode, gameIcon = "🎮", gameTitle, error, submitting, onJoin }: Props) {
  const { auth } = useAuth();
  const [nameInput, setNameInput] = useState("");
  const [avatar, setAvatar] = useState<string>(() => AVATARS[Math.floor(Math.random() * AVATARS.length)].id);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const lockedName = auth?.student
    ? (auth.student.username ?? `${auth.student.vorname} ${auth.student.nachname}`)
    : null;

  function handleSubmit() {
    const n = lockedName ?? nameInput.trim();
    if (!n) return;
    onJoin(n, avatar);
  }

  if (!mounted) return null;

  return (
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

      <div className="w-full max-w-xs flex flex-col gap-4">
        {lockedName ? (
          <>
            <div className="flex flex-col items-center gap-3">
              <AvatarDisplay avatarId={avatar} size="lg" />
              <div className="flex items-center gap-2 rounded-xl px-4 py-2 border border-white/20 bg-white/10">
                <span className="text-white font-semibold">{lockedName}</span>
                <span className="text-white/40 text-xs">eingeloggt</span>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-white/50 mb-2 text-center">Avatar wählen</p>
              <AvatarPicker selected={avatar} onSelect={(id) => setAvatar(id)} />
            </div>
          </>
        ) : (
          <>
            <input
              autoFocus
              className="w-full rounded-xl px-4 py-3 text-center text-lg font-semibold outline-none border border-white/20 bg-white/10 text-white placeholder-white/40 focus:border-indigo-400"
              placeholder="Dein Name"
              maxLength={30}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-white/50 mb-2 text-center">Avatar wählen</p>
              <AvatarPicker selected={avatar} onSelect={(id) => setAvatar(id)} />
            </div>
          </>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || (!lockedName && !nameInput.trim())}
          className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          {submitting ? "Verbinde…" : "Beitreten"}
        </button>
      </div>
    </div>
  );
}
