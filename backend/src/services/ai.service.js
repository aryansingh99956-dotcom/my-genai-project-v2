// backend/src/services/ai.service.js

const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const puppeteer = require("puppeteer");


// ============================================================
// GEMINI SETUP
// ============================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_GEN_API_KEY,
});


// ============================================================
// INTERVIEW REPORT SCHEMA
// ============================================================

const questionSchema = z.object({
  question: z.string().min(5),
  intention: z.string().min(5),
  answer: z.string().min(5),
});


const skillGapSchema = z.object({
  skill: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
});


const preparationPlanSchema = z.object({
  day: z.number().int().min(1),
  focus: z.string().min(1),
  tasks: z.array(z.string()).min(1),
});


const interviewReportSchema = z.object({
  matchScore: z.number().min(0).max(100),

  technicalQuestions: z
    .array(questionSchema)
    .length(5),

  behavioralQuestions: z
    .array(questionSchema)
    .length(5),

  skillGaps: z
    .array(skillGapSchema),

  preparationPlan: z
    .array(preparationPlanSchema)
    .min(1),

  title: z.string().min(1),
});


// ============================================================
// HELPER - CLEAN TEXT
// ============================================================

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}


// ============================================================
// HELPER - REMOVE JSON FROM NORMAL TEXT
// ============================================================

function containsJsonObject(text) {
  if (typeof text !== "string") {
    return false;
  }

  const value = text.trim();

  return (
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]"))
  );
}


// ============================================================
// VALIDATE QUESTION ARRAYS
// ============================================================

function validateQuestionArray(questions, type) {
  if (!Array.isArray(questions)) {
    throw new Error(`${type} questions are missing.`);
  }

  if (questions.length !== 5) {
    throw new Error(
      `${type} questions must contain exactly 5 questions. Received: ${questions.length}`
    );
  }

  questions.forEach((item, index) => {
    const questionNumber = index + 1;

    if (!item || typeof item !== "object") {
      throw new Error(
        `${type} question ${questionNumber} is invalid.`
      );
    }

    if (
      typeof item.question !== "string" ||
      item.question.trim().length < 5
    ) {
      throw new Error(
        `${type} question ${questionNumber} has an invalid question.`
      );
    }

    if (
      typeof item.intention !== "string" ||
      item.intention.trim().length < 5
    ) {
      throw new Error(
        `${type} question ${questionNumber} has an invalid intention.`
      );
    }

    if (
      typeof item.answer !== "string" ||
      item.answer.trim().length < 5
    ) {
      throw new Error(
        `${type} question ${questionNumber} has an invalid answer.`
      );
    }

    // Don't allow JSON object inside question
    if (containsJsonObject(item.question)) {
      throw new Error(
        `${type} question ${questionNumber} contains JSON inside question field.`
      );
    }

    // Don't allow JSON object inside intention
    if (containsJsonObject(item.intention)) {
      throw new Error(
        `${type} question ${questionNumber} contains JSON inside intention field.`
      );
    }

    // Don't allow JSON object inside answer
    if (containsJsonObject(item.answer)) {
      throw new Error(
        `${type} question ${questionNumber} contains JSON inside answer field.`
      );
    }
  });
}


// ============================================================
// VALIDATE COMPLETE REPORT
// ============================================================

