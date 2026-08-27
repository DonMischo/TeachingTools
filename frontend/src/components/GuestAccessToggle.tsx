"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Teacher opt-in toggle for QR/join-link guest access on one session. Drop it next
 * to the join QR on any tool's host page: `<GuestAccessToggle tool="caputh" code={code} />`.
 * `tool` must match a key in the join-code registry (api/join_codes.py).
 *
 * `className` traegt die Schriftfarben: die Vorgabe passt auf helle Flaechen,
 * dunkle Hostansichten (Caputh-Lobby) reichen helle Toene herein.
 */
export function GuestAccessToggle({ tool, code, className = "text-sm text-gray-600 hover:text-gray-900" }: {
  tool: string;
  code: string;
  className?: string;
}) {
  const [allow, setAllow] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.guest.status(tool, code).then(r => setAllow(r.allow_guests)).catch(() => setAllow(null));
  }, [tool, code]);

  async function toggle() {
    if (allow === null || saving) return;
    setSaving(true);
    try {
      const r = await api.guest.setAllowed(tool, code, !allow);
      setAllow(r.allow_guests);
    } catch { /* keep previous state */ }
    finally { setSaving(false); }
  }

  if (allow === null) return null;

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={`flex items-center gap-2 disabled:opacity-50 ${className}`}
      title="Ob nicht angemeldete Gäste per QR/Link beitreten dürfen (60-Minuten-Zugang)"
    >
      <span
        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
        style={{ background: allow ? "#4f46e5" : "#cbd5e1" }}
      >
        <span
          className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
          style={{ transform: allow ? "translateX(18px)" : "translateX(2px)" }}
        />
      </span>
      Gäste erlauben
    </button>
  );
}
