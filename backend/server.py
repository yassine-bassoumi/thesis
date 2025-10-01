from fastapi import FastAPI, HTTPException, Depends, File, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
import uuid
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configuration
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create FastAPI app
app = FastAPI(title="Collaborator Task Platform")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__ident="2b")
security = HTTPBearer()

# Models
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
    evidence_files: List[str] = []

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    completed_at: Optional[datetime] = None

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

class NotificationBase(BaseModel):
    user_id: str
    title: str
    message: str
    type: str = "info"

class Notification(NotificationBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Utility functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    # Truncate password to 72 bytes for bcrypt compatibility
    if len(password.encode('utf-8')) > 72:
        password = password[:70]  # Keep it safe under 72 bytes
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
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
    return User(**user)

def require_role(allowed_roles: List[str]):
    def decorator(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Not enough permissions"
            )
        return current_user
    return decorator

# Helper functions
def prepare_for_mongo(data: dict) -> dict:
    """Prepare data for MongoDB storage"""
    if isinstance(data.get('created_at'), datetime):
        data['created_at'] = data['created_at'].isoformat()
    if isinstance(data.get('due_date'), datetime):
        data['due_date'] = data['due_date'].isoformat()
    if isinstance(data.get('completed_at'), datetime):
        data['completed_at'] = data['completed_at'].isoformat()
    return data

def parse_from_mongo(item: dict) -> dict:
    """Parse data from MongoDB"""
    if isinstance(item.get('created_at'), str):
        item['created_at'] = datetime.fromisoformat(item['created_at'])
    if isinstance(item.get('due_date'), str):
        item['due_date'] = datetime.fromisoformat(item['due_date'])
    if isinstance(item.get('completed_at'), str):
        item['completed_at'] = datetime.fromisoformat(item['completed_at'])
    return item

# Routes

# Authentication Routes
@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    user = User(**user_data.dict())
    user_dict = user.dict()
    user_dict["password"] = hashed_password
    
    user_dict = prepare_for_mongo(user_dict)
    await db.users.insert_one(user_dict)
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@app.post("/api/auth/login", response_model=Token)
async def login(user_credentials: UserLogin):
    user_data = await db.users.find_one({"email": user_credentials.email})
    if not user_data or not verify_password(user_credentials.password, user_data["password"]):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_data = parse_from_mongo(user_data)
    user = User(**{k: v for k, v in user_data.items() if k != "password"})
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

# User Routes
@app.get("/api/users/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@app.get("/api/users", response_model=List[User])
async def get_users(current_user: User = Depends(require_role(["manager"]))):
    users = await db.users.find().to_list(length=None)
    return [User(**{k: v for k, v in parse_from_mongo(user).items() if k != "password"}) for user in users]

# Task Routes
@app.post("/api/tasks", response_model=Task)
async def create_task(task_data: TaskCreate, current_user: User = Depends(require_role(["manager"]))):
    # Verify assignee exists
    assignee = await db.users.find_one({"id": task_data.assignee_id})
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found")
    
    task = Task(**task_data.dict(), creator_id=current_user.id)
    task_dict = prepare_for_mongo(task.dict())
    await db.tasks.insert_one(task_dict)
    
    # Create notification for assignee
    notification = Notification(
        user_id=task_data.assignee_id,
        title="New Task Assigned",
        message=f"You have been assigned a new task: {task_data.title}",
        type="task_assignment"
    )
    notification_dict = prepare_for_mongo(notification.dict())
    await db.notifications.insert_one(notification_dict)
    
    return task

@app.get("/api/tasks", response_model=List[Task])
async def get_tasks(current_user: User = Depends(get_current_user)):
    if current_user.role == "manager":
        tasks = await db.tasks.find({"creator_id": current_user.id}).to_list(length=None)
    else:
        tasks = await db.tasks.find({"assignee_id": current_user.id}).to_list(length=None)
    
    return [Task(**parse_from_mongo(task)) for task in tasks]

@app.get("/api/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str, current_user: User = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = parse_from_mongo(task)
    # Check permissions
    if current_user.role == "collaborator" and task["assignee_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "manager" and task["creator_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return Task(**task)

@app.put("/api/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, task_update: TaskUpdate, current_user: User = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = parse_from_mongo(task)
    
    # Check permissions
    if current_user.role == "collaborator" and task["assignee_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "manager" and task["creator_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update fields
    update_data = {k: v for k, v in task_update.dict().items() if v is not None}
    if update_data:
        update_data = prepare_for_mongo(update_data)
        await db.tasks.update_one({"id": task_id}, {"$set": update_data})
        
        # Get updated task
        updated_task = await db.tasks.find_one({"id": task_id})
        return Task(**parse_from_mongo(updated_task))
    
    return Task(**task)

# Performance Routes
@app.post("/api/performance", response_model=Performance)
async def create_performance_evaluation(
    performance_data: PerformanceCreate,
    current_user: User = Depends(require_role(["manager"]))
):
    # Verify task and collaborator exist
    task = await db.tasks.find_one({"id": performance_data.task_id})
    collaborator = await db.users.find_one({"id": performance_data.collaborator_id})
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not collaborator:
        raise HTTPException(status_code=404, detail="Collaborator not found")
    
    performance = Performance(**performance_data.dict(), evaluator_id=current_user.id)
    performance_dict = prepare_for_mongo(performance.dict())
    await db.performance_evaluations.insert_one(performance_dict)
    
    return performance

@app.get("/api/performance/{collaborator_id}", response_model=List[Performance])
async def get_performance_evaluations(
    collaborator_id: str,
    current_user: User = Depends(get_current_user)
):
    # Check permissions
    if current_user.role == "collaborator" and current_user.id != collaborator_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    evaluations = await db.performance_evaluations.find(
        {"collaborator_id": collaborator_id}
    ).to_list(length=None)
    
    return [Performance(**parse_from_mongo(evaluation)) for evaluation in evaluations]

# Notification Routes
@app.get("/api/notifications", response_model=List[Notification])
async def get_notifications(current_user: User = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": current_user.id}
    ).sort("created_at", -1).to_list(length=None)
    
    return [Notification(**parse_from_mongo(notification)) for notification in notifications]

@app.put("/api/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    notification = await db.notifications.find_one({"id": notification_id})
    if not notification or notification["user_id"] != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"is_read": True}}
    )
    
    return {"message": "Notification marked as read"}

# Dashboard & Analytics Routes
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    if current_user.role == "manager":
        total_tasks = await db.tasks.count_documents({"creator_id": current_user.id})
        completed_tasks = await db.tasks.count_documents({
            "creator_id": current_user.id,
            "status": TaskStatus.COMPLETED
        })
        pending_tasks = await db.tasks.count_documents({
            "creator_id": current_user.id,
            "status": TaskStatus.PENDING
        })
        overdue_tasks = await db.tasks.count_documents({
            "creator_id": current_user.id,
            "status": TaskStatus.OVERDUE
        })
        
        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks,
            "overdue_tasks": overdue_tasks,
        }
    else:
        my_tasks = await db.tasks.count_documents({"assignee_id": current_user.id})
        completed = await db.tasks.count_documents({
            "assignee_id": current_user.id,
            "status": TaskStatus.COMPLETED
        })
        pending = await db.tasks.count_documents({
            "assignee_id": current_user.id,
            "status": TaskStatus.PENDING
        })
        
        # Get average performance scores
        evaluations = await db.performance_evaluations.find(
            {"collaborator_id": current_user.id}
        ).to_list(length=None)
        
        avg_punctuality = 0
        avg_quality = 0
        if evaluations:
            avg_punctuality = sum(e["punctuality_score"] for e in evaluations) / len(evaluations)
            avg_quality = sum(e["quality_score"] for e in evaluations) / len(evaluations)
        
        return {
            "my_tasks": my_tasks,
            "completed_tasks": completed,
            "pending_tasks": pending,
            "avg_punctuality_score": round(avg_punctuality, 2),
            "avg_quality_score": round(avg_quality, 2),
        }

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc)}

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()