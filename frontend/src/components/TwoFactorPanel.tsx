"use client";

/**
 * Zwei-Faktor einrichten, abschalten, wiederherstellen.
 *
 * Hängt bewusst nicht am Login: der zweite Faktor deckt hier die zwei Stellen
 * ab, an denen ein Klartext-Passwort über die Leitung geht — der Einzelabruf
 * eines Lehrkraft-Passworts (Admin, Code bei jedem Abruf) und der Export der
 * Zugangsdaten einer Klasse (Klassenleitung, eingerichteter Faktor genügt).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";

function apiErr(e: unknown): string {
  return (e as Error)?.message ?? "Da ist etwas schiefgegangen.";
}

export default function TwoFactorPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);

  const { data: status } = useQuery({ queryKey: ["2fa-status"], queryFn: api.twoFactor.status });
  const { data: setup, refetch: startSetup, isFetching: setupLaeuft } = useQuery({
    queryKey: ["2fa-setup"], queryFn: api.twoFactor.setup, enabled: false, gcTime: 0,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["2fa-status"] });

  const activateMut = useMutation({
    mutationFn: () => api.twoFactor.activate(code.trim()),
    onSuccess: (res) => {
      setRecovery(res.recovery_codes);
      setCode("");
      invalidate();
      toast("Zwei-Faktor ist aktiv", "success");
    },
    onError: (e) => toast(apiErr(e), "error"),
  });

  const disableMut = useMutation({
    mutationFn: () => api.twoFactor.disable(password),
    onSuccess: () => {
      setPassword("");
      setRecovery(null);
      invalidate();
      toast("Zwei-Faktor abgeschaltet", "success");
    },
    onError: (e) => toast(apiErr(e), "error"),
  });

  // ── Aktiv ────────────────────────────────────────────────────────────────
  if (status?.confirmed) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          <span className="font-semibold text-[var(--ok,#1c6a56)]">✅ Aktiv.</span>{" "}
          Noch {status.recovery_left} Wiederherstellungscode(s) übrig.
        </p>
        {recovery && <RecoveryList codes={recovery} />}
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--text-muted)]">Abschalten</summary>
          <div className="flex flex-col gap-2 mt-2">
            <p className="text-xs text-[var(--text-muted)]">
              Mit dem eigenen Passwort, nicht mit einem Code — wer das Telefon verloren hat,
              käme sonst nicht mehr heran. Danach ist der Export von Zugangsdaten gesperrt.
            </p>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Dein Passwort" className="input text-sm py-2 max-w-xs"
            />
            <button
              onClick={() => disableMut.mutate()} disabled={!password || disableMut.isPending}
              className="self-start text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              Zwei-Faktor abschalten
            </button>
          </div>
        </details>
      </div>
    );
  }

  // ── Einrichtung ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--text-muted)]">
        Nötig, um Zugangsdaten mit Klartext-Passwörtern zu exportieren. Du brauchst eine
        Authenticator-App auf dem Telefon (z. B. Aegis, FreeOTP, Google Authenticator).
      </p>

      {!setup ? (
        <button
          onClick={() => startSetup()} disabled={setupLaeuft}
          className="self-start btn-primary text-sm py-2 px-4"
        >
          {setupLaeuft ? "Moment…" : "Einrichtung starten"}
        </button>
      ) : (
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div
            className="w-40 h-40 shrink-0 bg-white rounded-lg p-2 [&>svg]:w-full [&>svg]:h-full"
            dangerouslySetInnerHTML={{ __html: setup.qr_svg }}
          />
          <div className="flex flex-col gap-2 min-w-0">
            <p className="text-xs text-[var(--text-muted)]">
              QR scannen — oder den Schlüssel abtippen:
            </p>
            <code className="text-xs break-all bg-[var(--surface-hover)] rounded px-2 py-1">
              {setup.secret}
            </code>
            <label className="text-xs text-[var(--text-muted)] flex flex-col gap-1">
              Sechsstelliger Code aus der App
              <input
                value={code} onChange={e => setCode(e.target.value)}
                inputMode="numeric" maxLength={6} placeholder="123456"
                className="input text-sm py-2 w-32 font-mono tracking-widest"
              />
            </label>
            <button
              onClick={() => activateMut.mutate()}
              disabled={code.trim().length !== 6 || activateMut.isPending}
              className="self-start btn-primary text-sm py-2 px-4 disabled:opacity-50"
            >
              {activateMut.isPending ? "Prüfe…" : "Bestätigen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RecoveryList({ codes }: { codes: string[] }) {
  return (
    <div className="rounded-lg border border-[var(--warn,#86610c)] bg-[var(--surface-hover)] p-3 flex flex-col gap-2">
      <p className="text-xs font-semibold">
        ⚠️ Wiederherstellungscodes — jetzt notieren, sie werden nie wieder angezeigt.
      </p>
      <p className="text-xs text-[var(--text-muted)]">
        Jeder gilt einmal und schaltet Zwei-Faktor ab, falls das Telefon weg ist.
      </p>
      <div className="grid grid-cols-2 gap-1 font-mono text-xs">
        {codes.map(c => <span key={c}>{c}</span>)}
      </div>
    </div>
  );
}
