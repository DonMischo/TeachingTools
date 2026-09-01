"use client";

/**
 * Bildschirm für ein abgelaufenes 60-Minuten-Gastfenster.
 *
 * Mit `onRejoin` bekommt der Gast einen Weg zurück: der abgelaufene Eintrag
 * wird verworfen und der Beitritt beginnt von vorn. Ob das klappt, entscheidet
 * weiterhin der Server — ohne Gast-Opt-in oder bei geschlossener Sitzung
 * landet der Gast auf dem entsprechenden Hinweis statt im Werkzeug.
 */
export function GuestExpired({ gameIcon = "⏰", onRejoin }: {
  gameIcon?: string;
  onRejoin?: () => void;
}) {
  return (
    <div
      style={{ minHeight: "100svh", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}
      className="flex flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <div className="text-5xl">{gameIcon}</div>
      <h1 className="text-2xl font-black text-white">Sitzung abgelaufen</h1>
      <p className="text-white/60 max-w-xs">
        Dein Gastzugang war 60&nbsp;Minuten gültig und ist jetzt abgelaufen.
        {onRejoin
          ? " Wenn deine Lehrkraft noch geöffnet hat, kannst du direkt wieder beitreten."
          : " Bitte scanne den QR-Code erneut oder frage deine Lehrkraft nach einem neuen Link."}
      </p>

      {onRejoin && (
        <button
          onClick={onRejoin}
          className="mt-2 px-6 py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          Neu beitreten
        </button>
      )}
    </div>
  );
}
