"use client";
/**
 * QR-Scanner für Elemon: Kamera (jsQR liest die Bilder), dazu ein Feld zum
 * Abtippen — die Kamera geht nur über https oder localhost, und nicht jedes
 * Schulgerät gibt sie frei.
 */
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { qrLesen, type QrInhalt } from "@/lib/klikk/elemon/spiel";

export default function Scanner({ code, gefunden, schliessen }: {
  /** Sitzungscode: eine abgetippte Zahl gilt als Spieler-ID in dieser Sitzung */
  code?: string;
  gefunden: (q: QrInhalt) => void;
  schliessen: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [eingabe, setEingabe] = useState("");
  const fertig = useRef(false);

  useEffect(() => {
    let strom: MediaStream | null = null, raf = 0, aus = false;
    const leinwand = document.createElement("canvas");
    const ctx = leinwand.getContext("2d", { willReadFrequently: true });
    if (!navigator.mediaDevices?.getUserMedia) {
      setFehler("Die Kamera geht hier nicht (nur über https). Tipp den Code unten ab.");
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(s => {
      if (aus) { s.getTracks().forEach(t => t.stop()); return; }
      strom = s;
      const v = video.current!;
      v.srcObject = s;
      v.play().catch(() => {});
      const lesen = () => {
        if (aus || fertig.current) return;
        if (v.readyState >= 2 && ctx && v.videoWidth) {
          leinwand.width = v.videoWidth; leinwand.height = v.videoHeight;
          ctx.drawImage(v, 0, 0);
          const bild = ctx.getImageData(0, 0, leinwand.width, leinwand.height);
          const qr = jsQR(bild.data, bild.width, bild.height, { inversionAttempts: "dontInvert" });
          const inhalt = qr ? qrLesen(qr.data) : null;
          if (inhalt) { fertig.current = true; gefunden(inhalt); return; }
          if (qr) setFehler("Das ist kein Elemon-Code.");
        }
        raf = requestAnimationFrame(lesen);
      };
      raf = requestAnimationFrame(lesen);
    }).catch(() => setFehler("Kein Zugriff auf die Kamera. Tipp den Code unten ab."));
    return () => { aus = true; cancelAnimationFrame(raf); strom?.getTracks().forEach(t => t.stop()); };
  }, [gefunden]);

  const abgetippt = () => {
    const t = eingabe.trim();
    const inhalt = qrLesen(t) ?? (code && /^\d{1,9}$/.test(t) ? { art: "spieler" as const, code, id: Number(t) } : null);
    if (inhalt) gefunden(inhalt); else setFehler("Den Code kenne ich nicht.");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4" role="dialog" aria-label="QR-Code scannen">
      <div className="card p-3 w-full max-w-sm flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <b>📷 QR-Code scannen</b>
          <button className="text-sm underline text-muted" onClick={schliessen}>Schließen</button>
        </div>
        <video ref={video} className="w-full aspect-square object-cover rounded-lg bg-black" muted playsInline />
        <p className="text-xs text-muted">Halte die Kamera auf den Code einer Mitspielerin, eines Mitspielers oder auf eine Elemon-Karte.</p>
        {fehler && <p className="text-xs text-bad">{fehler}</p>}
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); abgetippt(); }}>
          <input className="input flex-1 text-sm" value={eingabe} onChange={e => setEingabe(e.target.value)} placeholder="Spieler-Nr. oder Kartencode" aria-label="Code abtippen" />
          <button className="btn-secondary text-sm">OK</button>
        </form>
      </div>
    </div>
  );
}
