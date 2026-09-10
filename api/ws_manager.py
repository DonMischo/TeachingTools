"""
Shared in-memory WebSocket room manager for live-session tools
(Caputh, Bingo, Barometer, Exit Ticket, Auktion, ...).

A room is keyed by join code and holds any number of teacher sockets plus
students keyed by an arbitrary hashable id (student_id, participant_id,
card_id, house_id, ...). Optional per-student info dicts (name, avatar)
support player lobbies.

All send helpers swallow socket errors — a dead socket is cleaned up by the
router's disconnect handler, not mid-broadcast.
"""
from fastapi import WebSocket


class RoomManager:
    def __init__(self):
        self._teachers: dict[str, list[WebSocket]] = {}
        self._students: dict[str, dict] = {}   # code → {key: ws}
        self._info: dict[str, dict] = {}       # code → {key: info dict}

    # ── membership ──────────────────────────────────────────────────────
    def add_teacher(self, code: str, ws: WebSocket):
        self._teachers.setdefault(code, []).append(ws)

    def remove_teacher(self, code: str, ws: WebSocket):
        self._teachers[code] = [w for w in self._teachers.get(code, []) if w is not ws]

    def add_student(self, code: str, key, ws: WebSocket, info: dict | None = None):
        self._students.setdefault(code, {})[key] = ws
        if info is not None:
            self._info.setdefault(code, {})[key] = info

    def remove_student(self, code: str, key, ws: WebSocket | None = None):
        """With `ws`, only remove while that socket is still the registered one.

        A reconnect registers the new socket under the same key. When the old
        socket's disconnect handler runs afterwards, it must not take the new
        one with it — the player would silently stop receiving broadcasts."""
        if ws is not None and self._students.get(code, {}).get(key) is not ws:
            return
        self._students.get(code, {}).pop(key, None)
        self._info.get(code, {}).pop(key, None)

    # ── queries ─────────────────────────────────────────────────────────
    def student_count(self, code: str) -> int:
        return len(self._students.get(code, {}))

    def student_keys(self, code: str) -> set:
        return set(self._students.get(code, {}).keys())

    def infos(self, code: str) -> list[dict]:
        return list(self._info.get(code, {}).values())

    def is_empty(self, code: str) -> bool:
        return not self._teachers.get(code) and not self._students.get(code)

    def drop_room(self, code: str):
        self._teachers.pop(code, None)
        self._students.pop(code, None)
        self._info.pop(code, None)

    def clear(self):
        """Drop all rooms (used by tests)."""
        self._teachers.clear()
        self._students.clear()
        self._info.clear()

    # ── sending ─────────────────────────────────────────────────────────
    async def _send(self, ws: WebSocket, msg: dict):
        try:
            await ws.send_json(msg)
        except Exception:
            pass

    async def send_teachers(self, code: str, msg: dict):
        for ws in list(self._teachers.get(code, [])):
            await self._send(ws, msg)

    async def send_student(self, code: str, key, msg: dict):
        ws = self._students.get(code, {}).get(key)
        if ws:
            await self._send(ws, msg)

    async def broadcast_students(self, code: str, msg: dict):
        for ws in list(self._students.get(code, {}).values()):
            await self._send(ws, msg)

    async def broadcast(self, code: str, msg: dict):
        """Send to all teachers and all students in the room."""
        await self.send_teachers(code, msg)
        await self.broadcast_students(code, msg)

    async def close_student(self, code: str, key, close_code: int = 4000):
        """Close a student's socket and remove them from the room."""
        ws = self._students.get(code, {}).get(key)
        if ws:
            try:
                await ws.close(code=close_code)
            except Exception:
                pass
        self.remove_student(code, key)
