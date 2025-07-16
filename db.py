"""db.py – Low-level SQLite-Zugriff für die Hauspunkte-App."""
from __future__ import annotations
import sqlite3
from pathlib import Path
from typing import Iterable, Optional, Sequence, Tuple, Any, Dict

DEFAULT_DB_PATH = Path("data/housepoints.db")
SCHEMA_PATH = Path("schema.sql")


def get_connection(db_path: Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(conn: sqlite3.Connection, schema_path: Path = SCHEMA_PATH) -> None:
    with schema_path.open("r", encoding="utf-8") as f:
        schema_sql = f.read()
    conn.executescript(schema_sql)
    conn.commit()


# --- Teacher-Queries -------------------------------------------------------

def upsert_teacher(conn: sqlite3.Connection, first_name: str, last_name: str, active: int = 1) -> int:
    """Insert oder Update Teacher; return id."""
    cur = conn.execute(
        """
        INSERT INTO teachers (first_name, last_name, active)
        VALUES (?,?,?)
        ON CONFLICT(first_name, last_name) DO UPDATE SET active=excluded.active
        """,
        (first_name.strip(), last_name.strip(), int(active)),
    )
    conn.commit()
    if cur.lastrowid is not None and cur.lastrowid != 0:
        return cur.lastrowid
    # Wenn Conflict -> ID nachschlagen
    row = conn.execute(
        "SELECT id FROM teachers WHERE first_name=? AND last_name=?",
        (first_name.strip(), last_name.strip()),
    ).fetchone()
    return row["id"]


def set_teacher_active(conn: sqlite3.Connection, teacher_id: int, active: int) -> None:
    conn.execute("UPDATE teachers SET active=? WHERE id=?", (int(active), teacher_id))
    conn.commit()


def get_teachers(conn: sqlite3.Connection, only_active: bool = True) -> Sequence[sqlite3.Row]:
    sql = "SELECT id, first_name, last_name, active FROM teachers"
    if only_active:
        sql += " WHERE active=1"
    sql += " ORDER BY last_name, first_name"
    return conn.execute(sql).fetchall()


def get_teacher_by_id(conn: sqlite3.Connection, teacher_id: int) -> Optional[sqlite3.Row]:
    return conn.execute(
        "SELECT id, first_name, last_name, active FROM teachers WHERE id=?",
        (teacher_id,),
    ).fetchone()


# --- Class-Queries ---------------------------------------------------------

CLASS_CODES = [
    f"{grade}{section}" for grade in range(5, 11) for section in ("a", "b", "c")
]


def ensure_classes(conn: sqlite3.Connection) -> None:
    """Sorge dafür, dass alle Standardklassen (5a–10c) existieren."""
    for code in CLASS_CODES:
        display_name = f"Klasse {code}"
        conn.execute(
            "INSERT OR IGNORE INTO classes (code, display_name) VALUES (?,?)",
            (code, display_name),
        )
    conn.commit()


def get_classes(conn: sqlite3.Connection) -> Sequence[sqlite3.Row]:
    return conn.execute(
        "SELECT id, code, display_name FROM classes ORDER BY code"
    ).fetchall()


def get_class_by_code(conn: sqlite3.Connection, code: str) -> Optional[sqlite3.Row]:
    return conn.execute(
        "SELECT id, code, display_name FROM classes WHERE code=?",
        (code,),
    ).fetchone()


# --- Transactions ----------------------------------------------------------

def add_transaction(
    conn: sqlite3.Connection,
    *,
    teacher_id: int,
    class_id: int,
    points: int,
    reason: str = "",
) -> int:
    cur = conn.execute(
        "INSERT INTO transactions (teacher_id, class_id, points, reason) VALUES (?,?,?,?)",
        (teacher_id, class_id, points, reason.strip()),
    )
    conn.commit()
    return cur.lastrowid


def get_class_total_points(conn: sqlite3.Connection, class_id: int) -> int:
    row = conn.execute(
        "SELECT COALESCE(SUM(points),0) AS total FROM transactions WHERE class_id=?",
        (class_id,),
    ).fetchone()
    return row["total"] if row else 0


def get_all_totals(conn: sqlite3.Connection) -> Sequence[sqlite3.Row]:
    return conn.execute(
        "SELECT class_id, class_code, class_display_name, total_points FROM class_totals ORDER BY class_code"
    ).fetchall()


def get_recent_transactions(
    conn: sqlite3.Connection,
    limit: int = 50,
    class_id: Optional[int] = None,
) -> Sequence[sqlite3.Row]:
    sql = (
        "SELECT t.id, t.ts, t.points, t.reason, "
        "c.code AS class_code, "
        "te.first_name || ' ' || te.last_name AS teacher_name "
        "FROM transactions t "
        "JOIN classes c ON c.id = t.class_id "
        "JOIN teachers te ON te.id = t.teacher_id "
    )
    params: Tuple[Any, ...]
    if class_id is not None:
        sql += "WHERE t.class_id=? "
        params = (class_id,)
    else:
        params = tuple()
    sql += "ORDER BY t.ts DESC LIMIT ?"
    params = params + (limit,)
    return conn.execute(sql, params).fetchall()