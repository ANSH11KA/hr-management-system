// app.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/error.js";
import "./config/dns.js";
import "dotenv/config";
// ...rest of your existing imports

const app = express();
app.use(helmet());
const allowedOrigins = [
  "https://hr-management-system-three-nu.vercel.app",
  "http://localhost:5173",
  ...(process.env.CLIENT_URL || "").split(","),
]
  .map(s => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

console.log("CORS allowed origins:", allowedOrigins);

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
}));
app.use(express.json({ limit: "100kb" }));
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);

connectDB().then(() =>
  app.listen(process.env.PORT || 5000, () => console.log("API running"))
);