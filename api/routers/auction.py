from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..availability import require_capability
from ..database import get_db
from ..models import AuctionBid, AuctionSession, AuctionSet, Haus, HausMember, Student, StudentRole, Teacher, Transaction
from .haeuser import haus_total_points
from ..utils import gen_code
from ..ws_auth import ws_identity, ws_teacher
from ..ws_manager import RoomManager

router = APIRouter(prefix="/api/auction", tags=["auction"])

# Teachers + Haussprecher (keyed by house_id) live in the shared RoomManager;
# name-only spectators are tracked separately since they never receive sends.
_mgr = RoomManager()
_spectators: dict[str, dict[WebSocket, str]] = {}  # code → {ws: name}


def _spectator_names(code: str) -> list[str]:
    return list(_spectators.get(code, {}).values())


# ── Helpers ───────────────────────────────────────────────────────────────────

def _bids_list(session: AuctionSession, db: Session) -> list[dict]:
    houses = {h.id: h.name for h in db.query(Haus).all()}
    return [
        {
            "house_id": b.house_id,
            "house_name": houses.get(b.house_id, "?"),
            "amount": b.amount,
            "student_id": b.student_id,
        }
        for b in session.bids
    ]


def _state_teacher(session: AuctionSession, db: Session) -> dict:
    db.refresh(session)
    houses = {h.id: h.name for h in db.query(Haus).all()}
    winner_name = houses.get(session.winner_house_id) if session.winner_house_id else None
    return {
        "event": "state",
        "status": session.status,
        "title": session.title,
        "description": session.description,
        "prize_description": session.prize_description,
        "bids": _bids_list(session, db),
        "winner_house_id": session.winner_house_id,
        "winner_name": winner_name,
        "winning_bid": session.winning_bid,
    }


def _state_haussp(session: AuctionSession, house_id: int, db: Session) -> dict:
    db.refresh(session)
    my_bid = next((b.amount for b in session.bids if b.house_id == house_id), None)
    return {
        "event": "state",
        "status": session.status,
        "title": session.title,
        "description": session.description,
        "prize_description": session.prize_description,
        "my_bid": my_bid,
        "winner_house_id": session.winner_house_id,
        "winning_bid": session.winning_bid,
    }


def _find_student_by_name(name: str, db: Session) -> "Student | None":
    """Look up a student by full name (case-insensitive)."""
    return db.query(Student).filter(
        func.lower(Student.vorname + " " + Student.nachname) == name.strip().lower()
    ).first()


# ── REST ──────────────────────────────────────────────────────────────────────

class AuctionCreate(BaseModel):
    title: str
    description: str | None = None
    prize_description: str | None = None


class AuctionOut(BaseModel):
    id: int
    code: str
    title: str
    description: str | None
    prize_description: str | None
    status: str
    created_at: datetime
    winner_house_id: int | None
    winning_bid: int | None

    class Config:
        from_attributes = True


class AuctionSetOut(BaseModel):
    id: int
    title: str
    description: str | None
    prize_description: str | None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/info")
def game_info(code: str, db: Session = Depends(get_db)):
    """Resolve a code to its game type — used by the shared play lobby."""
    s = db.query(AuctionSession).filter_by(code=code).first()
    if s:
        return {"game": "auction", "title": s.title, "status": s.status}
    raise HTTPException(404, "Code not found")


@router.get("", response_model=list[AuctionOut])
def list_auctions(set_id: int | None = None, db: Session = Depends(get_db), current=Depends(get_current_user)):
    q = db.query(AuctionSession)
    if set_id is not None:
        q = q.filter_by(set_id=set_id)
    return q.order_by(AuctionSession.created_at.desc()).all()


