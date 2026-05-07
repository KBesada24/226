import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from math import ceil
from typing import Any, Optional

import bcrypt
import jwt
from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from supabase import Client, create_client


class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: Any = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


class StudentRegister(BaseModel):
    first_name: str = Field(alias="firstName", min_length=1)
    last_name: str = Field(alias="lastName", min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)
    model_config = ConfigDict(populate_by_name=True)


class StudentLogin(BaseModel):
    email: EmailStr
    password: str


class StudentUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, alias="firstName")
    last_name: Optional[str] = Field(default=None, alias="lastName")
    email: Optional[EmailStr] = None
    model_config = ConfigDict(populate_by_name=True)


class ClubCreate(BaseModel):
    name: str = Field(min_length=1)
    description: Optional[str] = None
    category: str = Field(min_length=1)
    cover_photo_url: Optional[str] = Field(default=None, alias="coverPhotoUrl")
    model_config = ConfigDict(populate_by_name=True)


class ClubUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    cover_photo_url: Optional[str] = Field(default=None, alias="coverPhotoUrl")
    model_config = ConfigDict(populate_by_name=True)


class MembershipUpdate(BaseModel):
    status: str


class EventCreate(BaseModel):
    title: str = Field(min_length=1)
    event_date: datetime = Field(alias="eventDate")
    location: str = Field(min_length=1)
    description: Optional[str] = None
    club_id: str = Field(alias="clubId")
    model_config = ConfigDict(populate_by_name=True)


class EventUpdate(BaseModel):
    title: Optional[str] = None
    event_date: Optional[datetime] = Field(default=None, alias="eventDate")
    location: Optional[str] = None
    description: Optional[str] = None
    model_config = ConfigDict(populate_by_name=True)


class AdminClubAction(BaseModel):
    action: str
    reason: Optional[str] = None


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


def env(name: str, fallback: Optional[str] = None) -> Optional[str]:
    return os.getenv(name) or (os.getenv(fallback) if fallback else None)


def get_supabase() -> Client:
    url = env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or env("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        raise AppError(500, "CONFIGURATION_ERROR", "Supabase URL and key are required")
    return create_client(url, key)


def ok(data: Any, status_code: int = 200) -> JSONResponse:
    return JSONResponse({"success": True, "data": data}, status_code=status_code)


def paginated(items: list[dict[str, Any]], total: int, page: int, limit: int) -> JSONResponse:
    return ok(
        {
            "items": items,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "totalPages": ceil(total / limit) if limit else 0,
            },
        }
    )


def row(result: Any) -> Any:
    return result.data


def single_or_none(table: str, column: str, value: Any) -> Optional[dict[str, Any]]:
    data = row(get_supabase().table(table).select("*").eq(column, value).execute())
    return data[0] if data else None


def require_found(value: Optional[dict[str, Any]], resource: str) -> dict[str, Any]:
    if not value:
        raise AppError(404, "NOT_FOUND", f"{resource} not found")
    return value


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def check_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise AppError(500, "CONFIGURATION_ERROR", "JWT_SECRET is required")
    return secret


def create_token(student: dict[str, Any]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "studentId": student["student_id"],
        "email": student["email"],
        "role": student.get("role", "student"),
        "iat": now,
        "exp": now + timedelta(hours=24),
    }
    return jwt.encode(payload, jwt_secret(), algorithm="HS256")


