import random
import string
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import AuctionBid, AuctionSession, Haus, HausMember, Student, StudentRole, Teacher, Transaction

router = APIRouter(prefix="/api/auction", tags=["auction"])


def _code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


# ── Manager ──────────────────────────────────────────────────────────────────

class _AuctionManager:
    def __init__(self):
        self._teachers: dict[str, list[WebSocket]] = {}
        self._haussp: dict[str, dict[int, WebSocket]] = {}
        self._participants: dict[str, dict[WebSocket, str]] = {}  # code → {ws: name}

    def add_teacher(self, code: str, ws: WebSocket):
        self._teachers.setdefault(code, []).append(ws)

    def remove_teacher(self, code: str, ws: WebSocket):
        self._teachers[code] = [w for w in self._teachers.get(code, []) if w is not ws]

    def add_haussp(self, code: str, house_id: int, ws: WebSocket):
        self._haussp.setdefault(code, {})[house_id] = ws

    def remove_haussp(self, code: str, house_id: int):
        self._haussp.get(code, {}).pop(house_id, None)

    def connected_houses(self, code: str) -> set[int]:
        return set(self._haussp.get(code, {}).keys())

    def add_participant(self, code: str, ws: WebSocket, name: str):
        self._participants.setdefault(code, {})[ws] = name

    def remove_participant(self, code: str, ws: WebSocket):
        self._participants.get(code, {}).pop(ws, None)

    def participant_names(self, code: str) -> list[str]:
        return list(self._participants.get(code, {}).values())

    async def broadcast_teachers(self, code: str, msg: dict):
        for ws in list(self._teachers.get(code, [])):
            try:
                await ws.send_json(msg)
            except Exception:
                pass

    async def broadcast_all(self, code: str, msg: dict):
        await self.broadcast_teachers(code, msg)
        for ws in list(self._haussp.get(code, {}).values()):
            try:
                await ws.send_json(msg)
            except Exception:
                pass

    async def send_haussp(self, code: str, house_id: int, msg: dict):
        ws = self._haussp.get(code, {}).get(house_id)
        if ws:
            try:
                await ws.send_json(msg)
            except Exception:
                pass


_mgr = _AuctionManager()


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


@router.get("/info")
def game_info(code: str, db: Session = Depends(get_db)):
    """Resolve a code to its game type — used by the shared play lobby."""
    s = db.query(AuctionSession).filter_by(code=code).first()
    if s:
        return {"game": "auction", "title": s.title, "status": s.status}
    raise HTTPException(404, "Code not found")


@router.get("", response_model=list[AuctionOut])
def list_auctions(db: Session = Depends(get_db), current=Depends(get_current_user)):
    return db.query(AuctionSession).order_by(AuctionSession.created_at.desc()).all()


@router.post("", response_model=AuctionOut, status_code=201)
def create_auction(body: AuctionCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if current.role not in ("teacher", "admin"):
        raise HTTPException(403)
    session = AuctionSession(
        code=_code(), title=body.title,
        description=body.description, prize_description=body.prize_description,
        created_by=current.id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


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

        _mgr.add_participant(code, ws, name)
        if is_haussp:
            _mgr.add_haussp(code, house_id, ws)
            state = _state_haussp(session, house_id, db)
            state["is_haussprecher"] = True
            state["players"] = _mgr.participant_names(code)
            await ws.send_json(state)
        else:
            # Spectator: receives broadcasts but cannot control
            _mgr.add_teacher(code, ws)
            state = _state_teacher(session, db)
            state["is_haussprecher"] = False
            state["players"] = _mgr.participant_names(code)
            await ws.send_json(state)
        await _mgr.broadcast_all(code, {"event": "players", "players": _mgr.participant_names(code)})

    elif role == "haussprecher":
        sr = db.query(StudentRole).filter_by(student_id=student_id, role_type="haussprecher").first()
        if not sr:
            await ws.send_json({"event": "error", "message": "Kein Haussprecher-Status für diesen Schüler"})
            await ws.close(code=4003)
            return
        house_id = sr.scope_id
        is_haussp = True
        _mgr.add_haussp(code, house_id, ws)
        await ws.send_json(_state_haussp(session, house_id, db))

    else:
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
                    await _mgr.broadcast_all(code, {"event": "bidding_open"})
                    await _mgr.broadcast_teachers(code, _state_teacher(session, db))

                elif action == "close_bidding" and session.status == "bidding":
                    session.status = "closed"
                    db.commit()
                    bids = _bids_list(session, db)
                    await _mgr.broadcast_all(code, {"event": "bidding_closed", "bids": bids, "status": "closed"})

                elif action == "award" and session.status == "closed":
                    winner_house_id = int(data.get("house_id", 0))
                    amount = int(data.get("amount", 0))
                    if not winner_house_id or not amount:
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
                    await _mgr.broadcast_all(code, {
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
                    await _mgr.broadcast_teachers(code, {"event": "bid_update", "bids": _bids_list(session, db)})

    except WebSocketDisconnect:
        pass
    finally:
        if token:
            _mgr.remove_participant(code, ws)
            await _mgr.broadcast_all(code, {"event": "players", "players": _mgr.participant_names(code)})
        if is_haussp and house_id is not None:
            _mgr.remove_haussp(code, house_id)
        else:
            _mgr.remove_teacher(code, ws)
