# HR Management System (HRMS)

A full-stack web application for managing employees, attendance, Daily Activity Reports (DARs) and leave requests, with role-based dashboards for **HR/Admin** and **Employee** users.

| | |
|---|---|
| **Live frontend** | `https://<your-app>.vercel.app` |
| **Backend API** | `https://<your-api>.onrender.com/api` |
| **Repository** | `https://github.com/<your-username>/hr-management-system` |
| **Candidate** | `<your name>` |

> The Render free tier sleeps after inactivity. Open the API URL once and wait ~30 seconds before using the live app.

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
- Changing employment status to `inactive` or `terminated` also disables login
- Employees can view their own profile only

**Attendance**
- Employees check in and check out; duration is calculated
- Duplicate check-ins, check-out without check-in, and double check-outs are handled with clear errors
- Employee history with a month picker and monthly summary
- HR view with date, status, department and employee filters

**Daily Activity Reports**
- Report date, work completed, tasks in progress, blockers, next-day plan, submission timestamp
- One report per employee per day; editable only on the day it is for
- HR can filter by department and date range

**Leave management**
- Employees apply (type, dates, reason), see Pending / Approved / Rejected / Cancelled, and cancel their own pending requests
- HR approves or rejects with a decision note; the reviewer and review time are shown
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
| Backend | Node.js, Express 5, Mongoose 9 |
| Database | MongoDB (Atlas) |
| Auth | JWT (`jsonwebtoken`), `bcryptjs` |
| Hardening | `helmet`, `cors`, `express-rate-limit` |
| Deployment | Vercel (frontend), Render (backend), MongoDB Atlas |

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

---

## Local setup

**Prerequisites:** Node.js 20+, and a MongoDB Atlas cluster (or local MongoDB).

### 1. Clone

```bash
git clone https://github.com/<your-username>/hr-management-system.git
cd hr-management-system
```

### 2. Backend

```bash
cd server
npm install
cp .env.example .env      # Windows PowerShell: copy .env.example .env
# edit .env with your values (see table below)
npm run seed              # creates demo users
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

> Run every `npm` command from inside `server/` or `client/`. Restart Vite after editing `client/.env`.

### Environment variables

`server/.env`

| Variable | Description |
|---|---|
| `PORT` | API port (default `5000`) |
| `MONGO_URI` | MongoDB connection string, including the database name (`/hrms`) |
| `JWT_SECRET` | Long random string used to sign tokens |
| `CLIENT_URL` | Allowed CORS origin, e.g. `http://localhost:5173` (no trailing slash) |

`client/.env`

| Variable | Description |
|---|---|
| `VITE_API_URL` | API base URL, e.g. `http://localhost:5000/api` |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Real `.env` files are git-ignored. Only `.env.example` files with placeholders are committed.

### Demo accounts (fictional data)

| Role | Email | Password |
|---|---|---|
| HR / Admin | `hr@demo.com` | `Password@123` |
| Employee | `emp@demo.com` | `Password@123` |

Credentials are also shared privately with the coordinator.

### Troubleshooting

- **`querySrv ECONNREFUSED`:** your network blocks SRV DNS lookups. `server/src/config/dns.js` forces public DNS servers for Node; alternatively use Atlas's non-SRV (`mongodb://`) connection string.
- **Requests go to port 5173:** `VITE_API_URL` is missing or Vite was not restarted.
- **CORS error:** `CLIENT_URL` must match the frontend origin exactly.

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
| | `PATCH /leaves/:id/approve` and `/reject` (body: `{ note }`) | Admin |
| Dashboard | `GET /dashboard` | Role-specific response |

**Status codes:** `400` validation, `401` not authenticated or bad token, `403` forbidden or deactivated account, `404` not found, `409` duplicate or conflict, `413` body too large, `500` generic server error (no stack traces are sent to clients).

A Postman collection can be placed in `docs/postman_collection.json`.

---

## Database design

MongoDB with Mongoose. Relationships use `ObjectId` references.

| Collection | Key fields | References |
|---|---|---|
| `users` | name, email, passwordHash (`select: false`), role, isActive | none |
| `employees` | employeeId, phone, department, designation, joiningDate, employmentStatus | `user` to `User`, `manager` to `Employee` |
| `attendances` | date (`YYYY-MM-DD`), checkInAt, checkOutAt, totalMinutes, status | `employee` to `Employee` |
| `dailyreports` | reportDate (`YYYY-MM-DD`), workCompleted, inProgress, blockers, nextDayPlan, submittedAt | `employee` to `Employee` |
| `leaverequests` | leaveType, startDate, endDate, reason, status, reviewNote, reviewedAt | `employee` to `Employee`, `reviewedBy` to `User` |

**Indexes**

| Collection | Index | Purpose |
|---|---|---|
| `users` | `email` (unique) | Unique work email, fast login lookup |
| `employees` | `employeeId` (unique), `user` (unique), `department`, `{ department, employmentStatus }` | Uniqueness, filters |
| `attendances` | `{ employee, date }` (unique) | One record per employee per day; blocks duplicate check-ins |
| `dailyreports` | `{ employee, reportDate }` (unique) | One DAR per employee per day |
| `leaverequests` | `employee`, `status` | Employee history, pending counts |

Demo data is created by `npm run seed` (one HR/Admin and one Employee). The seed deletes existing users and employees first.

---

## Assumptions and business rules

1. **Business timezone is Asia/Kolkata (IST).** Attendance and DAR dates are stored as `YYYY-MM-DD` strings in IST; timestamps are stored in UTC and displayed in IST. This keeps behaviour identical on a developer laptop and on Render (which runs in UTC).
2. **Late:** check-in after 09:30 IST.
3. **Half Day:** total worked time under 240 minutes (4 hours) at check-out.
4. **Absent and Leave are computed at query time, not stored.** When HR filters by a single past-or-today weekday, an active employee with no attendance record is shown as *Absent*, or as *Leave* if an approved leave covers that date. Weekends and employees who had not yet joined are skipped.
5. **Missing check-out:** shown as "Missing" in the history; the record is kept.
6. **One attendance record and one DAR per employee per day** (unique indexes plus friendly checks). Multiple entries are not supported.
7. **DAR editing:** a report can be edited only by its owner and only on the day it is for. Future dates are rejected.
8. **Leave overlap:** a new request cannot overlap a Pending or Approved request. Rejected and Cancelled requests do not block new ones.
9. **Leave cancellation:** employees can cancel only their own *Pending* requests.
10. **Roles are strictly separated:** HR/Admin accounts manage and review. Attendance, DAR and leave submission are employee-only, enforced by server-side role checks.
11. **Deactivation** sets `employmentStatus` to `inactive` and `User.isActive` to `false`. Existing tokens stop working immediately because `protect` re-checks the account on each request. Admins cannot deactivate themselves.
12. **Logout** removes the token on the client. Tokens are stateless JWTs that expire after 1 day.
13. **Dashboard "absent"** = active employees minus present minus on approved leave.

---

## Security

- bcrypt password hashing; `passwordHash` is never returned by default (`select: false`)
- JWT verified on every protected request; the user and employee identity come from the token, never from the request body
- Role checks (`authorize`) and record-ownership checks on the server; frontend hiding is only a convenience
- Login rate limit (20 attempts per 15 minutes) and equal-time password comparison for unknown emails
- Input validation on both client and server; non-string query and body values are rejected to prevent NoSQL operator injection; regex search input is escaped
- `helmet` headers, CORS limited to the deployed frontend origin, JSON body size limit (100 kb)
- Secrets live in environment variables; `.env` is never committed
- Errors are mapped to safe messages; stack traces are logged server-side only

**Known trade-off:** the JWT is kept in `localStorage`, which is simple but exposed to XSS. An httpOnly cookie would be the next hardening step.

---

## Deployment

1. **MongoDB Atlas:** create an M0 cluster and a database user, allow `0.0.0.0/0` under Network Access, copy the connection string with `/hrms`, then run `npm run seed` once against it.
2. **Render (backend):** Web Service, root directory `server`, build `npm install`, start `npm start`. Set `MONGO_URI`, `JWT_SECRET` (a different value from local) and `CLIENT_URL`.
3. **Vercel (frontend):** root directory `client`, framework Vite, set `VITE_API_URL=https://<your-api>.onrender.com/api`. `client/vercel.json` rewrites all paths to `/` so React Router refreshes do not 404:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
   ```
4. Set `CLIENT_URL` on Render to the final Vercel URL (no trailing slash) and redeploy.

---

## Known limitations

- Attendance, reports and leave lists are capped at 200 rows (only Employees is paginated)
- The reporting-manager dropdown loads up to 50 employees
- The employee monthly summary counts stored statuses only (Present, Late, Half Day); Absent and Leave are computed for HR's single-date view
- No email notifications, leave balances, or password reset flow

---

## Third-party libraries and AI disclosure

**Libraries:** React, React Router, Vite, Tailwind CSS, Axios, lucide-react, Express, Mongoose, jsonwebtoken, bcryptjs, helmet, cors, express-rate-limit, dotenv, nodemon. The Inter font is loaded from Google Fonts.

**AI assistance:** an AI assistant (Claude by Anthropic) was used to help plan the architecture, generate and review code, and debug errors during development. All code was reviewed, run and tested by me, and I can explain every file. All data in this project is fictional.

---

## Screenshots / walkthrough

Add screenshots or a link to a short screen recording in `docs/` covering: login, HR dashboard, employee management, check-in/out, DAR submission, leave request and approval.
