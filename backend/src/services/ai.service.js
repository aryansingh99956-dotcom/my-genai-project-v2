const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const puppeteer = require("puppeteer");

// =========================================================
// GEMINI
// =========================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_GEN_API_KEY,
});


// =========================================================
// INTERVIEW REPORT SCHEMA
// =========================================================

const questionSchema = z.object({
  question: z.string().min(1),
  intention: z.string().min(1),
  answer: z.string().min(1),
});

const skillGapSchema = z.object({
  skill: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
});

const preparationDaySchema = z.object({
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

  skillGaps: z.array(skillGapSchema),

  preparationPlan: z
    .array(preparationDaySchema)
    .min(1),

  title: z.string().min(1),
});


// =========================================================
// RESUME PDF SCHEMA
// =========================================================

const resumePdfSchema = z.object({
  html: z.string().min(1),
});


// =========================================================
// TEXT HELPERS
// =========================================================

function cleanText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}


// =========================================================
// JSON PARSER
// =========================================================

function parseGeminiJSON(text) {
  const cleaned = cleanText(text);

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");

    if (first !== -1 && last !== -1 && last > first) {
      try {
        return JSON.parse(
          cleaned.substring(first, last + 1)
        );
      } catch {
        throw new Error(
          "Gemini returned invalid JSON."
        );
      }
    }

    throw new Error(
      "Gemini returned invalid JSON."
    );
  }
}


// =========================================================
// REMOVE FIELD LABELS
// =========================================================
// This does NOT create fallback content.
// It only removes accidental labels such as:
// "Question: ..."
// "Answer: ..."
// =========================================================

function removeLabel(text, labels) {
  let value = cleanText(text);

  for (const label of labels) {
    const regex = new RegExp(
      `^\\s*${label}\\s*[:\\-]\\s*`,
      "i"
    );

    value = value.replace(regex, "").trim();
  }

  return value;
}


// =========================================================
// NORMALIZE QUESTION OBJECT
// =========================================================

function normalizeQuestion(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const question = removeLabel(
    item.question,
    ["question", "q"]
  );

  const intention = removeLabel(
    item.intention,
    [
      "intention",
      "interviewer intention",
      "intent",
    ]
  );

  const answer = removeLabel(
    item.answer,
    [
      "answer",
      "model answer",
      "sample answer",
    ]
  );

  if (!question || !intention || !answer) {
    return null;
  }

  return {
    question,
    intention,
    answer,
  };
}


// =========================================================
// GENERIC / INVALID TEXT DETECTOR
// =========================================================

function isGenericIntention(text) {
  const value = text.toLowerCase().trim();

  const generic = [
    "evaluate the candidate's technical understanding of this topic.",
    "evaluate the candidate's technical understanding of this topic",
    "evaluate the candidate's understanding of this topic.",
    "evaluate the candidate's understanding of this topic",
    "assess the candidate's technical understanding.",
    "assess the candidate's technical knowledge.",
    "evaluate the candidate's communication, problem-solving and behavioral approach.",
    "evaluate the candidate's communication, problem-solving and behavioral approach",
  ];

  return generic.includes(value);
}


function isGenericAnswer(text) {
  const value = text.toLowerCase().trim();

  const generic = [
    "the candidate should explain the concept accurately and support the explanation with a relevant example.",
    "the candidate should explain the concept accurately and support the explanation with a relevant example",
    "the candidate should provide a specific example from their experience and explain their actions and results.",
    "the candidate should provide a specific example from their experience and explain their actions and results",
    "explain the concept clearly.",
    "give a practical example.",
  ];

  return generic.includes(value);
}


// =========================================================
// CHECK FIELD CONTAMINATION
// =========================================================

function containsOtherField(text, field) {
  const value = text.toLowerCase();

  if (
    field !== "question" &&
    (
      value.includes("interviewer intention:") ||
      value.includes('"intention"') ||
      value.includes("intention:")
    )
  ) {
    return true;
  }

  if (
    field !== "question" &&
    (
      value.includes("model answer:") ||
      value.includes("answer:") ||
      value.includes('"answer"')
    )
  ) {
    return true;
  }

  if (
    field !== "intention" &&
    (
      value.includes("question:") ||
      value.includes('"question"')
    )
  ) {
    return true;
  }

  return false;
}


