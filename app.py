"""app.py – Streamlit UI für die Hauspunkte-App."""
from __future__ import annotations
import streamlit as st
from pathlib import Path

import db
import actions

# ---------------------------------------------------------------------------
# Seiten-Konfiguration
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="Hauspunkte",
    page_icon="✨",
    layout="wide",
    initial_sidebar_state="expanded",
)

# CSS für Kachel-Highlighting ------------------------------------------------
CUSTOM_CSS = """
<style>
.kachel-button > button {
    height: 80px;
    font-size: 1.25rem !important;
    font-weight: 600;
}
.kachel-selected > button {
    background-color: #ffeb3b !important; /* Gelb */
    color: #000 !important;
}
.kachel-positive {
    color: #2e7d32;
    font-weight: 700;
}
.kachel-negative {
    color: #c62828;
    font-weight: 700;
}
</style>
"""
st.markdown(CUSTOM_CSS, unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# DB-Verbindung initialisieren
# ---------------------------------------------------------------------------
conn = db.get_connection()
db.init_db(conn)
db.ensure_classes(conn)

# Sync-Button für Lehrerliste ------------------------------------------------
with st.sidebar:
    st.header("Lehrkraft")
    if st.button("Lehrerliste aktualisieren", type="secondary"):
        try:
            actions.sync_teachers_from_csv(conn)
            st.success("Lehrerliste aktualisiert.")
        except Exception as e:  # pylint: disable=broad-except
            st.error(f"Fehler beim Einlesen der CSV: {e}")

    # Lehrkräfte laden
    teachers = db.get_teachers(conn, only_active=True)
    teacher_map = {f"{t['first_name']} {t['last_name']}": t["id"] for t in teachers}
    teacher_name_list = list(teacher_map.keys())

    if "teacher_name" not in st.session_state and teacher_name_list:
        st.session_state["teacher_name"] = teacher_name_list[0]

    selected_teacher_name = st.selectbox("Lehrkraft auswählen", teacher_name_list, key="teacher_name")
    selected_teacher_id = teacher_map.get(selected_teacher_name)

# ---------------------------------------------------------------------------
# Klassenliste laden
# ---------------------------------------------------------------------------
classes = db.get_classes(conn)
class_code_to_id = {c["code"]: c["id"] for c in classes}

# SessionState für ausgewählte Klasse
if "selected_class_code" not in st.session_state:
    st.session_state["selected_class_code"] = classes[0]["code"] if classes else None


# Hilfsfunktion: Kachel zeichnen --------------------------------------------
def class_tile(code: str, total: int):
    selected = st.session_state.get("selected_class_code") == code
    css_class = "kachel-button kachel-selected" if selected else "kachel-button"
    label = f"{code}\n{total}"
    # Container für CSS-Klasse
    with st.container():
        btn = st.button(label, key=f"class_{code}", use_container_width=True)
        # Workaround: CSS-Klasse injizieren (Streamlit generiert Buttons -> wir style'n via markdown)
        st.markdown(f'<style>div[data-testid="stVerticalBlock"] button[key="class_{code}"] {{}} </style>', unsafe_allow_html=True)
    if btn:
        st.session_state["selected_class_code"] = code


# Hauptbereich: Klassenkacheln + Log ----------------------------------------
st.title("Hauspunkte nach Klassen")

# Gesamttabelle holen
import pandas as pd
import numpy as np

totals_df = actions.get_totals_dataframe(conn)

# Raster: 3 Spalten pro Zeile (a,b,c)
cols_per_row = 3
row_cols = st.columns(cols_per_row, gap="large")
for idx, row in totals_df.iterrows():
    col = row_cols[idx % cols_per_row]
    with col:
        class_tile(row["class_code"], int(row["total_points"]))
    if (idx + 1) % cols_per_row == 0 and (idx + 1) < len(totals_df):
        row_cols = st.columns(cols_per_row, gap="large")


# Rechts "Sidebar" (eigentlich Spalte) --------------------------------------
main_col, action_col = st.columns([3, 1], gap="large")
with action_col:
    st.subheader("Punkte verdienen")
    earn_points = st.number_input("Anzahl Punkte", min_value=1, max_value=500, value=5, step=1, key="earn_points")
    earn_reason = st.text_input("Begründung", key="earn_reason")
    if st.button("Vergeben", type="primary", key="award_button"):
        if selected_teacher_id is None:
            st.error("Bitte zuerst eine Lehrkraft auswählen.")
        else:
            class_code = st.session_state.get("selected_class_code")
            if not class_code:
                st.error("Keine Klasse ausgewählt.")
            else:
                class_id = class_code_to_id[class_code]
                try:
                    actions.award_points(conn, selected_teacher_id, class_id, int(earn_points), earn_reason)
                    st.success(f"{earn_points} Punkte an {class_code} vergeben.")
                except Exception as e:  # pylint: disable=broad-except
                    st.error(f"Fehler: {e}")

    st.divider()
    st.subheader("Punkte verlieren")
    lose_points = st.number_input("Anzahl Punkte", min_value=1, max_value=500, value=5, step=1, key="lose_points")
    lose_reason = st.text_input("Begründung", key="lose_reason")
    if st.button("Abziehen", type="secondary", key="deduct_button"):
        if selected_teacher_id is None:
            st.error("Bitte zuerst eine Lehrkraft auswählen.")
        else:
            class_code = st.session_state.get("selected_class_code")
            if not class_code:
                st.error("Keine Klasse ausgewählt.")
            else:
                class_id = class_code_to_id[class_code]
                try:
                    actions.deduct_points(conn, selected_teacher_id, class_id, int(lose_points), lose_reason)
                    st.warning(f"{lose_points} Punkte von {class_code} abgezogen.")
                except Exception as e:  # pylint: disable=broad-except
                    st.error(f"Fehler: {e}")


# Log & Punktetabelle --------------------------------------------------------
with main_col:
    st.subheader("Aktueller Punktestand")
    st.dataframe(
        totals_df.set_index("class_code")["total_points"].rename("Punkte"),
        use_container_width=True,
    )

    st.subheader("Letzte Aktionen")
    selected_class_code = st.session_state.get("selected_class_code")
    selected_class_id = class_code_to_id[selected_class_code] if selected_class_code else None
    log_df = actions.recent_log_dataframe(conn, limit=50, class_id=selected_class_id)
    st.dataframe(log_df, use_container_width=True)