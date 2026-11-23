
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

app.set("trust proxy", 1);

// Allowed frontend origins
const clean = (s) => s.trim().replace(/\/+$/, "");

const fromEnv = (process.env.CLIENT_URL || "")
  .split(",")
  .map(clean)
  .filter(Boolean);

const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? fromEnv
    : [...fromEnv, "http://localhost:5173"];

console.log("CORS allowed origins:", allowedOrigins);

app.use(helmet());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }

      console.warn("Blocked CORS origin:", origin);
      return cb(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "100kb" }));

// Login rate limiter
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message: "Too many login attempts. Please try again in 15 minutes.",
    },
  })
);

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 5000, () => {
      console.log("API running");
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  });