function validateInterviewReport(report) {
  if (!report || typeof report !== "object") {
    throw new Error("Gemini returned an invalid report.");
  }


  // ----------------------------------------------------------
  // Match Score
  // ----------------------------------------------------------

  if (
    typeof report.matchScore !== "number" ||
    report.matchScore < 0 ||
    report.matchScore > 100
  ) {
    throw new Error("Invalid match score.");
  }


  // ----------------------------------------------------------
  // Technical Questions
  // ----------------------------------------------------------

  validateQuestionArray(
    report.technicalQuestions,
    "Technical"
  );


  // ----------------------------------------------------------
  // Behavioral Questions
  // ----------------------------------------------------------

  validateQuestionArray(
    report.behavioralQuestions,
    "Behavioral"
  );


  // ----------------------------------------------------------
  // Skill Gaps
  // ----------------------------------------------------------

  if (!Array.isArray(report.skillGaps)) {
    throw new Error("Skill gaps are missing.");
  }

  report.skillGaps.forEach((gap, index) => {
    if (!gap || typeof gap !== "object") {
      throw new Error(
        `Skill gap ${index + 1} is invalid.`
      );
    }

    if (
      typeof gap.skill !== "string" ||
      !gap.skill.trim()
    ) {
      throw new Error(
        `Skill gap ${index + 1} has an invalid skill.`
      );
    }

    if (
      !["low", "medium", "high"].includes(
        gap.severity
      )
    ) {
      throw new Error(
        `Skill gap ${index + 1} has invalid severity.`
      );
    }
  });


  // ----------------------------------------------------------
  // Preparation Plan
  // ----------------------------------------------------------

  if (!Array.isArray(report.preparationPlan)) {
    throw new Error(
      "Preparation plan is missing."
    );
  }

  if (report.preparationPlan.length === 0) {
    throw new Error(
      "Preparation plan cannot be empty."
    );
  }

  report.preparationPlan.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(
        `Preparation plan day ${index + 1} is invalid.`
      );
    }

    if (
      typeof item.day !== "number" ||
      item.day < 1
    ) {
      throw new Error(
        `Preparation plan day ${index + 1} has invalid day.`
      );
    }

    if (
      typeof item.focus !== "string" ||
      !item.focus.trim()
    ) {
      throw new Error(
        `Preparation plan day ${index + 1} has invalid focus.`
      );
    }

    if (
      !Array.isArray(item.tasks) ||
      item.tasks.length === 0
    ) {
      throw new Error(
        `Preparation plan day ${index + 1} has no tasks.`
      );
    }
  });


  // ----------------------------------------------------------
  // Title
  // ----------------------------------------------------------

  if (
    typeof report.title !== "string" ||
    !report.title.trim()
  ) {
    throw new Error(
      "Job title is missing."
    );
  }


  return true;
}


// ============================================================
// GENERATE INTERVIEW REPORT
// ============================================================

