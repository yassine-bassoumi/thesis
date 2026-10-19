from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Request, Query, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import aiofiles
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timedelta, timezone, date
from fastapi.responses import FileResponse
import mimetypes
from jose import JWTError, jwt
import os
import uuid
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
from bson import ObjectId
import hashlib
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# =============================================================================
# CONFIG
# =============================================================================

SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 6

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Collaborator Task Platform")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

security = HTTPBearer()

# =============================================================================
# DATA MODELS - WITH PERSISTENT NOTIFICATIONS
# =============================================================================


class UserRole(str):
    MANAGER = "manager"
    COLLABORATOR = "collaborator"


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str


class UserCreate(UserBase):
    password: str


class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: User


class TaskStatus(str):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    NOT_EVALUATED = "not_evaluated"


class TaskPriority(str):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TaskBase(BaseModel):
    title: str
    description: str
    assignee_id: str
    due_date: datetime
    priority: str = TaskPriority.MEDIUM


class TaskCreate(TaskBase):
    pass


class Task(TaskBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    creator_id: str
    status: str = TaskStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    attachments: List[str] = []
    completion_evidence: List[str] = []
    completion_notes: Optional[str] = None

    # Evaluation fields (latest evaluation applied on the task)
    punctuality_score: Optional[int] = None
    quality_score: Optional[int] = None
    performance_rating: Optional[float] = None
    feedback: Optional[str] = None
    evaluation_date: Optional[datetime] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    assignee_id: Optional[str] = None
    status: Optional[str] = None

    # Used internally when we want to force-sync evaluation fields
    punctuality_score: Optional[int] = None
    quality_score: Optional[int] = None
    performance_rating: Optional[float] = None
    feedback: Optional[str] = None
    evaluation_date: Optional[datetime] = None


class PerformanceBase(BaseModel):
    task_id: str
    collaborator_id: str
    punctuality_score: int = Field(ge=1, le=5)
    quality_score: int = Field(ge=1, le=5)
    comments: Optional[str] = None


class PerformanceCreate(PerformanceBase):
    pass


class Performance(PerformanceBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    evaluator_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Notifications


class NotificationBase(BaseModel):
    type: str
    title: str
    message: str
    user_id: str
    is_read: bool = False
    is_archived: bool = False
    metadata: Optional[Dict[str, Any]] = None


class NotificationCreate(NotificationBase):
    pass


class Notification(NotificationBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationUpdate(BaseModel):
    is_read: Optional[bool] = None
    is_archived: Optional[bool] = None


def notification_helper(notification) -> dict:
    return {
        "id": str(notification["_id"]),
        "type": notification["type"],
        "title": notification["title"],
        "message": notification["message"],
        "user_id": notification["user_id"],
        "is_read": notification.get("is_read", False),
        "is_archived": notification.get("is_archived", False),
        "metadata": notification.get("metadata", {}),
        "created_at": notification["created_at"],
    }


# Task Templates


class TaskTemplateBase(BaseModel):
    name: str
    description: str
    default_priority: str = TaskPriority.MEDIUM
    estimated_duration_hours: int = 1
    category: str = "general"


class TaskTemplateCreate(TaskTemplateBase):
    pass


class TaskTemplate(TaskTemplateBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    creator_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    usage_count: int = 0


class InstantiateTemplateRequest(BaseModel):
    assignee_id: str
    due_date: datetime


# Meetings


class MeetingCreate(BaseModel):
    title: str
    description: str
    meeting_date: datetime  # le front envoie "YYYY-MM-DD" -> FastAPI le parse en datetime (00:00)
    start_time: str  # "HH:MM"
    end_time: str  # "HH:MM"
    location: Optional[str] = "Virtual"
    meeting_type: str = "team_meeting"
    participant_ids: List[str]


class Meeting(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    meeting_date: str  # "YYYY-MM-DD" (toujours string côté API)
    start_time: str  # "HH:MM"
    end_time: str  # "HH:MM"
    location: Optional[str] = "Virtual"
    meeting_type: str = "team_meeting"
    organizer_id: str
    participant_ids: List[str]
    participant_responses: Dict[str, str] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "pending"


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    meeting_date: Optional[datetime] = None  # front envoie "YYYY-MM-DD" -> parse en datetime
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    participant_ids: Optional[List[str]] = None


class MeetingResponse(BaseModel):
    response: Literal["accept", "decline"]


# =============================================================================
# NOTIFICATION SERVICES
# =============================================================================


class NotificationService:
    """Service for creating persistent notifications"""

    @staticmethod
    async def create_task_notification(user_id: str, task_data: dict, notification_type: str):
        """Create task-related notifications (English only)."""
        try:
            notification_templates = {
                # Task related
                "task_created": {
                    "title": "📝 New Task Created",
                    "message": f'Task "{task_data.get("title", "Untitled")}" has been created.',
                },
                "task_assigned": {
                    "title": "🎯 New Task Assignment",
                    "message": f'You have been assigned to task "{task_data.get("title", "Untitled")}".',
                },
                "task_updated": {
                    "title": "📝 Task Updated",
                    "message": f'Task "{task_data.get("title", "Untitled")}" has been updated.',
                },
                "task_deleted": {
                    "title": "🗑️ Task Deleted",
                    "message": f'Task "{task_data.get("title", "Untitled")}" has been deleted.',
                },
                "task_completed": {
                    "title": "✅ Task Completed",
                    "message": f'Task "{task_data.get("title", "Untitled")}" has been completed.',
                },
                "task_in_progress": {
                    "title": "▶️ Task Started",
                    "message": f'Task "{task_data.get("title", "Untitled")}" has been started.',
                },
                "task_pending": {
                    "title": "⏸️ Task Pending",
                    "message": f'Task "{task_data.get("title", "Untitled")}" is pending.',
                },
                "task_not_evaluated": {
                    "title": "⏳ Awaiting Evaluation",
                    "message": f'Task "{task_data.get("title", "Untitled")}" is completed and waiting for evaluation.',
                },
                # Evaluation
                "evaluation_completed": {
                    "title": "⭐ Evaluation Completed",
                    "message": f'The performance for task "{task_data.get("title", "Untitled")}" has been evaluated.',
                },
                "evaluation_updated": {
                    "title": "⭐ Evaluation Updated",
                    "message": f'The performance evaluation for task "{task_data.get("title", "Untitled")}" has been updated.',
                },
                "performance_review": {
                    "title": "📊 Performance Review",
                    "message": "A new performance review is available.",
                },
                # Meetings
                "meeting_scheduled": {
                    "title": "📅 Meeting Scheduled",
                    "message": f'Meeting "{task_data.get("title", "Untitled")}" has been scheduled.',
                },
                "meeting_updated": {
                    "title": "📅 Meeting Updated",
                    "message": f'Meeting "{task_data.get("title", "Untitled")}" has been updated.',
                },
                "meeting_cancelled": {
                    "title": "❌ Meeting Cancelled",
                    "message": f'Meeting "{task_data.get("title", "Untitled")}" has been cancelled.',
                },
                "meeting_invitation": {
                    "title": "📨 Meeting Invitation",
                    "message": f'You have been invited to meeting "{task_data.get("title", "Untitled")}".',
                },
                # Reminders
                "deadline_reminder": {
                    "title": "⏰ Deadline Reminder",
                    "message": f'Task "{task_data.get("title", "Untitled")}" deadline is approaching.',
                },
                "overdue": {
                    "title": "🔴 Task Overdue",
                    "message": f'Task "{task_data.get("title", "Untitled")}" is overdue.',
                },
            }

            template = notification_templates.get(
                notification_type,
                {"title": "🔔 Notification", "message": "You have a new notification."},
            )

            current_time = datetime.now(timezone.utc)

            notification_data = {
                "user_id": user_id,
                "type": notification_type,
                "title": template["title"],
                "message": template["message"],
                "is_read": False,
                "is_archived": False,
                "metadata": {
                    "task_id": task_data.get("id"),
                    "task_title": task_data.get("title"),
                    "created_at": current_time.isoformat(),
                },
                "created_at": current_time,
            }

            await db.notifications.insert_one(notification_data)
            print(
                f"✅ Notification created: {notification_type} for user {user_id} at {current_time}"
            )

        except Exception as e:
            print(f"❌ Error creating notification: {str(e)}")

    @staticmethod
    async def create_meeting_notification(user_id: str, meeting_data: dict, notification_type: str):
        """Create notification for meeting actions """

        notification_templates = {
            "meeting_scheduled": {
                "title": "📅 Meeting Scheduled",
                "message": f"Meeting '{meeting_data.get('title', 'Unknown')}' has been scheduled",
            },
            "meeting_updated": {
                "title": "📅 Meeting Updated",
                "message": f"Meeting '{meeting_data.get('title', 'Unknown')}' has been updated",
            },
            "meeting_cancelled": {
                "title": "❌ Meeting Cancelled",
                "message": f"Meeting '{meeting_data.get('title', 'Unknown')}' has been cancelled",
            },
            "meeting_invitation": {
                "title": "📨 Meeting Invitation",
                "message": f"You've been invited to: '{meeting_data.get('title', 'Unknown')}'",
            },
            "meeting_response": {
                "title": "📨 Meeting Response",
                "message": f"Someone responded to your meeting: '{meeting_data.get('title', 'Unknown')}'",
            },
        }

        template = notification_templates.get(
            notification_type,
            {"title": "🔔 Notification", "message": "You have a new notification"},
        )

        notification_data = {
            "_id": ObjectId(),
            "type": notification_type,
            "title": template["title"],
            "message": template["message"],
            "user_id": user_id,
            "is_read": False,
            "is_archived": False,
            "metadata": {
                "meeting_id": meeting_data.get("id"),
                "meeting_title": meeting_data.get("title"),
                "timestamp": datetime.utcnow().isoformat(),
            },
            "created_at": datetime.utcnow(),
        }

        try:
            await db.notifications.insert_one(notification_data)
            print(f"✅ Meeting notification created for {user_id}: {template['title']}")
            return notification_data
        except Exception as e:
            print(f"❌ Error creating meeting notification: {str(e)}")
            return None


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================


def is_task_already_evaluated(task: dict) -> bool:
    """
    Return True if the task already has an evaluation.
    Used to distinguish first evaluation vs re-evaluation.
    """
    if not task:
        return False

    fields = [
        "punctuality_score",
        "quality_score",
        "performance_rating",
        "feedback",
        "evaluation_date",
    ]

    for field in fields:
        value = task.get(field)
        if value is None:
            continue
        # Numeric fields: 0 or below = no evaluation
        if isinstance(value, (int, float)) and value <= 0:
            continue
        # String fields: empty string = no evaluation
        if isinstance(value, str) and not value.strip():
            continue

        return True

    return False


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify if a password matches the stored hash."""
    try:
        salt, stored_hash = hashed_password.split(":")
        password_hash = hashlib.sha256((plain_password + salt).encode()).hexdigest()
        return password_hash == stored_hash
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Hash password with salt using SHA-256 (for demo only)."""
    salt = secrets.token_hex(16)
    password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}:{password_hash}"


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from JWT."""
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise credentials_exception

    user = clean_mongo_id(user)
    user = parse_from_mongo(user)

    return User(**user)


async def get_user_from_token_query(token: str) -> dict:
    """
    Décoder le token passé en query (?token=...) et retourner l'utilisateur.
    Utilisé pour sécuriser le téléchargement d'évidence.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_role(allowed_roles: List[str]):
    """Dependency factory to require a specific user role."""

    def decorator(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return current_user

    return decorator


async def check_meeting_conflicts(
    meeting_date: str,
    start_time: str,
    end_time: str,
    participant_ids: List[str],
    exclude_meeting_id: str = None,
):
    """
    Check for meeting time conflicts on a given day
    for a set of participants (including organizers).
    """
    conflicts: List[dict] = []

    # On force "YYYY-MM-DD"
    meeting_date_str = str(meeting_date)[:10]

    print(f"🔍 Checking conflicts for date: {meeting_date_str}, time: {start_time}-{end_time}")
    print(f"🔍 Participants (and organizers) to check: {participant_ids}")
    print(f"🔍 Excluding meeting: {exclude_meeting_id}")

    for participant_id in participant_ids:
        query: Dict[str, Any] = {
            "meeting_date": meeting_date_str,
            "status": {"$in": ["pending", "accepted", "partially_accepted"]},
            "$or": [
                {"participant_ids": participant_id},
                {"organizer_id": participant_id},
            ],
        }

        if exclude_meeting_id:
            query["id"] = {"$ne": exclude_meeting_id}

        existing_meetings = await db.meetings.find(query).to_list(length=None)
        print(f"🔍 Found {len(existing_meetings)} existing meetings for user {participant_id}")

        for existing_meeting in existing_meetings:
            existing_start = existing_meeting["start_time"]
            existing_end = existing_meeting["end_time"]

            # Overlap simple en HH:MM
            if start_time < existing_end and end_time > existing_start:
                user = await db.users.find_one({"id": participant_id})
                user_name = user.get("full_name", "Unknown") if user else "Unknown"

                conflict_info = {
                    "participant_name": user_name,
                    "participant_id": participant_id,
                    "conflicting_meeting": existing_meeting["title"],
                    "existing_time": f"{existing_start}-{existing_end}",
                    "conflicting_meeting_id": existing_meeting["id"],
                }
                conflicts.append(conflict_info)
                print(f"❌ Conflict detected: {conflict_info}")

    return conflicts if conflicts else None


def format_conflict_message(conflicts: List[dict]) -> str:
    """Format user-friendly conflict message."""
    if not conflicts:
        return ""
    conflict_list = []
    for conflict in conflicts:
        conflict_list.append(
            f"{conflict['participant_name']} has a meeting '{conflict['conflicting_meeting']}' "
            f"at {conflict['existing_time']}"
        )
    return "Schedule conflicts detected:\n• " + "\n• ".join(conflict_list)


def clean_mongo_id(item: dict) -> dict:
    """Remove MongoDB _id from a document."""
    if item and "_id" in item:
        del item["_id"]
    return item


def prepare_for_mongo(data: dict) -> dict:
    """Prepare data for MongoDB (convert datetimes to strings where needed)."""
    if not data:
        return data

    datetime_fields = [
        "created_at",
        "due_date",
        "completed_at",
        "updated_at",
        "evaluation_date",
        "start_time",
        "end_time",
    ]

    for field in datetime_fields:
        if isinstance(data.get(field), datetime):
            if field in ["start_time", "end_time"]:
                data[field] = data[field].strftime("%H:%M")
            else:
                data[field] = data[field].isoformat()

    return data


def parse_from_mongo(data):
    """Parse MongoDB document into JSON-serializable python structure."""
    if not data:
        return data

    if isinstance(data, list):
        return [parse_from_mongo(item) for item in data]

    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            if key == "_id":
                result[key] = str(value)
            elif key in ["created_at", "due_date", "completed_at", "updated_at", "evaluation_date"] and isinstance(value, str):
                try:
                    result[key] = datetime.fromisoformat(value.replace("Z", "+00:00"))
                except (ValueError, AttributeError):
                    result[key] = value
            elif key in ["created_at", "due_date", "completed_at", "updated_at", "evaluation_date"] and isinstance(value, datetime):
                result[key] = value
            elif key == "meeting_date" and isinstance(value, str):
                result[key] = value
            elif key in ["start_time", "end_time"] and isinstance(value, str):
                result[key] = value
            else:
                result[key] = parse_from_mongo(value)
        return result

    return data


def build_file_response(file_path: Path, filename: str, disposition: str = "attachment") -> FileResponse:
    """Helper pour renvoyer un fichier avec Content-Disposition correct."""
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    mime_type, _ = mimetypes.guess_type(str(file_path))
    if not mime_type:
        mime_type = "application/octet-stream"

    response = FileResponse(
        path=file_path,
        media_type=mime_type,
        filename=filename,
    )
    response.headers["Content-Disposition"] = f'{disposition}; filename="{filename}"'
    return response


def normalize_meeting_date_to_str(raw_md) -> str:
    """
    Reçoit un datetime, date ou str, renvoie toujours une string 'YYYY-MM-DD'.
    """
    if isinstance(raw_md, datetime):
        meeting_date_obj = raw_md.date()
    elif isinstance(raw_md, date):
        meeting_date_obj = raw_md
    else:
        # si c'est déjà une string / autre, on prend les 10 premiers caractères 'YYYY-MM-DD'
        meeting_date_obj = datetime.strptime(str(raw_md)[:10], "%Y-%m-%d").date()

    return meeting_date_obj.isoformat()  # 'YYYY-MM-DD'


# =============================================================================
# AUTH ROUTES
# =============================================================================


@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user_data.password)
    user = User(**user_data.dict())
    user_dict = user.dict()
    user_dict["password"] = hashed_password

    user_dict = prepare_for_mongo(user_dict)
    await db.users.insert_one(user_dict)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.id}, expires_delta=access_token_expires)

    return {"access_token": access_token, "token_type": "bearer", "user": user}


@app.post("/api/auth/login", response_model=Token)
async def login(user_credentials: UserLogin):
    user_data = await db.users.find_one({"email": user_credentials.email})
    if not user_data or not verify_password(user_credentials.password, user_data["password"]):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_data = clean_mongo_id(user_data)
    user_data = parse_from_mongo(user_data)
    user = User(**{k: v for k, v in user_data.items() if k != "password"})

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.id}, expires_delta=access_token_expires)

    return {"access_token": access_token, "token_type": "bearer", "user": user}


