import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .database import engine
from .models import Base
from .database import get_db
from .routers import classes, teachers, transactions, auth as auth_router, setup as setup_router, capuths as capuths_router, wettkampf as wettkampf_router, haeuser as haeuser_router
from .routers.capuths import _inactivity_watchdog
from .seed import ensure_classes

app = FastAPI(title="Hauspokal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1339"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(setup_router.router)
app.include_router(auth_router.router)
app.include_router(classes.router)
app.include_router(teachers.router)
app.include_router(transactions.router)
app.include_router(capuths_router.router)
app.include_router(wettkampf_router.router)
app.include_router(haeuser_router.router)

HAUS_LOGO_DIR = Path(__file__).parent.parent / "data" / "haeuser"
HAUS_LOGO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/haeuser", StaticFiles(directory=str(HAUS_LOGO_DIR)), name="haus_logos")

GFX_DIR = Path(__file__).parent.parent / "data" / "gfx"
if GFX_DIR.exists():
    app.mount("/uploads/gfx", StaticFiles(directory=str(GFX_DIR)), name="gfx")

QUIZ_GFX_DIR = Path(__file__).parent.parent / "data" / "quizzes"
QUIZ_GFX_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/quizzes", StaticFiles(directory=str(QUIZ_GFX_DIR)), name="quiz_assets")


@app.on_event("startup")
async def startup():
    Base.metadata.create_all(bind=engine)
    ensure_classes()
    asyncio.create_task(_inactivity_watchdog(get_db))
