# HR Management System (HRMS)

A full-stack web application for managing employees, attendance, Daily Activity Reports (DARs) and leave requests, with role-based dashboards for **HR/Admin** and **Employee** users.

| | |
|---|---|
| **Live frontend** | https://hr-management-system-git-main-ansh11kas-projects.vercel.app/|
| **Backend API base URL** | https://hr-management-system-9zw2.onrender.com/api |
| **Repository** | https://github.com/ANSH11KA/hr-management-system |
| **Candidate** | `<your name>` |

> The backend runs on Render's free tier, which sleeps after inactivity. The first request can take 30 to 50 seconds. Open the API URL once and wait before using the app.

### Demo accounts (fictional data)

| Role | Email | Password |
|---|---|---|
| HR / Admin | `hr@demo.com` | `Password@123` |
| Employee | `emp@demo.com` | `Password@123` |

Credentials are also shared privately with the coordinator.

---

## Features

**Authentication and authorisation**
- JWT login, logout (token removal on the client), and a `/auth/me` endpoint
- Role-based access control (`admin` = HR/Admin, `employee`) enforced on the server for every protected route
- Protected frontend routes and role-specific navigation
- Passwords hashed with bcrypt; invalid credentials and unauthorised access return clear messages

**Employee management (HR/Admin)**
- Add, view, edit, search, filter (department, status), paginate and deactivate employees
- Fields: employee ID, name, work email, phone, department, designation, joining date, employment status, reporting manager
- Duplicate employee IDs and emails are rejected (unique indexes, `409`)
- Setting status to `inactive` or `terminated` also disables login
- Employees can view their own profile only

**Attendance**
- Employees check in and check out; working duration is calculated
- Duplicate check-ins, check-out without check-in, and double check-outs are handled with clear errors
- Employee history with a month picker and monthly summary
- HR view with date, status, department and employee filters

**Daily Activity Reports**
- Report date, work completed, tasks in progress, blockers, next-day plan, submission timestamp
- One report per employee per day; editable only by its owner on the day it is for
- HR can filter by department and date range

**Leave management**
- Employees apply (type, dates, reason), track Pending / Approved / Rejected / Cancelled, and cancel their own pending requests
- HR approves or rejects with a decision note; reviewer and review time are shown
- Date-range validation and overlap prevention

**Dashboards (all counts come from the backend)**
- HR: active employees, present, absent, on leave today, pending leave requests, DARs submitted and missing, recent leave requests and reports
- Employee: today's attendance, today's DAR status, latest leave status, quick actions, recent activity
- Loading, error and empty states on every page

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), React Router, Tailwind CSS v4, Axios, lucide-react |
| Backend | Node.js 22, Express 5, Mongoose 9 |
| Database | MongoDB Atlas |
| Auth | JWT (`jsonwebtoken`), `bcryptjs` |
| Hardening | `helmet`, `cors`, `express-rate-limit` |
| Deployment | Vercel (frontend), Render (backend), MongoDB Atlas (database) |

---

## Project structure

```
hr-management-system/
├── server/
│   ├── src/
│   │   ├── config/        db.js, dns.js
│   │   ├── models/        User, Employee, Attendance, DailyReport, LeaveRequest
│   │   ├── middleware/    auth.js (protect, authorize), error.js
│   │   ├── controllers/   auth, employee, attendance, report, leave, dashboard, wrap
│   │   ├── routes/        index.js
│   │   ├── utils/         time.js (business-timezone helpers)
│   │   ├── app.js
│   │   └── seed.js
│   ├── .env.example
│   └── package.json
└── client/
    ├── src/
    │   ├── api.js
    │   ├── context/       AuthContext.js, AuthProvider.jsx
    │   ├── hooks/         useAuth.js
    │   ├── components/    Layout, ProtectedRoute, StatusBadge, Alert
    │   └── pages/         Login, Dashboard, Employees, Attendance, Reports, Leaves, Profile
    ├── vercel.json
    └── .env.example
```

**Request flow:** `route → protect (JWT) → authorize (role) → controller → model → error handler`

---

## Local setup

**Prerequisites:** Node.js 20 or newer (22 LTS recommended) and a MongoDB Atlas cluster or local MongoDB.

### 1. Clone

```bash
git clone https://github.com/ANSH11KA/hr-management-system.git
cd hr-management-system
```

### 2. Backend

```bash
cd server
npm install
cp .env.example .env      # Windows PowerShell: copy .env.example .env
# edit .env with your values (see the table below)
npm run seed              # creates the demo users
npm run dev               # http://localhost:5000
```

Expected output: `MongoDB connected` and `API running`.

### 3. Frontend

```bash
cd client
npm install
cp .env.example .env
npm run dev               # http://localhost:5173
```

