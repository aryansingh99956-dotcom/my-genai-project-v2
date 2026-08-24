const express = require("express");

const authMiddleware =
  require("../middleware/auth.middleware");

const interviewController =
  require("../../controller/interview.controller");

const upload =
  require("../middleware/file.middleware");


const interviewRouter =
  express.Router();


// =========================================================
// GENERATE INTERVIEW REPORT
// =========================================================

interviewRouter.post(

  "/",

  authMiddleware.authUser,

  upload.single("resume"),

  interviewController.generateInterviewController

);


// =========================================================
// GET INTERVIEW REPORT
// =========================================================

interviewRouter.get(

  "/report/:interviewId",

  authMiddleware.authUser,

  interviewController.getInterviewReportByIdController

);


// =========================================================
// GENERATE RESUME PDF
// =========================================================

interviewRouter.post(

  "/resume/pdf/:interviewReportId",

  authMiddleware.authUser,

  interviewController.generateResumePdfController

);


// =========================================================
// EXPORT
// =========================================================

module.exports =
  interviewRouter;