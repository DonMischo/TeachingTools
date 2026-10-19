"use client";
/** Verweis auf eine andere Simulation — nur in der App, nicht im Schülerspieler oder Offline */
import { useEffect, useState } from "react";

export default function SimVerweis({ href, text }: { href: string; text: string }) {
  const [da, setDa] = useState(false);
  useEffect(() => { setDa(window.location.pathname.startsWith("/simulationen")); }, []);
  if (!da) return null;
  return <a className="btn-secondary py-1.5" href={href}>{text} ↗</a>;
}
