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
    .max(100),

  technicalQuestions: z.array(
    z.object({
      question: z.string(),
      intention: z.string(),
      answer: z.string(),
    })
  ),

  behavioralQuestions: z.array(
    z.object({
      question: z.string(),
      intention: z.string(),
      answer: z.string(),
    })
  ),

  skillGaps: z.array(
    z.object({
      skill: z.string(),
      severity: z.enum([
        "low",
        "medium",
        "high",
      ]),
    })
  ),

  preparationPlan: z.array(
    z.object({
      day: z.number().int().min(1),
      focus: z.string(),
      tasks: z.array(z.string()),
    })
  ),

  title: z.string(),
});

// =========================================================
// SAFE STRING
// =========================================================

function toStringSafe(value, fallback = "") {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return String(value).trim();
}

// =========================================================
// CLEAN GEMINI TEXT
// =========================================================

function cleanJsonText(text) {
  if (!text) {
    return "";
  }

  let cleaned = String(text).trim();

  // Remove markdown JSON fences
  cleaned = cleaned.replace(
    /^```json\s*/i,
    ""
  );

  cleaned = cleaned.replace(
    /^```\s*/i,
    ""
  );

  cleaned = cleaned.replace(
    /\s*```$/i,
    ""
  );

  return cleaned.trim();
}

// =========================================================
// REPAIR JSON-FRAGMENT ARRAYS
//
// Sometimes Gemini can return:
//
// [
//   "{",
//   "\"question\": \"...\",",
//   "\"intention\": \"...\",",
//   "\"answer\": \"...\"",
//   "}"
// ]
//
// This function joins those fragments and parses them.
// =========================================================

function repairFragmentedArray(value) {
  if (!Array.isArray(value)) {
    return value;
  }

  if (value.length === 0) {
    return value;
  }

  // Already proper objects
  if (
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item)
    )
  ) {
    return value;
  }

  // Only strings
  if (
    !value.every(
      (item) =>
        typeof item === "string"
    )
  ) {
    return value;
  }

  const joined = cleanJsonText(
    value.join("")
  );

  // Try complete JSON
  try {
    const parsed =
      JSON.parse(joined);

    if (
      Array.isArray(parsed) ||
      (parsed &&
        typeof parsed === "object")
    ) {
      return parsed;
    }
  } catch (error) {
    // Continue with other repair methods
  }

  // Sometimes fragments contain spaces/newlines
  const joinedWithNewLines =
    cleanJsonText(
      value.join("\n")
    );

  try {
    const parsed =
      JSON.parse(
        joinedWithNewLines
      );

    if (
      Array.isArray(parsed) ||
      (parsed &&
        typeof parsed === "object")
    ) {
      return parsed;
    }
  } catch (error) {
    // Ignore
  }

  return value;
}

// =========================================================
// REPAIR POSSIBLE JSON STRING
// =========================================================

function repairPossibleJson(value) {
  if (
    typeof value !== "string"
  ) {
    return value;
  }

  const cleaned =
    cleanJsonText(value);

  if (
    !cleaned.startsWith("{") &&
    !cleaned.startsWith("[")
  ) {
    return value;
  }

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    return value;
  }
}

// =========================================================
// NORMALIZE QUESTIONS
// =========================================================

function normalizeQuestions(
  questions,
  type = "technical"
) {
  if (!Array.isArray(questions)) {
    return [];
  }

  // Repair Gemini fragmented response
  questions =
    repairFragmentedArray(
      questions
    );

  // If repair resulted in a single object
  if (
    questions &&
    !Array.isArray(questions) &&
    typeof questions === "object"
  ) {
    questions = [questions];
  }

  if (!Array.isArray(questions)) {
    return [];
  }

  return questions
    .map((item, index) => {

      // ---------------------------------------------------
      // Plain string
      // ---------------------------------------------------

      if (
        typeof item === "string"
      ) {
        const question =
          item.trim();

        if (!question) {
          return null;
        }

        return {
          question,

          intention:
            type === "technical"
              ? `The interviewer wants to evaluate the candidate's understanding of ${question}.`
              : `The interviewer wants to understand how the candidate would respond to ${question}.`,

          answer:
            type === "technical"
              ? `A strong answer should directly address "${question}" with the relevant concept, reasoning, and a practical example.`
              : `A strong answer should directly address "${question}" using a genuine example from the candidate's experience.`,
        };
      }

      // ---------------------------------------------------
      // Object
      // ---------------------------------------------------

      if (
        !item ||
        typeof item !== "object"
      ) {
        return null;
      }

      const question =
        toStringSafe(
          item.question
        );

      if (!question) {
        return null;
      }

      const intention =
        toStringSafe(
          item.intention,
          type === "technical"
            ? `The interviewer wants to evaluate the candidate's understanding of ${question}.`
            : `The interviewer wants to understand how the candidate would respond to ${question}.`
        );

      const answer =
        toStringSafe(
          item.answer,
          type === "technical"
            ? `A strong answer should directly explain ${question} and include relevant reasoning and an example.`
            : `A strong answer should directly answer ${question} using a genuine example from the candidate's experience.`
        );

      return {
        question,
        intention,
        answer,
      };
    })
    .filter(Boolean);
}

