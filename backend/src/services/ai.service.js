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
// INTERVIEW REPORT SCHEMAS
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

  matchScore:
    z.number().min(0).max(100),

  technicalQuestions:
    z.array(questionSchema).length(5),

  behavioralQuestions:
    z.array(questionSchema).length(5),

  skillGaps:
    z.array(skillGapSchema),

  preparationPlan:
    z.array(preparationPlanSchema).min(1),

  title:
    z.string().min(1),

});


// ============================================================
// CLEAN TEXT
// ============================================================

function cleanText(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}


// ============================================================
// CHECK IF STRING IS JSON
// ============================================================

function containsJsonObject(text) {

  if (typeof text !== "string") {
    return false;
  }

  const value =
    text.trim();

  return (
    (value.startsWith("{") &&
      value.endsWith("}")) ||
    (value.startsWith("[") &&
      value.endsWith("]"))
  );
}


// ============================================================
// VALIDATE QUESTION ARRAY
// ============================================================

function validateQuestionArray(
  questions,
  type
) {

  if (!Array.isArray(questions)) {

    throw new Error(
      `${type} questions are missing.`
    );

  }


  if (questions.length !== 5) {

    throw new Error(
      `${type} questions must contain exactly 5 questions. Received: ${questions.length}`
    );

  }


  questions.forEach(
    (item, index) => {

      const number =
        index + 1;


      if (
        !item ||
        typeof item !== "object"
      ) {

        throw new Error(
          `${type} question ${number} is invalid.`
        );

      }


      if (
        typeof item.question !== "string" ||
        item.question.trim().length < 5
      ) {

        throw new Error(
          `${type} question ${number} has an invalid question.`
        );

      }


      if (
        typeof item.intention !== "string" ||
        item.intention.trim().length < 5
      ) {

        throw new Error(
          `${type} question ${number} has an invalid intention.`
        );

      }


      if (
        typeof item.answer !== "string" ||
        item.answer.trim().length < 5
      ) {

        throw new Error(
          `${type} question ${number} has an invalid answer.`
        );

      }


      if (
        containsJsonObject(
          item.question
        )
      ) {

        throw new Error(
          `${type} question ${number} contains JSON inside question.`
        );

      }


      if (
        containsJsonObject(
          item.intention
        )
      ) {

        throw new Error(
          `${type} question ${number} contains JSON inside intention.`
        );

      }


      if (
        containsJsonObject(
          item.answer
        )
      ) {

        throw new Error(
          `${type} question ${number} contains JSON inside answer.`
        );

      }

    }
  );

}


// ============================================================
// VALIDATE COMPLETE REPORT
// ============================================================