@router.post("", response_model=AuctionOut, status_code=201, dependencies=[Depends(require_capability("auktion", "host"))])
def create_auction(body: AuctionCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    """Creates a reusable AuctionSet from the given content, then immediately
    starts a session from it — same request/response shape as before the
    library split, so existing callers need no changes."""
    if current.role not in ("teacher", "admin"):
        raise HTTPException(403)
    auction_set = AuctionSet(
        title=body.title, description=body.description, prize_description=body.prize_description,
        created_by=current.id,
    )
    db.add(auction_set)
    db.flush()
    session = AuctionSession(set_id=auction_set.id, code=gen_code(db, AuctionSession, length=8), created_by=current.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sets", response_model=list[AuctionSetOut])
def list_sets(db: Session = Depends(get_db), current=Depends(get_current_user)):
    """The Auction content library — open to every teacher (mirrors /api/bingo/sets)."""
    return db.query(AuctionSet).order_by(AuctionSet.created_at.desc()).all()


def create_session_from_set(db: Session, set_id: int, created_by: int) -> AuctionSession:
    """Start a fresh auction from a library set — shared by the REST endpoint
    and the Stundenplaner tool registry."""
    auction_set = db.query(AuctionSet).filter_by(id=set_id).first()
    if not auction_set:
        raise HTTPException(404, "Auktion nicht gefunden")
    session = AuctionSession(set_id=auction_set.id, code=gen_code(db, AuctionSession, length=8), created_by=created_by)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/sets/{set_id}/sessions", response_model=AuctionOut, status_code=201, dependencies=[Depends(require_capability("auktion", "host"))])
def start_session_from_set(set_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if current.role not in ("teacher", "admin"):
        raise HTTPException(403)
    return create_session_from_set(db, set_id, current.id)


@router.delete("/{code}", status_code=204)
def delete_auction(code: str, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if current.role not in ("teacher", "admin"):
        raise HTTPException(403)
    s = db.query(AuctionSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404)
    db.delete(s)
    db.commit()


# ── WebSocket ─────────────────────────────────────────────────────────────────

@router.websocket("/{code}/ws")
async def auction_ws(
    code: str, ws: WebSocket,
    role: str = "teacher", student_id: int = 0,
    token: str = "",   # anon join UUID (stored in localStorage)
    name: str = "",    # display name for anon participants
    db: Session = Depends(get_db),
):
    await ws.accept()
    session = db.query(AuctionSession).filter_by(code=code).first()
    if not session:
        await ws.close(code=4004)
        return

    house_id: int | None = None
    is_haussp = False
    is_teacher_ctrl = False  # true only for authenticated teachers who can control the auction

    if token:
        # Anon join: resolve role by name lookup
        student = _find_student_by_name(name, db)
        if student:
            sr = db.query(StudentRole).filter_by(student_id=student.id, role_type="haussprecher").first()
            if sr:
                house_id = sr.scope_id
                is_haussp = True

        _spectators.setdefault(code, {})[ws] = name
        if is_haussp:
            _mgr.add_student(code, house_id, ws)
            state = _state_haussp(session, house_id, db)
            state["is_haussprecher"] = True
            state["players"] = _spectator_names(code)
            await ws.send_json(state)
        else:
            # Spectator: receives broadcasts but cannot control
            _mgr.add_teacher(code, ws)
            state = _state_teacher(session, db)
            state["is_haussprecher"] = False
            state["players"] = _spectator_names(code)
            await ws.send_json(state)
        await _mgr.broadcast(code, {"event": "players", "players": _spectator_names(code)})

    elif role == "haussprecher":
        # Identity must come from the connection's own session cookie —
        # student_id in the query string is client-supplied and spoofable.
        identity = ws_identity(ws, db)
        if not identity or identity[0] != "student":
            await ws.send_json({"event": "error", "message": "Bitte einloggen"})
            await ws.close(code=4001)
            return
        student_id = identity[1]
        sr = db.query(StudentRole).filter_by(student_id=student_id, role_type="haussprecher").first()
        if not sr:
            await ws.send_json({"event": "error", "message": "Kein Haussprecher-Status für diesen Schüler"})
            await ws.close(code=4003)
            return
        house_id = sr.scope_id
        is_haussp = True
        _mgr.add_student(code, house_id, ws)
        await ws.send_json(_state_haussp(session, house_id, db))

    else:
        # Auction control (open/close bidding, award) only for verified teachers.
        if ws_teacher(ws, db) is None:
            await ws.send_json({"event": "error", "message": "Nur für Lehrkräfte"})
            await ws.close(code=4003)
            return
        is_teacher_ctrl = True
        _mgr.add_teacher(code, ws)
        await ws.send_json(_state_teacher(session, db))

    try:
        while True:
            data = await ws.receive_json()
            action = data.get("action")

            if is_teacher_ctrl:
                if action == "open_bidding" and session.status == "waiting":
                    session.status = "bidding"
                    db.commit()
                    await _mgr.broadcast(code, {"event": "bidding_open"})
                    await _mgr.send_teachers(code, _state_teacher(session, db))

                elif action == "close_bidding" and session.status == "bidding":
                    session.status = "closed"
                    db.commit()
                    bids = _bids_list(session, db)
                    await _mgr.broadcast(code, {"event": "bidding_closed", "bids": bids, "status": "closed"})

                elif action == "award" and session.status == "closed":
                    winner_house_id = int(data.get("house_id", 0))
                    amount = int(data.get("amount", 0))
                    if not winner_house_id or not amount:
                        continue
                    available = haus_total_points(db, winner_house_id)
                    if amount > available:
                        await ws.send_json({"event": "error", "message": f"Haus hat nur {available} Punkte verfügbar"})
                        continue
                    session.winner_house_id = winner_house_id
                    session.winning_bid = amount
                    members = db.query(HausMember).filter_by(haus_id=winner_house_id).all()
                    n = len(members)
                    if n > 0:
                        per_class = -round(amount / n)
                        for m in members:
                            db.add(Transaction(
                                teacher_id=session.created_by, class_id=m.class_id,
                                points=per_class,
                                reason=f"Punkte-Auktion: {session.title} (Gebot {amount})",
                            ))
                    db.commit()
                    houses = {h.id: h.name for h in db.query(Haus).all()}
                    await _mgr.broadcast(code, {
                        "event": "awarded",
                        "winner_house_id": winner_house_id,
                        "winner_name": houses.get(winner_house_id, "?"),
                        "winning_bid": amount,
                    })

            elif is_haussp and house_id is not None:
                if action == "bid" and session.status == "bidding":
                    amount = int(data.get("amount", 0))
                    if amount <= 0:
                        await ws.send_json({"event": "error", "message": "Gebot muss > 0 sein"})
                        continue
                    available = haus_total_points(db, house_id)
                    if amount > available:
                        await ws.send_json({"event": "error", "message": f"Euer Haus hat nur {available} Punkte verfügbar"})
                        continue
                    existing = db.query(AuctionBid).filter_by(session_id=session.id, house_id=house_id).first()
                    if existing:
                        existing.amount = amount
                        existing.submitted_at = datetime.utcnow()
                    else:
                        db.add(AuctionBid(
                            session_id=session.id, house_id=house_id,
                            student_id=student_id or None, amount=amount,
                        ))
                    db.commit()
                    db.refresh(session)
                    await ws.send_json({"event": "bid_ack", "amount": amount})
                    await _mgr.send_teachers(code, {"event": "bid_update", "bids": _bids_list(session, db)})

    except WebSocketDisconnect:
        pass
    finally:
        if token:
            _spectators.get(code, {}).pop(ws, None)
            await _mgr.broadcast(code, {"event": "players", "players": _spectator_names(code)})
        if is_haussp and house_id is not None:
            _mgr.remove_student(code, house_id)
        else:
            _mgr.remove_teacher(code, ws)
