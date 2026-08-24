const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: [ "http://localhost:5173",

    "https://my-genai-project-v2.vercel.app"],
    credentials: true
}))
console.log("cookie parser loaded");


/* require all the routes here */
const authRouter = require("./src/routes/auth.routes");
const interviewRouter = require("./src/routes/interview.routes")

/* using all the routes here */
app.use("/api/auth", authRouter); 
app.use("/api/interview", interviewRouter)



module.exports = app; 