// =========================================================
// NORMALIZE SKILL GAPS
// =========================================================

function normalizeSkillGaps(
  skillGaps
) {
  if (!Array.isArray(skillGaps)) {
    return [];
  }

  // Repair fragmented Gemini response
  skillGaps =
    repairFragmentedArray(
      skillGaps
    );

  if (
    skillGaps &&
    !Array.isArray(skillGaps) &&
    typeof skillGaps === "object"
  ) {
    skillGaps = [skillGaps];
  }

  if (!Array.isArray(skillGaps)) {
    return [];
  }

  return skillGaps
    .map((item) => {

      // ---------------------------------------------------
      // String
      // ---------------------------------------------------

      if (
        typeof item === "string"
      ) {
        const skill =
          item.trim();

        // Don't allow JSON fragments
        if (
          !skill ||
          skill === "skill" ||
          skill === "skills" ||
          skill === "severity" ||
          skill === "high" ||
          skill === "medium" ||
          skill === "low" ||
          skill === "{" ||
          skill === "}"
        ) {
          return null;
        }

        return {
          skill,
          severity: "medium",
        };
      }

      // ---------------------------------------------------
      // Object
      // ---------------------------------------------------

      if (
        !item ||
        typeof item !== "object"
      ) {
        return null;
      }

      let severity =
        String(
          item.severity ||
            "medium"
        ).toLowerCase();

      if (
        ![
          "low",
          "medium",
          "high",
        ].includes(severity)
      ) {
        severity = "medium";
      }

      const skill =
        toStringSafe(
          item.skill
        );

      if (
        !skill ||
        skill === "skill" ||
        skill === "skills" ||
        skill === "severity" ||
        skill === "high" ||
        skill === "medium" ||
        skill === "low"
      ) {
        return null;
      }

      return {
        skill,
        severity,
      };
    })
    .filter(Boolean);
}

// =========================================================
// NORMALIZE PREPARATION PLAN
// =========================================================

