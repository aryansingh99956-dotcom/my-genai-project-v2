const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const puppeteer = require("puppeteer");

// =========================================================
// GEMINI AI
// =========================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_GEN_API_KEY,
});

// =========================================================
// INTERVIEW REPORT SCHEMA
// =========================================================

const interviewReportSchema = z.object({
  matchScore: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "A score between 0 and 100 indicating how well the candidate's profile matches the job description."
    ),

  technicalQuestions: z
    .array(
      z.object({
        question: z.string(),
        intention: z.string(),
        answer: z.string(),
      })
    ),

  behavioralQuestions: z
    .array(
      z.object({
        question: z.string(),
        intention: z.string(),
        answer: z.string(),
      })
    ),

  skillGaps: z
    .array(
      z.object({
        skill: z.string(),
        severity: z.enum(["low", "medium", "high"]),
      })
    ),

  preparationPlan: z
    .array(
      z.object({
        day: z.number().int().min(1),
        focus: z.string(),
        tasks: z.array(z.string()),
      })
    ),

  title: z.string(),
});

// =========================================================
// HELPER FUNCTIONS
// =========================================================

function toStringSafe(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return String(value).trim();
}


// ---------------------------------------------------------
// Normalize technical / behavioral questions
// ---------------------------------------------------------

function normalizeQuestions(questions, type = "technical") {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions.map((item, index) => {

    // Gemini sometimes returns a plain string
    if (typeof item === "string") {
      return {
        question: item.trim(),

        intention:
          type === "technical"
            ? "The interviewer wants to evaluate the candidate's technical understanding and practical knowledge."
            : "The interviewer wants to evaluate the candidate's communication, behavior and problem-solving approach.",

        answer:
          type === "technical"
            ? "Explain the concept clearly, give a practical example, and relate it to your project experience."
            : "Answer honestly using a clear situation, action and result structure.",
      };
    }

    // Gemini returns an object
    return {
      question: toStringSafe(
        item?.question,
        `Interview question ${index + 1}`
      ),

      intention: toStringSafe(
        item?.intention,
        type === "technical"
          ? "Evaluate the candidate's technical knowledge."
          : "Evaluate the candidate's behavioral and communication skills."
      ),

      answer: toStringSafe(
        item?.answer,
        type === "technical"
          ? "Explain the concept clearly with a practical example."
          : "Give a clear answer with a relevant real-world example."
      ),
    };
  });
}


// ---------------------------------------------------------
// Normalize skill gaps
// ---------------------------------------------------------

function normalizeSkillGaps(skillGaps) {
  if (!Array.isArray(skillGaps)) {
    return [];
  }

  return skillGaps.map((item) => {

    // If Gemini returns:
    // "Automated Testing"
    if (typeof item === "string") {
      return {
        skill: item.trim(),
        severity: "medium",
      };
    }

    let severity = String(item?.severity || "medium").toLowerCase();

    if (!["low", "medium", "high"].includes(severity)) {
      severity = "medium";
    }

    return {
      skill: toStringSafe(
        item?.skill,
        "Additional technical skill"
      ),
      severity,
    };
  });
}


// ---------------------------------------------------------
// Normalize preparation plan
// ---------------------------------------------------------

function normalizePreparationPlan(plan) {
  if (!Array.isArray(plan)) {
    return [];
  }

  const usedDays = new Set();

  return plan.map((item, index) => {

    let day;

    let focus;

    let tasks;


    // -----------------------------------------------
    // Gemini returned a string
    // Example:
    // "Day 1: JavaScript Deep Dive"
    // -----------------------------------------------

    if (typeof item === "string") {

      const match = item.match(/day\s*(\d+)/i);

      day = match
        ? Number(match[1])
        : index + 1;

      focus = item
        .replace(/day\s*\d+\s*[:\-]?\s*/i, "")
        .trim();

      if (!focus) {
        focus = `Preparation Day ${day}`;
      }

      tasks = [
        `Study ${focus}`,
        `Practice ${focus} with practical examples`,
        `Revise important interview questions related to ${focus}`,
      ];
    }

    // -----------------------------------------------
    // Gemini returned an object
    // -----------------------------------------------

    else {

      day = Number(item?.day);

      if (!Number.isInteger(day) || day < 1) {
        day = index + 1;
      }

      focus = toStringSafe(
        item?.focus,
        `Interview Preparation - Day ${day}`
      );

      tasks = Array.isArray(item?.tasks)
        ? item.tasks
            .map((task) => toStringSafe(task))
            .filter(Boolean)
        : [];

      // Make sure tasks are not empty
      if (tasks.length === 0) {
        tasks = [
          `Study ${focus}`,
          `Practice ${focus} with practical examples`,
          `Revise interview questions related to ${focus}`,
        ];
      }
    }


    // -----------------------------------------------
    // Make day numbers unique
    // -----------------------------------------------

    while (usedDays.has(day)) {
      day++;
    }

    usedDays.add(day);


    return {
      day,
      focus,
      tasks,
    };
  });
}


