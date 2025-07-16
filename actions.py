"""actions.py – Business-Logik für die Hauspunkte-App."""
from __future__ import annotations
from pathlib import Path
from typing import Optional
import pandas as pd

import db  # lokaler Import


TEACHER_CSV_PATH = Path("data/teachers.csv")


def sync_teachers_from_csv(conn, csv_path: Path = TEACHER_CSV_PATH, deactivate_missing: bool = False) -> None:
    """Liest Lehrkräfte aus CSV ein und schreibt/aktualisiert sie in der DB.

    Parameter
    ---------
    deactivate_missing: Falls True -> Lehrkräfte, die in der DB aber nicht in der CSV sind, werden auf active=0 gesetzt.
    """
    if not csv_path.exists():
        raise FileNotFoundError(f"Teacher CSV nicht gefunden: {csv_path}")

    df = pd.read_csv(csv_path, dtype=str).fillna("")
    required_cols = {"first_name", "last_name", "active"}
    missing = required_cols - set(df.columns.str.strip().str.lower())
    # robustes Mapping: normalisiere Spaltennamen
    norm_map = {c.lower().strip(): c for c in df.columns}
    if missing:
        raise ValueError(f"Fehlende Spalten in teacher CSV: {missing}")

    # Normalisierte Sicht
    df_norm = pd.DataFrame({
        "first_name": df[norm_map["first_name"]].astype(str).str.strip(),
        "last_name": df[norm_map["last_name"]].astype(str).str.strip(),
        "active": df[norm_map["active"]].astype(str).str.strip(),
    })

    # Normalisiere active zu 0/1
    df_norm["active"] = df_norm["active"].apply(lambda v: 1 if str(v).strip() in {"1", "True", "true", "ja", "JA", "Yes", "yes"} else 0)

    # Upsert alle
    seen_ids = []
    for _, row in df_norm.iterrows():
        tid = db.upsert_teacher(conn, row["first_name"], row["last_name"], row["active"])
        seen_ids.append(tid)

    if deactivate_missing:
        # Alle Lehrer, die nicht mehr in CSV sind, deaktivieren
        qmarks = ",".join("?" for _ in seen_ids) or "0"  # never empty
        conn.execute(
            f"UPDATE teachers SET active=0 WHERE id NOT IN ({qmarks})",
            seen_ids,
        )
        conn.commit()


def format_teacher_name(row) -> str:
    return f"{row['first_name']} {row['last_name']}"


def award_points(conn, teacher_id: int, class_id: int, points: int, reason: str = "") -> int:
    if points <= 0:
        raise ValueError("Punkte müssen > 0 sein (award_points).")
    return db.add_transaction(conn, teacher_id=teacher_id, class_id=class_id, points=points, reason=reason)


def deduct_points(conn, teacher_id: int, class_id: int, points: int, reason: str = "") -> int:
    if points <= 0:
        raise ValueError("Punkte müssen > 0 sein (deduct_points erwartet positive Eingabe; wird negativ gespeichert).")
    return db.add_transaction(conn, teacher_id=teacher_id, class_id=class_id, points=-points, reason=reason)


def get_totals_dataframe(conn):
    import pandas as pd
    rows = db.get_all_totals(conn)
    df = pd.DataFrame(rows, columns=["class_id", "class_code", "class_display_name", "total_points"])
    return df


def recent_log_dataframe(conn, limit: int = 50, class_id: Optional[int] = None):
    import pandas as pd
    rows = db.get_recent_transactions(conn, limit=limit, class_id=class_id)
    df = pd.DataFrame(rows, columns=["id", "ts", "points", "reason", "class_code", "teacher_name"])
    return df