# =============================================================================
# USER ROUTES
# =============================================================================


@app.get("/api/users/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/api/users")
async def get_users(current_user: User = Depends(require_role(["manager"]))):
    users = await db.users.find().to_list(length=None)
    cleaned_users = []
    for user in users:
        user = clean_mongo_id(user)
        user = parse_from_mongo(user)
        user_dict = {k: v for k, v in user.items() if k != "password"}
        cleaned_users.append(user_dict)
    return cleaned_users


@app.get("/api/users/team")
async def get_team_members(current_user: User = Depends(require_role(["manager"]))):
    """Get all collaborators belonging to the team."""
    try:
        print(f"👥 Fetching team for manager: {current_user.id}")

        collaborators = await db.users.find({"role": "collaborator"}).to_list(length=None)

        cleaned_collaborators = []
        for user in collaborators:
            user = clean_mongo_id(user)
            user = parse_from_mongo(user)
            user_dict = {k: v for k, v in user.items() if k != "password"}
            cleaned_collaborators.append(user_dict)

        print(f"✅ Team members found: {len(cleaned_collaborators)}")
        return cleaned_collaborators

    except Exception as e:
        print(f"❌ Error in get_team_members: {e}")
        return []


# =============================================================================
# PERSISTENT NOTIFICATIONS ROUTES
# =============================================================================


@app.get("/api/notifications")
async def get_user_notifications(current_user: User = Depends(get_current_user)):
    """Get all non-archived notifications for the current user."""
    try:
        print(f"🔔 Fetching notifications for user: {current_user.id}")

        notifications = []
        async for notification in db.notifications.find(
            {"user_id": current_user.id, "is_archived": False}
        ).sort("created_at", -1):
            notifications.append(notification_helper(notification))

        print(f"✅ Found {len(notifications)} notifications for user {current_user.id}")
        return notifications

    except Exception as e:
        print(f"❌ Error fetching notifications: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching notifications: {str(e)}")


