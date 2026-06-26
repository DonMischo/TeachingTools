from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Transaction, Teacher, Class
from ..schemas import TransactionCreate, TransactionOut
from ..auth import get_current_teacher

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(
    body: TransactionCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    if body.points == 0:
        raise HTTPException(status_code=422, detail="Points must not be zero")
    if body.teacher_id != current.id and current.role != "admin":
        raise HTTPException(status_code=403, detail="Can only record transactions for yourself")

    cls = db.get(Class, body.class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    tx = Transaction(
        teacher_id=body.teacher_id,
        class_id=body.class_id,
        points=body.points,
        reason=body.reason,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return TransactionOut(
        id=tx.id,
        ts=tx.ts,
        points=tx.points,
        reason=tx.reason,
        class_code=tx.class_.code,
        teacher_name=f"{tx.teacher.first_name} {tx.teacher.last_name}",
    )


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    class_id: int | None = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Transaction).order_by(Transaction.ts.desc(), Transaction.id.desc())
    if class_id is not None:
        q = q.filter(Transaction.class_id == class_id)
    rows = q.limit(limit).all()
    return [
        TransactionOut(
            id=r.id,
            ts=r.ts,
            points=r.points,
            reason=r.reason,
            class_code=r.class_.code,
            teacher_name=f"{r.teacher.first_name} {r.teacher.last_name}",
        )
        for r in rows
    ]
