"""Wem eine Sitzung gehoert: einer Klasse oder einem Kurs/WPF.

Spiel-Sitzungen (Caputh, Bingo, TaskCrawler) hingen bisher an genau einer Klasse.
Seit der A/B-Auswahl kann eine Sitzung auch nur einer Haelfte einer Klasse
gehoeren. Kurse und Wahlpflichtgruppen sind dagegen klassenuebergreifend — in einem
WPF »NaT« der Jahrgangsstufe 9 sitzen Schueler aus 9a, 9b und 9c.

Fuer die Punktevergabe heisst das: nicht die Sitzung, sondern jede beteiligte
Klasse wird einzeln bewertet. Erreichen die 9a zusammen 60 % und die 9b 45 %,
bekommt die 9a 60 % und die 9b 45 % der Maximalpunktzahl — jede Klasse ihren
eigenen vollen Anteil, nicht einen Bruchteil eines geteilten Topfes.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import Class, StudentGroup

# Gruppenarten, die ueber Klassengrenzen hinweg gehen.
CROSS_CLASS_GROUP_TYPES = ("kurs", "wahlpflicht")
# Gruppenarten, die eine Sitzung tragen duerfen. Eine A/B-Gruppe gehoert zu genau
# einer Klasse — die Punkte gehen deshalb ungeteilt an diese eine Klasse, waehrend
# ein Kurs/WPF auf mehrere aufgeteilt wird.
SESSION_GROUP_TYPES = CROSS_CLASS_GROUP_TYPES + ("ab_gruppe",)


def validate_scope(class_id: int | None, group_id: int | None) -> None:
    """Genau eines von beidem muss gesetzt sein."""
    if (class_id is None) == (group_id is None):
        raise HTTPException(422, "Bitte genau eine Klasse oder einen Kurs/WPF wählen.")


def load_group(db: Session, group_id: int) -> StudentGroup:
    g = db.get(StudentGroup, group_id)
    if not g:
        raise HTTPException(404, "Kurs/WPF nicht gefunden")
    if g.group_type not in SESSION_GROUP_TYPES:
        raise HTTPException(422, "Diese Gruppe kann keine Sitzung tragen.")
    return g


def group_class_ids(group: StudentGroup) -> list[int]:
    """Die Klassen, aus denen die Mitglieder dieser Gruppe kommen.

    Eine A/B-Gruppe haengt fest an ihrer Klasse; die gilt auch, solange noch
    niemand eingetragen ist."""
    if group.class_id is not None:
        return [group.class_id]
    return sorted({m.student.class_id for m in group.members if m.student.class_id is not None})


def scope_class_ids(db: Session, class_id: int | None, group_id: int | None) -> list[int]:
    """Alle Klassen, die dieser Geltungsbereich abdeckt."""
    if class_id is not None:
        return [class_id]
    if group_id is None:
        return []
    group = db.get(StudentGroup, group_id)
    return group_class_ids(group) if group else []


def scope_label(db: Session, class_id: int | None, group_id: int | None) -> str:
    """Kurzname fuer Listen und Berichte: »9a« bzw. »9 NaT«."""
    if class_id is not None:
        cls = db.get(Class, class_id)
        return cls.code if cls else f"Klasse {class_id}"
    if group_id is not None:
        g = db.get(StudentGroup, group_id)
        if g:
            # A/B-Gruppe: »9a A« — der blosse Name »A« sagte nichts.
            if g.class_id is not None:
                cls = db.get(Class, g.class_id)
                return f"{cls.code} {g.name}" if cls else g.name
            return f"{g.grade} {g.name}" if g.grade else g.name
        return f"Kurs {group_id}"
    return "Ohne Klasse"


def participant_class_id(
    *,
    session_class_id: int | None,
    session_group_id: int | None,
    student_class_id: int | None,
    chosen_class_id: int | None,
    allowed_class_ids: list[int] | None = None,
) -> int | None:
    """Welcher Klasse die Leistung eines Teilnehmers zugute kommt.

    Klassensitzung: immer die Klasse der Sitzung — auch fuer einen Gast, der
    zufaellig woanders angemeldet waere. Kurs/WPF: die eigene Klasse des
    angemeldeten Schuelers, sonst die beim Beitritt gewaehlte. Bleibt beides
    leer, zaehlt der Teilnehmer nirgends mit (``None``) statt still bei einer
    fremden Klasse zu landen.
    """
    if session_group_id is None:
        return session_class_id
    if student_class_id is not None:
        return student_class_id
    if chosen_class_id is not None and (allowed_class_ids is None or chosen_class_id in allowed_class_ids):
        return chosen_class_id
    # Deckt der Geltungsbereich nur eine Klasse ab (A/B-Gruppe, oder ein Kurs,
    # dessen Mitglieder alle aus einer Klasse kommen), gibt es nichts zu waehlen.
    if allowed_class_ids and len(allowed_class_ids) == 1:
        return allowed_class_ids[0]
    return None
