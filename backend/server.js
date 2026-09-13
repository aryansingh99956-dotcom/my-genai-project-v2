 require("dotenv").config({
  path: "./.env",
});

console.log(
  "MONGO_URI:",
  process.env.MONGO_URI ? "Loaded" : "Missing"
);

const app = require("./app");
const connectToDB = require("./config/database");

const interviewRoutes = require("./src/routes/interview.routes");


// ==========================================
// ROUTES
// ==========================================

app.use("/api/interview", interviewRoutes);


// ==========================================
// DATABASE
// ==========================================

connectToDB();


// ==========================================
// SERVER
// ==========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});