function normalizePreparationPlan(
  plan
) {
  if (!Array.isArray(plan)) {
    return [];
  }

  plan =
    repairFragmentedArray(
      plan
    );

  if (
    plan &&
    !Array.isArray(plan) &&
    typeof plan === "object"
  ) {
    plan = [plan];
  }

  if (!Array.isArray(plan)) {
    return [];
  }

  const usedDays =
    new Set();

  return plan
    .map((item, index) => {

      let day;
      let focus;
      let tasks;

      // ---------------------------------------------------
      // String
      // ---------------------------------------------------

      if (
        typeof item === "string"
      ) {
        const match =
          item.match(
            /day\s*(\d+)/i
          );

        day =
          match
            ? Number(match[1])
            : index + 1;

        focus =
          item
            .replace(
              /day\s*\d+\s*[:\-]?\s*/i,
              ""
            )
            .trim();

        if (!focus) {
          focus =
            `Interview Preparation - Day ${day}`;
        }

        tasks = [
          `Study ${focus}`,
          `Practice ${focus} with practical examples`,
          `Revise interview questions related to ${focus}`,
        ];
      }

      // ---------------------------------------------------
      // Object
      // ---------------------------------------------------

      else if (
        item &&
        typeof item === "object"
      ) {
        day =
          Number(item.day);

        if (
          !Number.isInteger(day) ||
          day < 1
        ) {
          day = index + 1;
        }

        focus =
          toStringSafe(
            item.focus,
            `Interview Preparation - Day ${day}`
          );

        tasks =
          Array.isArray(
            item.tasks
          )
            ? item.tasks
                .map((task) =>
                  toStringSafe(task)
                )
                .filter(Boolean)
            : [];

        if (
          tasks.length === 0
        ) {
          tasks = [
            `Study ${focus}`,
            `Practice ${focus} with practical examples`,
            `Revise interview questions related to ${focus}`,
          ];
        }
      }

      else {
        return null;
      }

      // ---------------------------------------------------
      // Unique day
      // ---------------------------------------------------

      while (
        usedDays.has(day)
      ) {
        day++;
      }

      usedDays.add(day);

      return {
        day,
        focus,
        tasks,
      };
    })
    .filter(Boolean);
}

// =========================================================
// GET JOB TITLE
// =========================================================

function getJobTitle(
  jobDescription
) {
  if (!jobDescription) {
    return "Interview Preparation";
  }

  const text =
    String(
      jobDescription
    ).trim();

  const titleMatch =
    text.match(
      /(?:job\s*title|position|role)\s*[:\-]\s*([^\n]+)/i
    );

  if (
    titleMatch &&
    titleMatch[1]
  ) {
    return titleMatch[1]
      .trim();
  }

  const firstLine =
    text
      .split("\n")
      .map((line) =>
        line.trim()
      )
      .find(Boolean);

  if (
    firstLine &&
    firstLine.length < 100
  ) {
    return firstLine;
  }

  return "Interview Preparation";
}

// =========================================================
// NORMALIZE COMPLETE REPORT
// =========================================================

function normalizeInterviewReport(
  data,
  jobDescription
) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "Invalid interview report returned by Gemini."
    );
  }

  // -------------------------------------------------------
  // Repair individual fields
  // -------------------------------------------------------

  let technicalQuestions =
    repairPossibleJson(
      data.technicalQuestions
    );

  let behavioralQuestions =
    repairPossibleJson(
      data.behavioralQuestions
    );

  let skillGaps =
    repairPossibleJson(
      data.skillGaps
    );

  let preparationPlan =
    repairPossibleJson(
      data.preparationPlan
    );

  // -------------------------------------------------------
  // Match score
  // -------------------------------------------------------

  let matchScore =
    Number(
      data.matchScore
    );

  if (
    !Number.isFinite(
      matchScore
    )
  ) {
    matchScore = 0;
  }

  matchScore =
    Math.max(
      0,
      Math.min(
        100,
        matchScore
      )
    );

  // -------------------------------------------------------
  // Build normalized report
  // -------------------------------------------------------

  const normalizedReport = {
    matchScore,

    technicalQuestions:
      normalizeQuestions(
        technicalQuestions,
        "technical"
      ),

    behavioralQuestions:
      normalizeQuestions(
        behavioralQuestions,
        "behavioral"
      ),

    skillGaps:
      normalizeSkillGaps(
        skillGaps
      ),

    preparationPlan:
      normalizePreparationPlan(
        preparationPlan
      ),

    title:
      toStringSafe(
        data.title,
        getJobTitle(
          jobDescription
        )
      ),
  };

  // -------------------------------------------------------
  // Title fallback
  // -------------------------------------------------------

  if (
    !normalizedReport.title
  ) {
    normalizedReport.title =
      getJobTitle(
        jobDescription
      );
  }

  // -------------------------------------------------------
  // Final Zod validation
  // -------------------------------------------------------

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