> Run every `npm` command from inside `server/` or `client/`, not the repository root. Restart Vite after editing `client/.env`.

### Environment variables

`server/.env`

| Variable | Description |
|---|---|
| `PORT` | API port (default `5000`) |
| `MONGO_URI` | MongoDB connection string, including the database name (`/hrms`) |
| `JWT_SECRET` | Long random string used to sign tokens |
| `CLIENT_URL` | Allowed frontend origin(s), comma-separated, no trailing slash |

`client/.env`

| Variable | Description |
|---|---|
| `VITE_API_URL` | API base URL, e.g. `http://localhost:5000/api` |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Real `.env` files are git-ignored. Only `.env.example` files with placeholders are committed.

### Troubleshooting

| Problem | Fix |
|---|---|
| `querySrv ECONNREFUSED` | The network blocks SRV DNS lookups. `server/src/config/dns.js` forces public DNS for Node; or use Atlas's non-SRV `mongodb://` connection string |
| Requests go to port 5173 | `VITE_API_URL` is missing, or Vite was not restarted |
| CORS error | The frontend origin is not in `CLIENT_URL` (or the allow-list in `app.js`) |
| `Invalid email or password` on a fresh database | Run `npm run seed` against that database |
| Atlas TLS or timeout error on Render | Allow `0.0.0.0/0` in Atlas Network Access and make sure the cluster is not paused |

---

## API overview

Base path: `/api`. All routes except login require `Authorization: Bearer <token>`.

| Area | Method and path | Access |
|---|---|---|
| Auth | `POST /auth/login` | Public (rate limited) |
| | `GET /auth/me` | Any logged-in user |
| Employees | `POST /employees` | Admin |
| | `GET /employees?search=&department=&status=&page=&limit=` | Admin |
| | `GET /employees/:id` | Admin, or the employee's own record |
| | `PUT /employees/:id` | Admin |
| | `PATCH /employees/:id/deactivate` | Admin |
| Attendance | `POST /attendance/check-in` | Employee |
| | `POST /attendance/check-out` | Employee |
| | `GET /attendance/me?month=YYYY-MM` | Employee |
| | `GET /attendance?date=&status=&department=&employee=` | Admin |
| Reports (DAR) | `POST /reports` | Employee |
| | `PUT /reports/:id` | Employee (own, same day only) |
| | `GET /reports/me` | Employee |
| | `GET /reports?employee=&department=&from=&to=` | Admin |
| Leaves | `POST /leaves` | Employee |
| | `GET /leaves/me` | Employee |
| | `PATCH /leaves/:id/cancel` | Employee (own, pending only) |
| | `GET /leaves?status=` | Admin |
| | `PATCH /leaves/:id/approve` and `/reject` (body: `{ "note": "..." }`) | Admin |
| Dashboard | `GET /dashboard` | Role-specific response |

**Status codes:** `400` validation error, `401` not authenticated or bad token, `403` forbidden or deactivated account, `404` not found, `409` duplicate or conflict, `413` body too large, `429` rate limited, `500` generic server error (stack traces are never sent to clients).

Example:

```bash
curl -X POST https://hr-management-system-9zw2.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hr@demo.com","password":"Password@123"}'
```

---

## Database design

MongoDB with Mongoose. Relationships use `ObjectId` references.

| Collection | Key fields | References |
|---|---|---|
| `users` | name, email, passwordHash (`select: false`), role, isActive | none |
| `employees` | employeeId, phone, department, designation, joiningDate, employmentStatus | `user` to User, `manager` to Employee |
| `attendances` | date (`YYYY-MM-DD`), checkInAt, checkOutAt, totalMinutes, status | `employee` to Employee |
| `dailyreports` | reportDate (`YYYY-MM-DD`), workCompleted, inProgress, blockers, nextDayPlan, submittedAt | `employee` to Employee |
| `leaverequests` | leaveType, startDate, endDate, reason, status, reviewNote, reviewedAt | `employee` to Employee, `reviewedBy` to User |

**Indexes**

| Collection | Index | Purpose |
|---|---|---|
| `users` | `email` (unique) | Unique work email, fast login lookup |
| `employees` | `employeeId` (unique), `user` (unique), `department`, `{ department, employmentStatus }` | Uniqueness and filters |
| `attendances` | `{ employee, date }` (unique) | One record per employee per day; blocks duplicate check-ins |
| `dailyreports` | `{ employee, reportDate }` (unique) | One DAR per employee per day |
| `leaverequests` | `employee`, `status` | Employee history, pending counts |

**Demo data:** `npm run seed` creates one HR/Admin and one Employee. The script deletes existing users and employees first, so only run it against a database you are happy to reset.

