"""
Yjs CRDT WebSocket handler for Schreibraum.
Adapted from EtherStud4Kids — uses Hauspokal's AsyncSessionLocal.
"""
import logging
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from pycrdt import Doc
from sqlalchemy import select, delete

from ...database import AsyncSessionLocal
from ...models import SchreibraumParticipant, SchreibraumActionLog, SchreibraumRoom, SchreibraumDocument

log = logging.getLogger(__name__)
router = APIRouter()

# In-memory Yjs state per room (room_code → Doc)
_docs: dict[str, Doc] = {}
# Active WebSocket connections per room
_clients: dict[str, set[WebSocket]] = defaultdict(set)
# participant_id → WebSocket (for kick)
_participant_ws: dict[str, WebSocket] = {}
# track whether startup purge has run
_purge_done = False

MSG_SYNC = 0
MSG_AWARENESS = 1
SYNC_STEP1 = 0
SYNC_STEP2 = 1
SYNC_UPDATE = 2


# ---------------------------------------------------------------------------
# Binary protocol helpers (Yjs variable-length encoding)
# ---------------------------------------------------------------------------

def _enc_varint(n: int) -> bytes:
    buf = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            b |= 0x80
        buf.append(b)
        if not n:
            break
    return bytes(buf)


def _dec_varint(data: bytes, pos: int) -> tuple[int, int]:
    result = shift = 0
    while True:
        b = data[pos]; pos += 1
        result |= (b & 0x7F) << shift
        if not (b & 0x80):
            return result, pos
        shift += 7


def _enc_varbytes(data: bytes) -> bytes:
    return _enc_varint(len(data)) + data


def _dec_varbytes(data: bytes, pos: int) -> tuple[bytes, int]:
    length, pos = _dec_varint(data, pos)
    return data[pos: pos + length], pos + length


def _sync1(sv: bytes) -> bytes:
    return bytes([MSG_SYNC, SYNC_STEP1]) + _enc_varbytes(sv)


def _sync2(update: bytes) -> bytes:
    return bytes([MSG_SYNC, SYNC_STEP2]) + _enc_varbytes(update)


def _update_msg(update: bytes) -> bytes:
    return bytes([MSG_SYNC, SYNC_UPDATE]) + _enc_varbytes(update)


# ---------------------------------------------------------------------------
# Broadcast + logging helpers
# ---------------------------------------------------------------------------

async def _broadcast(room_code: str, data: bytes, exclude: WebSocket | None = None) -> None:
    dead: set[WebSocket] = set()
    for client in list(_clients.get(room_code, set())):
        if client is exclude:
            continue
        try:
            await client.send_bytes(data)
        except Exception:
            dead.add(client)
    _clients[room_code] -= dead


async def _write_log(room_id: str, name: str, action: str, detail: str | None = None) -> None:
    try:
        async with AsyncSessionLocal() as db:
            db.add(SchreibraumActionLog(room_id=room_id, participant_name=name, action=action, detail=detail))
            await db.commit()
    except Exception as e:
        log.warning("Failed to write action log: %s", e)


async def _purge_old_logs() -> None:
    """Delete action log entries older than 7 days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                delete(SchreibraumActionLog).where(SchreibraumActionLog.ts < cutoff)
            )
            await db.commit()
            if result.rowcount:
                log.info("Purged %d action log entries older than 7 days", result.rowcount)
    except Exception as e:
        log.warning("Log purge failed: %s", e)


async def kick_ws(participant_id: str) -> None:
    """Called by the REST kick endpoint to close the participant's WS."""
    ws = _participant_ws.get(participant_id)
    if ws:
        try:
            await ws.close(code=4003)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/api/schreibraum/ws/{room_code}")
