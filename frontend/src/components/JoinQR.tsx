"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";

/**
 * QR-Code auf eine Beitritts-URL — anklickbar, um ihn bildschirmfüllend zu zeigen.
 *
 * Die QR-Codes sitzen in Seitenleisten und Panels und sind dort so klein, dass
 * die halbe Klasse aufstehen muss. Ein Klick blendet ihn deshalb groß über die
 * Seite, zum Abscannen aus der letzten Reihe.
 *
 * Die Lupe steckt hier und nicht in den elf aufrufenden Seiten, damit jeder
 * QR sie bekommt. `zoomable={false}` ist für den einen Fall gedacht, in dem der
 * QR schon in einem Button steckt (verschachtelte Buttons sind ungültig).
 */
export function JoinQR({ url, size = 90, className = "rounded-xl border border-line", zoomable = true }: {
  url: string | null | undefined;
  size?: number;
  className?: string;
  zoomable?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!url) return null;

  const qr = (
    <QRCodeSVG
      value={url}
      size={size}
      marginSize={1}
      bgColor="#ffffff"
      fgColor="#000000"
      className={className}
    />
  );

  if (!zoomable) return qr;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="QR-Code vergrößern"
        aria-label="QR-Code vergrößern"
        className="block cursor-zoom-in leading-none transition-transform hover:scale-105
          focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent"
      >
        {qr}
      </button>
      {open && <QRLightbox url={url} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * Der vergrößerte QR, per Portal direkt an <body>.
 *
 * Ohne Portal beschneidet ihn der erste Vorfahr mit `overflow: hidden` oder
 * `transform` — und genau darin stecken die QR-Codes hier meistens (Popover,
 * Panel, Dialog).
 */
function QRLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="QR-Code vergrößert"
      onClick={onClose}
      className="fixed inset-0 z-100 flex flex-col items-center justify-center gap-5 bg-black/80 p-6 cursor-zoom-out"
    >
      {/* Weißer Rahmen: viele Scanner tun sich auf dunklem Grund schwer. */}
      <div className="rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <QRCodeSVG
          value={url}
          size={1024}
          marginSize={1}
          bgColor="#ffffff"
          fgColor="#000000"
          style={{ display: "block", width: "min(78vw, 78vh)", height: "auto" }}
        />
      </div>

      <p className="max-w-[min(90vw,42rem)] break-all text-center font-mono text-sm text-white/80">
        {url}
      </p>

      <button
        type="button"
        autoFocus
        onClick={onClose}
        className="rounded-xl border border-white/30 px-5 py-2 font-bold text-white hover:bg-white/10"
      >
        Schließen
      </button>
    </div>,
    document.body,
  );
}