function validateInterviewReport(
  report
) {

  if (
    !report ||
    typeof report !== "object"
  ) {

    throw new Error(
      "Gemini returned an invalid report."
    );

  }


  // ----------------------------------------------------------
  // MATCH SCORE
  // ----------------------------------------------------------

  if (
    typeof report.matchScore !== "number" ||
    report.matchScore < 0 ||
    report.matchScore > 100
  ) {

    throw new Error(
      "Invalid match score."
    );

  }


  // ----------------------------------------------------------
  // TECHNICAL QUESTIONS
  // ----------------------------------------------------------

  validateQuestionArray(
    report.technicalQuestions,
    "Technical"
  );


  // ----------------------------------------------------------
  // BEHAVIORAL QUESTIONS
  // ----------------------------------------------------------

  validateQuestionArray(
    report.behavioralQuestions,
    "Behavioral"
  );


  // ----------------------------------------------------------
  // SKILL GAPS
  // ----------------------------------------------------------

  if (
    !Array.isArray(
      report.skillGaps
    )
  ) {

    throw new Error(
      "Skill gaps are missing."
    );

  }


  report.skillGaps.forEach(
    (gap, index) => {

      if (
        !gap ||
        typeof gap !== "object"
      ) {

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
        ![
          "low",
          "medium",
          "high",
        ].includes(
          gap.severity
        )
      ) {

        throw new Error(
          `Skill gap ${index + 1} has invalid severity.`
        );

      }

    }
  );


  // ----------------------------------------------------------
  // PREPARATION PLAN
  // ----------------------------------------------------------

  if (
    !Array.isArray(
      report.preparationPlan
    )
  ) {

    throw new Error(
      "Preparation plan is missing."
    );

  }


  if (
    report.preparationPlan.length === 0
  ) {

    throw new Error(
      "Preparation plan cannot be empty."
    );

  }


  report.preparationPlan.forEach(
    (item, index) => {

      if (
        !item ||
        typeof item !== "object"
      ) {

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
        !Array.isArray(
          item.tasks
        ) ||
        item.tasks.length === 0
      ) {

        throw new Error(
          `Preparation plan day ${index + 1} has no tasks.`
        );

      }

    }
  );


  // ----------------------------------------------------------
  // TITLE
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

async function generateInterviewReport(
  jobDescription
) {

  try {

    console.log(
      "========== GENERATE INTERVIEW REPORT =========="
    );


    // --------------------------------------------------------
    // CHECK JOB DESCRIPTION
    // --------------------------------------------------------

    if (
      !jobDescription ||
      typeof jobDescription !== "string" ||
      !jobDescription.trim()
    ) {

      throw new Error(
        "Job description is required."
      );

    }


    // --------------------------------------------------------
    // PROMPT
    // --------------------------------------------------------

    const prompt = `
You are an expert technical interviewer,
recruiter and career coach.

Analyze the following job description and
generate a complete interview preparation report.

==================================================
JOB DESCRIPTION
==================================================

${jobDescription.trim()}

==================================================
ABSOLUTE REQUIREMENTS
==================================================

Return ONLY valid JSON.

Do NOT return markdown.

Do NOT return code blocks.

Do NOT explain anything outside the JSON.

Do NOT put JSON inside strings.

==================================================
1. MATCH SCORE
==================================================

matchScore must be a NUMBER between 0 and 100.

==================================================
2. TECHNICAL QUESTIONS
==================================================

technicalQuestions MUST contain EXACTLY 5 objects.

There MUST be exactly:

1
2
3
4
5

Every object MUST contain:

{
  "question": "...",
  "intention": "...",
  "answer": "..."
}

QUESTION:

The question field must contain ONLY the interview question.

INTENTION:

The intention field must contain ONLY what the interviewer wants to evaluate.

ANSWER:

The answer field must contain ONLY the ideal candidate answer.

Do NOT mix these fields.

Do NOT put JSON inside any field.

Do NOT write:

question:

intention:

answer:

inside the values.

Technical questions must be relevant to
the job description.

==================================================
3. BEHAVIORAL QUESTIONS
==================================================

behavioralQuestions MUST contain EXACTLY 5 objects.

Every object MUST contain:

{
  "question": "...",
  "intention": "...",
  "answer": "..."
}

question = ONLY question.

intention = ONLY interviewer intention.

answer = ONLY ideal answer.

Do NOT mix fields.

==================================================
4. SKILL GAPS
==================================================

skillGaps must contain skills that need improvement.

Every object MUST contain:

{
  "skill": "Skill Name",
  "severity": "low"
}

severity MUST be exactly one of:

low
medium
high

Do NOT use:

Low
Medium
High
beginner
important
critical

skill must contain ONLY the skill name.

==================================================
5. PREPARATION PLAN
==================================================

Create a practical preparation roadmap.

Every object must contain:

{
  "day": 1,
  "focus": "Topic",
  "tasks": [
    "Task 1",
    "Task 2"
  ]
}

day must be a number.

focus must contain the main topic.

tasks must contain actionable preparation tasks.

==================================================
6. TITLE
==================================================

title must contain the actual job title.

Example:

"Data Analyst"

or

"Software Engineer"

Do NOT use:

"Interview Preparation"

==================================================
FINAL CHECK
==================================================

Before returning the response verify:

1. technicalQuestions = EXACTLY 5
2. behavioralQuestions = EXACTLY 5
3. Every question has question, intention and answer
4. question contains ONLY question text
5. intention contains ONLY intention text
6. answer contains ONLY answer text
7. No field contains nested JSON
8. skillGaps exists
9. severity is low, medium or high
10. preparationPlan exists
11. preparationPlan contains tasks
12. matchScore is between 0 and 100
13. title is the actual job title
14. Return ONLY JSON

==================================================
EXPECTED STRUCTURE
==================================================

{
  "matchScore": 75,

  "technicalQuestions": [
    {
      "question": "Question 1",
      "intention": "Interviewer intention",
      "answer": "Ideal answer"
    },
    {
      "question": "Question 2",
      "intention": "Interviewer intention",
      "answer": "Ideal answer"
    },
    {
      "question": "Question 3",
      "intention": "Interviewer intention",
      "answer": "Ideal answer"
    },
    {
      "question": "Question 4",
      "intention": "Interviewer intention",
      "answer": "Ideal answer"
    },
    {
      "question": "Question 5",
      "intention": "Interviewer intention",
      "answer": "Ideal answer"
    }
  ],

  "behavioralQuestions": [
    {
      "question": "Behavioral question 1",
      "intention": "Interviewer intention",
      "answer": "Ideal answer"
    },
    {
      "question": "Behavioral question 2",
      "intention": "Interviewer intention",
      "answer": "Ideal answer"
    },
    {
      "question": "Behavioral question 3",
      "intention": "Interviewer intention",
      "answer": "Ideal answer"
    },
    {
      "question": "Behavioral question 4",
      "intention": "Interviewer intention",
      "answer": "Ideal answer"
    },
    {
      "question": "Behavioral question 5",
      "intention": "Interviewer intention",
      "answer": "Ideal answer"
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


    // --------------------------------------------------------
    // JSON SCHEMA
    // --------------------------------------------------------

    const jsonSchema =
      zodToJsonSchema(
        interviewReportSchema
      );


    // --------------------------------------------------------
    // GENERATE ONE RESPONSE
    // --------------------------------------------------------

    const generateOnce =
      async () => {

        console.log(
          "Sending request to Gemini..."
        );


        const response =
          await ai.models.generateContent({

            model:
              "gemini-3.8-flash",

            contents:
              prompt,

            config: {

              responseFormat: {
                text: {

                  mimeType:
                    "application/json",

                  schema:
                    jsonSchema,

                },
              },

            },

          });


        const rawText =
          response.text;


        console.log(
          "========== GEMINI RAW INTERVIEW RESPONSE =========="
        );

        console.log(
          rawText
        );

        console.log(
          "===================================================="
        );


        if (!rawText) {

          throw new Error(
            "Gemini returned an empty response."
          );

        }


        let parsedResponse;


        try {

          parsedResponse =
            JSON.parse(
              cleanText(
                rawText
              )
            );

        } catch (error) {

          console.error(
            "JSON PARSE ERROR:",
            error
          );

          throw new Error(
            "Gemini returned invalid JSON."
          );

        }


        return parsedResponse;

      };


    // --------------------------------------------------------
    // RETRY INVALID OUTPUT
    // --------------------------------------------------------

    let parsedResponse =
      null;

    let lastError =
      null;


    for (
      let attempt = 1;
      attempt <= 2;
      attempt++
    ) {

      try {

        console.log(
          `========== GEMINI ATTEMPT ${attempt}/2 ==========`
        );


        parsedResponse =
          await generateOnce();


        validateInterviewReport(
          parsedResponse
        );


        console.log(
          "Gemini response passed validation."
        );


        break;

      } catch (error) {

        lastError =
          error;


        console.error(
          `Gemini attempt ${attempt} failed:`,
          error.message
        );


        /*
         * IMPORTANT:
         *
         * If Gemini itself is temporarily unavailable
         * (503 / 429), retrying immediately is not useful.
         *
         * Throw immediately so Render shows the real
         * Gemini error instead of hiding it behind another
         * validation error.
         */

        const status =
          error?.status ||
          error?.code;


        if (
          status === 503 ||
          status === 429
        ) {

          throw error;

        }


        if (
          attempt < 2
        ) {

          console.log(
            "Retrying because generated report failed validation..."
          );

        }

      }

    }


    // --------------------------------------------------------
    // VALID REPORT CHECK
    // --------------------------------------------------------

    if (!parsedResponse) {

      throw new Error(
        `Unable to generate a valid interview report. Last error: ${
          lastError?.message ||
          "Unknown error"
        }`
      );

    }


    // --------------------------------------------------------
    // FINAL ZOD VALIDATION
    // --------------------------------------------------------

    const validatedReport =
      interviewReportSchema.parse(
        parsedResponse
      );


    // --------------------------------------------------------
    // FINAL LOG
    // --------------------------------------------------------

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
  resumeData
) {

  let browser =
    null;


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


    // --------------------------------------------------------
    // Support object passed from controller
    // --------------------------------------------------------

    

let html;


    if (
      typeof resumeData === "string"
    ) {

      html =
        resumeData;

    } else {

      const {
        resume = "",
        jobDescription = "",
        selfDescription = "",
      } =
        resumeData || {};


      html = `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>Resume</title>

<style>

* {
  box-sizing: border-box;
}

body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 40px;
  color: #222;
  line-height: 1.5;
}

h1,
h2,
h3 {
  margin-top: 0;
}

.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  border-bottom: 1px solid #222;
  padding-bottom: 6px;
  margin-bottom: 12px;
}

pre {
  white-space: pre-wrap;
  font-family: Arial, sans-serif;
}

</style>

</head>

<body>

<div class="section">

<div class="section-title">
Candidate Information
</div>

<pre>${escapeHtml(
  selfDescription
)}</pre>

</div>


<div class="section">

<div class="section-title">
Resume
</div>

<pre>${escapeHtml(
  resume
)}</pre>

</div>


<div class="section">

<div class="section-title">
Target Job
</div>

<pre>${escapeHtml(
  jobDescription
)}</pre>

</div>

</body>

</html>
`;

    }


    // --------------------------------------------------------
    // Set HTML
    // --------------------------------------------------------

    await page.setContent(
      html,
      {
        waitUntil:
          "networkidle0",
      }
    );


    // --------------------------------------------------------
    // Generate PDF
    // --------------------------------------------------------

    const pdf =
      await page.pdf({

        format:
          "A4",

        printBackground:
          true,

        margin: {

          top:
            "20px",

          right:
            "20px",

          bottom:
            "20px",

          left:
            "20px",

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
// ESCAPE HTML
// ============================================================

function escapeHtml(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }


  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  generateInterviewReport,

  generateResumePdf,

  interviewReportSchema,

  validateInterviewReport,

};