import io
import json
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from ..auth import require_admin

router = APIRouter(prefix="/api/admin/style", tags=["style"])

STYLE_DIR = Path(__file__).parent.parent.parent / "data" / "style-pack"
ICONS_DIR = STYLE_DIR / "icons"
THEME_FILE = STYLE_DIR / "theme.json"

LOGO_EXTS = {".svg", ".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_ICONS = {
    "home", "caputh", "sportundspiele", "haeuser", "klassen",
    "schreibraum", "admin", "punkte", "user", "login",
}

CSS_VARS = [
    "bg", "surface", "surface-hover", "border", "text", "text-muted",
    "accent", "accent-text",
]


def _generate_favicon(logo_path: Path) -> None:
    """Generate a multi-size favicon.ico from the uploaded logo."""
    try:
        from PIL import Image
        img = Image.open(logo_path).convert("RGBA")
        # White background for formats that don't support transparency in ICO
        bg = Image.new("RGBA", img.size, (255, 255, 255, 0))
        bg.paste(img, mask=img.split()[3])
        favicon_path = STYLE_DIR / "favicon.ico"
        bg.save(favicon_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    except Exception:
        pass  # favicon generation is best-effort


def _ensure_dirs():
    STYLE_DIR.mkdir(parents=True, exist_ok=True)
    ICONS_DIR.mkdir(parents=True, exist_ok=True)


def _logo_url() -> str | None:
    for ext in LOGO_EXTS:
        if (STYLE_DIR / f"logo{ext}").exists():
            return f"/uploads/style-pack/logo{ext}"
    return None


def _available_icons() -> list[str]:
    return [n for n in ALLOWED_ICONS if (ICONS_DIR / f"{n}.svg").exists()]


def _load_theme() -> dict:
    if THEME_FILE.exists():
        try:
            return json.loads(THEME_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


# ---------------------------------------------------------------------------
# Public read — all users need this to apply the active style
# ---------------------------------------------------------------------------

@router.get("/favicon")
def get_favicon():
    """Serve the generated favicon.ico, or 404 if none uploaded yet."""
    path = STYLE_DIR / "favicon.ico"
    if not path.exists():
        raise HTTPException(404, "No favicon uploaded yet")
    return FileResponse(str(path), media_type="image/x-icon")


@router.get("/manifest")
def get_manifest():
    """Returns currently active style pack info. Public — no auth required."""
    _ensure_dirs()
    return {
        "logo": _logo_url(),
        "favicon": "/api/admin/style/favicon" if (STYLE_DIR / "favicon.ico").exists() else None,
        "icons": _available_icons(),
        "theme": _load_theme(),
    }


# ---------------------------------------------------------------------------
# Admin write endpoints
# ---------------------------------------------------------------------------

@router.post("/pack")
async def upload_style_pack(
    file: UploadFile = File(...),
    _: object = Depends(require_admin),
):
    """Upload a ZIP containing any combination of theme.json, logo.*, icons/*.svg."""
    _ensure_dirs()
    raw = await file.read()

    try:
        zf = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile:
        raise HTTPException(400, "Ungültige ZIP-Datei")

    results: dict = {"icons": [], "logo": None, "theme": False, "errors": []}

    with zf:
        for name in zf.namelist():
            parts = [p for p in name.replace("\\", "/").split("/") if p and not p.startswith(".")]
            if not parts:
                continue
            filename = parts[-1]
            stem, _, raw_ext = filename.rpartition(".")
            ext = f".{raw_ext.lower()}" if raw_ext else ""

            # ── Logo ──────────────────────────────────────────────────────
            if stem.lower() == "logo" and ext in LOGO_EXTS and len(parts) == 1:
                for old_ext in LOGO_EXTS:
                    (STYLE_DIR / f"logo{old_ext}").unlink(missing_ok=True)
                logo_path = STYLE_DIR / f"logo{ext}"
                logo_path.write_bytes(zf.read(name))
                results["logo"] = f"logo{ext}"
                _generate_favicon(logo_path)

            # ── Theme ─────────────────────────────────────────────────────
            elif filename.lower() == "theme.json":
                try:
                    parsed = json.loads(zf.read(name).decode("utf-8"))
                    # Whitelist only known CSS vars
                    clean = {k: v for k, v in parsed.items() if k in CSS_VARS and isinstance(v, str)}
                    THEME_FILE.write_text(json.dumps(clean, ensure_ascii=False, indent=2), encoding="utf-8")
                    results["theme"] = True
                except Exception as e:
                    results["errors"].append(f"theme.json: {e}")

            # ── Icons ─────────────────────────────────────────────────────
            elif (len(parts) >= 2 and parts[-2].lower() == "icons"
                  and stem.lower() in ALLOWED_ICONS and ext == ".svg"):
                data = zf.read(name)
                # Basic SVG safety: must start with <svg
                if b"<svg" not in data[:200].lower():
                    results["errors"].append(f"icons/{filename}: kein gültiges SVG")
                    continue
                (ICONS_DIR / f"{stem.lower()}.svg").write_bytes(data)
                results["icons"].append(stem.lower())

    return results


@router.post("/colors")
async def save_colors(
    body: dict,
    _: object = Depends(require_admin),
):
    """Save individual color variables (from the color editor)."""
    _ensure_dirs()
    # Whitelist CSS vars, validate hex/rgb values
    clean = {}
    for k, v in body.items():
        if k in CSS_VARS and isinstance(v, str) and len(v) < 50:
            clean[k] = v
    THEME_FILE.write_text(json.dumps(clean, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True, "saved": list(clean.keys())}


@router.delete("")
async def reset_style_pack(_: object = Depends(require_admin)):
    """Remove all custom style pack files, reverting to built-in themes."""
    _ensure_dirs()
    for ext in LOGO_EXTS:
        (STYLE_DIR / f"logo{ext}").unlink(missing_ok=True)
    (STYLE_DIR / "favicon.ico").unlink(missing_ok=True)
    THEME_FILE.unlink(missing_ok=True)
    for name in ALLOWED_ICONS:
        (ICONS_DIR / f"{name}.svg").unlink(missing_ok=True)
    return {"ok": True}
