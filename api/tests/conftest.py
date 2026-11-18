"""
Shared fixtures.

Uses an in-memory SQLite database so tests need no running Postgres.
The SQLAlchemy models are compatible with SQLite for all features we use.
"""
import os
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from api.database import Base, get_db
from api.main import app
from api.models import Teacher, Class, Transaction, Student, RevokedToken, SportfestDiscipline, SportfestResult
from api.auth import hash_password

TEST_DB_URL = "sqlite:///:memory:"


@pytest.fixture(scope="session")
def engine():
    e = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=e)
    yield e
    Base.metadata.drop_all(bind=e)


@pytest.fixture()
def db(engine):
    """Fresh transaction-rolled-back session per test — nothing persists between tests.

    Patches session.commit → session.flush so that endpoint-level commits don't close
    the outer test transaction; rollback at the end undoes all writes cleanly.
    """
    connection = engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()
    session.commit = session.flush  # keep outer transaction alive

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db):
    """TestClient with the real DB dependency overridden."""
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Seeded data helpers
# ---------------------------------------------------------------------------

@pytest.fixture()
def teacher(db) -> Teacher:
    t = Teacher(first_name="Anna", last_name="Müller", active=True,
                password_hash=hash_password("secret"), role="teacher")
    db.add(t)
    db.flush()
    return t


@pytest.fixture()
def admin(db) -> Teacher:
    t = Teacher(first_name="Admin", last_name="User", active=True,
                password_hash=hash_password("admin123"), role="admin")
    db.add(t)
    db.flush()
    return t


@pytest.fixture()
def klass(db) -> Class:
    c = Class(code="5a", display_name="Klasse 5a")
    db.add(c)
    db.flush()
    return c


@pytest.fixture()
def teacher_token(client, teacher) -> str:
    r = client.post("/api/auth/login", json={"username": "Anna Müller", "password": "secret"})
    return r.json()["access_token"]


@pytest.fixture()
def admin_token(client, admin) -> str:
    r = client.post("/api/auth/login", json={"username": "Admin User", "password": "admin123"})
    return r.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def count_selects(engine):
    """count_selects("quiz_responses") -> how many SELECTs on that table ran so far.
    Guards against N+1 queries (one query per participant/question)."""
    from sqlalchemy import event
    seen: list[str] = []

    def _log(conn, cursor, statement, *args):
        if statement.lstrip().upper().startswith("SELECT"):
            seen.append(statement)

    event.listen(engine, "before_cursor_execute", _log)
    yield lambda table: sum(1 for s in seen if f"FROM {table}" in s)
    event.remove(engine, "before_cursor_execute", _log)


@pytest.fixture(autouse=True)
def _fragmente_sicherung_umleiten(tmp_path, monkeypatch):
    """Die laufende Fragmente-Sicherung schreibt in Tests nie nach data/."""
    from api import fragments_archiv
    monkeypatch.setattr(fragments_archiv, "BACKUP_BASE", tmp_path / "fragments_backup")
