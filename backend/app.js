const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();

// =========================================================
// MIDDLEWARE
// =========================================================

app.use(express.json());
app.use(cookieParser());

// =========================================================
// CORS
// =========================================================

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without an origin
      if (!origin) {
        return callback(null, true);
      }

      // Local development
      if (origin === "http://localhost:5173") {
        return callback(null, true);
      }

      // Production + Vercel preview deployments
      if (
        origin === "https://my-genai-project-v2.vercel.app" ||
        origin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// =========================================================
// ROUTES
// =========================================================

const authRouter = require("./src/routes/auth.routes");
const interviewRouter = require("./src/routes/interview.routes");

// Authentication routes
app.use("/api/auth", authRouter);

// Interview routes
app.use("/api/interview", interviewRouter);

// =========================================================
// TEST ROUTE
// =========================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "MY GENAI backend is running",
  });
});

// =========================================================
// EXPORT
// =========================================================

module.exports = app;