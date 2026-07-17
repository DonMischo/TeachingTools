"use client";
import { QRCodeSVG } from "qrcode.react";

/** QR code linking students to a game/tool join URL. Renders nothing until the URL is known. */
export function JoinQR({ url, size = 90, className = "rounded-xl border border-[var(--border)]" }: {
  url: string | null | undefined;
  size?: number;
  className?: string;
}) {
  if (!url) return null;
  return (
    <QRCodeSVG
      value={url}
      size={size}
      marginSize={1}
      bgColor="#ffffff"
      fgColor="#000000"
      className={className}
    />
  );
}
