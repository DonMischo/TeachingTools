/**
 * useLiveSocket — die gemeinsame Live-Verbindung aller Werkzeugseiten.
 *
 * Vertrag:
 *  - Abriss (kein eigener Server-Code): neu verbinden, 1 s, 2 s, 4 s … höchstens 10 s
 *  - nach erfolgreichem Verbinden beginnt die Wartezeit wieder bei 1 s
 *  - Server-Code 4000–4999: onRejected(code), kein neuer Versuch
 *  - path null / Abbau der Seite: keine Verbindung, kein Neuversuch
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLiveSocket } from "@/hooks/useLiveSocket";

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  close = vi.fn();
  send = vi.fn();
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }
}
const sockets = MockWebSocket.instances;
const PATH = "/api/x/ws?role=teacher";

beforeEach(() => {
  vi.useFakeTimers();
  sockets.length = 0;
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useLiveSocket", () => {
  it("baut die ws-Adresse aus dem Pfad erst im Browser", () => {
    renderHook(() => useLiveSocket(PATH, () => {}));
    expect(sockets[0].url).toBe(`ws://${window.location.host}${PATH}`);
  });

  it("verbindet nach einem Abriss mit wachsendem Abstand neu", () => {
    renderHook(() => useLiveSocket(PATH, () => {}));
    expect(sockets).toHaveLength(1);

    act(() => { sockets[0].onclose?.({ code: 1006 }); });
    act(() => { vi.advanceTimersByTime(999); });
    expect(sockets).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(1); });
    expect(sockets).toHaveLength(2);
    expect(sockets[1].url).toBe(sockets[0].url);

    act(() => { sockets[1].onclose?.({ code: 1006 }); });
    act(() => { vi.advanceTimersByTime(1999); });
    expect(sockets).toHaveLength(2);
    act(() => { vi.advanceTimersByTime(1); });
    expect(sockets).toHaveLength(3);
  });

  it("beginnt nach erfolgreichem Verbinden wieder bei 1 s", () => {
    renderHook(() => useLiveSocket(PATH, () => {}));
    act(() => { sockets[0].onclose?.({ code: 1006 }); });
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { sockets[1].onclose?.({ code: 1006 }); });
    act(() => { vi.advanceTimersByTime(2000); });

    act(() => { sockets[2].onopen?.(); });
    act(() => { sockets[2].onclose?.({ code: 1006 }); });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(sockets).toHaveLength(4);
  });

  it("bleibt bei einem Code des Servers zu und meldet ihn", () => {
    const onRejected = vi.fn();
    const onClose = vi.fn();
    renderHook(() => useLiveSocket(PATH, () => {}, { onRejected, onClose }));

    act(() => { sockets[0].onclose?.({ code: 4003 }); });
    act(() => { vi.advanceTimersByTime(30_000); });

    expect(onRejected).toHaveBeenCalledWith(4003);
    expect(onClose).not.toHaveBeenCalled();
    expect(sockets).toHaveLength(1);
  });

  it("reicht Nachrichten als Objekt an den aktuellen Handler", () => {
    const erster = vi.fn();
    const zweiter = vi.fn();
    const { rerender } = renderHook(({ h }) => useLiveSocket(PATH, h), { initialProps: { h: erster } });
    rerender({ h: zweiter });

    act(() => { sockets[0].onmessage?.({ data: '{"event":"state"}' }); });

    expect(erster).not.toHaveBeenCalled();
    expect(zweiter).toHaveBeenCalledWith({ event: "state" });
  });

  it("ohne Pfad keine Verbindung, nach dem Abbau kein Neuversuch", () => {
    const { rerender, unmount } = renderHook(({ path }) => useLiveSocket(path, () => {}), {
      initialProps: { path: null as string | null },
    });
    expect(sockets).toHaveLength(0);

    rerender({ path: PATH });
    expect(sockets).toHaveLength(1);

    unmount();
    expect(sockets[0].close).toHaveBeenCalled();
    act(() => { sockets[0].onclose?.({ code: 1006 }); });
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(sockets).toHaveLength(1);
  });

  it("sendet nur über eine offene Verbindung", () => {
    const { result } = renderHook(() => useLiveSocket(PATH, () => {}));
    expect(result.current.send({ action: "start" })).toBe(false);

    sockets[0].readyState = 1;
    act(() => { sockets[0].onopen?.(); });
    expect(result.current.connected).toBe(true);
    expect(result.current.send({ action: "start" })).toBe(true);
    expect(sockets[0].send).toHaveBeenCalledWith('{"action":"start"}');
  });
});