def current_student(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AppError(401, "AUTHENTICATION_ERROR", "Authentication required")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        raise AppError(401, "AUTHENTICATION_ERROR", "Invalid or expired token")
    student = single_or_none("students", "student_id", payload["studentId"])
    return require_found(student, "Student")


def require_self(student_id: str, actor: dict[str, Any]) -> None:
    if student_id != actor["student_id"]:
        raise AppError(403, "AUTHORIZATION_ERROR", "You can only access your own resources")


def require_university_admin(actor: dict[str, Any]) -> None:
    if actor.get("role") != "university_admin":
        raise AppError(403, "AUTHORIZATION_ERROR", "Admin access required")


def is_club_admin(club_id: str, student_id: str) -> bool:
    club = require_found(single_or_none("clubs", "club_id", club_id), "Club")
    student = single_or_none("students", "student_id", student_id)
    return bool(
        student
        and (student.get("role") == "university_admin" or club.get("admin_student_id") == student_id)
    )


def require_club_admin(club_id: str, actor: dict[str, Any]) -> None:
    if not is_club_admin(club_id, actor["student_id"]):
        raise AppError(403, "AUTHORIZATION_ERROR", "You must be the club admin")


def student_api(student: dict[str, Any]) -> dict[str, Any]:
    return {
        "studentId": student["student_id"],
        "email": student["email"],
        "firstName": student["first_name"],
        "lastName": student["last_name"],
        "createdAt": student.get("created_at"),
        "role": student.get("role", "student"),
    }


def student_summary(student: dict[str, Any]) -> dict[str, Any]:
    return {
        "studentId": student["student_id"],
        "email": student["email"],
        "firstName": student["first_name"],
        "lastName": student["last_name"],
    }


def club_summary(club: dict[str, Any]) -> dict[str, Any]:
    return {
        "clubId": club["club_id"],
        "name": club["name"],
        "description": club.get("description"),
        "category": club["category"],
        "coverPhotoUrl": club.get("cover_photo_url"),
        "adminStudentId": club.get("admin_student_id"),
        "createdAt": club.get("created_at"),
    }


def count_members(club_id: str) -> int:
    result = get_supabase().table("memberships").select("*", count="exact").eq("club_id", club_id).eq("status", "active").execute()
    return result.count or 0


def next_event(club_id: str) -> Optional[dict[str, Any]]:
    data = row(
        get_supabase()
        .table("events")
        .select("*")
        .eq("club_id", club_id)
        .gte("event_date", datetime.now(timezone.utc).isoformat())
        .order("event_date")
        .limit(1)
        .execute()
    )
    if not data:
        return None
    event = data[0]
    return {
        "eventId": event["event_id"],
        "title": event["title"],
        "eventDate": event["event_date"],
        "location": event["location"],
    }


def club_api(club: dict[str, Any], include_next: bool = False) -> dict[str, Any]:
    payload = club_summary(club)
    payload["memberCount"] = count_members(club["club_id"])
    if include_next:
        payload["nextEvent"] = next_event(club["club_id"])
    return payload


def event_api(event: dict[str, Any], include_attendees: bool = False) -> dict[str, Any]:
    club = require_found(single_or_none("clubs", "club_id", event["club_id"]), "Club")
    payload = {
        "eventId": event["event_id"],
        "title": event["title"],
        "eventDate": event["event_date"],
        "location": event["location"],
        "description": event.get("description"),
        "clubId": event["club_id"],
        "createdAt": event.get("created_at"),
        "club": {
            "clubId": club["club_id"],
            "name": club["name"],
            "category": club["category"],
        },
    }
    if include_attendees:
        result = get_supabase().table("rsvps").select("*", count="exact").eq("event_id", event["event_id"]).execute()
        payload["attendeeCount"] = result.count or 0
    return payload


def membership_api(membership: dict[str, Any]) -> dict[str, Any]:
    return {
        "studentId": membership["student_id"],
        "clubId": membership["club_id"],
        "status": membership["status"],
        "createdAt": membership.get("created_at"),
    }


def get_membership(student_id: str, club_id: str) -> Optional[dict[str, Any]]:
    data = row(
        get_supabase()
        .table("memberships")
        .select("*")
        .eq("student_id", student_id)
        .eq("club_id", club_id)
        .execute()
    )
    return data[0] if data else None


def create_membership(student_id: str, club_id: str, status: str = "pending") -> dict[str, Any]:
    existing = get_membership(student_id, club_id)
    if existing:
        if existing["status"] == "rejected":
            data = row(
                get_supabase()
                .table("memberships")
                .update({"status": status})
                .eq("student_id", student_id)
                .eq("club_id", club_id)
                .execute()
            )
            return data[0]
        raise AppError(409, "CONFLICT", "Student is already a member or has a pending request")
    return row(
        get_supabase()
        .table("memberships")
        .insert({"student_id": student_id, "club_id": club_id, "status": status})
        .execute()
    )[0]


def count_table(table: str, *filters: tuple[str, str, Any]) -> int:
    query = get_supabase().table(table).select("*", count="exact")
    for column, op, value in filters:
        if op == "eq":
            query = query.eq(column, value)
        elif op == "gte":
            query = query.gte(column, value)
        elif op == "lte":
            query = query.lte(column, value)
    result = query.execute()
    return result.count or 0


app = FastAPI(title="EagleConnect API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000").split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    body = {"success": False, "error": {"code": exc.code, "message": exc.message}}
    if exc.details is not None:
        body["error"]["details"] = exc.details
    return JSONResponse(body, status_code=exc.status_code)


@app.exception_handler(HTTPException)
async def http_error_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        {"success": False, "error": {"code": "HTTP_ERROR", "message": str(exc.detail)}},
        status_code=exc.status_code,
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        {"success": False, "error": {"code": "INTERNAL_ERROR", "message": str(exc)}},
        status_code=500,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/register")
def register(payload: StudentRegister):
    existing = single_or_none("students", "email", str(payload.email))
    if existing:
        raise AppError(409, "CONFLICT", "Email already registered")
    student = row(
        get_supabase()
        .table("students")
        .insert(
            {
                "first_name": payload.first_name,
                "last_name": payload.last_name,
                "email": str(payload.email),
                "password_hash": hash_password(payload.password),
            }
        )
        .execute()
    )[0]
    return ok(student_api(student), 201)


@app.post("/api/auth/login")
def login(payload: StudentLogin):
    student = single_or_none("students", "email", str(payload.email))
    if not student or not check_password(payload.password, student["password_hash"]):
        raise AppError(401, "AUTHENTICATION_ERROR", "Invalid email or password")
    return ok({"token": create_token(student), "student": student_api(student)})


@app.post("/api/auth/logout")
def logout(_: dict[str, Any] = Depends(current_student)):
    return ok({"message": "Logged out successfully"})


@app.get("/api/students/{student_id}")
def get_student(student_id: str, actor: dict[str, Any] = Depends(current_student)):
    require_self(student_id, actor)
    return ok(student_api(require_found(single_or_none("students", "student_id", student_id), "Student")))


@app.patch("/api/students/{student_id}")
def update_student(student_id: str, payload: StudentUpdate, actor: dict[str, Any] = Depends(current_student)):
    require_self(student_id, actor)
    updates: dict[str, Any] = {}
    if payload.first_name is not None:
        updates["first_name"] = payload.first_name
    if payload.last_name is not None:
        updates["last_name"] = payload.last_name
    if payload.email is not None:
        updates["email"] = str(payload.email)
    if not updates:
        return ok(student_api(actor))
    student = row(get_supabase().table("students").update(updates).eq("student_id", student_id).execute())[0]
    return ok(student_api(student))


@app.get("/api/students/{student_id}/memberships")
def student_memberships(student_id: str, _: dict[str, Any] = Depends(current_student)):
    memberships = row(
        get_supabase().table("memberships").select("*").eq("student_id", student_id).order("created_at", desc=True).execute()
    )
    items = []
    for membership in memberships:
        club = require_found(single_or_none("clubs", "club_id", membership["club_id"]), "Club")
        item = membership_api(membership)
        item["club"] = club_summary(club)
        items.append(item)
    return ok({"memberships": items})


@app.get("/api/clubs")
def list_clubs(category: Optional[str] = None, search: Optional[str] = None, page: int = 1, limit: int = 10):
    page = max(1, page)
    limit = min(max(1, limit), 100)
    query = get_supabase().table("clubs").select("*", count="exact").eq("status", "approved")
    if category:
        query = query.eq("category", category)
    if search:
        query = query.or_(f"name.ilike.%{search}%,description.ilike.%{search}%")
    result = query.order("created_at", desc=True).range((page - 1) * limit, page * limit - 1).execute()
    return paginated([club_api(club) for club in (result.data or [])], result.count or 0, page, limit)


@app.post("/api/clubs")
def create_club(payload: ClubCreate, actor: dict[str, Any] = Depends(current_student)):
    club = row(
        get_supabase()
        .table("clubs")
        .insert(
            {
                "name": payload.name,
                "description": payload.description,
                "category": payload.category,
                "cover_photo_url": payload.cover_photo_url,
                "admin_student_id": actor["student_id"],
                "status": "pending",
            }
        )
        .execute()
    )[0]
    create_membership(actor["student_id"], club["club_id"], "active")
    if actor.get("role") == "student":
        get_supabase().table("students").update({"role": "club_admin"}).eq("student_id", actor["student_id"]).execute()
    invite = get_or_create_invite(club["club_id"])
    data = club_api(club, include_next=True)
    data["inviteToken"] = invite["token"]
    return ok(data, 201)


@app.get("/api/clubs/{club_id}")
def get_club(club_id: str):
    return ok(club_api(require_found(single_or_none("clubs", "club_id", club_id), "Club"), include_next=True))


@app.patch("/api/clubs/{club_id}")
def update_club(club_id: str, payload: ClubUpdate, actor: dict[str, Any] = Depends(current_student)):
    require_club_admin(club_id, actor)
    updates = payload.model_dump(exclude_unset=True, by_alias=False)
    if updates:
        club = row(get_supabase().table("clubs").update(updates).eq("club_id", club_id).execute())[0]
    else:
        club = require_found(single_or_none("clubs", "club_id", club_id), "Club")
    return ok(club_api(club, include_next=True))


@app.delete("/api/clubs/{club_id}")
def delete_club(club_id: str, actor: dict[str, Any] = Depends(current_student)):
    require_club_admin(club_id, actor)
    get_supabase().table("clubs").delete().eq("club_id", club_id).execute()
    return ok({"message": "Club deleted successfully"})


@app.get("/api/clubs/{club_id}/members")
def get_members(club_id: str, status: Optional[str] = None):
    query = get_supabase().table("memberships").select("*").eq("club_id", club_id)
    if status:
        query = query.eq("status", status)
    memberships = row(query.order("created_at", desc=True).execute())
    items = []
    for membership in memberships:
        student = require_found(single_or_none("students", "student_id", membership["student_id"]), "Student")
        item = membership_api(membership)
        item["student"] = student_summary(student)
        items.append(item)
    return ok({"members": items})


@app.post("/api/clubs/{club_id}/members")
def join_club(club_id: str, actor: dict[str, Any] = Depends(current_student)):
    require_found(single_or_none("clubs", "club_id", club_id), "Club")
    return ok(membership_api(create_membership(actor["student_id"], club_id)), 201)


@app.patch("/api/clubs/{club_id}/members/{student_id}")
def update_member(club_id: str, student_id: str, payload: MembershipUpdate, actor: dict[str, Any] = Depends(current_student)):
    require_club_admin(club_id, actor)
    if payload.status not in {"active", "rejected"}:
        raise AppError(400, "VALIDATION_ERROR", "Status must be active or rejected")
    membership = row(
        get_supabase()
        .table("memberships")
        .update({"status": payload.status})
        .eq("club_id", club_id)
        .eq("student_id", student_id)
        .execute()
    )
    if not membership:
        raise AppError(404, "NOT_FOUND", "Membership not found")
    return ok(membership_api(membership[0]))


@app.delete("/api/clubs/{club_id}/members/{student_id}")
def remove_member(club_id: str, student_id: str, actor: dict[str, Any] = Depends(current_student)):
    if actor["student_id"] != student_id and not is_club_admin(club_id, actor["student_id"]):
        raise AppError(403, "AUTHORIZATION_ERROR", "You can only remove yourself or be an admin to remove members")
    get_supabase().table("memberships").delete().eq("club_id", club_id).eq("student_id", student_id).execute()
    return ok({"message": "Member removed successfully"})


def get_or_create_invite(club_id: str) -> dict[str, Any]:
    existing = single_or_none("invite_tokens", "club_id", club_id)
    if existing:
        return existing
    return row(
        get_supabase()
        .table("invite_tokens")
        .insert({"club_id": club_id, "token": secrets.token_urlsafe(24)})
        .execute()
    )[0]


@app.get("/api/clubs/{club_id}/invite")
def club_invite(club_id: str, actor: dict[str, Any] = Depends(current_student)):
    require_club_admin(club_id, actor)
    invite = get_or_create_invite(club_id)
    base_url = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")
    return ok({"inviteUrl": f"{base_url}/invites/{invite['token']}", "token": invite["token"]})


@app.post("/api/invites/{token}/join")
def join_invite(token: str, actor: dict[str, Any] = Depends(current_student)):
    invite = require_found(single_or_none("invite_tokens", "token", token), "Invite token is invalid or has expired")
    membership = create_membership(actor["student_id"], invite["club_id"], "active")
    if membership["status"] != "active":
        membership = row(
            get_supabase()
            .table("memberships")
            .update({"status": "active"})
            .eq("club_id", invite["club_id"])
            .eq("student_id", actor["student_id"])
            .execute()
        )[0]
    return ok({"clubId": invite["club_id"], "membership": membership_api(membership)})


@app.get("/api/events")
def list_events(clubId: Optional[str] = None, upcoming: Optional[bool] = None, page: int = 1, limit: int = 10):
    page = max(1, page)
    limit = min(max(1, limit), 100)
    query = get_supabase().table("events").select("*", count="exact")
    if clubId:
        query = query.eq("club_id", clubId)
    if upcoming:
        query = query.gte("event_date", datetime.now(timezone.utc).isoformat())
    result = query.order("event_date").range((page - 1) * limit, page * limit - 1).execute()
    return paginated([event_api(event) for event in (result.data or [])], result.count or 0, page, limit)


@app.post("/api/events")
def create_event(payload: EventCreate, actor: dict[str, Any] = Depends(current_student)):
    if payload.event_date <= datetime.now(payload.event_date.tzinfo or timezone.utc):
        raise AppError(400, "VALIDATION_ERROR", "Event date must be in the future")
    require_club_admin(payload.club_id, actor)
    event = row(
        get_supabase()
        .table("events")
        .insert(
            {
                "title": payload.title,
                "event_date": payload.event_date.isoformat(),
                "location": payload.location,
                "description": payload.description,
                "club_id": payload.club_id,
            }
        )
        .execute()
    )[0]
    notify_event_created(event)
    return ok(event_api(event, include_attendees=True), 201)


@app.get("/api/events/{event_id}")
def get_event(event_id: str):
    return ok(event_api(require_found(single_or_none("events", "event_id", event_id), "Event"), include_attendees=True))


@app.patch("/api/events/{event_id}")
def update_event(event_id: str, payload: EventUpdate, actor: dict[str, Any] = Depends(current_student)):
    event = require_found(single_or_none("events", "event_id", event_id), "Event")
    require_club_admin(event["club_id"], actor)
    updates = payload.model_dump(exclude_unset=True, by_alias=False)
    if "event_date" in updates and updates["event_date"] is not None:
        if updates["event_date"] <= datetime.now(updates["event_date"].tzinfo or timezone.utc):
            raise AppError(400, "VALIDATION_ERROR", "Event date must be in the future")
        updates["event_date"] = updates["event_date"].isoformat()
    if updates:
        event = row(get_supabase().table("events").update(updates).eq("event_id", event_id).execute())[0]
    return ok(event_api(event, include_attendees=True))


@app.delete("/api/events/{event_id}")
def delete_event(event_id: str, actor: dict[str, Any] = Depends(current_student)):
    event = require_found(single_or_none("events", "event_id", event_id), "Event")
    require_club_admin(event["club_id"], actor)
    get_supabase().table("events").delete().eq("event_id", event_id).execute()
    return ok({"message": "Event deleted successfully"})


@app.get("/api/events/{event_id}/rsvps")
def get_rsvps(event_id: str):
    rsvps = row(get_supabase().table("rsvps").select("*").eq("event_id", event_id).order("created_at", desc=True).execute())
    attendees = []
    for rsvp in rsvps:
        student = require_found(single_or_none("students", "student_id", rsvp["student_id"]), "Student")
        item = {"studentId": rsvp["student_id"], "eventId": rsvp["event_id"], "createdAt": rsvp.get("created_at"), "student": student_summary(student)}
        attendees.append(item)
    return ok({"attendees": attendees})


@app.post("/api/events/{event_id}/rsvps")
def create_rsvp(event_id: str, actor: dict[str, Any] = Depends(current_student)):
    require_found(single_or_none("events", "event_id", event_id), "Event")
    data = row(
        get_supabase()
        .table("rsvps")
        .select("*")
        .eq("student_id", actor["student_id"])
        .eq("event_id", event_id)
        .execute()
    )
    if data:
        raise AppError(409, "CONFLICT", "Student has already RSVP'd to this event")
    rsvp = row(get_supabase().table("rsvps").insert({"student_id": actor["student_id"], "event_id": event_id}).execute())[0]
    return ok({"studentId": rsvp["student_id"], "eventId": rsvp["event_id"], "createdAt": rsvp.get("created_at")}, 201)


@app.delete("/api/events/{event_id}/rsvps/{student_id}")
def cancel_rsvp(event_id: str, student_id: str, actor: dict[str, Any] = Depends(current_student)):
    require_self(student_id, actor)
    get_supabase().table("rsvps").delete().eq("student_id", student_id).eq("event_id", event_id).execute()
    return ok({"message": "RSVP canceled successfully"})


def notify_event_created(event: dict[str, Any]) -> None:
    memberships = row(
        get_supabase().table("memberships").select("*").eq("club_id", event["club_id"]).eq("status", "active").execute()
    )
    if not memberships:
        return
    club = require_found(single_or_none("clubs", "club_id", event["club_id"]), "Club")
    notifications = [
        {
            "student_id": member["student_id"],
            "type": "event_invite",
            "title": f"New event: {event['title']}",
            "message": f"{club['name']} created a new event.",
            "metadata": {"eventId": event["event_id"], "clubId": club["club_id"]},
        }
        for member in memberships
    ]
    get_supabase().table("notifications").insert(notifications).execute()


@app.get("/api/admin/clubs")
def admin_clubs(status: str = "pending", actor: dict[str, Any] = Depends(current_student)):
    require_university_admin(actor)
    if status not in {"pending", "approved"}:
        raise AppError(400, "VALIDATION_ERROR", 'Invalid status. Must be "pending" or "approved"')
    clubs = row(get_supabase().table("clubs").select("*").eq("status", status).order("created_at", desc=True).execute())
    items = []
    for club in clubs:
        item = {
            "clubId": club["club_id"],
            "name": club["name"],
            "description": club.get("description"),
            "category": club["category"],
            "coverPhotoUrl": club.get("cover_photo_url"),
            "adminStudentId": club.get("admin_student_id"),
            "createdAt": club.get("created_at"),
        }
        if club.get("admin_student_id"):
            admin = single_or_none("students", "student_id", club["admin_student_id"])
            if admin:
                item["adminName"] = f"{admin['first_name']} {admin['last_name']}"
                item["adminEmail"] = admin["email"]
        items.append(item)
    return ok({"clubs": items})


@app.patch("/api/admin/clubs/{club_id}")
def admin_club_action(club_id: str, payload: AdminClubAction, actor: dict[str, Any] = Depends(current_student)):
    require_university_admin(actor)
    club = require_found(single_or_none("clubs", "club_id", club_id), "Club")
    if payload.action == "approve":
        status = "approved"
        message = "Club approved successfully"
    elif payload.action == "reject":
        if not payload.reason:
            raise AppError(400, "VALIDATION_ERROR", "Reason is required when rejecting a club")
        status = "rejected"
        message = "Club rejected successfully"
    elif payload.action == "deactivate":
        status = "suspended"
        message = "Club deactivated successfully"
    else:
        raise AppError(400, "VALIDATION_ERROR", 'Action must be "approve", "reject", or "deactivate"')
    get_supabase().table("clubs").update({"status": status}).eq("club_id", club_id).execute()
    if payload.action == "approve" and club.get("admin_student_id"):
        admin = single_or_none("students", "student_id", club["admin_student_id"])
        if admin and admin.get("role") == "student":
            get_supabase().table("students").update({"role": "club_admin"}).eq("student_id", club["admin_student_id"]).execute()
    return ok({"message": message})


@app.post("/api/admin/setup-roles")
def setup_roles(actor: dict[str, Any] = Depends(current_student)):
    require_university_admin(actor)
    clubs = row(get_supabase().table("clubs").select("admin_student_id").execute())
    admin_ids = sorted({club["admin_student_id"] for club in clubs if club.get("admin_student_id")})
    updated = 0
    if admin_ids:
        students = row(get_supabase().table("students").select("student_id, role").in_("student_id", admin_ids).execute())
        to_update = [student["student_id"] for student in students if student.get("role") == "student"]
        if to_update:
            get_supabase().table("students").update({"role": "club_admin"}).in_("student_id", to_update).execute()
            updated = len(to_update)
    return ok({"totalClubs": len(clubs), "updatedAdmins": updated, "alreadyAdmins": len(admin_ids) - updated, "errors": []})


@app.get("/api/stats")
def platform_stats():
    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    thirty_days_from_now = (now + timedelta(days=30)).isoformat()
    return ok(
        {
            "totalClubs": count_table("clubs", ("status", "eq", "approved")),
            "totalMembers": count_table("memberships", ("status", "eq", "active")),
            "upcomingEvents": count_table("events", ("event_date", "gte", now.isoformat()), ("event_date", "lte", thirty_days_from_now)),
            "trends": {
                "clubsChange": count_table("clubs", ("created_at", "gte", thirty_days_ago)),
                "membersChange": count_table("memberships", ("created_at", "gte", thirty_days_ago), ("status", "eq", "active")),
                "eventsChange": count_table("events", ("created_at", "gte", thirty_days_ago)),
            },
        }
    )


@app.get("/api/stats/student/{student_id}")
def student_stats(student_id: str, actor: dict[str, Any] = Depends(current_student)):
    require_self(student_id, actor)
    memberships = row(get_supabase().table("memberships").select("*").eq("student_id", student_id).execute())
    rsvps = row(get_supabase().table("rsvps").select("*").eq("student_id", student_id).execute())
    upcoming = 0
    now = datetime.now(timezone.utc).isoformat()
    for rsvp in rsvps:
        event = single_or_none("events", "event_id", rsvp["event_id"])
        if event and event["event_date"] > now:
            upcoming += 1
    return ok({"clubCount": len([m for m in memberships if m["status"] == "active"]), "upcomingEventCount": upcoming})


@app.get("/api/notifications")
def notifications(actor: dict[str, Any] = Depends(current_student)):
    data = row(
        get_supabase().table("notifications").select("*").eq("student_id", actor["student_id"]).order("created_at", desc=True).limit(20).execute()
    )
    return ok([notification_api(item) for item in data])


def notification_api(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "notificationId": item["notification_id"],
        "studentId": item["student_id"],
        "type": item["type"],
        "title": item["title"],
        "message": item["message"],
        "read": item["read"],
        "metadata": item.get("metadata"),
        "createdAt": item.get("created_at"),
    }


@app.patch("/api/notifications/{notification_id}")
def mark_notification(notification_id: str, actor: dict[str, Any] = Depends(current_student)):
    get_supabase().table("notifications").update({"read": True}).eq("notification_id", notification_id).eq("student_id", actor["student_id"]).execute()
    return ok({"message": "Notification marked as read"})


@app.get("/api/clubs/{club_id}/messages")
def club_messages(club_id: str, _: dict[str, Any] = Depends(current_student)):
    data = row(
        get_supabase().table("messages").select("*").eq("club_id", club_id).order("created_at", desc=True).limit(50).execute()
    )
    messages = []
    for message in reversed(data):
        student = single_or_none("students", "student_id", message["student_id"])
        item = {
            "messageId": message["message_id"],
            "content": message["content"],
            "clubId": message["club_id"],
            "studentId": message["student_id"],
            "createdAt": message.get("created_at"),
        }
        if student:
            item["student"] = student_summary(student)
        messages.append(item)
    return ok(messages)


@app.post("/api/clubs/{club_id}/messages")
def create_message(club_id: str, payload: MessageCreate, actor: dict[str, Any] = Depends(current_student)):
    message = row(
        get_supabase().table("messages").insert({"club_id": club_id, "student_id": actor["student_id"], "content": payload.content}).execute()
    )[0]
    data = {
        "messageId": message["message_id"],
        "content": message["content"],
        "clubId": message["club_id"],
        "studentId": message["student_id"],
        "createdAt": message.get("created_at"),
        "student": student_summary(actor),
    }
    return ok(data, 201)


@app.get("/api/clubs/{club_id}/reviews")
def club_reviews(club_id: str, _: dict[str, Any] = Depends(current_student)):
    data = row(get_supabase().table("reviews").select("*").eq("club_id", club_id).order("created_at", desc=True).limit(20).execute())
    reviews = []
    for review in data:
        student = single_or_none("students", "student_id", review["student_id"])
        item = {
            "reviewId": review["review_id"],
            "rating": review["rating"],
            "comment": review.get("comment"),
            "clubId": review["club_id"],
            "studentId": review["student_id"],
            "createdAt": review.get("created_at"),
        }
        if student:
            item["student"] = {
                "studentId": student["student_id"],
                "firstName": student["first_name"],
                "lastName": student["last_name"],
            }
        reviews.append(item)
    return ok(reviews)


@app.post("/api/clubs/{club_id}/reviews")
def create_review(club_id: str, payload: ReviewCreate, actor: dict[str, Any] = Depends(current_student)):
    existing = row(
        get_supabase().table("reviews").select("*").eq("club_id", club_id).eq("student_id", actor["student_id"]).execute()
    )
    if existing:
        raise AppError(409, "CONFLICT", "You have already reviewed this club")
    review = row(
        get_supabase()
        .table("reviews")
        .insert({"club_id": club_id, "student_id": actor["student_id"], "rating": payload.rating, "comment": payload.comment})
        .execute()
    )[0]
    return ok(
        {
            "reviewId": review["review_id"],
            "rating": review["rating"],
            "comment": review.get("comment"),
            "clubId": review["club_id"],
            "studentId": review["student_id"],
            "createdAt": review.get("created_at"),
            "student": {"studentId": actor["student_id"], "firstName": actor["first_name"], "lastName": actor["last_name"]},
        },
        201,
    )


@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...), actor: dict[str, Any] = Depends(current_student)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise AppError(400, "VALIDATION_ERROR", "File must be an image")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise AppError(400, "VALIDATION_ERROR", "File size must be less than 5MB")
    suffix = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin"
    path = f"covers/{actor['student_id']}-{int(datetime.now(timezone.utc).timestamp() * 1000)}-{uuid.uuid4().hex}.{suffix}"
    storage = get_supabase().storage.from_("club-assets")
    storage.upload(path, content, {"content-type": file.content_type, "x-upsert": "false"})
    public_url = storage.get_public_url(path)
    return ok({"url": public_url})
