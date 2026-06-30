from datetime import datetime
from pydantic import BaseModel


class RoomCreate(BaseModel):
    title: str
    mode: str = "next-free-line"
    is_permanent: bool = True


class RoomPatch(BaseModel):
    title: str | None = None
    mode: str | None = None
    is_permanent: bool | None = None


class AccessGrantIn(BaseModel):
    student_id: int | None = None
    class_id: int | None = None


class AccessGrantOut(BaseModel):
    id: int
    room_id: str
    student_id: int | None = None
    class_id: int | None = None
    label: str = ""

    model_config = {"from_attributes": True}


class RoomOut(BaseModel):
    id: str
    code: str
    title: str
    mode: str
    is_permanent: bool
    created_by: int
    creator_name: str
    created_at: datetime
    access: list[AccessGrantOut] = []

    model_config = {"from_attributes": True}


class ParticipantOut(BaseModel):
    id: str
    room_id: str
    name: str
    color: str
    session_token: str
    is_teacher: bool
    is_kicked: bool
    rejoin_allowed: bool
    joined_at: datetime

    model_config = {"from_attributes": True}


class ActionLogOut(BaseModel):
    id: str
    room_id: str
    participant_name: str
    action: str
    detail: str | None = None
    ts: datetime

    model_config = {"from_attributes": True}