// ---------------------------------------------------------
// Get title safely
// ---------------------------------------------------------

function getJobTitle(jobDescription) {

  if (!jobDescription) {
    return "Interview Preparation";
  }

  const text = String(jobDescription).trim();

  // Look for common job-title formats
  const titleMatch = text.match(
    /(?:job\s*title|position|role)\s*[:\-]\s*([^\n]+)/i
  );

  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }

  // Otherwise use first meaningful line
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (firstLine && firstLine.length < 100) {
    return firstLine;
  }

  return "Interview Preparation";
}


// =========================================================
// NORMALIZE COMPLETE INTERVIEW REPORT
// =========================================================

function normalizeInterviewReport(data, jobDescription) {

  const matchScoreNumber = Number(data?.matchScore);

  let matchScore = Number.isFinite(matchScoreNumber)
    ? matchScoreNumber
    : 0;

  // Keep score between 0 and 100
  matchScore = Math.max(
    0,
    Math.min(100, matchScore)
  );


  const normalizedReport = {

    matchScore,

    technicalQuestions: normalizeQuestions(
      data?.technicalQuestions,
      "technical"
    ),

    behavioralQuestions: normalizeQuestions(
      data?.behavioralQuestions,
      "behavioral"
    ),

    skillGaps: normalizeSkillGaps(
      data?.skillGaps
    ),

    preparationPlan: normalizePreparationPlan(
      data?.preparationPlan
    ),

    title: toStringSafe(
      data?.title,
      getJobTitle(jobDescription)
    ),
  };


  // If Gemini completely misses the title
  if (!normalizedReport.title) {
    normalizedReport.title =
      getJobTitle(jobDescription);
  }


  // Final Zod validation
  return interviewReportSchema.parse(
    normalizedReport
  );
}


// =========================================================
// GENERATE INTERVIEW REPORT
// =========================================================

async function generateInterviewReport({
  resume,
  selfDescription,
  jobDescription,
}) {

  const prompt = `
You are an expert technical interviewer and career advisor.

Generate a personalized interview preparation report.

CANDIDATE RESUME:
${resume}

SELF DESCRIPTION:
${selfDescription}

JOB DESCRIPTION:
${jobDescription}


IMPORTANT JSON RULES:

Return ONLY JSON.

The JSON MUST contain exactly these fields:

{
  "matchScore": 0,
  "technicalQuestions": [],
  "behavioralQuestions": [],
  "skillGaps": [],
  "preparationPlan": [],
  "title": ""
}


TECHNICAL QUESTIONS:

technicalQuestions MUST be an array of objects.

Every object MUST have:

{
  "question": "technical interview question",
  "intention": "why interviewer asks this question",
  "answer": "strong answer and important points"
}


BEHAVIORAL QUESTIONS:

behavioralQuestions MUST be an array of objects.

Every object MUST have:

{
  "question": "behavioral interview question",
  "intention": "why interviewer asks this question",
  "answer": "strong answer and important points"
}


SKILL GAPS:

skillGaps MUST be an array of objects.

Every object MUST have:

{
  "skill": "missing skill",
  "severity": "low"
}

severity MUST be exactly one of:

"low"
"medium"
"high"


PREPARATION PLAN:

preparationPlan MUST be an array of objects.

Every object MUST have:

{
  "day": 1,
  "focus": "main topic",
  "tasks": [
    "task 1",
    "task 2",
    "task 3"
  ]
}

IMPORTANT:

"day" MUST be a NUMBER.

Correct:
"day": 1

Incorrect:
"day": "Day 1"

Do NOT write "Day 1: JavaScript".

The day must contain ONLY the number.

For example:

{
  "day": 1,
  "focus": "JavaScript Fundamentals",
  "tasks": [
    "Revise variables and functions",
    "Practice closures",
    "Practice promises and async/await"
  ]
}


Create multiple preparation days.

Each day must have a unique number.


TITLE:

The "title" field is REQUIRED.

Use the actual job title from the job description.

For example:

"title": "Software Development Intern"


MATCH SCORE:

matchScore must be a NUMBER between 0 and 100.


Do not return Markdown.

Do not return explanations outside JSON.

Return only valid JSON.
`;


  try {

    const response =
      await ai.models.generateContent({

        model: "gemini-3-flash-preview",

        contents: prompt,

        config: {

          responseMimeType:
            "application/json",

          responseSchema:
            zodToJsonSchema(
              interviewReportSchema
            ),

        },

      });


    // -----------------------------------------------
    // Make sure Gemini returned something
    // -----------------------------------------------

    if (!response || !response.text) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }


    console.log(
      "\n========== GEMINI RAW RESPONSE ==========\n"
    );

    console.log(response.text);

    console.log(
      "\n=========================================\n"
    );


    // -----------------------------------------------
    // Parse JSON
    // -----------------------------------------------

    let parsedResponse;

    try {

      parsedResponse =
        JSON.parse(response.text);

    } catch (jsonError) {

      console.error(
        "Gemini JSON parse error:",
        jsonError
      );

      throw new Error(
        "Gemini returned invalid JSON."
      );
    }


    // -----------------------------------------------
    // Normalize response
    // -----------------------------------------------

    const finalReport =
      normalizeInterviewReport(
        parsedResponse,
        jobDescription
      );


    console.log(
      "\n========== FINAL INTERVIEW REPORT ==========\n"
    );

    console.log(
      JSON.stringify(
        finalReport,
        null,
        2
      )
    );

    console.log(
      "\n============================================\n"
    );


    return finalReport;

  } catch (error) {

    console.error(
      "generateInterviewReport ERROR:",
      error
    );

    throw error;
  }
}