Generate a highly personalized interview preparation report.

Use ONLY the candidate's resume, self-description, and job description.

=========================================================
CANDIDATE RESUME
=========================================================

${resume || "Not provided"}

=========================================================
SELF DESCRIPTION
=========================================================

${selfDescription || "Not provided"}

=========================================================
JOB DESCRIPTION
=========================================================

${jobDescription || "Not provided"}

=========================================================
IMPORTANT
=========================================================

Return ONLY valid JSON.

Do not return Markdown.

Do not return explanations outside JSON.

=========================================================
TECHNICAL QUESTIONS
=========================================================

Generate EXACTLY 5 technical questions.

Each question must be different.

Each question must be relevant to the candidate and target job.

Every question MUST have its own:

1. question
2. intention
3. answer

The answer MUST directly answer that exact question.

DO NOT use generic answers.

BAD:

"Explain the concept clearly and give a practical example."

GOOD:

If the question is:

"What is the difference between WHERE and HAVING in SQL?"

The answer should actually explain WHERE, HAVING, filtering before/after grouping,
and provide an appropriate SQL example.

Every answer must be unique.

=========================================================
BEHAVIORAL QUESTIONS
=========================================================

Generate EXACTLY 5 behavioral questions.

Every question must be different.

Every intention must be different.

Every answer must be different.

Answers must be realistic sample answers based ONLY on the candidate's
actual resume and self-description.

Do not invent companies, projects, achievements, or experiences.

=========================================================
SKILL GAPS
=========================================================

Identify actual skills that are required by the job but are missing,
weak, or insufficiently demonstrated by the candidate.

Each skill gap must be an object:

{
  "skill": "Actual Skill Name",
  "severity": "low"
}

The skill MUST be an actual skill.

Never use:

"skill"
"skills"
"severity"
"high"
"medium"
"low"

as a skill.

Severity must be exactly:

"low"
"medium"
"high"

=========================================================
PREPARATION PLAN
=========================================================

Generate at least 5 preparation days.

Every day must have a unique numeric day.

Example:

{
  "day": 1,
  "focus": "SQL",
  "tasks": [
    "Revise joins",
    "Practice GROUP BY and HAVING",
    "Solve SQL interview questions"
  ]
}

The day must be a NUMBER.

=========================================================
TITLE
=========================================================

Use the actual job title from the job description.

=========================================================
MATCH SCORE
=========================================================

Return a number from 0 to 100.

The score must reflect how closely the candidate matches the job.

=========================================================
FINAL JSON STRUCTURE
=========================================================

{
  "matchScore": 0,

  "technicalQuestions": [
    {
      "question": "...",
      "intention": "...",
      "answer": "..."
    }
  ],

  "behavioralQuestions": [
    {
      "question": "...",
      "intention": "...",
      "answer": "..."
    }
  ],

  "skillGaps": [
    {
      "skill": "...",
      "severity": "medium"
    }
  ],

  "preparationPlan": [
    {
      "day": 1,
      "focus": "...",
      "tasks": [
        "...",
        "...",
        "..."
      ]
    }
  ],

  "title": "..."
}

=========================================================
FINAL CHECK
=========================================================

Before returning the JSON:

- Exactly 5 technical questions.
- Exactly 5 behavioral questions.
- Technical questions are unique.
- Technical intentions are unique.
- Technical answers are unique.
- Every technical answer directly answers its question.
- Behavioral questions are unique.
- Behavioral intentions are unique.
- Behavioral answers are unique.
- Skill gaps contain actual skill names.
- Severity is only low, medium, or high.
- Preparation days are numbers.
- Preparation days are unique.
- Return ONLY JSON.
`;

  try {

    // =====================================================
    // GEMINI REQUEST
    // =====================================================

    const response =
      await ai.models.generateContent({

        model:
          "gemini-3-flash-preview",

        contents:
          prompt,

        config: {

          responseMimeType:
            "application/json",

          responseSchema:
            zodToJsonSchema(
              interviewReportSchema
            ),
        },
      });

    // =====================================================
    // CHECK RESPONSE
    // =====================================================

    if (
      !response ||
      !response.text
    ) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    console.log(
      "\n========== GEMINI RAW RESPONSE ==========\n"
    );

    console.log(
      response.text
    );

    console.log(
      "\n=========================================\n"
    );

    // =====================================================
    // PARSE JSON
    // =====================================================

    let parsedResponse;

    try {

      const cleaned =
        cleanJsonText(
          response.text
        );

      parsedResponse =
        JSON.parse(
          cleaned
        );

    } catch (jsonError) {

      console.error(
        "Gemini JSON parse error:",
        jsonError
      );

      console.error(
        "RAW RESPONSE:",
        response.text
      );

      throw new Error(
        "Gemini returned invalid JSON."
      );
    }

    // =====================================================
    // NORMALIZE
    // =====================================================

    const finalReport =
      normalizeInterviewReport(
        parsedResponse,
        jobDescription
      );

    // =====================================================
    // LOG FINAL REPORT
    // =====================================================

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
      "\n============================================"
    );

    console.error(
      "generateInterviewReport ERROR:"
    );

    console.error(
      error
    );

    console.error(
      "============================================\n"
    );

    throw error;
  }
}

// =========================================================
// GENERATE PDF FROM HTML
// =========================================================

async function generatePdfFromHtml(
  htmlContent
) {

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
        waitUntil:
          "networkidle0",
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

    html:
      z
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

=========================================================
CANDIDATE RESUME
=========================================================

${resume || "Not provided"}

=========================================================
SELF DESCRIPTION
=========================================================

${selfDescription || "Not provided"}

=========================================================
JOB DESCRIPTION
=========================================================

${jobDescription || "Not provided"}

=========================================================
REQUIREMENTS
=========================================================

Create a professional, clean and modern A4 resume.

Include relevant sections such as:

- Candidate Name
- Professional Summary
- Technical Skills
- Education
- Experience
- Projects
- Achievements
- Certifications if available

IMPORTANT:

1. Return complete valid HTML.
2. Use inline CSS or a style tag.
3. Make it suitable for A4 PDF.
4. Keep it professional and readable.
5. Do not use Markdown.
6. Do not invent important personal information.
7. Return the HTML inside the JSON field "html".
8. Return only valid JSON.
`;

  try {

    const response =
      await ai.models.generateContent({

        model:
          "gemini-3-flash-preview",

        contents:
          prompt,

        config: {

          responseMimeType:
            "application/json",

          responseSchema:
            zodToJsonSchema(
              resumePdfSchema
            ),
        },
      });

    if (
      !response ||
      !response.text
    ) {
      throw new Error(
        "Gemini returned an empty resume response."
      );
    }

    console.log(
      "\n========== GEMINI RESUME RESPONSE ==========\n"
    );

    console.log(
      response.text
    );

    console.log(
      "\n=============================================\n"
    );

    const cleaned =
      cleanJsonText(
        response.text
      );

    const jsonContent =
      JSON.parse(
        cleaned
      );

    const validatedContent =
      resumePdfSchema.parse(
        jsonContent
      );

    const pdfBuffer =
      await generatePdfFromHtml(
        validatedContent.html
      );

    return pdfBuffer;

  } catch (error) {

    console.error(
      "generateResumePdf ERROR:",
      error
    );

    throw error;
  }
}

// =========================================================
// EXPORTS
// =========================================================

module.exports = {
  generateInterviewReport,
  generateResumePdf,
};