async function generateInterviewReport(jobDescription) {
  try {
    console.log(
      "========== GENERATE INTERVIEW REPORT =========="
    );


    if (
      !jobDescription ||
      typeof jobDescription !== "string"
    ) {
      throw new Error(
        "Job description is required."
      );
    }


    // ========================================================
    // PROMPT
    // ========================================================

    const prompt = `
You are an expert technical interviewer, recruiter and career coach.

Analyze the following job description and generate a complete interview preparation report.

==================================================
JOB DESCRIPTION
==================================================

${jobDescription}

==================================================
ABSOLUTE REQUIREMENTS
==================================================

Return ONLY valid JSON.

Do NOT return markdown.

Do NOT return code blocks.

Do NOT explain the response.

Do NOT put JSON inside strings.

==================================================
1. MATCH SCORE
==================================================

matchScore must be a NUMBER between 0 and 100.

It represents how well a typical candidate profile would match the given job requirements.

==================================================
2. TECHNICAL QUESTIONS
==================================================

technicalQuestions MUST contain EXACTLY 5 objects.

IMPORTANT:

There MUST be:

Q1
Q2
Q3
Q4
Q5

Exactly 5.

Every object MUST have exactly these fields:

{
  "question": "...",
  "intention": "...",
  "answer": "..."
}

--------------------------------------------------
QUESTION FIELD
--------------------------------------------------

question must contain ONLY the interview question.

Example:

"Explain the difference between a process and a thread."

DO NOT write:

{
  "question": "...",
  "intention": "...",
  "answer": "..."
}

inside the question field.

DO NOT include "question:".

--------------------------------------------------
INTENTION FIELD
--------------------------------------------------

intention must contain ONLY what the interviewer wants to evaluate.

Example:

"To evaluate the candidate's understanding of operating system concurrency."

Do not repeat the question.

--------------------------------------------------
ANSWER FIELD
--------------------------------------------------

answer must contain ONLY the ideal candidate answer.

Example:

"A process is an independent program in execution, while a thread is a lightweight execution unit within a process..."

Do not include:

"question:"
"intention:"
"answer:"

Do not include JSON.

==================================================
3. BEHAVIORAL QUESTIONS
==================================================

behavioralQuestions MUST contain EXACTLY 5 objects.

Exactly:

Q1
Q2
Q3
Q4
Q5

Every object must contain:

{
  "question": "...",
  "intention": "...",
  "answer": "..."
}

The same rules apply:

question = ONLY question

intention = ONLY interviewer intention

answer = ONLY ideal answer

Do not mix fields.

==================================================
4. SKILL GAPS
==================================================

skillGaps must contain the skills that the candidate should improve for this job.

Each object MUST contain:

{
  "skill": "Skill Name",
  "severity": "low"
}

severity MUST be exactly one of:

"low"

"medium"

"high"

Do NOT use:

"Low"
"Medium"
"High"
"beginner"
"important"
"critical"

The skill field must contain ONLY the skill name.

Example:

{
  "skill": "SQL",
  "severity": "high"
}

==================================================
5. PREPARATION PLAN
==================================================

Create a practical interview preparation roadmap.

Each object must contain:

{
  "day": 1,
  "focus": "...",
  "tasks": [
    "...",
    "...",
    "..."
  ]
}

day must be a number.

focus must contain the main topic.

tasks must contain actionable preparation tasks.

Create a useful multi-day roadmap based on the job description.

==================================================
6. JOB TITLE
==================================================

title must contain the actual job title.

For example:

"Data Analyst"

or

"Software Engineer"

Do not put a generic title such as:

"Interview Preparation"

==================================================
FINAL VALIDATION BEFORE RESPONDING
==================================================

Before returning your answer, verify all of these:

1. technicalQuestions has EXACTLY 5 objects.
2. behavioralQuestions has EXACTLY 5 objects.
3. Every technical question has question, intention and answer.
4. Every behavioral question has question, intention and answer.
5. question contains ONLY the question.
6. intention contains ONLY the intention.
7. answer contains ONLY the answer.
8. No field contains nested JSON as text.
9. skillGaps exists.
10. Every skill gap severity is exactly low, medium or high.
11. preparationPlan exists.
12. preparationPlan contains actionable tasks.
13. matchScore is between 0 and 100.
14. title contains the actual job title.
15. Return ONLY valid JSON.

==================================================
EXPECTED STRUCTURE
==================================================

{
  "matchScore": 75,
  "technicalQuestions": [
    {
      "question": "Question 1",
      "intention": "What the interviewer wants to evaluate",
      "answer": "Ideal candidate answer"
    },
    {
      "question": "Question 2",
      "intention": "What the interviewer wants to evaluate",
      "answer": "Ideal candidate answer"
    },
    {
      "question": "Question 3",
      "intention": "What the interviewer wants to evaluate",
      "answer": "Ideal candidate answer"
    },
    {
      "question": "Question 4",
      "intention": "What the interviewer wants to evaluate",
      "answer": "Ideal candidate answer"
    },
    {
      "question": "Question 5",
      "intention": "What the interviewer wants to evaluate",
      "answer": "Ideal candidate answer"
    }
  ],
  "behavioralQuestions": [
    {
      "question": "Behavioral question 1",
      "intention": "What the interviewer wants to evaluate",
      "answer": "Ideal candidate answer"
    },
    {
      "question": "Behavioral question 2",
      "intention": "What the interviewer wants to evaluate",
      "answer": "Ideal candidate answer"
    },
    {
      "question": "Behavioral question 3",
      "intention": "What the interviewer wants to evaluate",
      "answer": "Ideal candidate answer"
    },
    {
      "question": "Behavioral question 4",
      "intention": "What the interviewer wants to evaluate",
      "answer": "Ideal candidate answer"
    },
    {
      "question": "Behavioral question 5",
      "intention": "What the interviewer wants to evaluate",
      "answer": "Ideal candidate answer"
    }
  ],
  "skillGaps": [
    {
      "skill": "Skill Name",
      "severity": "high"
    }
  ],
  "preparationPlan": [
    {
      "day": 1,
      "focus": "Topic",
      "tasks": [
        "Task 1",
        "Task 2"
      ]
    }
  ],
  "title": "Actual Job Title"
}

REMEMBER:

EXACTLY 5 TECHNICAL QUESTIONS.

EXACTLY 5 BEHAVIORAL QUESTIONS.

RETURN ONLY JSON.
`;


    // ========================================================
    // JSON SCHEMA
    // ========================================================

    const jsonSchema =
      zodToJsonSchema(
        interviewReportSchema
      );


    // ========================================================
    // ONE GEMINI ATTEMPT
    // ========================================================

    const generateOnce = async () => {
      console.log(
        "Sending request to Gemini..."
      );


     const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
];

async function generateWithFallback() {
  let lastError = null;

  for (const model of MODELS) {
    try {
      console.log(
        `Trying Gemini model: ${model}`
      );

      const response =
        await ai.models.generateContent({
          model,
          contents: prompt,

          config: {
            responseMimeType: "application/json",
            responseSchema: jsonSchema,
          },
        });

      console.log(
        `Gemini model succeeded: ${model}`
      );

      return response;

    } catch (error) {
      lastError = error;

      console.error(
        `Gemini model failed: ${model}`,
        error.message
      );

      // Only move to another model for temporary availability errors
      const status =
        error?.status ||
        error?.code;

      if (
        status !== 503 &&
        status !== 429
      ) {
        throw error;
      }
    }
  }

  throw lastError;
}


    // ========================================================
    // TRY UP TO 3 TIMES
    // ========================================================

    let parsedResponse = null;
    let lastError = null;


    for (
      let attempt = 1;
      attempt <= 3;
      attempt++
    ) {
      try {
        console.log(
          `========== GEMINI ATTEMPT ${attempt}/3 ==========`
        );


        parsedResponse =
          await generateOnce();


        validateInterviewReport(
          parsedResponse
        );


        console.log(
          `Gemini response passed validation on attempt ${attempt}.`
        );


        break;

      } catch (error) {
        lastError = error;


        console.error(
          `Gemini attempt ${attempt} failed:`,
          error.message
        );


        if (attempt < 3) {
          console.log(
            "Retrying Gemini..."
          );
        }
      }
    }


    // ========================================================
    // ALL ATTEMPTS FAILED
    // ========================================================

    if (!parsedResponse) {
      throw new Error(
        `Unable to generate a valid interview report after 3 attempts. Last error: ${
          lastError?.message || "Unknown error"
        }`
      );
    }


    // ========================================================
    // FINAL ZOD VALIDATION
    // ========================================================

    const validatedReport =
      interviewReportSchema.parse(
        parsedResponse
      );


    // ========================================================
    // FINAL LOG
    // ========================================================

    console.log(
      "========== FINAL VALID INTERVIEW REPORT =========="
    );

    console.log(
      JSON.stringify(
        validatedReport,
        null,
        2
      )
    );

    console.log(
      "=================================================="
    );


    return validatedReport;

  } catch (error) {

    console.error(
      "generateInterviewReport ERROR:",
      error
    );

    throw error;
  }
}


// ============================================================
// GENERATE RESUME PDF
// ============================================================

async function generateResumePdf(
  resumeHtml
) {
  let browser = null;


  try {
    console.log(
      "Starting Puppeteer PDF generation..."
    );


    browser =
      await puppeteer.launch({
        headless: true,

        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });


    const page =
      await browser.newPage();


    await page.setContent(
      resumeHtml,
      {
        waitUntil: "networkidle0",
      }
    );


    const pdf =
      await page.pdf({
        format: "A4",

        printBackground: true,

        margin: {
          top: "20px",
          right: "20px",
          bottom: "20px",
          left: "20px",
        },
      });


    console.log(
      "PDF generated successfully."
    );


    return pdf;

  } catch (error) {

    console.error(
      "generateResumePdf ERROR:",
      error
    );

    throw error;

  } finally {

    if (browser) {
      await browser.close();
    }
  }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  generateInterviewReport,
  generateResumePdf,
  interviewReportSchema,
  validateInterviewReport,
};F