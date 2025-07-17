"""app.py – Hauspunkte-App (Tiles via clickable_images, Style-Upgrade, DB-Logik unverändert)."""
from __future__ import annotations

import base64
import io
from pathlib import Path
from typing import List, Optional

import pandas as pd  # ggf. für Tabellenanzeige (Streamlit nutzt es intern auch)
import streamlit as st
from PIL import Image, ImageDraw, ImageFont

# klickbare Bilder (externes Paket)
try:
    from st_clickable_images import clickable_images
except ImportError as e:
    raise RuntimeError(
        "st-clickable-images fehlt. Installiere: pip install st-clickable-images Pillow"
    ) from e

import db
import actions


# =============================================================================
# Seiten-Konfiguration
# =============================================================================
st.set_page_config(
    page_title="Hauspunkte",
    page_icon="✨",
    layout="wide",
    initial_sidebar_state="expanded",
)

# =============================================================================
# Tile-Rendering-Parameter
# =============================================================================
IMG_SIZE = 180              # komplette Kachel
INNER_IMG_MAX = 160         # Nutzergrafik max-Kante
FONT_SIZE = 16
FONT_COLOR = (245, 245, 245, 255)
BG_COLOR = (43, 43, 43, 255)                # dunkel
BG_COLOR_SELECTED = (58, 58, 58, 255)       # etwas heller
BORDER_COLOR = (80, 80, 80, 255)
BORDER_COLOR_SELECTED = (255, 235, 59, 255) # gelb
BORDER_WIDTH = 2
PADDING = 8
RADIUS = 16

ROOT = Path(__file__).parent.resolve()
DATA_DIR = ROOT / "data"
GFX_DIR = DATA_DIR / "gfx"


# =============================================================================
# Schrift (robust)
# =============================================================================
_DEF_FONT: ImageFont.ImageFont
for _fn in ("arial.ttf", "DejaVuSans.ttf", "LiberationSans-Regular.ttf"):
    try:
        _DEF_FONT = ImageFont.truetype(_fn, FONT_SIZE)
        break
    except Exception:
        continue
else:  # fallback
    _DEF_FONT = ImageFont.load_default()


# =============================================================================
# CSS (nur Rest-Styling; ursprüngliche Button-Overlays entfernt)
# =============================================================================
BASE_CSS = """
<style>
/* optional: kleiner Abstand im Grid-Container, rest Styling kommt aus PIL-Bild */
.stImage { margin: 0 !important; padding: 0 !important; }
</style>
"""
st.markdown(BASE_CSS, unsafe_allow_html=True)


# =============================================================================
# DB-Verbindung initialisieren (wie in deiner Version)
# =============================================================================
conn = db.get_connection()
db.init_db(conn)
db.ensure_classes(conn)


# =============================================================================
# Hilfsfunktionen – unverändert + ergänzt
# =============================================================================
def _calc_df_height(df, row_px: int = 34, header_px: int = 34, pad_px: int = 16) -> int:
    return header_px + (len(df) * row_px) + pad_px


def _reload_totals_df():
    """Lade Punktestände, sortiert (desc) nach total_points, dann class_code."""
    df = actions.get_totals_dataframe(conn)
    df = df.sort_values(
        by=["total_points", "class_code"],
        ascending=[False, True],
        kind="mergesort",
    )
    df.reset_index(drop=True, inplace=True)
    return df


def _img_b64_file(img_path: Path) -> Optional[str]:
    """Nur Rohdatei (nicht mehr genutzt für Tiles, aber lassen für evtl. andere Anzeigen)."""
    if not img_path.exists():
        return None
    try:
        data = img_path.read_bytes()
        return base64.b64encode(data).decode("utf-8")
    except Exception:  # robust
        return None


def _load_class_image(code: str) -> Optional[Image.Image]:
    """PNG für Klasse laden, RGBA konvertieren; None bei Fehler."""
    fp = GFX_DIR / f"{code}.png"
    if not fp.exists():
        return None
    try:
        return Image.open(fp).convert("RGBA")
    except Exception:
        return None


