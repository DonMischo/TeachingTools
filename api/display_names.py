"""Wie ein Schuelername das Backend verlaesst.

Grundform ist der Rufname plus abgekuerzter Nachname — »Anna B.«. Den vollen
Namen sehen nur drei:

  * die Klassenleitung dieser Klasse (``Teacher.klasse_id``),
  * die Schuelerdatenverwaltung (Admin oder das Recht »Schülerdaten«),
  * der Schueler selbst.

Alles andere — Fachlehrerlisten, Spielstaende, Ranglisten, Berichte, alles was
am Beamer landen kann — bekommt die Kurzform. Der Gedanke ist nicht, dass
»Anna B.« anonym waere (in einer Klasse ist sie es nicht), sondern dass ein
voller Klarname nicht in Zusammenhaenge geraet, die ihn nicht brauchen.

Der Rufname ist ``alias`` vor ``vorname``: der Alias ist genau dafuer da (siehe
``Student.alias``), und wo er gesetzt ist, waere der Vorname der falsche Name.

Geburtstage gehen grundsaetzlich gar nicht mehr nach draussen. Einzige
Ausnahme ist die Klassenleitung im Fenster von ±5 Tagen um den Tag herum —
gerade genug, um in der Klassenliste zu gratulieren.
"""
from datetime import date
from typing import Union

from sqlalchemy.orm import Session

from .admin_access import has_admin_feature
from .models import SchoolSettings, Student, Teacher

# Wie weit vor und nach dem Tag ein Geburtstag der Klassenleitung angezeigt wird.
BIRTHDAY_WINDOW_DAYS = 5


def rufname(s: Student) -> str:
    """Der Vorname, unter dem dieser Schueler angesprochen wird."""
    return (s.alias or s.vorname or "").strip()


def short_name(s: Student) -> str:
    """»Anna B.« — die Form, die ueberall hin darf."""
    return abbreviate_parts(rufname(s), s.nachname or "")


def full_name(s: Student) -> str:
    """»Anna Bauer« — nur fuer Klassenleitung, Schuelerdatenverwaltung, sich selbst."""
    return f"{s.vorname or ''} {s.nachname or ''}".strip()


def abbreviate_parts(vorname: str, nachname: str) -> str:
    """Vor- und Nachname zur Kurzform zusammensetzen."""
    vorname = (vorname or "").strip()
    nachname = (nachname or "").strip()
    if not nachname:
        return vorname
    if not vorname:
        return f"{nachname[:1]}."
    return f"{vorname} {nachname[:1]}."


def abbreviate_stored(name: str) -> str:
    """Einen bereits gespeicherten Anzeigenamen auf die Kurzform bringen.

    Fuer Tabellen, die den Namen als Text mitfuehren (Exit-Ticket-Antworten,
    Bingo-Karten, Wettschreiben-Teilnehmer): der Altbestand steht dort noch
    ausgeschrieben. Idempotent — »Anna B.« bleibt »Anna B.«, ein einzelner
    Name (»Gast«, ein selbst getippter Spitzname) bleibt unangetastet.
    """
    teile = (name or "").strip().split()
    if len(teile) < 2:
        return (name or "").strip()
    letzter = teile[-1]
    if len(letzter.rstrip(".")) <= 1:      # schon abgekuerzt
        return " ".join(teile)
    return " ".join(teile[:-1] + [f"{letzter[:1]}."])


def birthday_soon(bd: date | None, *, today: date | None = None,
                  days: int = BIRTHDAY_WINDOW_DAYS) -> bool:
    """Liegt dieser Geburtstag im Fenster um heute — ohne Ruecksicht aufs Jahr?

    Ueber den Jahreswechsel hinweg (30.12. ist am 3.1. noch »nah«), und der
    29.02. zaehlt in Nicht-Schaltjahren als 1.3.
    """
    if bd is None:
        return False
    today = today or date.today()
    for jahr in (today.year - 1, today.year, today.year + 1):
        try:
            dieses_jahr = bd.replace(year=jahr)
        except ValueError:                  # 29.02. in einem Nicht-Schaltjahr
            dieses_jahr = date(jahr, 3, 1)
        if abs((dieses_jahr - today).days) <= days:
            return True
    return False


