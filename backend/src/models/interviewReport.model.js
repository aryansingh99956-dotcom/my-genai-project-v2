const mongoose = require("mongoose");

// ===============================
// Technical Questions Schema
// ===============================
const technicalQuestionsSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, "Technical question is required"],
    },

    intention: {
      type: String,
      required: [true, "Intention is required"],
    },

    answer: {
      type: String,
      required: [true, "Answer is required"],
    },
  },
  {
    _id: false,
  }
);

// ===============================
// Behavioral Questions Schema
// ===============================
const behavioralQuestionsSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, "Behavioral question is required"],
    },

    intention: {
      type: String,
      required: [true, "Intention is required"],
    },

    answer: {
      type: String,
      required: [true, "Answer is required"],
    },
  },
  {
    _id: false,
  }
);

// ===============================
// Skill Gap Schema
// ===============================
const skillGapSchema = new mongoose.Schema(
  {
    skill: {
      type: String,
      required: [true, "Skill is required"],
    },

    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      required: [true, "Severity is required"],
    },
  },
  {
    _id: false,
  }
);

// ===============================
// Preparation Plan Schema
// ===============================
// IMPORTANT:
// Gemini is returning day as a STRING
// e.g. "Day 1: JavaScript Deep Dive"
// So day must be String, NOT Number.
const preparationPlanSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: [true, "Day is required"],
    },

    focus: {
      type: String,
      required: [true, "Focus is required"],
    },

    tasks: [
      {
        type: String,
        required: [true, "Task is required"],
      },
    ],
  },
  {
    _id: false,
  }
);

// ===============================
// Main Interview Report Schema
// ===============================
const interviewReportSchema = new mongoose.Schema(
  {
    jobDescription: {
      type: String,
      required: [true, "Job description is required"],
    },

    resume: {
      type: String,
    },

    selfDescription: {
      type: String,
    },

    matchScore: {
      type: Number,
      min: 0,
      max: 100,
    },

    technicalQuestions: [technicalQuestionsSchema],

    behavioralQuestions: [behavioralQuestionsSchema],

    skillGaps: [skillGapSchema],

    preparationPlan: [preparationPlanSchema],

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },

    title: {
      type: String,
      required: [true, "Job title is required"],
    },
  },
  {
    timestamps: true,
  }
);

// ===============================
// Model
// ===============================
const interviewReportModel = mongoose.model(
  "InterviewReport",
  interviewReportSchema
);

module.exports = interviewReportModel;