@app.post("/api/notifications")
async def create_notification(
    notification: NotificationCreate, current_user: User = Depends(get_current_user)
):
    """Create a new notification (mostly used by internal UI actions)."""
    try:
        print(f"📢 Creating notification for user: {notification.user_id}")

        user = await db.users.find_one({"id": notification.user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        notification_data = notification.dict()
        notification_data["created_at"] = datetime.utcnow()
        notification_data["_id"] = ObjectId()
        if "is_archived" not in notification_data:
            notification_data["is_archived"] = False

        result = await db.notifications.insert_one(notification_data)

        if result.inserted_id:
            created_notification = await db.notifications.find_one({"_id": result.inserted_id})
            normalized_notification = notification_helper(created_notification)
            print(f"✅ Notification created: {normalized_notification['id']}")

            return normalized_notification
        else:
            raise HTTPException(status_code=500, detail="Failed to create notification")

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating notification: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating notification: {str(e)}")


@app.put("/api/notifications/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str, current_user: User = Depends(get_current_user)
):
    """Mark a notification as read."""
    try:
        print(f"📌 Marking notification as read: {notification_id} for user: {current_user.id}")

        if not ObjectId.is_valid(notification_id):
            raise HTTPException(status_code=400, detail="Invalid notification ID")

        result = await db.notifications.update_one(
            {"_id": ObjectId(notification_id), "user_id": current_user.id},
            {"$set": {"is_read": True}},
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")

        print(f"✅ Notification {notification_id} marked as read")
        return {"message": "Notification marked as read"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error marking notification as read: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating notification: {str(e)}")


@app.put("/api/notifications/{notification_id}")
async def update_notification(
    notification_id: str,
    update: NotificationUpdate,
    current_user: User = Depends(get_current_user),
):
    """Generic notification update (supports is_read / is_archived)."""
    try:
        print(f"🛠 Updating notification {notification_id} for user {current_user.id}")

        if not ObjectId.is_valid(notification_id):
            raise HTTPException(status_code=400, detail="Invalid notification ID")

        update_data = update.dict(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        result = await db.notifications.update_one(
            {"_id": ObjectId(notification_id), "user_id": current_user.id},
            {"$set": update_data},
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")

        print(f"✅ Notification {notification_id} updated: {update_data}")
        return {"message": "Notification updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating notification: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating notification: {str(e)}")


@app.delete("/api/notifications/{notification_id}")
async def delete_notification(
    notification_id: str, current_user: User = Depends(get_current_user)
):
    """Delete a notification permanently."""
    try:
        print(f"🗑️ Deleting notification: {notification_id} by user: {current_user.id} (role: {current_user.role})")

        if not ObjectId.is_valid(notification_id):
            raise HTTPException(status_code=400, detail="Invalid notification ID")

        # ✅ Les managers peuvent supprimer n'importe quelle notification
        # Les collaborateurs ne peuvent supprimer que leurs propres notifications
        query = {"_id": ObjectId(notification_id)}
        if current_user.role != "manager":
            query["user_id"] = current_user.id

        notification = await db.notifications.find_one(query)
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")

        result = await db.notifications.delete_one(query)

        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")

        print(f"✅ Notification {notification_id} deleted successfully by {current_user.role} {current_user.id}")
        return {"message": "Notification deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting notification: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting notification: {str(e)}")


@app.get("/api/notifications/unread/count")
async def get_unread_notifications_count(current_user: User = Depends(get_current_user)):
    """Return unread notification count (excluding archived)."""
    try:
        count = await db.notifications.count_documents(
            {"user_id": current_user.id, "is_read": False, "is_archived": False}
        )
        print(f"📊 Unread notifications count for {current_user.id}: {count}")
        return {"count": count}
    except Exception as e:
        print(f"❌ Error counting notifications: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error counting notifications: {str(e)}")


# =============================================================================
# TASK ROUTES (WITH NOTIFICATIONS + EVALUATION LOGIC)
# =============================================================================


@app.get("/api/tasks")
async def get_tasks(current_user: User = Depends(get_current_user)):
    try:
        print(f"🎯 GET /api/tasks - User: {current_user.id}, Role: {current_user.role}")

        if current_user.role == "manager":
            query = {"creator_id": current_user.id}
            tasks = await db.tasks.find(query).to_list(length=None)
            print(f"📋 Manager query: {query}")
            print(f"📦 Found {len(tasks)} tasks created by manager")
        else:
            query = {"assignee_id": current_user.id}
            tasks = await db.tasks.find(query).to_list(length=None)
            print(f"📋 Collaborator query: {query}")
            print(f"📦 Found {len(tasks)} tasks assigned to collaborator")

        processed_tasks = []
        for task in tasks:
            try:
                task = clean_mongo_id(task)
                task = parse_from_mongo(task)

                if task.get("status") == "not_evaluated":
                    task["display_status"] = "AWAITING EVALUATION"
                else:
                    task["display_status"] = task.get("status", "").upper()

                if task.get("assignee_id"):
                    assignee = await db.users.find_one({"id": task["assignee_id"]})
                    if assignee:
                        assignee = clean_mongo_id(assignee)
                        task["assignee_name"] = assignee.get("full_name", "Unknown")
                        task["assignee_email"] = assignee.get("email", "No email")

                processed_tasks.append(task)
            except Exception as e:
                print(f"Error processing task {task.get('id', 'unknown')}: {e}")
                continue

        print(
            f"✅ Found {len(processed_tasks)} tasks for user {current_user.id} (role: {current_user.role})"
        )
        return processed_tasks

    except Exception as e:
        print(f"Error in get_tasks: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching tasks: {str(e)}")


@app.get("/api/tasks/{task_id}")
async def get_task(task_id: str, current_user: User = Depends(get_current_user)):
    """Get a single task (used by 'View full details')."""
    try:
        print(f"📥 Fetching task {task_id} for user {current_user.id}")

        task = await db.tasks.find_one({"id": task_id})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Access control
        if current_user.role == "collaborator" and task.get("assignee_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        if current_user.role == "manager" and task.get("creator_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        task = clean_mongo_id(task)
        task = parse_from_mongo(task)

        if task.get("status") == "not_evaluated":
            task["display_status"] = "AWAITING EVALUATION"
        else:
            task["display_status"] = task.get("status", "").upper()

        # Assignee infos
        if task.get("assignee_id"):
            assignee = await db.users.find_one({"id": task["assignee_id"]})
            if assignee:
                assignee = clean_mongo_id(assignee)
                task["assignee_name"] = assignee.get("full_name", "Unknown")
                task["assignee_email"] = assignee.get("email", "No email")

        # Manager infos
        if task.get("creator_id"):
            creator = await db.users.find_one({"id": task["creator_id"]})
            if creator:
                creator = clean_mongo_id(creator)
                task["creator_name"] = creator.get("full_name", "Manager")

        print(f"✅ Task {task_id} fetched successfully")
        return task

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching task: {str(e)}")


@app.post("/api/tasks", response_model=Task)
async def create_task(
    task_data: TaskCreate, current_user: User = Depends(require_role(["manager"]))
):
    """Create a new task and send notifications."""
    assignee = await db.users.find_one({"id": task_data.assignee_id})
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found")

    task = Task(**task_data.dict(), creator_id=current_user.id)
    task_dict = prepare_for_mongo(task.dict())
    await db.tasks.insert_one(task_dict)

    await NotificationService.create_task_notification(
        user_id=task_data.assignee_id,
        task_data={"id": task.id, "title": task_data.title},
        notification_type="task_assigned",
    )

    await NotificationService.create_task_notification(
        user_id=current_user.id,
        task_data={"id": task.id, "title": task_data.title},
        notification_type="task_created",
    )

    print(f"✅ Task created: {task.id}, notifications sent")
    return task


@app.put("/api/tasks/{task_id}")
async def update_task(
    task_id: str, task_data: TaskUpdate, current_user: User = Depends(get_current_user)
):
    """Update a task, handle status / completed_at, reset evaluation if needed, and send notifications."""
    try:
        print(f"🔄 Updating task {task_id}")

        existing_task = await db.tasks.find_one({"id": task_id})
        if not existing_task:
            raise HTTPException(status_code=404, detail="Task not found")

        # ---- SECURITÉ PAR RÔLE ----
        if current_user.role == "manager":
            # Le manager doit être le créateur de la tâche
            if existing_task.get("creator_id") != current_user.id:
                raise HTTPException(status_code=403, detail="You can only update your own tasks")

        elif current_user.role == "collaborator":
            # Le collaborateur doit être l'assigné de la tâche
            if existing_task.get("assignee_id") != current_user.id:
                raise HTTPException(status_code=403, detail="You can only update your own tasks")

        else:
            raise HTTPException(status_code=403, detail="Not enough permissions")

        update_data = task_data.dict(exclude_unset=True)

        # Si c'est un collaborateur, il ne peut changer QUE le status
        if current_user.role == "collaborator":
            allowed_fields = {"status"}
            invalid_fields = [f for f in update_data.keys() if f not in allowed_fields]
            if invalid_fields:
                raise HTTPException(
                    status_code=400,
                    detail="Collaborators can only change task status",
                )

        old_status = existing_task.get("status")
        new_status = update_data.get("status", old_status)

        finished_statuses = ["completed", "not_evaluated"]

        # ⭐ IMPORTANT :
        # Si un collaborateur met la tâche en "completed",
        # on la force en "not_evaluated" pour indiquer "Awaiting evaluation"
        # (même logique que l'endpoint /api/tasks/{task_id}/complete).
        if current_user.role == "collaborator" and new_status == "completed":
            print("♻️ Collaborator completed task -> setting status to 'not_evaluated'")
            update_data["status"] = "not_evaluated"
            new_status = "not_evaluated"

        # completed_at handling
        if new_status is not None:
            if new_status in finished_statuses and old_status not in finished_statuses:
                update_data["completed_at"] = datetime.now(timezone.utc)
            elif new_status not in finished_statuses and old_status in finished_statuses:
                update_data["completed_at"] = None

        # Auto reset evaluation if important changes
        evaluation_fields = [
            "punctuality_score",
            "quality_score",
            "performance_rating",
            "feedback",
            "evaluation_date",
        ]

        has_evaluation = any(existing_task.get(f) is not None for f in evaluation_fields)

        important_fields = ["title", "description", "due_date", "assignee_id", "priority"]

        has_important_change = any(
            field in update_data and update_data[field] != existing_task.get(field)
            for field in important_fields
        )

        status_reopened = (
            old_status == "completed"
            and new_status in ["pending", "in_progress", "not_evaluated"]
        )

        if has_evaluation and (has_important_change or status_reopened):
            print("♻️ Reset evaluation fields due to task change / reopen")
            for f in evaluation_fields:
                update_data[f] = None
            # If still considered completed but needs new evaluation, switch to not_evaluated
            if new_status == "completed":
                update_data["status"] = "not_evaluated"
                new_status = "not_evaluated"

        update_data["updated_at"] = datetime.now(timezone.utc)

              # =============================================================================
        # DÉTECTION DES CHANGEMENTS POUR NOTIFICATIONS
        # =============================================================================

        changed_fields = []
        for field in update_data:
            if field in ["updated_at", "_id"]:
                continue
            old_value = existing_task.get(field)
            new_value = update_data[field]
            if old_value != new_value:
                changed_fields.append(field)

        print(f"📝 Changed fields detected: {changed_fields}")

        # DB update
        result = await db.tasks.update_one({"id": task_id}, {"$set": prepare_for_mongo(update_data)})

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Task not found or no changes made")

        # =============================================================================
        # NOTIFICATIONS POUR TOUS LES CHANGEMENTS
        # =============================================================================

        if changed_fields:
            assignee_id = existing_task.get("assignee_id")
            creator_id = existing_task.get("creator_id")

            # Déterminer le type de notification basé sur les changements
            notification_type = "task_updated"
            new_status_effective = update_data.get("status", old_status)

            if "status" in changed_fields:
                if new_status_effective == "in_progress":
                    notification_type = "task_in_progress"
                elif new_status_effective == "completed":
                    notification_type = "task_completed"
                elif new_status_effective == "pending":
                    notification_type = "task_pending"
                elif new_status_effective == "not_evaluated":
                    notification_type = "task_not_evaluated"

            # Préparer les détails des changements pour la notification
            change_details = []

            for field in changed_fields:
                old_value = existing_task.get(field)
                new_value = update_data.get(field)

                if field == "status":
                    status_labels = {
                        "pending": "Pending",
                        "in_progress": "In Progress",
                        "completed": "Completed",
                        "not_evaluated": "Awaiting Evaluation",
                        "overdue": "Overdue",
                    }
                    old_display = status_labels.get(old_value, old_value)
                    new_display = status_labels.get(new_value, new_value)
                    change_details.append(f"Status: {old_display} → {new_display}")

                elif field == "priority":
                    priority_labels = {
                        "low": "Low",
                        "medium": "Medium",
                        "high": "High",
                    }
                    old_display = priority_labels.get(old_value, old_value)
                    new_display = priority_labels.get(new_value, new_value)
                    change_details.append(f"Priority: {old_display} → {new_display}")

                elif field == "due_date":
                    old_display = format_datetime(old_value) if old_value else "Not set"
                    new_display = format_datetime(new_value) if new_value else "Not set"
                    change_details.append(f"Due date: {old_display} → {new_display}")

                elif field == "assignee_id":
                    old_assignee = await db.users.find_one({"id": old_value}) if old_value else None
                    new_assignee = await db.users.find_one({"id": new_value}) if new_value else None

                    old_name = old_assignee.get("full_name", "Unassigned") if old_assignee else "Unassigned"
                    new_name = new_assignee.get("full_name", "Unassigned") if new_assignee else "Unassigned"

                    if old_value and not new_value:
                        change_details.append(f"Assignee: {old_name} → Unassigned")
                    elif not old_value and new_value:
                        change_details.append(f"Assignee: Unassigned → {new_name}")
                    else:
                        change_details.append(f"Assignee: {old_name} → {new_name}")

                elif field == "title":
                    change_details.append("Title updated")

                elif field == "description":
                    change_details.append("Description updated")

                else:
                    change_details.append(f"{field.replace('_', ' ').title()} updated")

            # 🔔 DESTINATAIRES : collaborateur + manager (sans doublon)
            recipients = set()
            if assignee_id:
                recipients.add(assignee_id)
            if creator_id:
                recipients.add(creator_id)

            for user_id in recipients:
                # Cas spécial : le collaborateur complète la tâche via PUT (sans evidence)
                # -> on force déjà status = 'not_evaluated'
                # On veut :
                #   - collaborateur : notification 'task_completed'
                #   - manager      : notification 'task_not_evaluated'
                per_user_type = notification_type
                if (
                    "status" in changed_fields
                    and new_status_effective == "not_evaluated"
                    and current_user.role == "collaborator"
                ):
                    if user_id == assignee_id:
                        per_user_type = "task_completed"
                    elif user_id == creator_id:
                        per_user_type = "task_not_evaluated"

                await NotificationService.create_task_notification(
                    user_id=user_id,
                    task_data={
                        "id": task_id,
                        "title": existing_task.get("title"),
                        "changed_fields": changed_fields,
                        "change_details": change_details,
                    },
                    notification_type=per_user_type,
                )

            print(
                f"✅ Notifications sent for task {task_id} "
                f"to {', '.join(recipients)} – fields: {', '.join(changed_fields)}"
            )

        # Return updated task
        updated_task = await db.tasks.find_one({"id": task_id})
        updated_task = clean_mongo_id(updated_task)
        updated_task = parse_from_mongo(updated_task)

        if updated_task.get("status") == "not_evaluated":
            updated_task["display_status"] = "AWAITING EVALUATION"
        else:
            updated_task["display_status"] = updated_task.get("status", "").upper()

        print(f"✅ Task updated successfully: {updated_task['id']}")
        return updated_task

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Fonction helper pour formater les dates
def format_datetime(dt_string):
    """Format datetime for display in notifications"""
    try:
        if isinstance(dt_string, str):
            dt = datetime.fromisoformat(dt_string.replace("Z", "+00:00"))
        elif isinstance(dt_string, datetime):
            dt = dt_string
        else:
            return str(dt_string)

        # ✅ correction: %Y (année) au lieu de 202Y
        return dt.strftime("%b %d, %Y at %H:%M")
    except Exception:
        return str(dt_string)


@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str, current_user: User = Depends(get_current_user)):
    """Delete a task (manager only) and notify the assignee."""
    try:
        print(f"🗑️ Deleting task {task_id}")

        existing_task = await db.tasks.find_one({"id": task_id})
        if not existing_task:
            raise HTTPException(status_code=404, detail="Task not found")

        if current_user.role != "manager":
            raise HTTPException(status_code=403, detail="Only managers can delete tasks")

        # ✅ NOTIFICATION pour la suppression - AVANT la suppression
        assignee_id = existing_task.get("assignee_id")
        if assignee_id:
            await NotificationService.create_task_notification(
                user_id=assignee_id,
                task_data={"id": task_id, "title": existing_task.get("title")},
                notification_type="task_deleted",
            )
            print(f"✅ Deletion notification sent to collaborator {assignee_id}")
            # 🔔 Notif de confirmation pour le manager
            await NotificationService.create_task_notification(
                user_id=current_user.id,
                task_data={"id": task_id, "title": existing_task.get("title")},
                notification_type="task_deleted",
            )
            print(f"✅ Deletion notification sent to manager {current_user.id}")

        result = await db.tasks.delete_one({"id": task_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Task not found")

        print(f"✅ Task {task_id} deleted successfully")
        return {"message": "Task deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting task {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/api/tasks/{task_id}/complete")
async def complete_task(
    task_id: str, request: Request, current_user: User = Depends(get_current_user)
):
    """Mark a task as completed by collaborator and attach evidence."""
    try:
        print(f"🎯 Completing task {task_id} - User: {current_user.id}")

        form_data = await request.form()
        completion_data = form_data.get("completion_data", "")

        files = []
        form_items = await request.form()
        for key, value in form_items.items():
            if hasattr(value, "filename") and value.filename:
                files.append(value)

        task = await db.tasks.find_one({"id": task_id})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        if current_user.role == "collaborator" and task["assignee_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        completion_notes = ""
        if completion_data:
            try:
                data_dict = json.loads(completion_data)
                completion_notes = data_dict.get("completion_notes", "")
            except json.JSONDecodeError:
                completion_notes = completion_data

        evidence_files = []
        for file in files:
            if file and hasattr(file, "filename") and file.filename:
                ext = os.path.splitext(file.filename)[1].lower()
                if ext in [".jpg", ".jpeg", ".png", ".pdf"]:
                    filename = f"{uuid.uuid4()}{ext}"
                    file_path = ROOT_DIR / "uploads" / "evidence" / filename
                    file_path.parent.mkdir(parents=True, exist_ok=True)

                    content = await file.read()
                    async with aiofiles.open(file_path, "wb") as f:
                        await f.write(content)

                    evidence_files.append(filename)

        now_iso = datetime.now(timezone.utc).isoformat()

        # Reset evaluation on completion (new cycle)
        update_data = {
            "status": "not_evaluated",
            "completed_at": now_iso,
            "completion_evidence": evidence_files,
            "completion_notes": completion_notes,
            "updated_at": now_iso,
            "punctuality_score": None,
            "quality_score": None,
            "performance_rating": None,
            "feedback": None,
            "evaluation_date": None,
        }

        await db.tasks.update_one({"id": task_id}, {"$set": update_data})

        if task.get("creator_id"):
            print(f"📢 Sending completion notification to manager: {task['creator_id']}")
            await NotificationService.create_task_notification(
                user_id=task["creator_id"],
                task_data={"id": task_id, "title": task["title"]},
                notification_type="task_not_evaluated",
            )
            print(f"✅ Completion notification sent to manager {task['creator_id']}")

        if current_user.role == "collaborator":
            await NotificationService.create_task_notification(
                user_id=current_user.id,
                task_data={"id": task_id, "title": task["title"]},
                notification_type="task_completed",
            )
            print(f"✅ Completion notification sent to collaborator {current_user.id}")

        return {
            "status": "success",
            "message": "Task completed successfully - Waiting for evaluation",
            "evidence_files": evidence_files,
            "completion_notes": completion_notes,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in complete_task: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tasks/{task_id}/evaluate")
async def evaluate_task(
    task_id: str,
    performance_data: PerformanceCreate,
    current_user: User = Depends(require_role(["manager"])),
):
    """
    Evaluate a task.

    Allowed:
      - First evaluation: task status = 'not_evaluated'
      - Re-evaluation: task status = 'completed'

    Each call:
      - Adds a record in performance_evaluations (history)
      - Overrides evaluation fields on the task (latest version)
      - Sets task status to 'completed'
      - Sends different notifications for first evaluation vs update
    """
    try:
        print(f"📊 Evaluating task {task_id} by manager {current_user.id}")

        task = await db.tasks.find_one({"id": task_id})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        current_status = task.get("status")

        if current_status not in ("not_evaluated", "completed"):
            raise HTTPException(
                status_code=400,
                detail="Task is not ready for evaluation (status must be 'not_evaluated' or 'completed')",
            )

        if task.get("creator_id") != current_user.id:
            raise HTTPException(status_code=403, detail="You can only evaluate your own tasks")

        if task.get("assignee_id") != performance_data.collaborator_id:
            raise HTTPException(status_code=400, detail="Collaborator ID doesn't match task assignee")

        # Was this task already evaluated before this call?
        previously_evaluated = is_task_already_evaluated(task)

        # 1) Save evaluation in history collection
        performance = Performance(**performance_data.dict(), evaluator_id=current_user.id)
        avg_rating = (performance_data.punctuality_score + performance_data.quality_score) / 2.0

        performance_dict = performance.dict()
        performance_dict["overall_score"] = avg_rating
        performance_dict = prepare_for_mongo(performance_dict)
        await db.performance_evaluations.insert_one(performance_dict)

        # 2) Update task with latest evaluation fields
        now_iso = datetime.now(timezone.utc).isoformat()

        task_update_fields = {
            "status": "completed",   # always 'completed' after an evaluation
            "punctuality_score": performance_data.punctuality_score,
            "quality_score": performance_data.quality_score,
            "performance_rating": avg_rating,
            "feedback": performance_data.comments or None,
            "evaluation_date": now_iso,
            "updated_at": now_iso,
        }

        await db.tasks.update_one({"id": task_id}, {"$set": task_update_fields})

        # 3) Reload updated task for response
        updated_task = await db.tasks.find_one({"id": task_id})
        updated_task = clean_mongo_id(updated_task)
        updated_task = parse_from_mongo(updated_task)

        if updated_task.get("status") == "not_evaluated":
            updated_task["display_status"] = "AWAITING EVALUATION"
        else:
            updated_task["display_status"] = updated_task.get("status", "").upper()

        # 4) Notifications (collaborator + manager)
        notification_type = "evaluation_updated" if previously_evaluated else "evaluation_completed"

        # To collaborator (assignee)
        if performance_data.collaborator_id:
            await NotificationService.create_task_notification(
                user_id=performance_data.collaborator_id,
                task_data={"id": task_id, "title": task.get("title", "Task")},
                notification_type=notification_type,
            )
            print(
                f"✅ Evaluation notification sent to collaborator {performance_data.collaborator_id} "
                f"({notification_type})"
            )

        # To manager (current evaluator)
        await NotificationService.create_task_notification(
            user_id=current_user.id,
            task_data={"id": task_id, "title": task.get("title", "Task")},
            notification_type=notification_type,
        )
        print(
            f"✅ Evaluation notification sent to manager {current_user.id} "
            f"({notification_type})"
        )

        print(
            f"✅ Task {task_id} evaluated successfully "
            f"({'re-evaluated' if previously_evaluated else 'first evaluation'})"
        )

        return {
            "message": "Task evaluated successfully"
            if not previously_evaluated
            else "Task evaluation updated successfully",
            "previously_evaluated": previously_evaluated,
            "performance": performance,
            "task_status": "completed",
            "status": "completed",
            "punctuality_score": performance_data.punctuality_score,
            "quality_score": performance_data.quality_score,
            "performance_rating": avg_rating,
            "feedback": performance_data.comments or None,
            "evaluation_date": now_iso,
            "task": updated_task,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error evaluating task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error evaluating task: {str(e)}")


# =============================================================================
# TASK TEMPLATES ROUTES
# =============================================================================


@app.post("/api/task-templates", response_model=TaskTemplate)
async def create_task_template(
    template_data: TaskTemplateCreate,
    current_user: User = Depends(require_role(["manager"])),
):
    template = TaskTemplate(**template_data.dict(), creator_id=current_user.id)
    template_dict = prepare_for_mongo(template.dict())
    await db.task_templates.insert_one(template_dict)
    return template


@app.get("/api/task-templates")
async def get_task_templates(current_user: User = Depends(require_role(["manager"]))):
    templates = await db.task_templates.find({"creator_id": current_user.id}).to_list(length=None)

    cleaned_templates = []
    for template in templates:
        template = clean_mongo_id(template)
        template = parse_from_mongo(template)
        cleaned_templates.append(template)

    return cleaned_templates


@app.post("/api/task-templates/{template_id}/instantiate")
async def instantiate_template(
    template_id: str,
    request: InstantiateTemplateRequest,
    current_user: User = Depends(require_role(["manager"])),
):
    print(f"🎯 Instantiating template {template_id} for {request.assignee_id}")

    template = await db.task_templates.find_one({"id": template_id})
    if not template or template["creator_id"] != current_user.id:
        raise HTTPException(status_code=404, detail="Template not found")

    assignee = await db.users.find_one({"id": request.assignee_id})
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found")

    task_data = TaskCreate(
        title=f"{template['name']}",
        description=template["description"],
        assignee_id=request.assignee_id,
        due_date=request.due_date,
        priority=template["default_priority"],
    )

    task = Task(**task_data.dict(), creator_id=current_user.id)
    task_dict = prepare_for_mongo(task.dict())
    await db.tasks.insert_one(task_dict)

    await db.task_templates.update_one({"id": template_id}, {"$inc": {"usage_count": 1}})

    await NotificationService.create_task_notification(
        user_id=request.assignee_id,
        task_data={"id": task.id, "title": template["name"]},
        notification_type="task_assigned",
    )

    await NotificationService.create_task_notification(
        user_id=current_user.id,
        task_data={"id": task.id, "title": template["name"]},
        notification_type="task_created",
    )

    return task


@app.delete("/api/task-templates/{template_id}")
async def delete_template(
    template_id: str,
    current_user: User = Depends(require_role(["manager"])),
):
    result = await db.task_templates.delete_one(
        {"id": template_id, "creator_id": current_user.id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted successfully"}


@app.get("/api/templates")
async def get_templates(current_user: User = Depends(require_role(["manager"]))):
    """Alias for /api/task-templates."""
    return await get_task_templates(current_user)


@app.post("/api/templates", response_model=TaskTemplate)
async def create_template(
    template_data: TaskTemplateCreate,
    current_user: User = Depends(require_role(["manager"])),
):
    """Alias for /api/task-templates."""
    return await create_task_template(template_data, current_user)


@app.post("/api/templates/{template_id}/instantiate")
async def instantiate_template_alias(
    template_id: str,
    request: InstantiateTemplateRequest,
    current_user: User = Depends(require_role(["manager"])),
):
    """Alias for /api/task-templates/{template_id}/instantiate."""
    return await instantiate_template(template_id, request, current_user)


# =============================================================================
# MEETINGS ROUTES (WITH NOTIFICATIONS)
# =============================================================================
@app.post("/api/meetings", response_model=Meeting)
async def create_meeting(
    meeting_data: MeetingCreate,
    current_user: User = Depends(require_role(["manager"])),
):
    """
    Create a new meeting (manager only):
    - Vérifie l'existence des participants
    - Vérifie les conflits d'horaires
    - Crée le document en base
    - Envoie les notifications
    """
    try:
        print(f"📅 Creating meeting '{meeting_data.title}' by manager {current_user.id}")

        # 1) Normaliser la date au format "YYYY-MM-DD"
        meeting_date_str = normalize_meeting_date_to_str(meeting_data.meeting_date)
        start_time = meeting_data.start_time
        end_time = meeting_data.end_time
        participant_ids = meeting_data.participant_ids or []

        # 2) Vérifier que les participants existent
        if not participant_ids:
            raise HTTPException(status_code=400, detail="At least one participant is required")

        participants_cursor = db.users.find({"id": {"$in": participant_ids}})
        participants = await participants_cursor.to_list(length=None)

        found_ids = {u["id"] for u in participants}
        missing = [pid for pid in participant_ids if pid not in found_ids]

        if missing:
            raise HTTPException(
                status_code=404,
                detail=f"Some participants do not exist: {', '.join(missing)}",
            )

        # 3) Vérifier les conflits (participants + organisateur)
        all_ids_for_conflict = list(set(participant_ids + [current_user.id]))
        print(f"🔍 Checking conflicts for creation with IDs: {all_ids_for_conflict}")

        conflict_details = await check_meeting_conflicts(
            meeting_date_str,
            start_time,
            end_time,
            all_ids_for_conflict,
            exclude_meeting_id=None,
        )

        if conflict_details:
            conflict_message = format_conflict_message(conflict_details)
            print(f"❌ Conflict on create: {conflict_message}")
            raise HTTPException(status_code=409, detail=conflict_message)

        # 4) Construire le document meeting
        meeting_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        meeting_doc = {
            "id": meeting_id,
            "title": meeting_data.title,
            "description": meeting_data.description,
            "meeting_date": meeting_date_str,   # toujours string "YYYY-MM-DD"
            "start_time": start_time,          # "HH:MM"
            "end_time": end_time,              # "HH:MM"
            "location": meeting_data.location or "Virtual",
            "meeting_type": meeting_data.meeting_type or "team_meeting",
            "organizer_id": current_user.id,
            "participant_ids": participant_ids,
            "participant_responses": {},       # personne n'a encore répondu
            "created_at": now,
            "status": "pending",
        }

        # 5) Sauver en base
        meeting_doc_db = prepare_for_mongo(meeting_doc.copy())
        await db.meetings.insert_one(meeting_doc_db)

        print(f"✅ Meeting created in DB with id {meeting_id}")

        # 6) Notifications
        #    - pour l'organisateur : "meeting_scheduled"
        await NotificationService.create_meeting_notification(
            user_id=current_user.id,
            meeting_data={"id": meeting_id, "title": meeting_data.title},
            notification_type="meeting_scheduled",
        )

        #    - pour chaque participant : "meeting_invitation"
        for pid in participant_ids:
            await NotificationService.create_meeting_notification(
                user_id=pid,
                meeting_data={"id": meeting_id, "title": meeting_data.title},
                notification_type="meeting_invitation",
            )

        print(f"📨 Notifications sent for meeting {meeting_id}")

        # 7) Retourner l'objet Meeting (meeting_date déjà en string)
        return Meeting(**meeting_doc)

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating meeting: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating meeting: {e}")


async def _handle_meeting_response(
    meeting_id: str,
    current_user: User,
    response: Literal["accept", "decline"],
) -> dict:
    """
    Logique commune pour accepter/refuser un meeting :
    - vérifie que le meeting existe
    - vérifie que l'utilisateur est participant
    - met à jour participant_responses[current_user.id]
    - recalcule le status global (pending / accepted / declined / partially_accepted)
    - notifie l'organisateur
    - renvoie le meeting mis à jour (dict)
    """
    meeting = await db.meetings.find_one({"id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    participant_ids = meeting.get("participant_ids", []) or []
    if isinstance(participant_ids, str):
        participant_ids = [participant_ids]

    if current_user.id not in participant_ids:
        raise HTTPException(status_code=403, detail="You are not a participant of this meeting")

    # 🗳️ MAJ des réponses individuelles
    responses = meeting.get("participant_responses", {}) or {}
    responses[current_user.id] = response

    total_participants = len(participant_ids)
    accepted_count = list(responses.values()).count("accept")
    declined_count = list(responses.values()).count("decline")

    # 🔁 recalcul du statut global
    if total_participants > 0 and len(responses) == total_participants:
        if declined_count > 0 and accepted_count == 0:
            status = "declined"
        elif accepted_count == total_participants:
            status = "accepted"
        else:
            status = "partially_accepted"
    else:
        status = "pending"

    update_doc = {
        "participant_responses": responses,
        "status": status,
        "updated_at": datetime.now(timezone.utc),
    }

    await db.meetings.update_one({"id": meeting_id}, {"$set": update_doc})

    # 🔔 notification à l’organisateur
    organizer_id = meeting.get("organizer_id")
    if organizer_id:
        await NotificationService.create_meeting_notification(
            user_id=organizer_id,
            meeting_data={"id": meeting_id, "title": meeting.get("title")},
            notification_type="meeting_response",
        )

    updated_meeting = await db.meetings.find_one({"id": meeting_id})
    if not updated_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found after update")

    updated_meeting = clean_mongo_id(updated_meeting)
    updated_meeting = parse_from_mongo(updated_meeting)

    # Normaliser meeting_date en "YYYY-MM-DD"
    md_val = updated_meeting.get("meeting_date")
    if isinstance(md_val, datetime):
        updated_meeting["meeting_date"] = md_val.date().isoformat()
    elif isinstance(md_val, date):
        updated_meeting["meeting_date"] = md_val.isoformat()
    elif isinstance(md_val, str):
        updated_meeting["meeting_date"] = md_val[:10]

    return updated_meeting


@app.post("/api/meetings/{meeting_id}/respond", response_model=Meeting)
async def respond_to_meeting(
    meeting_id: str,
    data: MeetingResponse,
    current_user: User = Depends(get_current_user),
):
    """
    Participant répond à une invitation de meeting (accept / decline).
    Utilise la logique commune _handle_meeting_response.
    """
    try:
        print(f"📩 Responding to meeting {meeting_id} with {data.response} by user {current_user.id}")
        updated_meeting = await _handle_meeting_response(meeting_id, current_user, data.response)
        print(f"✅ Response saved for meeting {meeting_id}")
        return Meeting(**updated_meeting)
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error responding to meeting {meeting_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error responding to meeting: {e}")


@app.get("/api/meetings")
async def get_meetings(current_user: User = Depends(get_current_user)):
    """Get meetings for the current user (as organizer or participant)."""
    try:
        print(f"📥 Getting meetings for user: {current_user.id}, role: {current_user.role}")

        if current_user.role == "manager":
            cursor = db.meetings.find({"organizer_id": current_user.id})
        else:
            cursor = db.meetings.find({"participant_ids": {"$in": [current_user.id]}})

        meetings = await cursor.to_list(length=100)
        print(f"📨 Raw meetings found: {len(meetings)}")

        cleaned_meetings: List[Dict[str, Any]] = []

        for meeting in meetings:
            try:
                meeting = clean_mongo_id(meeting)
                meeting = parse_from_mongo(meeting)

                # Sécuriser meeting_date en string "YYYY-MM-DD"
                md_val = meeting.get("meeting_date")
                if isinstance(md_val, datetime):
                    meeting["meeting_date"] = md_val.date().isoformat()
                elif isinstance(md_val, date):
                    meeting["meeting_date"] = md_val.isoformat()
                elif isinstance(md_val, str):
                    meeting["meeting_date"] = md_val[:10]

                participant_names: List[str] = []
                participant_ids = meeting.get("participant_ids", []) or []

                if isinstance(participant_ids, str):
                    participant_ids = [participant_ids]

                for pid in participant_ids:
                    if not pid:
                        participant_names.append("Invalid ID")
                        continue

                    user = await db.users.find_one({"id": pid})
                    if user:
                        name = user.get("full_name") or user.get("email") or "Unknown"
                        participant_names.append(name)
                    else:
                        participant_names.append("Former Member")

                meeting["participant_names"] = participant_names

                organizer_id = meeting.get("organizer_id")
                organizer = await db.users.find_one({"id": organizer_id}) if organizer_id else None
                meeting["organizer_name"] = (
                    organizer.get("full_name") if organizer else "Unknown Organizer"
                )

                cleaned_meetings.append(meeting)

            except Exception as e:
                print(f"❌ Error processing meeting: {e}")
                continue

        return cleaned_meetings

    except Exception as e:
        print(f"❌ Error in get_meetings: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching meetings: {e}")


@app.get("/api/meetings/{meeting_id}")
async def get_meeting(meeting_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific meeting with detailed responses and permissions."""
    try:
        print(f"📥 Getting meeting: {meeting_id} for user: {current_user.id}")

        meeting = await db.meetings.find_one({"id": meeting_id})
        if not meeting:
            print(f"❌ Meeting not found: {meeting_id}")
            raise HTTPException(status_code=404, detail="Meeting not found")

        meeting = clean_mongo_id(meeting)
        meeting = parse_from_mongo(meeting)

        # Normaliser meeting_date
        md_val = meeting.get("meeting_date")
        if isinstance(md_val, datetime):
            meeting["meeting_date"] = md_val.date().isoformat()
        elif isinstance(md_val, date):
            meeting["meeting_date"] = md_val.isoformat()
        elif isinstance(md_val, str):
            meeting["meeting_date"] = md_val[:10]

        is_organizer = meeting.get("organizer_id") == current_user.id
        is_participant = current_user.id in meeting.get("participant_ids", [])

        if not (is_organizer or is_participant):
            print(f"❌ User {current_user.id} not authorized to access meeting {meeting_id}")
            raise HTTPException(status_code=403, detail="Not authorized to access this meeting")

        print(f"✅ User authorized - Organizer: {is_organizer}, Participant: {is_participant}")

        participant_ids = meeting.get("participant_ids", []) or []
        participant_names: List[str] = []

        for pid in participant_ids:
            user = await db.users.find_one({"id": pid})
            if user:
                name = user.get("full_name") or user.get("email") or "Unknown"
                participant_names.append(name)
            else:
                participant_names.append("Former Member")

        meeting["participant_names"] = participant_names

        organizer_id = meeting.get("organizer_id")
        organizer = await db.users.find_one({"id": organizer_id}) if organizer_id else None
        meeting["organizer_name"] = (
            organizer.get("full_name") if organizer else "Unknown Organizer"
        )

        participant_responses: Dict[str, str] = meeting.get("participant_responses", {}) or {}
        detailed_responses = []

        for participant_id in participant_ids:
            user = await db.users.find_one({"id": participant_id})
            user_name = user.get("full_name", "Unknown") if user else "Unknown"
            response = participant_responses.get(participant_id, "pending")

            detailed_responses.append(
                {
                    "participant_id": participant_id,
                    "participant_name": user_name,
                    "response": response,
                    "response_text": {
                        "accept": "Accepted",
                        "decline": "Declined",
                        "pending": "Pending",
                    }[response],
                }
            )

        meeting["detailed_responses"] = detailed_responses

        total_participants = len(participant_ids)
        accepted_count = list(participant_responses.values()).count("accept")
        declined_count = list(participant_responses.values()).count("decline")
        pending_count = total_participants - len(participant_responses)

        meeting["response_stats"] = {
            "total_participants": total_participants,
            "accepted": accepted_count,
            "declined": declined_count,
            "pending": pending_count,
            "completion_rate": round(
                (len(participant_responses) / total_participants * 100)
                if total_participants > 0
                else 0,
                1,
            ),
        }

        print(f"✅ Meeting retrieved successfully: {meeting['title']}")
        return meeting

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting meeting {meeting_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching meeting: {e}")


@app.put("/api/meetings/{meeting_id}", response_model=Meeting)
async def update_meeting(
    meeting_id: str,
    meeting_data: MeetingUpdate,
    current_user: User = Depends(get_current_user),
):
    """Update an existing meeting (organizer only), check conflicts, notify, and return updated meeting."""
    try:
        print(f"🔄 Updating meeting: {meeting_id}")
        print(f"📊 Update data: {meeting_data.dict(exclude_unset=True)}")

        meeting = await db.meetings.find_one({"id": meeting_id})
        if not meeting:
            print(f"❌ Meeting not found: {meeting_id}")
            raise HTTPException(status_code=404, detail="Meeting not found")

        if meeting.get("organizer_id") != current_user.id:
            print(f"❌ User {current_user.id} is not organizer of meeting {meeting_id}")
            raise HTTPException(status_code=403, detail="Only the organizer can update this meeting")

        update_data = meeting_data.dict(exclude_unset=True)

        # ---------- 1) Gestion des participants ----------
        if "participant_ids" in update_data:
            new_participants = update_data["participant_ids"] or []
            current_participants = meeting.get("participant_ids", []) or []
            current_responses = meeting.get("participant_responses", {}) or {}

            print("🎯 Participant Management:")
            print(f"   - Current participants: {current_participants}")
            print(f"   - New participants: {new_participants}")
            print(f"   - Current responses: {current_responses}")

            updated_responses: Dict[str, str] = {}
            for participant_id in new_participants:
                if participant_id in current_participants and participant_id in current_responses:
                    updated_responses[participant_id] = current_responses[participant_id]
                    print(f"   ✅ Keeping vote for {participant_id}: {current_responses[participant_id]}")
                else:
                    print(f"   🔄 New participant or no vote: {participant_id}")

            update_data["participant_responses"] = updated_responses

            if set(new_participants) != set(current_participants):
                total_participants = len(new_participants)
                responses_count = len(updated_responses)
                accepted_count = list(updated_responses.values()).count("accept")
                declined_count = list(updated_responses.values()).count("decline")

                if responses_count == total_participants and total_participants > 0:
                    if accepted_count == total_participants:
                        update_data["status"] = "accepted"
                    elif declined_count > 0:
                        update_data["status"] = "declined"
                    else:
                        update_data["status"] = "partially_accepted"
                else:
                    update_data["status"] = "pending"

                print(f"   🔄 Status recalculated: {update_data['status']}")

        # ---------- 2) Normalisation meeting_date ----------
        if "meeting_date" in update_data:
            raw_md = update_data["meeting_date"]
            try:
                md_obj = datetime.strptime(str(raw_md)[:10], "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="meeting_date must be in format YYYY-MM-DD")
            update_data["meeting_date"] = md_obj.isoformat()

        # ---------- 3) Détection des conflits ----------
        if any(key in update_data for key in ["meeting_date", "start_time", "end_time", "participant_ids"]):
            raw_date = update_data.get("meeting_date", meeting.get("meeting_date"))
            if raw_date:
                try:
                    meeting_date_obj = datetime.strptime(str(raw_date)[:10], "%Y-%m-%d").date()
                    meeting_date_str = meeting_date_obj.isoformat()
                except ValueError:
                    raise HTTPException(status_code=400, detail="meeting_date must be in format YYYY-MM-DD")
            else:
                meeting_date_str = meeting.get("meeting_date")

            update_data["meeting_date"] = meeting_date_str

            start_time = update_data.get("start_time", meeting.get("start_time"))
            end_time = update_data.get("end_time", meeting.get("end_time"))
            participant_ids = update_data.get("participant_ids", meeting.get("participant_ids", [])) or []

            all_ids_for_conflict = [pid for pid in participant_ids if pid]
            organizer_id = meeting.get("organizer_id")
            if organizer_id:
                all_ids_for_conflict.append(organizer_id)
            all_ids_for_conflict = list(set(all_ids_for_conflict))

            print(f"🔍 Checking conflicts for update with IDs: {all_ids_for_conflict}")

            conflict_details = await check_meeting_conflicts(
                meeting_date_str,
                start_time,
                end_time,
                all_ids_for_conflict,
                exclude_meeting_id=meeting_id,
            )

            if conflict_details:
                conflict_message = format_conflict_message(conflict_details)
                print(f"❌ Conflict on update: {conflict_message}")
                raise HTTPException(status_code=409, detail=conflict_message)

        # ---------- 4) Mise à jour ----------
        update_data["updated_at"] = datetime.now(timezone.utc)
        print(f"📝 Final update data: {update_data}")

        result = await db.meetings.update_one({"id": meeting_id}, {"$set": update_data})
        print(f"📊 MongoDB update result: {result.modified_count} modified")

        if result.modified_count == 0:
            print(f"❌ No meeting was modified: {meeting_id}")
            raise HTTPException(status_code=400, detail="Failed to update meeting")

        # ---------- 5) Notifications + retour ----------
        updated_meeting = await db.meetings.find_one({"id": meeting_id})
        if not updated_meeting:
            raise HTTPException(status_code=404, detail="Meeting not found after update")

        current_participants = set(meeting.get("participant_ids", []))
        new_participants = set(updated_meeting.get("participant_ids", []))

        new_members = new_participants - current_participants
        removed_members = current_participants - new_participants
        remaining_members = current_participants & new_participants

        print("📢 Notification summary:")
        print(f"   - New members: {new_members}")
        print(f"   - Removed members: {removed_members}")
        print(f"   - Remaining members: {remaining_members}")

        await NotificationService.create_meeting_notification(
            user_id=current_user.id,
            meeting_data={"id": meeting_id, "title": updated_meeting["title"]},
            notification_type="meeting_updated",
        )

        for participant_id in new_members:
            await NotificationService.create_meeting_notification(
                user_id=participant_id,
                meeting_data={"id": meeting_id, "title": updated_meeting["title"]},
                notification_type="meeting_invitation",
            )

        for participant_id in removed_members:
            await NotificationService.create_meeting_notification(
                user_id=participant_id,
                meeting_data={"id": meeting_id, "title": updated_meeting["title"]},
                notification_type="meeting_cancelled",
            )

        if any(key in update_data for key in ["meeting_date", "start_time", "end_time"]):
            for participant_id in remaining_members:
                await NotificationService.create_meeting_notification(
                    user_id=participant_id,
                    meeting_data={"id": meeting_id, "title": updated_meeting["title"]},
                    notification_type="meeting_updated",
                )

        updated_meeting = clean_mongo_id(updated_meeting)
        updated_meeting = parse_from_mongo(updated_meeting)

        md_val = updated_meeting.get("meeting_date")
        if isinstance(md_val, datetime):
            updated_meeting["meeting_date"] = md_val.date().isoformat()
        elif isinstance(md_val, date):
            updated_meeting["meeting_date"] = md_val.isoformat()
        elif isinstance(md_val, str):
            updated_meeting["meeting_date"] = md_val[:10]

        print(f"✅ Meeting updated successfully: {meeting_id}")
        return Meeting(**updated_meeting)

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating meeting {meeting_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating meeting: {e}")


@app.delete("/api/meetings/{meeting_id}")
async def delete_meeting(
    meeting_id: str,
    current_user: User = Depends(require_role(["manager"])),
):
    """Delete a meeting (organizer only) and notify participants + organizer."""
    try:
        print(f"🗑️ Attempting to delete meeting {meeting_id}")

        existing_meeting = await db.meetings.find_one({"id": meeting_id})

        if not existing_meeting:
            print(f"❌ Meeting {meeting_id} not found")
            raise HTTPException(status_code=404, detail="Meeting not found")

        print(f"✅ Meeting found: {existing_meeting['title']}")

        if existing_meeting.get("organizer_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Can only delete your own meetings")

        # 🔔 Notif pour tous les participants
        for participant_id in existing_meeting.get("participant_ids", []):
            await NotificationService.create_meeting_notification(
                user_id=participant_id,
                meeting_data={"id": meeting_id, "title": existing_meeting["title"]},
                notification_type="meeting_cancelled",
            )

        # 🔔 Notif aussi pour le manager (organizer)
        await NotificationService.create_meeting_notification(
            user_id=current_user.id,
            meeting_data={"id": meeting_id, "title": existing_meeting["title"]},
            notification_type="meeting_cancelled",
        )

        result = await db.meetings.delete_one({"id": meeting_id})

        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Meeting not found")

        print(f"✅ Meeting {meeting_id} deleted successfully")
        return {"message": "Meeting deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting meeting {meeting_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@app.options("/api/meetings/{meeting_id}")
async def options_meeting_update(meeting_id: str):
    """Handle CORS preflight for meeting endpoints."""
    return {"message": "CORS preflight OK"}


# =============================================================================
# PERFORMANCE ROUTES
# =============================================================================


@app.post("/api/performance", response_model=Performance)
async def create_performance_evaluation(
    performance_data: PerformanceCreate,
    current_user: User = Depends(require_role(["manager"])),
):
    """
    Create a performance evaluation (historical record) + update task evaluation fields.
    Also sends notifications for first evaluation vs re-evaluation.
    """
    task = await db.tasks.find_one({"id": performance_data.task_id})
    collaborator = await db.users.find_one({"id": performance_data.collaborator_id})

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not collaborator:
        raise HTTPException(status_code=404, detail="Collaborator not found")

    if task.get("assignee_id") != performance_data.collaborator_id:
        raise HTTPException(status_code=400, detail="Collaborator ID doesn't match task assignee")

    # Check if this task already had an evaluation
    previously_evaluated = is_task_already_evaluated(task)

    # Create evaluation document (history)
    performance = Performance(**performance_data.dict(), evaluator_id=current_user.id)
    avg_rating = (performance_data.punctuality_score + performance_data.quality_score) / 2.0

    performance_dict = performance.dict()
    performance_dict["overall_score"] = avg_rating
    performance_dict = prepare_for_mongo(performance_dict)
    await db.performance_evaluations.insert_one(performance_dict)

    # Update task with latest evaluation fields
    now_iso = datetime.now(timezone.utc).isoformat()
    task_update_fields = {
        "status": "completed",
        "punctuality_score": performance_data.punctuality_score,
        "quality_score": performance_data.quality_score,
        "performance_rating": avg_rating,
        "feedback": performance_data.comments or None,
        "evaluation_date": now_iso,
        "updated_at": now_iso,
    }
    await db.tasks.update_one({"id": performance_data.task_id}, {"$set": task_update_fields})

    notification_type = "evaluation_updated" if previously_evaluated else "evaluation_completed"

    # Notify collaborator
    await NotificationService.create_task_notification(
        user_id=performance_data.collaborator_id,
        task_data={"id": performance_data.task_id, "title": task.get("title", "Task")},
        notification_type=notification_type,
    )

    # Notify manager
    await NotificationService.create_task_notification(
        user_id=current_user.id,
        task_data={"id": performance_data.task_id, "title": task.get("title", "Task")},
        notification_type=notification_type,
    )

    # Return performance model (Pydantic ignores extra field 'overall_score')
    return performance


@app.get("/api/performance/{user_id}")
async def get_performance_evaluations(
    user_id: str, current_user: User = Depends(get_current_user)
):
    if current_user.role == "collaborator" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    evaluations = await db.performance_evaluations.find(
        {"collaborator_id": user_id}
    ).to_list(length=None)

    cleaned_evaluations = []

    for evaluation in evaluations:
        evaluation = clean_mongo_id(evaluation)
        evaluation = parse_from_mongo(evaluation)

        # Attach task info (title, status)
        task_id = evaluation.get("task_id")
        if task_id:
            task = await db.tasks.find_one({"id": task_id})
            if task:
                task = clean_mongo_id(task)
                task = parse_from_mongo(task)
                evaluation["task_title"] = task.get("title", "Untitled task")
                raw_status = task.get("status")
                evaluation["task_status"] = raw_status
                evaluation["task_due_date"] = task.get("due_date")
            else:
                evaluation["task_title"] = "Unknown task"
        else:
            evaluation["task_title"] = "Unknown task"
            raw_status = None

        # Fix incoherences: if we have scores/comments,
        # we consider the evaluation "completed" for display
        p = evaluation.get("punctuality_score")
        q = evaluation.get("quality_score")
        overall = evaluation.get("overall_score")

        has_score = any(
            isinstance(v, (int, float)) and v is not None and v > 0 for v in [p, q, overall]
        )
        has_comments = isinstance(evaluation.get("comments"), str) and evaluation["comments"].strip()

        if raw_status == "not_evaluated" and (has_score or has_comments):
            evaluation["task_status"] = "completed"

        # If no overall_score, calculate it for analytics on frontend
        if evaluation.get("overall_score") is None and isinstance(p, (int, float)) and isinstance(
            q, (int, float)
        ):
            evaluation["overall_score"] = (p + q) / 2.0

        cleaned_evaluations.append(evaluation)

    return cleaned_evaluations


# =============================================================================
# DASHBOARD & ANALYTICS ROUTES
# =============================================================================


@app.get("/api/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    """Basic stats by role (simple endpoint, not used by React dashboards)."""
    if current_user.role == "manager":
        total_tasks = await db.tasks.count_documents({"creator_id": current_user.id})
        completed_tasks = await db.tasks.count_documents(
            {"creator_id": current_user.id, "status": "completed"}
        )
        pending_tasks = await db.tasks.count_documents(
            {"creator_id": current_user.id, "status": "pending"}
        )
        overdue_tasks = await db.tasks.count_documents(
            {"creator_id": current_user.id, "status": "overdue"}
        )

        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks,
            "overdue_tasks": overdue_tasks,
        }
    else:
        my_tasks = await db.tasks.count_documents({"assignee_id": current_user.id})
        completed = await db.tasks.count_documents(
            {"assignee_id": current_user.id, "status": "completed"}
        )
        pending = await db.tasks.count_documents(
            {"assignee_id": current_user.id, "status": "pending"}
        )

        evaluations = await db.performance_evaluations.find(
            {"collaborator_id": current_user.id}
        ).to_list(length=None)

        avg_punctuality = 0
        avg_quality = 0
        if evaluations:
            avg_punctuality = sum(e["punctuality_score"] for e in evaluations) / len(
                evaluations
            )
            avg_quality = sum(e["quality_score"] for e in evaluations) / len(evaluations)

        return {
            "my_tasks": my_tasks,
            "completed_tasks": completed,
            "pending_tasks": pending,
            "avg_punctuality_score": round(avg_punctuality, 2),
            "avg_quality_score": round(avg_quality, 2),
        }


@app.get("/api/dashboard/stats/{user_id}")
async def get_dashboard_stats_user(
    user_id: str, current_user: User = Depends(get_current_user)
):
    """Dashboard stats for a specific user (used by React)."""
    try:
        print(f"📊 Fetching dashboard stats for user: {user_id}")

        if current_user.role == "collaborator" and current_user.id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        if current_user.role == "manager":
            tasks_cursor = db.tasks.find({"creator_id": user_id})
            meetings_cursor = db.meetings.find({"organizer_id": user_id})
        else:
            tasks_cursor = db.tasks.find({"assignee_id": user_id})
            meetings_cursor = db.meetings.find({"participant_ids": user_id})

        tasks = await tasks_cursor.to_list(length=None)
        meetings = await meetings_cursor.to_list(length=None)

        total_tasks = len(tasks)
        completed_tasks = len([t for t in tasks if t.get("status") == "completed"])
        pending_tasks = len([t for t in tasks if t.get("status") == "pending"])

        total_meetings = len(meetings)
        scheduled_meetings = len(
            [m for m in meetings if m.get("status") in ["scheduled", "accepted"]]
        )
        pending_meetings = len([m for m in meetings if m.get("status") == "pending"])
        declined_meetings = len([m for m in meetings if m.get("status") == "declined"])

        evaluations_cursor = db.performance_evaluations.find({"collaborator_id": user_id})
        evaluations = await evaluations_cursor.to_list(length=None)

        avg_punctuality = 0
        avg_quality = 0

        if evaluations:
            punctuality_scores = [
                e.get("punctuality_score", 0)
                for e in evaluations
                if e.get("punctuality_score") is not None
            ]
            quality_scores = [
                e.get("quality_score", 0)
                for e in evaluations
                if e.get("quality_score") is not None
            ]

            if punctuality_scores:
                avg_punctuality = sum(punctuality_scores) / len(punctuality_scores)
            if quality_scores:
                avg_quality = sum(quality_scores) / len(quality_scores)

        stats = {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks,
            "total_meetings": total_meetings,
            "scheduled_meetings": scheduled_meetings,
            "pending_meetings": pending_meetings,
            "declined_meetings": declined_meetings,
            "avg_punctuality_score": round(avg_punctuality, 1),
            "avg_quality_score": round(avg_quality, 1),
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }

        print(f"✅ Dashboard stats calculated: {stats}")
        return stats

    except Exception as e:
        print(f"❌ Error in get_dashboard_stats: {e}")
        return {
            "total_tasks": 0,
            "completed_tasks": 0,
            "pending_tasks": 0,
            "total_meetings": 0,
            "scheduled_meetings": 0,
            "pending_meetings": 0,
            "declined_meetings": 0,
            "avg_punctuality_score": 0,
            "avg_quality_score": 0,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }


@app.get("/api/calendar/events")
async def get_calendar_events(current_user: User = Depends(get_current_user)):
    """Return unified calendar events (tasks + meetings)."""
    try:
        events = []

        if current_user.role == "manager":
            tasks = await db.tasks.find({"creator_id": current_user.id}).to_list(length=None)
        else:
            tasks = await db.tasks.find({"assignee_id": current_user.id}).to_list(length=None)

        for task in tasks:
            task = clean_mongo_id(task)
            task = parse_from_mongo(task)
            due = task["due_date"]
            if isinstance(due, datetime):
                start = due
            else:
                start = datetime.fromisoformat(str(due))
            events.append(
                {
                    "id": task["id"],
                    "title": task["title"],
                    "start": start.isoformat(),
                    "end": start.isoformat(),
                    "type": "task",
                    "status": task["status"],
                    "priority": task["priority"],
                }
            )

        if current_user.role == "manager":
            meetings = await db.meetings.find({"organizer_id": current_user.id}).to_list(
                length=None
            )
        else:
            meetings = await db.meetings.find({"participant_ids": current_user.id}).to_list(
                length=None
            )

        for meeting in meetings:
            meeting = clean_mongo_id(meeting)
            meeting = parse_from_mongo(meeting)

            date_str = meeting.get("meeting_date")
            start_time_str = meeting.get("start_time")
            end_time_str = meeting.get("end_time")

            if isinstance(date_str, datetime):
                date_str = date_str.date().isoformat()

            if not (date_str and start_time_str and end_time_str):
                continue

            start_dt = datetime.fromisoformat(f"{date_str}T{start_time_str}:00+00:00")
            end_dt = datetime.fromisoformat(f"{date_str}T{end_time_str}:00+00:00")

            events.append(
                {
                    "id": meeting["id"],
                    "title": meeting["title"],
                    "start": start_dt.isoformat(),
                    "end": end_dt.isoformat(),
                    "type": "meeting",
                    "location": meeting.get("location", "Virtual"),
                    "meeting_type": meeting.get("meeting_type", "team_meeting"),
                }
            )

        return events

    except Exception as e:
        print(f"Error in get_calendar_events: {e}")
        return []


# =============================================================================
# USER-SPECIFIC TASKS & MEETINGS
# =============================================================================


@app.get("/api/tasks/user/{user_id}")
async def get_user_tasks(user_id: str, current_user: User = Depends(get_current_user)):
    """Get tasks for a specific user (collaborator or by manager)."""
    try:
        if current_user.role == "collaborator" and current_user.id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        if current_user.role == "manager":
            collaborator_tasks = await db.tasks.find({"assignee_id": user_id}).to_list(
                length=None
            )
        else:
            collaborator_tasks = await db.tasks.find({"assignee_id": user_id}).to_list(
                length=None
            )

        processed_tasks = []
        for task in collaborator_tasks:
            try:
                task = clean_mongo_id(task)
                task = parse_from_mongo(task)

                if task.get("creator_id"):
                    creator = await db.users.find_one({"id": task["creator_id"]})
                    if creator:
                        creator = clean_mongo_id(creator)
                        task["creator_name"] = creator.get("full_name", "Manager")

                processed_tasks.append(task)
            except Exception as e:
                print(f"Error processing task {task.get('id', 'unknown')}: {e}")
                continue

        return processed_tasks

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_user_tasks: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching user tasks: {e}")


@app.get("/api/meetings/user/{user_id}")
async def get_user_meetings(user_id: str, current_user: User = Depends(get_current_user)):
    """Get meetings for a specific user (as participant)."""
    try:
        print(f"📥 Getting meetings for user: {user_id}, current user: {current_user.id}")

        if current_user.role == "collaborator" and current_user.id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        meetings_cursor = db.meetings.find({"participant_ids": {"$in": [user_id]}})
        meetings = await meetings_cursor.to_list(length=None)
        print(f"📨 Raw meetings found: {len(meetings)}")

        cleaned_meetings = []
        for meeting in meetings:
            try:
                meeting = clean_mongo_id(meeting)
                meeting = parse_from_mongo(meeting)

                print(f"🎯 Meeting: {meeting['title']}")
                print(f"   - Participant IDs: {meeting.get('participant_ids', [])}")
                print(f"   - Organizer ID: {meeting.get('organizer_id')}")

                participant_names = []
                participant_ids = meeting.get("participant_ids", [])

                for pid in participant_ids:
                    print(f"   - Looking up user: {pid}")
                    user = await db.users.find_one({"id": pid})
                    if user:
                        name = user.get("full_name") or user.get("email") or "Unknown"
                        participant_names.append(name)
                        print(f"   ✅ Found: {name}")
                    else:
                        print(f"   ❌ User not found: {pid}")

                meeting["participant_names"] = participant_names
                print(f"   - Final participant_names: {participant_names}")

                if meeting.get("organizer_id"):
                    organizer = await db.users.find_one({"id": meeting["organizer_id"]})
                    if organizer:
                        organizer = clean_mongo_id(organizer)
                        meeting["organizer_name"] = organizer.get("full_name", "Organizer")
                        print(f"   - Organizer: {meeting['organizer_name']}")
                else:
                    meeting["organizer_name"] = "Unknown Organizer"

                cleaned_meetings.append(meeting)
                print("   ✅ Meeting processed successfully")

            except Exception as e:
                print(f"❌ Error processing meeting: {e}")
                continue

        print(f"✅ Final cleaned meetings: {len(cleaned_meetings)}")
        return cleaned_meetings

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_user_meetings: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching user meetings: {e}")


@app.put("/api/meetings/{meeting_id}/accept")
async def accept_meeting(meeting_id: str, current_user: User = Depends(get_current_user)):
    """Simple accept endpoint (legacy, used by frontend)."""
    try:
        print(f"✅ Accept meeting {meeting_id} by user {current_user.id}")
        await _handle_meeting_response(meeting_id, current_user, "accept")
        return {"message": "Meeting accepted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in accept_meeting: {e}")
        raise HTTPException(status_code=500, detail="Error accepting meeting")


@app.put("/api/meetings/{meeting_id}/decline")
async def decline_meeting(meeting_id: str, current_user: User = Depends(get_current_user)):
    """Simple decline endpoint (legacy, used by frontend)."""
    try:
        print(f"❌ Decline meeting {meeting_id} by user {current_user.id}")
        await _handle_meeting_response(meeting_id, current_user, "decline")
        return {"message": "Meeting declined successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in decline_meeting: {e}")
        raise HTTPException(status_code=500, detail="Error declining meeting")


# =============================================================================
# TEAM ANALYTICS ROUTE
# =============================================================================


@app.get("/api/analytics/team-performance")
async def get_team_performance(current_user: User = Depends(require_role(["manager"]))):
    """Team performance analytics for manager dashboard."""
    try:
        if current_user.role != "manager":
            raise HTTPException(status_code=403, detail="Only managers can access team analytics")

        collaborators_cursor = db.users.find({"role": "collaborator"})
        collaborators = await collaborators_cursor.to_list(length=None)

        team_performance = []
        for collaborator in collaborators:
            collaborator = clean_mongo_id(collaborator)

            tasks_cursor = db.tasks.find({"assignee_id": collaborator["id"]})
            tasks = await tasks_cursor.to_list(length=None)

            total_tasks = len(tasks)
            completed_tasks = len([t for t in tasks if t.get("status") == "completed"])

            evaluations_cursor = db.performance_evaluations.find(
                {"collaborator_id": collaborator["id"]}
            )
            evaluations = await evaluations_cursor.to_list(length=None)

            avg_punctuality = 0
            avg_quality = 0

            if evaluations:
                punctuality_scores = [
                    e.get("punctuality_score", 0)
                    for e in evaluations
                    if e.get("punctuality_score") is not None
                ]
                quality_scores = [
                    e.get("quality_score", 0)
                    for e in evaluations
                    if e.get("quality_score") is not None
                ]

                if punctuality_scores:
                    avg_punctuality = sum(punctuality_scores) / len(punctuality_scores)
                if quality_scores:
                    avg_quality = sum(quality_scores) / len(quality_scores)

            team_performance.append(
                {
                    "collaborator_id": collaborator["id"],
                    "collaborator_name": collaborator.get("full_name", "Unknown"),
                    "collaborator_email": collaborator.get("email", "No email"),
                    "total_tasks": total_tasks,
                    "completed_tasks": completed_tasks,
                    "completion_rate": round(
                        (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 1
                    ),
                    "avg_punctuality_score": round(avg_punctuality, 1),
                    "avg_quality_score": round(avg_quality, 1),
                    "last_evaluation_count": len(evaluations),
                    "last_updated": datetime.now(timezone.utc).isoformat(),
                }
            )

        team_performance.sort(
            key=lambda x: (x["avg_quality_score"] + x["avg_punctuality_score"]),
            reverse=True,
        )

        print(f"✅ Team analytics calculated for {len(team_performance)} collaborators")
        return team_performance

    except Exception as e:
        print(f"❌ Error in get_team_performance: {e}")
        return []


# =============================================================================
# ROUTES POUR L'EVIDENCE DU TACHE
# =============================================================================


@app.get("/api/files/evidence/{filename}")
async def download_evidence_file(
    filename: str,
    token: str = Query(..., description="JWT token passed as query param"),
):
    """
    Télécharger un fichier d'évidence (download direct).
    Utilisé par les boutons "Download".
    """
    # 🔐 Vérifier que le token correspond à un user existant
    await get_user_from_token_query(token)

    file_path = ROOT_DIR / "uploads" / "evidence" / filename
    return build_file_response(file_path, filename, disposition="attachment")


@app.get("/api/files/evidence/preview/{filename}")
async def preview_evidence_file(
    filename: str,
    token: str = Query(..., description="JWT token passed as query param"),
):
    """
    Prévisualiser un fichier d'évidence dans le navigateur (inline, nouvel onglet).
    Utilisé par le bouton "View" dans TaskDetails.
    """
    await get_user_from_token_query(token)

    file_path = ROOT_DIR / "uploads" / "evidence" / filename
    return build_file_response(file_path, filename, disposition="inline")


# =============================================================================
# DEBUG & HEALTH
# =============================================================================


@app.get("/api/debug/tasks/{task_id}")
async def debug_task(task_id: str):
    """Simple debug route to inspect a task in DB."""
    try:
        if db is None:
            return {"error": "Database not connected"}

        task = await db.tasks.find_one({"id": task_id})

        if task:
            task = clean_mongo_id(task)
            task = parse_from_mongo(task)
            return {"exists": True, "task": task}
        else:
            return {"exists": False, "task_id": task_id}

    except Exception as e:
        return {"error": str(e)}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc)}


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