class NameScope:
    """Wer fuer *diesen* Aufrufer mit vollem Namen erscheinen darf.

    Einmal pro Request bauen, dann pro Schueler befragen — die Abfrage der
    Admin-Rechte laeuft so genau einmal statt einmal je Listenzeile.
    """

    def __init__(self, db: Session, viewer: Union[Teacher, Student, None]):
        # Schulweiter Schalter, nicht personenbezogen: ist er aus, geht das
        # Geschlecht an niemanden raus — auch nicht an die Klassenleitung.
        einstellungen = db.get(SchoolSettings, 1)
        self.geschlecht_sichtbar = bool(einstellungen and einstellungen.show_geschlecht)
        self.admin = isinstance(viewer, Teacher) and viewer.role == "admin"
        self.verwaltung = self.admin or (
            isinstance(viewer, Teacher) and has_admin_feature(db, viewer, "students")
        )
        self.klasse_id = viewer.klasse_id if isinstance(viewer, Teacher) else None
        self.selbst_id = viewer.id if isinstance(viewer, Student) else None

    def full(self, s: Student | None) -> bool:
        if s is None:
            return False
        if self.verwaltung:
            return True
        if self.klasse_id is not None and s.class_id == self.klasse_id:
            return True
        return s.id == self.selbst_id

    def name(self, s: Student | None) -> str:
        if s is None:
            return ""
        return full_name(s) if self.full(s) else short_name(s)

    def klassenleitung(self, s: Student | None) -> bool:
        """Enger als :meth:`full`: nur die Klassenleitung dieser Klasse und der
        Admin. Das Recht »Schülerdaten« allein reicht hier *nicht* — wer
        Geburtsdaten fuer Kartendruck oder Import braucht, holt sie ueber die
        eigenen Endpunkte dafuer (``/api/students/card-data``)."""
        if s is None:
            return False
        return self.admin or (self.klasse_id is not None and s.class_id == self.klasse_id)

    def geschlecht(self, s: Student | None) -> str | None:
        """Das Geschlecht — nur wenn die Schule den Schalter angemacht hat."""
        if s is None or not self.geschlecht_sichtbar:
            return None
        return s.geschlecht

    def birthday(self, s: Student | None) -> date | None:
        """Das Geburtsdatum, wenn es dieser Aufrufer gerade sehen darf."""
        if s is None or not self.klassenleitung(s):
            return None
        return s.geburtsdatum if birthday_soon(s.geburtsdatum) else None


def seat_labels(students) -> dict[int, str]:
    """Sitzplanbeschriftung: Rufname allein, und nur wenn zwei denselben tragen,
    mit Initiale des Nachnamens dahinter.

    Spiegelt ``seatNameById`` in SeatingEditor.tsx — der gedruckte Plan soll
    dieselben Namen tragen wie der auf dem Bildschirm. Mehr als den Rufnamen
    braucht ein Sitzplan nicht, auch nicht fuer die Klassenleitung.
    """
    haeufig: dict[str, int] = {}
    for s in students:
        haeufig[rufname(s).lower()] = haeufig.get(rufname(s).lower(), 0) + 1
    labels: dict[int, str] = {}
    for s in students:
        ruf = rufname(s)
        doppelt = haeufig.get(ruf.lower(), 0) > 1
        labels[s.id] = f"{ruf} {s.nachname[:1]}." if doppelt and s.nachname else ruf
    return labels


def student_out(s: Student, scope: "NameScope"):
    """``StudentOut`` fuer diesen Aufrufer bauen — der einzige richtige Weg.

    Traegt die Namen in der Form ein, die der Aufrufer sehen darf, setzt
    ``display_name`` immer auf die Kurzform und laesst das Geburtsdatum weg,
    solange kein Geburtstag ansteht.
    """
    from .schemas import StudentOut          # lokal: vermeidet einen Import-Zyklus

    voll = scope.full(s)
    out = StudentOut.model_validate(s)
    out.vorname = s.vorname if voll else rufname(s)
    out.nachname = (s.nachname or "") if voll else f"{(s.nachname or '')[:1]}."
    out.display_name = short_name(s)
    out.geschlecht = scope.geschlecht(s)
    out.geburtsdatum = scope.birthday(s)
    # Nachteilsausgleich ist ein Gesundheitsdatum: nur die Klassenleitung, wie
    # im Klassen-Roster auch. Eine Vertretung braucht die Namensliste, nicht die.
    out.nta = list(s.nta or []) if scope.klassenleitung(s) else []
    # Der Benutzername traegt den vollen Nachnamen (»a.mueller42«, siehe
    # students._make_username) und haette die Abkuerzung eine Zeile weiter oben
    # gleich wieder aufgehoben. `has_credentials` sagt weiterhin, *ob* es einen
    # Zugang gibt — dafuer muss man ihn nicht lesen koennen.
    out.username = s.username if voll else None
    # Stabiler Jahrgangsschluessel fuer den Abgleich ueber Schuljahre hinweg;
    # angezeigt wird er nirgends.
    out.ak_code = s.ak_code if voll else None
    out.has_credentials = bool(s.username and s.password_hash)
    return out