// =========================================================
// VALIDATE QUESTIONS
// =========================================================

function validateQuestions(
  questions,
  type
) {
  if (!Array.isArray(questions)) {
    throw new Error(
      `${type} questions are not an array.`
    );
  }

  if (questions.length !== 5) {
    throw new Error(
      `${type} questions must contain exactly 5 questions.`
    );
  }

  const normalized = questions.map(
    normalizeQuestion
  );

  if (normalized.some((item) => !item)) {
    throw new Error(
      `${type} question contains missing fields.`
    );
  }

  // -------------------------------------------------------
  // UNIQUE QUESTIONS
  // -------------------------------------------------------

  const questionSet = new Set();

  for (const item of normalized) {
    const key = item.question
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    if (questionSet.has(key)) {
      throw new Error(
        `${type} contains duplicate questions.`
      );
    }

    questionSet.add(key);
  }

  // -------------------------------------------------------
  // UNIQUE INTENTIONS
  // -------------------------------------------------------

  const intentionSet = new Set();

  for (const item of normalized) {
    const key = item.intention
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    if (isGenericIntention(item.intention)) {
      throw new Error(
        `${type} contains a generic interviewer intention.`
      );
    }

    if (intentionSet.has(key)) {
      throw new Error(
        `${type} contains duplicate interviewer intentions.`
      );
    }

    intentionSet.add(key);
  }

  // -------------------------------------------------------
  // ANSWERS
  // -------------------------------------------------------

  const answerSet = new Set();

  for (const item of normalized) {
    const key = item.answer
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    if (isGenericAnswer(item.answer)) {
      throw new Error(
        `${type} contains a generic answer.`
      );
    }

    if (answerSet.has(key)) {
      throw new Error(
        `${type} contains duplicate answers.`
      );
    }

    answerSet.add(key);

    if (
      containsOtherField(
        item.answer,
        "answer"
      )
    ) {
      throw new Error(
        `${type} answer contains another field.`
      );
    }
  }

  // -------------------------------------------------------
  // FIELD CONTAMINATION
  // -------------------------------------------------------

  for (const item of normalized) {
    if (
      containsOtherField(
        item.question,
        "question"
      )
    ) {
      throw new Error(
        `${type} question contains another field.`
      );
    }

    if (
      containsOtherField(
        item.intention,
        "intention"
      )
    ) {
      throw new Error(
        `${type} intention contains another field.`
      );
    }
  }

  return normalized;
}


// =========================================================
// SKILL GAP NORMALIZATION
// =========================================================

function normalizeSkillGaps(skillGaps) {
  if (!Array.isArray(skillGaps)) {
    throw new Error(
      "skillGaps must be an array."
    );
  }

  const invalidNames = new Set([
    "skill",
    "skills",
    "severity",
    "high",
    "medium",
    "low",
    "skill:",
    "severity:",
  ]);

  const result = [];

  for (const item of skillGaps) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      continue;
    }

    let skill = cleanText(item.skill);

    let severity =
      cleanText(item.severity)
        .toLowerCase();

    skill = skill
      .replace(/^skill\s*:\s*/i, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    severity = severity
      .replace(/^severity\s*:\s*/i, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    if (
      !skill ||
      invalidNames.has(
        skill.toLowerCase()
      )
    ) {
      continue;
    }

    if (
      !["low", "medium", "high"].includes(
        severity
      )
    ) {
      throw new Error(
        `Invalid skill severity: ${severity}`
      );
    }

    result.push({
      skill,
      severity,
    });
  }

  return result;
}


// =========================================================
// PREPARATION PLAN
// =========================================================