def _make_tile_image(code: str, points: int, selected: bool) -> Image.Image:
    """
    Baue Kachelbild: Klasse oben, Bild Mitte, Punkte unten, abgerundet, dark theme.
    """
    bg = BG_COLOR_SELECTED if selected else BG_COLOR
    border = BORDER_COLOR_SELECTED if selected else BORDER_COLOR

    # Transparentes Sheet + runde Fläche
    img = Image.new("RGBA", (IMG_SIZE, IMG_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    try:
        draw.rounded_rectangle(
            [(0, 0), (IMG_SIZE - 1, IMG_SIZE - 1)],
            radius=RADIUS,
            fill=bg,
            outline=border,
            width=BORDER_WIDTH,
        )
    except Exception:
        draw.rectangle(
            [(0, 0), (IMG_SIZE - 1, IMG_SIZE - 1)],
            fill=bg,
            outline=border,
            width=BORDER_WIDTH,
        )

    # Top label (Klasse)
    top_label = code
    bbox_top = draw.textbbox((0, 0), top_label, font=_DEF_FONT)
    top_w = bbox_top[2] - bbox_top[0]
    top_h = bbox_top[3] - bbox_top[1]
    top_x = (IMG_SIZE - top_w) // 2
    top_y = PADDING
    draw.text((top_x, top_y), top_label, font=_DEF_FONT, fill=FONT_COLOR)

    # Bottom label (Punkte)
    bottom_label = f"{points} Punkte"
    bbox_bot = draw.textbbox((0, 0), bottom_label, font=_DEF_FONT)
    bot_w = bbox_bot[2] - bbox_bot[0]
    bot_h = bbox_bot[3] - bbox_bot[1]
    bot_x = (IMG_SIZE - bot_w) // 2
    bot_y = IMG_SIZE - bot_h - PADDING
    draw.text((bot_x, bot_y), bottom_label, font=_DEF_FONT, fill=FONT_COLOR)

    # Middle region
    avail_top = top_y + top_h + PADDING
    avail_bot = bot_y - PADDING
    avail_h = max(0, avail_bot - avail_top)
    avail_w = IMG_SIZE - 2 * PADDING
    mid_h = min(avail_h, INNER_IMG_MAX)
    mid_w = min(avail_w, INNER_IMG_MAX)

    class_img = _load_class_image(code)
    if class_img is not None and mid_h > 0 and mid_w > 0:
        uw, uh = class_img.size
        scale = min(mid_w / uw, mid_h / uh, 1.0)
        nw, nh = int(uw * scale), int(uh * scale)
        class_img = class_img.resize((nw, nh))
        mx = (IMG_SIZE - nw) // 2
        my = avail_top + (mid_h - nh) // 2
        img.alpha_composite(class_img, (mx, my))
    else:
        # Platzhalter (Kürzel mittig)
        ph = top_label
        bbox_ph = draw.textbbox((0, 0), ph, font=_DEF_FONT)
        ph_w = bbox_ph[2] - bbox_ph[0]
        ph_h = bbox_ph[3] - bbox_ph[1]
        mx = (IMG_SIZE - ph_w) // 2
        my = avail_top + (mid_h - ph_h) // 2 if mid_h > 0 else (IMG_SIZE - ph_h) // 2
        draw.text((mx, my), ph, font=_DEF_FONT, fill=FONT_COLOR)

    return img


def _img_to_data_uri(image: Image.Image) -> str:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    b = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b}"


# =============================================================================
# Sidebar (unverändert aus deiner Version)
# =============================================================================
with st.sidebar:
    st.header("Lehrkraft")
    if st.button("Lehrerliste aktualisieren", type="secondary"):
        try:
            actions.sync_teachers_from_csv(conn)
            st.success("Lehrerliste aktualisiert.")
        except Exception as e:  # noqa: BLE001
            st.error(f"Fehler beim Einlesen der CSV: {e}")

    teachers = db.get_teachers(conn, only_active=True)
    teacher_map = {f"{t['first_name']} {t['last_name']}": t["id"] for t in teachers}
    teacher_name_list = list(teacher_map.keys())

    if "teacher_name" not in st.session_state and teacher_name_list:
        st.session_state["teacher_name"] = teacher_name_list[0]

    selected_teacher_name = st.selectbox("Lehrkraft auswählen", teacher_name_list, key="teacher_name")
    selected_teacher_id = teacher_map.get(selected_teacher_name)

    st.divider()
    st.subheader("Punkte verdienen")
    earn_points = st.number_input("Anzahl Punkte", min_value=1, max_value=100, value=5, step=1, key="earn_points")
    earn_reason = st.text_input("Begründung", key="earn_reason")
    if st.button("Vergeben", type="primary", key="award_button"):
        if selected_teacher_id is None:
            st.error("Bitte zuerst eine Lehrkraft auswählen.")
        else:
            class_code = st.session_state.get("selected_class_code")
            if not class_code:
                st.error("Keine Klasse ausgewählt.")
            else:
                class_row = db.get_class_by_code(conn, class_code)
                try:
                    actions.award_points(conn, selected_teacher_id, class_row["id"], int(earn_points), earn_reason)
                    st.success(f"{earn_points} Punkte an {class_code} vergeben.")
                    st.rerun()
                except Exception as e:  # noqa: BLE001
                    st.error(f"Fehler: {e}")
        st.rerun()

    st.divider()
    st.subheader("Punkte verlieren")
    lose_points = st.number_input("Anzahl Punkte", min_value=1, max_value=100, value=5, step=1, key="lose_points")
    lose_reason = st.text_input("Begründung", key="lose_reason")
    if st.button("Abziehen", type="secondary", key="deduct_button"):
        if selected_teacher_id is None:
            st.error("Bitte zuerst eine Lehrkraft auswählen.")
        else:
            class_code = st.session_state.get("selected_class_code")
            if not class_code:
                st.error("Keine Klasse ausgewählt.")
            else:
                class_row = db.get_class_by_code(conn, class_code)
                try:
                    actions.deduct_points(conn, selected_teacher_id, class_row["id"], int(lose_points), lose_reason)
                    st.warning(f"{lose_points} Punkte von {class_code} abgezogen.")
                    st.rerun()
                except Exception as e:  # noqa: BLE001
                    st.error(f"Fehler: {e}")
        st.rerun()


# =============================================================================
# Klassen laden & SessionState initialisieren (belassen wie vorher)
# =============================================================================
classes = db.get_classes(conn)
if "selected_class_code" not in st.session_state and classes:
    st.session_state["selected_class_code"] = classes[0]["code"]

# Punktestände laden
totals_df = _reload_totals_df()

# Mapping class_code -> id (aus totals_df, da sortiert & joinbar)
class_code_to_id = {row["class_code"]: row["class_id"] for _, row in totals_df.iterrows()}


# =============================================================================
# Hauptbereich
# =============================================================================
st.title("Hauspunkte nach Klassen")

# ---- clickable tiles ----
# Wir bauen die Liste der Klassen aus totals_df (damit Punktestände aktuell sind)
img_uris: List[str] = []
titles: List[str] = []
codes: List[str] = []

sel_code = st.session_state.get("selected_class_code")

for _, row in totals_df.iterrows():
    code = row["class_code"]
    pts = int(row["total_points"])
    is_sel = (code == sel_code)
    pil_img = _make_tile_image(code, pts, is_sel)
    img_uris.append(_img_to_data_uri(pil_img))
    titles.append(f"{code}: {pts} Punkte")
    codes.append(code)

# Grid-Styles (5 Spalten)
div_style = {
    "display": "grid",
    "grid-template-columns": "repeat(5, 1fr)",
    "gap": "14px",
    "justify-items": "center",
    "align-items": "start",
    "width": "100%",
}
img_style = {
    "width": f"{IMG_SIZE}px",
    "height": f"{IMG_SIZE}px",
    "object-fit": "contain",
    "margin": "0",
}

clicked = clickable_images(
    img_uris,
    titles=titles,
    div_style=div_style,
    img_style=img_style,
    key="class_tiles",
)

if 0 <= clicked < len(codes):
    st.session_state["selected_class_code"] = codes[clicked]
    st.rerun()


totals_view = totals_df.set_index("class_code")["total_points"].rename("Punkte").to_frame()
height_px = _calc_df_height(totals_view)
st.subheader("Aktueller Punktestand")
st.dataframe(
    totals_df.set_index("class_code")["total_points"].rename("Punkte"),
    use_container_width=True,
    height=height_px,
)

# st.subheader("Letzte Aktionen")
# selected_class_code = st.session_state.get("selected_class_code")
# selected_class_id = class_code_to_id.get(selected_class_code) if selected_class_code else None
# log_df = actions.recent_log_dataframe(conn, limit=50, class_id=selected_class_id)
# st.dataframe(log_df, use_container_width=True)
