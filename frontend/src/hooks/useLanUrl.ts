"use client";
import { useEffect, useState } from "react";

/**
 * Returns a join URL using the host machine's LAN IP instead of localhost,
 * so QR codes work for students on the same network.
 * Falls back to window.location.origin if the LAN IP can't be determined.
 */
export function useLanUrl(path: string): string {
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/server-ip")
      .then((r) => r.json())
      .then((d) => { if (d.ip && d.ip !== "127.0.0.1") setLanIp(d.ip); })
      .catch(() => {});
  }, []);

  if (!mounted) return "";
  const origin = lanIp
    ? `${window.location.protocol}//${lanIp}:${window.location.port || (window.location.protocol === "https:" ? "443" : "80")}`
    : window.location.origin;
  return `${origin}${path}`;
}