---

## Assumptions and business rules

1. **Business timezone is Asia/Kolkata (IST).** Attendance and DAR dates are stored as `YYYY-MM-DD` strings in IST; timestamps are stored in UTC and displayed in IST. This keeps behaviour identical on a laptop and on Render, which runs in UTC.
2. **Late:** check-in after 09:30 IST.
3. **Half Day:** total worked time under 240 minutes (4 hours) at check-out.
4. **Absent and Leave are computed at query time, not stored.** When HR filters by a single past-or-today weekday, an active employee with no attendance record appears as *Absent*, or as *Leave* if an approved leave covers that date. Weekends and employees who had not yet joined are skipped.
5. **Missing check-out:** shown as "Missing" in the history; the record is kept as is.
6. **One attendance record and one DAR per employee per day** (friendly check plus unique index). Multiple entries per day are not supported.
7. **DAR editing:** only the owner can edit a report, and only on the day it is for. Future dates are rejected.
8. **Leave overlap:** a new request cannot overlap a Pending or Approved request. Rejected and Cancelled requests do not block new ones.
9. **Leave cancellation:** employees can cancel only their own *Pending* requests.
10. **Roles are strictly separated:** HR/Admin accounts manage and review. Attendance, DAR and leave submission are employee-only, enforced by server-side role checks.
11. **Deactivation** sets `employmentStatus` to `inactive` and `User.isActive` to `false`. Existing tokens stop working immediately because `protect` re-checks the account on every request. Admins cannot deactivate themselves.
12. **Logout** removes the token on the client. Tokens are stateless JWTs that expire after 1 day.
13. **Dashboard absent count** = active employees minus present minus on approved leave. Only currently active employees are counted.

---

## Security

- bcrypt password hashing; `passwordHash` is never returned by default (`select: false`)
- JWT verified on every protected request; user and employee identity come from the token, never from the request body
- Role checks (`authorize`) and record-ownership checks on the server; hiding buttons in the UI is only a convenience
- Login rate limit (20 attempts per 15 minutes) and constant-time-style password comparison for unknown emails
- Input validation on client and server; non-string body and query values are rejected to prevent NoSQL operator injection; search input is regex-escaped; update endpoints use field whitelists to prevent mass assignment
- `helmet` security headers, CORS restricted to the deployed frontend origin, JSON body size limit (100 kb)
- Secrets live in environment variables; `.env` is never committed
- Errors are mapped to safe messages; stack traces are logged server-side only

**Known trade-off:** the JWT is kept in `localStorage`, which is simple but exposed to XSS. An httpOnly cookie would be the next hardening step.

---

## Deployment

| Part | Platform | Settings |
|---|---|---|
| Database | MongoDB Atlas (M0) | Database user, network access `0.0.0.0/0`, database name `hrms`, seeded with `npm run seed` |
| Backend | Render Web Service | Root directory `server`, build `npm install`, start `npm start`, Node 22 |
| Frontend | Vercel | Root directory `client`, Vite preset, `VITE_API_URL` set to the Render API URL |

**Render environment variables:** `MONGO_URI`, `JWT_SECRET` (different from local), `CLIENT_URL` (Vercel URL, no trailing slash).

**Vercel environment variable:** `VITE_API_URL=https://hr-management-system-9zw2.onrender.com/api`. Vite embeds this at build time, so redeploy after changing it.

`client/vercel.json` rewrites all paths to `/` so refreshing a React Router page does not return 404:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
```

The backend also sets `trust proxy` so rate limiting sees real client IPs behind Render's proxy.

---

## Known limitations

- Attendance, reports and leave lists are capped at 200 rows (only Employees is paginated)
- The reporting-manager dropdown loads up to 50 employees
- The employee monthly summary counts stored statuses only (Present, Late, Half Day); Absent and Leave are computed for HR's single-date view
- No automated test suite yet (testing was done manually against the acceptance checklist and with API requests)
- No email notifications, leave balances, or password reset flow

---

## Third-party libraries and AI disclosure

**Libraries:** React, React Router, Vite, Tailwind CSS, Axios, lucide-react, Express, Mongoose, jsonwebtoken, bcryptjs, helmet, cors, express-rate-limit, dotenv, nodemon. The Inter font is loaded from Google Fonts.

**AI assistance:** an AI assistant (Claude by Anthropic) was used to help plan the architecture, generate and review code, and debug errors during development. I reviewed, ran and tested the code and can explain every file. All data in this project is fictional.

---

## Screenshots / walkthrough

Screenshots or a short screen recording of the core workflows are available in the `docs/` folder: login, HR dashboard, employee management, check-in and check-out, DAR submission, leave request and approval.
