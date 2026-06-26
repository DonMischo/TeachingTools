"""
Minimal async WebSocket test helper for ASGI apps.

Bypasses httpx/wsproto entirely. Uses plain asyncio queues and tasks so all
WS handlers share one event loop — cross-WebSocket broadcasts work correctly.
"""
import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any


class AsyncWsSession:
    def __init__(self):
        self._c2s: asyncio.Queue = asyncio.Queue()  # test → app
        self._s2c: asyncio.Queue = asyncio.Queue()  # app → test

    async def _receive(self) -> dict:
        return await self._c2s.get()

    async def _send(self, message: dict) -> None:
        await self._s2c.put(message)

    async def send_json(self, data: Any) -> None:
        await self._c2s.put({"type": "websocket.receive", "text": json.dumps(data)})

    async def receive_json(self) -> Any:
        while True:
            msg = await self._s2c.get()
            if msg["type"] == "websocket.send":
                text = msg.get("text")
                if text is not None:
                    return json.loads(text)
            elif msg["type"] == "websocket.close":
                raise ConnectionError(f"WebSocket closed: {msg}")


async def _run_app(app, scope, session: AsyncWsSession) -> None:
    try:
        await app(scope, session._receive, session._send)
    except Exception:
        pass


@asynccontextmanager
async def connect_ws(app, scope: dict):
    session = AsyncWsSession()

    # Queue the ASGI handshake event before the task starts reading
    await session._c2s.put({"type": "websocket.connect"})

    task = asyncio.create_task(_run_app(app, scope, session))

    # Wait for websocket.accept
    try:
        while True:
            msg = await session._s2c.get()
            if msg["type"] == "websocket.accept":
                break
            elif msg["type"] == "websocket.close":
                raise ConnectionError(f"WebSocket rejected: {msg}")
    except Exception:
        task.cancel()
        raise

    try:
        yield session
    finally:
        await session._c2s.put({"type": "websocket.disconnect", "code": 1000})
        try:
            await asyncio.wait_for(asyncio.shield(task), timeout=1.0)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            pass
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass
