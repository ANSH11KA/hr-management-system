// app.js
import "./config/dns.js";
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/error.js";

const app = express();

// Render puts a reverse proxy in front of the app. Trusting the first proxy lets
// req.ip, and therefore the rate limiter, see the real client IP instead of the proxy's.
app.set("trust proxy", 1);

// Allowed browser origins come only from CLIENT_URL on the server
// (comma-separated, trailing slashes are ignored). Nothing is hard-coded.
const clean = s => s.trim().replace(/\/+$/, "");
const fromEnv = (process.env.CLIENT_URL || "").split(",").map(clean).filter(Boolean);
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? fromEnv
    : [...fromEnv, "http://localhost:5173"]; // local development only

if (fromEnv.length === 0) console.warn("CLIENT_URL is not set: no deployed frontend origin is allowed");
console.log("CORS allowed origins:", allowedOrigins);

app.use(helmet());
app.use(
  cors({
    // requests without an Origin header (curl, Postman, server-to-server) are allowed
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  })
);
app.use(express.json({ limit: "100kb" }));

// Only failed attempts count, so a user who logs in correctly is never locked out by it
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts. Please try again in 15 minutes." },
  })
);

app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);

connectDB()
  .then(() => app.listen(process.env.PORT || 5000, () => console.log("API running")))
  .catch(err => {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  });