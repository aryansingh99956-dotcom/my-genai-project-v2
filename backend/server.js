 require("dotenv").config({ path: "./.env"});
 console.log("MONGO_URI:", process.env.MONGO_URI);
 const app = require("./app");
 const connectToDB = require("./config/database");
 const interviewRoutes = require("./src/routes/interview.routes");
 app.use("/api/interview",interviewRoutes);
 connectToDB();
 

 app.listen(3000, () => {
    console.log("Server is running on port 3000");
   });