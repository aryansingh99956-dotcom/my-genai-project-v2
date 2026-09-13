// backend/src/services/ai.service.js

const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const puppeteer = require("puppeteer");

// ============================================================
// GEMINI CLIENT
// ============================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_GEN_API_KEY,
});

// ============================================================
// ZOD SCHEMAS
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
  tasks: z.array(z.string().min(1)).min(1),
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
// HELPERS
// ============================================================

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

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
// QUESTION VALIDATION
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
    const number = index + 1;

    if (!item || typeof item !== "object") {
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

    if (containsJsonObject(item.question)) {
      throw new Error(
        `${type} question ${number} contains JSON inside question field.`
      );
    }

    if (containsJsonObject(item.intention)) {
      throw new Error(
        `${type} question ${number} contains JSON inside intention field.`
      );
    }

    if (containsJsonObject(item.answer)) {
      throw new Error(
        `${type} question ${number} contains JSON inside answer field.`
      );
    }
  });
}

// ============================================================
// COMPLETE REPORT VALIDATION
// ============================================================

function validateInterviewReport(report) {
  if (!report || typeof report !== "object") {
    throw new Error(
      "Gemini returned an invalid report."
    );
  }

  // -------------------------
  // MATCH SCORE
  // -------------------------

  if (
    typeof report.matchScore !== "number" ||
    report.matchScore < 0 ||
    report.matchScore > 100
  ) {
    throw new Error(
      "Invalid match score."
    );
  }

  // -------------------------
  // TECHNICAL QUESTIONS
  // -------------------------

  validateQuestionArray(
    report.technicalQuestions,
    "Technical"
  );

  // -------------------------
  // BEHAVIORAL QUESTIONS
  // -------------------------

  validateQuestionArray(
    report.behavioralQuestions,
    "Behavioral"
  );

  // -------------------------
  // SKILL GAPS
  // -------------------------

  if (!Array.isArray(report.skillGaps)) {
    throw new Error(
      "Skill gaps are missing."
    );
  }

  report.skillGaps.forEach((gap, index) => {
    const number = index + 1;

    if (!gap || typeof gap !== "object") {
      throw new Error(
        `Skill gap ${number} is invalid.`
      );
    }

    if (
      typeof gap.skill !== "string" ||
      !gap.skill.trim()
    ) {
      throw new Error(
        `Skill gap ${number} has an invalid skill.`
      );
    }

    if (
      !["low", "medium", "high"].includes(
        gap.severity
      )
    ) {
      throw new Error(
        `Skill gap ${number} has invalid severity.`
      );
    }
  });

  // -------------------------
  // PREPARATION PLAN
  // -------------------------

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
    const number = index + 1;

    if (!item || typeof item !== "object") {
      throw new Error(
        `Preparation plan day ${number} is invalid.`
      );
    }

    if (
      typeof item.day !== "number" ||
      item.day < 1
    ) {
      throw new Error(
        `Preparation plan day ${number} has invalid day.`
      );
    }

    if (
      typeof item.focus !== "string" ||
      !item.focus.trim()
    ) {
      throw new Error(
        `Preparation plan day ${number} has invalid focus.`
      );
    }

    if (
      !Array.isArray(item.tasks) ||
      item.tasks.length === 0
    ) {
      throw new Error(
        `Preparation plan day ${number} has no tasks.`
      );
    }

    item.tasks.forEach((task, taskIndex) => {
      if (
        typeof task !== "string" ||
        !task.trim()
      ) {
        throw new Error(
          `Preparation plan day ${number}, task ${taskIndex + 1} is invalid.`
        );
      }
    });
  });

  // -------------------------
  // TITLE
  // -------------------------

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
      typeof jobDescription !== "string" ||
      !jobDescription.trim()
    ) {
      throw new Error(
        "Job description is required."
      );
    }

    const cleanJobDescription =
      jobDescription.trim();

    // ========================================================
    // PROMPT
    // ========================================================

    const prompt = `
You are an expert technical interviewer and career preparation assistant.

Analyze the following job description and create a complete interview preparation report.

JOB DESCRIPTION:
${cleanJobDescription}

STRICT OUTPUT REQUIREMENTS:

1. Return ONLY valid JSON matching the provided schema.

2. Generate EXACTLY 5 technical questions.

3. Generate EXACTLY 5 behavioral questions.

4. Every question object MUST contain exactly these fields:
   - question
   - intention
   - answer

5. "question":
   - Must contain ONLY the interview question.
   - Do NOT include labels such as "Question:", "Technical:", or "Q1:".
   - Do NOT include JSON.
   - Do NOT include the answer.
   - Do NOT include the interviewer intention.

6. "intention":
   - Must contain ONLY what the interviewer wants to evaluate.
   - Do NOT repeat the question.
   - Do NOT provide the candidate answer.
   - Do NOT include JSON.

7. "answer":
   - Must contain ONLY the ideal candidate answer.
   - It should be technically correct and interview-ready.
   - Do NOT include JSON.
   - Do NOT include labels such as "Answer:".

8. Technical questions must be strongly related to the technologies, responsibilities, and skills mentioned in the job description.

9. Behavioral questions must be realistic interview questions related to communication, teamwork, problem solving, ownership, adaptability, conflict handling, leadership, and workplace situations.

10. Avoid generic repeated questions.

11. Each intention must be specific to its corresponding question.

12. Each ideal answer must be specific to its corresponding question.

13. "skillGaps":
   - Each object must contain:
     - skill
     - severity
   - severity MUST be exactly one of:
     - "low"
     - "medium"
     - "high"
   - skill must contain ONLY the skill name.
   - Do not put explanations inside the skill field.

14. "preparationPlan":
   - Create a practical multi-day preparation roadmap.
   - Each object must contain:
     - day
     - focus
     - tasks
   - day must be a number.
   - focus must be a short topic.
   - tasks must be an array of practical preparation tasks.

15. "title":
   - Must be the actual job title inferred from the job description.
   - Do not use generic titles such as "Job Role" or "Software Role".

16. "matchScore":
   - Must be a number from 0 to 100.
   - Estimate how well a candidate with the skills described by the job description would match the role.
   - Do not return a string.

17. Do NOT put JSON fragments inside any question, intention, answer, skill, focus, or task string.

18. Do NOT return markdown.

19. Do NOT return code fences.

20. Do NOT add any explanation outside the JSON object.

Return the final structured JSON only.
`;

    // ========================================================
    // JSON SCHEMA
    // ========================================================

    const jsonSchema =
      zodToJsonSchema(
        interviewReportSchema
      );

    // ========================================================
    // GEMINI REQUEST
    // ========================================================

    const generateOnce = async () => {
      const models = [
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
      ];

      let lastError = null;

      for (const model of models) {
        for (let retry = 0; retry < 3; retry++) {
          try {
            console.log(
              `Trying Gemini model: ${model}, attempt ${retry + 1}/3`
            );

            const response =
              await ai.models.generateContent({
                model,
                contents: prompt,
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

            console.log(rawText);

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
                  cleanText(rawText)
                );
            } catch (parseError) {
              console.error(
                "JSON PARSE ERROR:",
                parseError
              );

              throw new Error(
                "Gemini returned invalid JSON."
              );
            }

            return parsedResponse;
          } catch (error) {
            lastError = error;

            const status =
              error?.status ||
              error?.code ||
              error?.response?.status;

            console.error(
              `Gemini ${model} failed:`,
              error.message
            );

            // ----------------------------------------------
            // TEMPORARY GEMINI ERRORS
            // ----------------------------------------------

            if (
              status === 503 ||
              status === 429 ||
              status === 500
            ) {
              const delay =
                2000 *
                Math.pow(2, retry);

              console.log(
                `Temporary Gemini error. Waiting ${delay}ms before retry...`
              );

              await sleep(delay);

              continue;
            }

            // ----------------------------------------------
            // OTHER ERROR
            // ----------------------------------------------

            throw error;
          }
        }

        console.log(
          `Model ${model} unavailable after retries. Trying next model...`
        );
      }

      throw (
        lastError ||
        new Error(
          "All Gemini models are currently unavailable."
        )
      );
    };

    // ========================================================
    // GENERATE + VALIDATE
    // ========================================================

    let parsedResponse = null;
    let lastError = null;

    for (
      let attempt = 1;
      attempt <= 2;
      attempt++
    ) {
      try {
        console.log(
          `========== GEMINI REPORT ATTEMPT ${attempt}/2 ==========`
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
          `Gemini report attempt ${attempt} failed:`,
          error.message
        );

        if (attempt < 2) {
          console.log(
            "Retrying report generation..."
          );

          await sleep(1500);
        }
      }
    }

    // ========================================================
    // VALID REPORT CHECK
    // ========================================================

    if (!parsedResponse) {
      throw new Error(
        `Unable to generate a valid interview report. Last error: ${
          lastError?.message ||
          "Unknown error"
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

async function generateResumePdf(resumeData) {
  let browser = null;

  try {
    console.log(
      "Starting Puppeteer PDF generation..."
    );

    // --------------------------------------------------------
    // SUPPORT OBJECT INPUT
    // --------------------------------------------------------

    let resume = "";
    let jobDescription = "";
    let selfDescription = "";

    if (
      resumeData &&
      typeof resumeData === "object"
    ) {
      resume =
        resumeData.resume || "";

      jobDescription =
        resumeData.jobDescription || "";

      selfDescription =
        resumeData.selfDescription || "";
    } else if (
      typeof resumeData === "string"
    ) {
      resume = resumeData;
    }

    // --------------------------------------------------------
    // ESCAPE HTML
    // --------------------------------------------------------

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    const resumeHtml = `
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
  font-family: Arial, Helvetica, sans-serif;
  margin: 0;
  padding: 35px;
  color: #111;
  background: white;
  line-height: 1.5;
}

h1 {
  margin: 0 0 10px;
  font-size: 28px;
}

h2 {
  margin-top: 24px;
  padding-bottom: 5px;
  border-bottom: 1px solid #222;
  font-size: 18px;
}

p {
  margin: 8px 0;
}

.resume-content {
  white-space: pre-wrap;
}

.section {
  margin-bottom: 20px;
}

</style>

</head>

<body>

<h1>Resume</h1>

<div class="section">

<h2>Professional Summary</h2>

<p>
${escapeHtml(
  selfDescription ||
    "Professional candidate profile"
)}
</p>

</div>

<div class="section">

<h2>Resume Details</h2>

<div class="resume-content">
${escapeHtml(resume)}
</div>

</div>

<div class="section">

<h2>Target Job Description</h2>

<div class="resume-content">
${escapeHtml(jobDescription)}
</div>

</div>

</body>

</html>
`;

    // --------------------------------------------------------
    // START BROWSER
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // CREATE PAGE
    // --------------------------------------------------------

    const page =
      await browser.newPage();

    // --------------------------------------------------------
    // SET HTML
    // --------------------------------------------------------

    await page.setContent(
      resumeHtml,
      {
        waitUntil:
          "networkidle0",
      }
    );

    // --------------------------------------------------------
    // GENERATE PDF
    // --------------------------------------------------------

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
};