function normalizePreparationPlan(plan) {
  if (!Array.isArray(plan)) {
    throw new Error(
      "preparationPlan must be an array."
    );
  }

  if (plan.length === 0) {
    throw new Error(
      "preparationPlan cannot be empty."
    );
  }

  const usedDays = new Set();

  const result = plan.map(
    (item, index) => {

      if (
        !item ||
        typeof item !== "object"
      ) {
        throw new Error(
          `Invalid preparation plan item at index ${index}.`
        );
      }

      const day = Number(item.day);

      if (
        !Number.isInteger(day) ||
        day < 1
      ) {
        throw new Error(
          `Invalid preparation day at index ${index}.`
        );
      }

      if (usedDays.has(day)) {
        throw new Error(
          `Duplicate preparation day: ${day}`
        );
      }

      usedDays.add(day);

      const focus = cleanText(
        item.focus
      );

      const tasks = Array.isArray(
        item.tasks
      )
        ? item.tasks
            .map(cleanText)
            .filter(Boolean)
        : [];

      if (!focus) {
        throw new Error(
          `Preparation day ${day} has no focus.`
        );
      }

      if (tasks.length === 0) {
        throw new Error(
          `Preparation day ${day} has no tasks.`
        );
      }

      return {
        day,
        focus,
        tasks,
      };
    }
  );

  return result;
}


// =========================================================
// TITLE
// =========================================================

function getJobTitle(jobDescription) {
  if (!jobDescription) {
    return "Interview Preparation";
  }

  const text = String(jobDescription).trim();

  const titleMatch = text.match(
    /(?:job\s*title|position|role)\s*[:\-]\s*([^\n]+)/i
  );

  if (
    titleMatch &&
    titleMatch[1]
  ) {
    return titleMatch[1].trim();
  }

  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (
    firstLine &&
    firstLine.length <= 100
  ) {
    return firstLine;
  }

  return "Interview Preparation";
}