async def collab_ws(ws: WebSocket, room_code: str, token: str = Query(...)):
    global _purge_done
    if not _purge_done:
        _purge_done = True
        await _purge_old_logs()

    log.info("WS connect: room=%s token=%.8s", room_code, token)
    await ws.accept()

    # Authenticate via session_token
    try:
        async with AsyncSessionLocal() as db:
            participant = (await db.execute(
                select(SchreibraumParticipant).where(
                    SchreibraumParticipant.session_token == token,
                    SchreibraumParticipant.is_kicked == False,
                )
            )).scalar_one_or_none()
    except Exception as e:
        log.error("DB auth error: %s", e)
        await ws.close(code=1011)
        return

    if not participant:
        log.warning("WS auth failed for token %.8s", token)
        await ws.close(code=4001)
        return

    room_id = participant.room_id
    participant_id = participant.id
    name = participant.name

    # Load or seed the in-memory Yjs doc
    if room_code not in _docs:
        doc = Doc()
        try:
            async with AsyncSessionLocal() as db:
                saved = (await db.execute(
                    select(SchreibraumDocument).where(SchreibraumDocument.room_id == room_id)
                )).scalar_one_or_none()
                if saved and saved.ydoc_state:
                    doc.apply_update(bytes(saved.ydoc_state))
                    log.info("Seeded doc from DB for room=%s", room_code)
        except Exception as e:
            log.warning("Could not seed doc for room=%s: %s", room_code, e)
        _docs[room_code] = doc
    else:
        doc = _docs[room_code]

    # Register connection
    _clients[room_code].add(ws)
    old_ws = _participant_ws.get(participant_id)
    if old_ws and old_ws is not ws:
        _clients[room_code].discard(old_ws)
        try:
            await old_ws.close(code=1001)
        except Exception:
            pass
    _participant_ws[participant_id] = ws
    await _write_log(room_id, name, "connect")

    # Send initial sync step 1
    try:
        await ws.send_bytes(_sync1(bytes(doc.get_state())))
    except Exception as e:
        log.error("Failed to send sync1: %s", e)
        await ws.close(code=1011)
        _clients[room_code].discard(ws)
        _participant_ws.pop(participant_id, None)
        return

    try:
        while True:
            data = await ws.receive_bytes()
            if not data:
                continue
            try:
                msg_type, pos = _dec_varint(data, 0)

                if msg_type == MSG_SYNC:
                    sync_type, pos = _dec_varint(data, pos)
                    payload, _ = _dec_varbytes(data, pos)

                    if sync_type == SYNC_STEP1:
                        update = bytes(doc.get_update(payload))
                        await ws.send_bytes(_sync2(update))

                    elif sync_type in (SYNC_STEP2, SYNC_UPDATE):
                        if payload:
                            doc.apply_update(payload)
                            # Log student edits; payload size gives rough edit magnitude
                            if not participant.is_teacher and sync_type == SYNC_UPDATE:
                                await _write_log(room_id, name, "edit", f"{len(payload)}B")
                        await _broadcast(room_code, _update_msg(payload), exclude=ws)

                elif msg_type == MSG_AWARENESS:
                    await _broadcast(room_code, data, exclude=ws)

            except Exception as e:
                log.error("Error processing message from %s: %s", name, e, exc_info=True)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.error("Unexpected WS error for %s: %s", name, e, exc_info=True)
    finally:
        _clients[room_code].discard(ws)
        _participant_ws.pop(participant_id, None)
        await _write_log(room_id, name, "disconnect")

        # Auto-cleanup temporary rooms when the last user leaves
        if not _clients.get(room_code):
            try:
                async with AsyncSessionLocal() as db:
                    room = (await db.execute(
                        select(SchreibraumRoom).where(SchreibraumRoom.code == room_code)
                    )).scalar_one_or_none()
                    if room and not room.is_permanent:
                        await db.delete(room)
                        await db.commit()
                        _docs.pop(room_code, None)
                        log.info("Cleaned up temp room %s", room_code)
            except Exception as e:
                log.warning("Could not clean up room %s: %s", room_code, e)