// =========================================================
// GENERATE PDF FROM HTML
// =========================================================

async function generatePdfFromHtml(htmlContent) {

  const browser =
    await puppeteer.launch({

      headless: true,

      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],

    });


  try {

    const page =
      await browser.newPage();


    await page.setContent(
      htmlContent,
      {
        waitUntil: "networkidle0",
      }
    );


    const pdfBuffer =
      await page.pdf({

        format: "A4",

        printBackground: true,

        margin: {
          top: "20mm",
          right: "20mm",
          bottom: "15mm",
          left: "15mm",
        },

      });


    return pdfBuffer;

  } finally {

    await browser.close();

  }
}


// =========================================================
// RESUME PDF SCHEMA
// =========================================================

const resumePdfSchema =
  z.object({

    html: z
      .string()
      .describe(
        "Complete HTML content of the resume which can be converted into a PDF using Puppeteer."
      ),

  });


// =========================================================
// GENERATE RESUME PDF
// =========================================================

async function generateResumePdf({
  resume,
  selfDescription,
  jobDescription,
}) {

  const prompt = `
Generate a professional resume in HTML format.

CANDIDATE RESUME:
${resume}

SELF DESCRIPTION:
${selfDescription}

JOB DESCRIPTION:
${jobDescription}

Create a professional, clean and modern resume.

The resume should contain relevant sections such as:

- Candidate Name
- Professional Summary
- Technical Skills
- Education
- Experience
- Projects
- Achievements
- Certifications if available

IMPORTANT REQUIREMENTS:

1. Return complete valid HTML.
2. The HTML must be suitable for A4 PDF.
3. Use inline CSS or a <style> tag.
4. Make the resume professional and readable.
5. Do not use Markdown.
6. Do not add explanations outside the HTML.
7. Return the HTML inside the JSON field "html".
8. Do not invent important personal information.
9. Return only JSON matching the provided schema.
`;


  const response =
    await ai.models.generateContent({

      model: "gemini-3-flash-preview",

      contents: prompt,

      config: {

        responseMimeType:
          "application/json",

        responseSchema:
          zodToJsonSchema(
            resumePdfSchema
          ),

      },

    });


  if (!response || !response.text) {
    throw new Error(
      "Gemini returned an empty resume response."
    );
  }


  const jsonContent =
    JSON.parse(response.text);


  const validatedContent =
    resumePdfSchema.parse(
      jsonContent
    );


  const pdfBuffer =
    await generatePdfFromHtml(
      validatedContent.html
    );


  return pdfBuffer;
}


// =========================================================
// EXPORTS
// =========================================================

module.exports = {

  generateInterviewReport,

  generateResumePdf,

};