// =========================================================
// COMPLETE REPORT NORMALIZATION
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
      "Gemini returned an invalid interview report."
    );
  }

  const matchScore = Number(
    data.matchScore
  );

  if (
    !Number.isFinite(matchScore)
  ) {
    throw new Error(
      "Invalid matchScore."
    );
  }

  const technicalQuestions =
    validateQuestions(
      data.technicalQuestions,
      "Technical"
    );

  const behavioralQuestions =
    validateQuestions(
      data.behavioralQuestions,
      "Behavioral"
    );

  const skillGaps =
    normalizeSkillGaps(
      data.skillGaps
    );

  const preparationPlan =
    normalizePreparationPlan(
      data.preparationPlan
    );

  const title =
    cleanText(
      data.title
    ) ||
    getJobTitle(
      jobDescription
    );

  const finalReport = {
    matchScore: Math.round(
      Math.max(
        0,
        Math.min(
          100,
          matchScore
        )
      )
    ),

    technicalQuestions,

    behavioralQuestions,

    skillGaps,

    preparationPlan,

    title,
  };

  // Final Zod validation
  return interviewReportSchema.parse(
    finalReport
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

Generate a personalized interview preparation report using ONLY:

1. Candidate resume
2. Candidate self description
3. Job description

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
ABSOLUTE OUTPUT RULE
=========================================================

Return ONLY JSON.

No Markdown.

No code fences.

No explanations.

Do NOT put JSON inside strings.

=========================================================
EXACT JSON STRUCTURE
=========================================================

{
  "matchScore": 0,
  "technicalQuestions": [
    {
      "question": "",
      "intention": "",
      "answer": ""
    }
  ],
  "behavioralQuestions": [
    {
      "question": "",
      "intention": "",
      "answer": ""
    }
  ],
  "skillGaps": [
    {
      "skill": "",
      "severity": "low"
    }
  ],
  "preparationPlan": [
    {
      "day": 1,
      "focus": "",
      "tasks": ["", "", ""]
    }
  ],
  "title": ""
}

=========================================================
TECHNICAL QUESTIONS
=========================================================

Generate EXACTLY 5.

Every object has exactly these fields:

question
intention
answer

IMPORTANT:

QUESTION FIELD:
Contains ONLY the interview question.

Example:

"What is the difference between WHERE and HAVING in SQL?"

Correct.

Incorrect:

"question: What is the difference..."

Incorrect:

"Question: ..., intention: ..., answer: ..."

---------------------------------------------------------

INTENTION FIELD:
Contains ONLY the reason the interviewer asks this question.

Example:

"To assess the candidate's ability to distinguish row-level filtering from group-level filtering in SQL."

Do NOT repeat the question.

Do NOT include "intention:".

Do NOT include answer content.

---------------------------------------------------------

ANSWER FIELD:
Contains ONLY the actual answer the candidate could give.

Example:

"WHERE filters individual rows before grouping, while HAVING filters groups after GROUP BY. WHERE is normally used for row-level conditions, whereas HAVING is used when the condition depends on an aggregate such as COUNT or SUM."

Do NOT repeat the question.

Do NOT explain what the interviewer wants.

Do NOT write "The candidate should..."

Do NOT write "Model answer:".

=========================================================
TECHNICAL UNIQUENESS
=========================================================

All 5 technical questions must be different.

All 5 intentions must be different.

All 5 answers must be different.

Each answer must directly answer ONLY its corresponding question.

=========================================================
BEHAVIORAL QUESTIONS
=========================================================

Generate EXACTLY 5.

Use candidate information from the resume and self description.

Do NOT invent experiences.

Each object:

{
  "question": "ONLY QUESTION",
  "intention": "ONLY INTERVIEWER INTENTION",
  "answer": "ONLY ACTUAL SAMPLE ANSWER"
}

The answer must be an actual answer that the candidate could adapt.

Do NOT write:

"Use STAR method."

Do NOT write:

"The candidate should..."

Each behavioral question needs a UNIQUE intention and UNIQUE answer.

=========================================================
SKILL GAPS
=========================================================

Compare the candidate with the job description.

Return only actual skills that are missing, weak, or insufficiently demonstrated.

Each item:

{
  "skill": "Power BI",
  "severity": "high"
}

The skill field contains ONLY the actual skill name.

The severity field contains ONLY:

"low"

OR

"medium"

OR

"high"

Nothing else.

NEVER:

{
  "skill": "skill",
  "severity": "high"
}

NEVER put "severity:" inside the severity value.

NEVER put "skill:" inside the skill value.

If there are no genuine gaps, return:

"skillGaps": []

=========================================================
PREPARATION ROAD MAP
=========================================================

Generate at least 5 unique days.

Each day:

{
  "day": 1,
  "focus": "Specific topic",
  "tasks": [
    "Specific task",
    "Specific task",
    "Specific task"
  ]
}

IMPORTANT:

day MUST be a NUMBER.

Correct:

"day": 1

Incorrect:

"day": "Day 1"

Every day must be unique.

Focus should target the candidate's actual skill gaps and job requirements.

=========================================================
MATCH SCORE
=========================================================

Number from 0 to 100.

=========================================================
TITLE
=========================================================

Use the actual job title from the job description.

=========================================================
FINAL CHECK
=========================================================

Before returning JSON verify:

1. Exactly 5 technical questions.
2. Exactly 5 behavioral questions.
3. Every question contains ONLY the question.
4. Every intention contains ONLY the interviewer intention.
5. Every answer contains ONLY the answer.
6. No answer contains the question.
7. No answer contains the intention.
8. No intention contains the question.
9. No generic intention.
10. No generic answer.
11. Every technical intention is unique.
12. Every technical answer is unique.
13. Every behavioral intention is unique.
14. Every behavioral answer is unique.
15. Skill is an actual skill name.
16. Severity is ONLY low, medium, or high.
17. Road map exists.
18. Road map has multiple unique numeric days.
19. Return ONLY JSON.

DO NOT BREAK THESE RULES.
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

    if (
      !response ||
      !response.text
    ) {
      throw new Error(
        "Gemini returned an empty interview report."
      );
    }

    console.log(
      "\n========== GEMINI RAW INTERVIEW RESPONSE ==========\n"
    );

    console.log(
      response.text
    );

    console.log(
      "\n====================================================\n"
    );

    const parsedResponse =
      parseGeminiJSON(
        response.text
      );

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
${resume || ""}

SELF DESCRIPTION:
${selfDescription || ""}

JOB DESCRIPTION:
${jobDescription || ""}

Requirements:

- Return complete HTML.
- HTML must be suitable for A4 PDF.
- Use inline CSS or style tag.
- Professional and readable.
- Do not use Markdown.
- Do not add explanations.
- Do not invent important personal information.
- Return JSON with exactly one field:

{
  "html": "complete HTML"
}
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

    const jsonContent =
      parseGeminiJSON(
        response.text
      );

    const validatedContent =
      resumePdfSchema.parse(
        jsonContent
      );

    return await generatePdfFromHtml(
      validatedContent.html
    );

  } catch (error) {

    console.error(
      "generateResumePdf ERROR:",
      error
    );

    throw error;
  }
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {
  generateInterviewReport,
  generateResumePdf,
};