# Collaborator Task Platform

A web-based platform for coordinating team tasks, scheduling meetings, evaluating task performance, and monitoring team activity. The application provides separate **Manager** and **Collaborator** workspaces and centralises day-to-day team coordination in one place.

> **Stack:** React · FastAPI · MongoDB Atlas  
> **Development approach:** Scrum, organised into three sprints

---

## Table of contents

- [Overview](#overview)
- [Main features](#main-features)
- [Roles and permissions](#roles-and-permissions)
- [Technology stack](#technology-stack)
- [System architecture](#system-architecture)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Run the application locally](#run-the-application-locally)
- [API documentation](#api-documentation)
- [Task lifecycle](#task-lifecycle)
- [Performance evaluation](#performance-evaluation)
- [Meeting workflow](#meeting-workflow)
- [Security and data management](#security-and-data-management)
- [Validation and testing](#validation-and-testing)
- [Known limitations](#known-limitations)
- [Development roadmap](#development-roadmap)

---

## Overview

The Collaborator Task Platform is designed for small teams that need a shared space to organise work and follow up on its progress.

- **Managers** can create and assign tasks, coordinate meetings, review completed work, evaluate collaborator performance, and consult team-level indicators.
- **Collaborators** can manage their assigned work, provide completion evidence, participate in meetings, and review their own performance history.

The application follows a **three-tier architecture**:

1. **Presentation layer** — a React single-page application.
2. **Business layer** — a Python FastAPI REST API that enforces application rules and permissions.
3. **Data layer** — MongoDB Atlas, accessed asynchronously through Motor.

The project was developed incrementally using the **Scrum** methodology and organised into **three development sprints**.

---

## Main features

### Authentication and user management

- Login and logout using JSON Web Tokens (JWT).
- Role-based navigation and protected routes for Managers and Collaborators.
- Initial Manager account provisioning by the backend startup routine.
- Manager account creation by an existing Manager.
- Collaborator account administration, including profile updates and account deactivation.
- Deactivation preserves historical records rather than deleting the user's task and evaluation history.

### Task management

- Create tasks with a title, description, priority, due date, and assigned Collaborator.
- Edit and delete tasks subject to ownership permissions.
- List and Kanban views for organising work.
- Filter tasks and follow their status.
- Collaborators can start and complete their assigned tasks.
- Task completion can include notes and evidence files.
- Managers can create reusable task templates and instantiate them as tasks.

### Meeting management and calendar

- Create, edit, and delete meetings.
- Select meeting participants and display participant responses.
- Interactive calendar with month, week, day, and agenda views.
- Server-side conflict detection when creating or updating meetings.
- Participants can accept or decline invitations.
- Managers can invite both Collaborators and other Managers.
- An invited Manager can view and respond to the invitation, but cannot edit or delete a meeting organised by another Manager.

### Performance evaluation

- Managers evaluate tasks completed by their assigned Collaborators.
- Two evaluation dimensions are recorded: **punctuality** and **quality**, each scored from 1 to 5.
- The overall performance score is the arithmetic mean of the two scores.
- Optional written feedback can be attached to an evaluation.
- Evaluation records are stored as history; the latest evaluation is also copied onto the task for convenient display.
- Managers can re-evaluate tasks while preserving previous evaluation records.
- Collaborators can consult their own evaluation history and personal performance indicators.

### Dashboards and analytics

- Manager dashboard with task, team, meeting, and performance information.
- Collaborator dashboard with assigned tasks and personal performance indicators.
- Task status and priority summaries.
- Team performance indicators for Managers.
- CSV exports for supported task, evaluation, and analytics data.

### Notifications

- Persistent in-application notifications for task, meeting, evaluation, and user-management events.
- Read/unread notification state.
- Notification management, including reading and archiving or deleting notifications where supported by the interface.
- Role-aware notification messages for events such as task completion, evaluation, Manager account creation, and Collaborator profile updates or deactivation.

---

## Roles and permissions

### Manager

A Manager can:

- Manage tasks that they created.
- Assign tasks to Collaborators.
- Review and evaluate completed tasks that they own.
- View performance information associated with their own team and tasks.
- Create and manage meetings that they organise.
- Invite Collaborators and other Managers to meetings.
- Create task templates and manage permitted user accounts.

> A Manager must **not** access or modify another Manager's private tasks or private dashboard data. A Manager invited to another Manager's meeting can view and respond to that meeting, but does not become its organiser.

### Collaborator

A Collaborator can:

- View tasks assigned to them, including assignments made by different Managers.
- Update the status of their assigned tasks and submit completion notes or evidence.
- View meetings to which they are invited and accept or decline invitations.
- Consult their own performance indicators and evaluation history.
- Consult and manage their own notifications.

> A Collaborator cannot evaluate tasks or modify tasks belonging to another user.

---

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React, JavaScript, Tailwind CSS, shadcn/ui |
| UI and interaction | React Router, Axios, Sonner, React Big Calendar, Moment.js, Lucide icons |
| Backend | Python, FastAPI, Pydantic |
| Database access | Motor (asynchronous MongoDB driver), PyMongo/BSON utilities |
| Database | MongoDB Atlas |
| Authentication | JWT; bcrypt password hashing, with compatibility migration for legacy salted SHA-256 hashes |
| API documentation | FastAPI / Swagger UI |

---

## System architecture

```text
Browser
  │
  ▼
React frontend (localhost:3000)
  │
  │  HTTP requests with JWT Authorization header
  ▼
FastAPI backend (localhost:8000)
  │
  │  Motor asynchronous database operations
  ▼
MongoDB Atlas
```

The backend is responsible for authentication, validation, role-based access control, task and meeting rules, evaluation recording, and notification creation. The frontend provides the user interface and calls the REST API.

### Main MongoDB collections

| Collection | Purpose |
|---|---|
| `users` | Manager and Collaborator accounts and account status |
| `tasks` | Task data, assignment, status, completion information, and latest evaluation fields |
| `task_templates` | Reusable task definitions created by Managers |
| `meetings` | Meeting details, organiser, participants, and participant responses |
| `performance_evaluations` | Historical task performance evaluations |
| `notifications` | Persistent user notifications |

---

## Project structure

```text
thesis/
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   ├── .env                 # Local secrets; do not commit
│   └── uploads/
│       └── evidence/        # Locally stored task completion evidence
│
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── public/
│   └── src/
│       ├── App.js
│       ├── App.css
│       ├── index.js
│       └── components/
│           ├── ManagerDashboard.js
│           ├── CollaboratorDashboard.js
│           ├── LoginPage.js
│           ├── TaskList.js
│           ├── KanbanView.js
│           ├── TaskDetails.js
│           ├── TaskCompletion.js
│           ├── CreateTaskModal.js
│           ├── EditTaskModal.js
│           ├── TaskTemplates.js
│           ├── CreateMeetingModal.js
│           ├── EditMeetingModal.js
│           ├── EnhancedCalendar.js
│           ├── MeetingResponsesModal.js
│           ├── PerformanceEvaluationModal.js
│           ├── AnalyticsDashboard.js
│           ├── RealTimeMetrics.js
│           ├── ExportManager.js
│           └── NotificationPanel.js
│
└── README.md
```

The structure above highlights the principal application files. The repository also contains shared UI components, styles, configuration files, and other supporting components.

---

## Prerequisites

- **Python** — a version compatible with the packages in `backend/requirements.txt`.
- **Node.js and npm**.
- **MongoDB Atlas** cluster, or another MongoDB connection string accessible to the backend.
- **Git** (optional, for cloning and version control).

---

## Configuration

### 1. Backend environment variables

Create a file named `.env` inside the `backend/` directory. The backend loads this file from the directory containing `server.py`.

```env
SECRET_KEY=replace-with-a-long-random-secret
MONGO_URL=mongodb+srv://<username>:<password>@<cluster>/<database-options>
DB_NAME=collaborator_task_platform
```

| Variable | Description |
|---|---|
|SECRET_KEY=b4cc5662281797001348b1458e7105f6c26be6c0fc9b4663c3b095357689773f
MONGO_URL="mongodb+srv://yassine:yassine1234@cluster0.dpd4z6a.mongodb.net/?retryWrites=true&w=majority"
DB_NAME="collaborator_platform_demo"

MANAGER_EMAIL=manager@myaplication.com
MANAGER_FULL_NAME=System Manager
MANAGER_PASSWORD=UnMotDePassFort



### 2. Frontend API address

The frontend exports an API base address from `frontend/src/App.js`. Confirm that it points to the backend API used by your local environment. For the default local backend, it should target:

```text
http://127.0.0.1:8000/api
```

The backend CORS configuration in the current development setup permits the local frontend origins `http://localhost:3000` and `http://127.0.0.1:3000`.

---

## Run the application locally

Run the backend and frontend in **two separate terminals**.

### 1. Start the backend

From the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m uvicorn server:app --reload
```

The API is then available at `http://127.0.0.1:8000`.

The backend startup routine checks or provisions the initial Manager account. The actual initial account credentials depend on the backend's account initialisation configuration; do not assume default credentials.

### 2. Start the frontend

Open a second terminal at the repository root:

```powershell
cd frontend
npm install
npm start
```

The React development server is normally available at `http://localhost:3000`.

### 3. Log in

Open `http://localhost:3000` in a browser and log in with an account provisioned for the application. Manager and Collaborator accounts are redirected to their role-specific dashboard.

> If the browser displays authentication errors immediately after opening the application, log in first and then inspect the subsequent API responses. Protected API calls require a valid JWT access token.

---

## API documentation

FastAPI exposes interactive API documentation while the backend is running:

| Resource | URL |
|---|---|
| Swagger UI | http://127.0.0.1:8000/docs |
| ReDoc | http://127.0.0.1:8000/redoc |
| Health endpoint | http://127.0.0.1:8000/api/health |

Swagger UI can be used to inspect endpoints, submit requests, and review HTTP responses. Protected endpoints require a valid Bearer token.

---

## Task lifecycle

1. A Manager creates a task and assigns it to a Collaborator.
2. The Collaborator views the task and changes its status while working on it.
3. The Collaborator submits completion notes and, where applicable, evidence files.
4. The task enters the `not_evaluated` state, displayed as **Awaiting Evaluation**.
5. The Manager reviews the result and submits the performance evaluation.
6. The task status becomes `completed`; the evaluation is stored in the evaluation history and the latest scores are reflected on the task.

```text
pending ──► in_progress ──► not_evaluated ──► completed
                              (Awaiting       (evaluated)
                               Evaluation)
```

Main task statuses: `pending`, `in_progress`, `not_evaluated`, `completed`, and `overdue` (where applicable).

---

## Performance evaluation

Each evaluation records:

| Field | Description |
|---|---|
| `punctuality_score` | Integer from 1 to 5 |
| `quality_score` | Integer from 1 to 5 |
| `comments` | Optional written feedback |
| Identifiers and date | Evaluator, Collaborator, task, and creation date |

The overall score is calculated as:

```text
Overall score = (Punctuality score + Quality score) / 2
```

Each evaluation is retained as a separate historical record in `performance_evaluations`. When a task is re-evaluated, the new evaluation is added to the history rather than replacing previous records.

---

## Meeting workflow

A Manager creates a meeting, selects its date and time, and invites participants. The backend checks for scheduling conflicts before accepting a creation or update. Invited participants can accept or decline the invitation. The organiser can consult the collected responses and manage the meeting.

The platform supports invitations to both Collaborators and other Managers. An invited Manager is treated as a participant for that meeting; organiser-only actions remain restricted to the Manager who created it.

---

## Security and data management

- Protected API operations use JWT authentication.
- Backend dependencies enforce role-based access control.
- Managers are restricted to their own private task and dashboard data.
- Collaborators can access their own account information and assigned tasks.
- Account deactivation preserves historical records.
- New password hashes use bcrypt; legacy salted SHA-256 hashes are supported through a migration mechanism after successful authentication.
- CORS is restricted to the configured local frontend origins in the development setup.
- Evidence files are stored locally by the current backend implementation, under its `uploads/evidence` directory.

> For any deployment beyond local development, review CORS origins, secret management, database permissions, file storage, logging, and account provisioning before exposing the application publicly.

---

## Validation and testing

The application has been validated primarily through **manual functional testing** in the local development environment, using both Manager and Collaborator accounts and the FastAPI Swagger UI for API checks.

The principal workflows covered include authentication, task creation and assignment, task completion with evidence, meeting scheduling and conflict checks, invitation responses, performance evaluation, notifications, dashboards, analytics, CSV export, and user-account administration.

Formal load testing, a structured external usability study, and comprehensive automated test coverage have not been established as part of the reported validation. This README therefore does not claim production-scale performance or formal user-study results.

---

## Known limitations

- The application is currently a web application; no dedicated mobile app is provided.
- Notifications are internal to the platform; email, SMS, and push delivery are not implemented.
- Meetings are not synchronised with external calendar services such as Google Calendar or Microsoft Outlook.
- Evidence files use local server storage in the current implementation; a durable object-storage service would be preferable for production.
- The application has been exercised in a development environment; a public production deployment and external pilot remain separate activities.
- Formal load testing and external usability evaluation remain future work.
- Analytics are descriptive; predictive or forecasting analytics are not implemented.

---

## Development roadmap

Possible future improvements include:

- Deploy the frontend and backend to managed hosting with secure environment configuration.
- Introduce scalable object storage for completion evidence.
- Add email, SMS, or push notification integrations.
- Integrate external calendar services.
- Expand automated backend and frontend test coverage.
- Conduct load, security, and usability testing with representative users.
- Extend analytics with trend analysis and forecasting where justified by data.

---

**Project:** Collaborator Task Platform  
**Architecture:** React + FastAPI + MongoDB Atlas  
**Development approach:** Scrum, organised into three sprints