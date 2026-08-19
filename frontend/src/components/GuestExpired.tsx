"use client";

/** Hard-block screen shown when a guest's 60-minute session has expired. There is
 * deliberately NO rejoin — the guest must get a fresh QR/link from the teacher. */
export function GuestExpired({ gameIcon = "⏰" }: { gameIcon?: string }) {
  return (
    <div
      style={{ minHeight: "100svh", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}
      className="flex flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <div className="text-5xl">{gameIcon}</div>
      <h1 className="text-2xl font-black text-white">Sitzung abgelaufen</h1>
      <p className="text-white/60 max-w-xs">
        Dein Gastzugang war 60&nbsp;Minuten gültig und ist jetzt abgelaufen. Bitte
        scanne den QR-Code erneut oder frage deine Lehrkraft nach einem neuen Link.
      </p>
    </div>
  );
}
