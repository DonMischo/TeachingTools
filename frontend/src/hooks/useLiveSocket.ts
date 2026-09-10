"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { wsUrl } from "@/lib/utils";

type Options = {
  onOpen?: () => void;
  /** Verbindung abgerissen — ein neuer Versuch ist schon unterwegs. */
  onClose?: () => void;
  /** Der Server hat mit eigenem Code geschlossen (4000–4999); es bleibt zu. */
  onRejected?: (code: number) => void;
};

/**
 * Die Live-Verbindung eines Werkzeugs, die nach einem Abriss selbst neu verbindet.
 *
 * Handys sperren im Warteraum den Bildschirm, das WLAN bricht kurz weg, der
 * Server startet neu — bisher blieb die Seite dann stehen, bis jemand neu lud.
 * Jeder Werkzeug-Server schickt beim Verbinden den aktuellen Stand, ein
 * Wiedereinstieg holt also alles nach.
 *
 * Schließt der Server mit eigenem Code (rausgeworfen, Gast-Token abgelaufen,
 * keine Berechtigung, nicht gefunden), hilft ein neuer Versuch nicht: dann
 * kommt `onRejected(code)`, und die Verbindung bleibt zu.
 *
 * `path` ist der Pfad samt Query (`/api/…/ws?…`). Die ws(s)://-Adresse baut der
 * Hook erst im Browser zusammen — beim Server-Rendern gibt es kein `window`.
 * `path = null` heißt: keine Verbindung, etwa solange ein Gast noch nicht
 * beigetreten ist. Ein anderer `path` baut die Verbindung neu auf.
 */
export function useLiveSocket(
  path: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMessage: (msg: any) => void,
  options: Options = {},
) {
  const socketRef = useRef<WebSocket | null>(null);
  const handlers = useRef({ onMessage, ...options });
  useLayoutEffect(() => { handlers.current = { onMessage, ...options }; });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!path) return;
    let socket: WebSocket;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let stopped = false;

    function connect() {
      socket = new WebSocket(wsUrl(path!));
      socketRef.current = socket;
      socket.onopen = () => {
        attempts = 0;
        setConnected(true);
        handlers.current.onOpen?.();
      };
      socket.onmessage = (e) => handlers.current.onMessage(JSON.parse(e.data));
      socket.onclose = (e) => {
        if (stopped) return;
        setConnected(false);
        if (e.code >= 4000 && e.code < 5000) {
          handlers.current.onRejected?.(e.code);
          return;
        }
        handlers.current.onClose?.();
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 10_000));
      };
    }
    connect();

    return () => {
      stopped = true;
      clearTimeout(retry);
      socketRef.current = null;
      setConnected(false);
      socket.close();
    };
  }, [path]);

  /** Schickt `data` als JSON; `false`, wenn gerade keine Verbindung offen ist. */
  const send = useCallback((data: unknown) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(data));
    return true;
  }, []);

  return { send, connected };
}
