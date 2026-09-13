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
      severity: z.enum(["low", "medium", "high"]),
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
// HELPER
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

// =========================================================
// NORMALIZE QUESTIONS
// =========================================================

function normalizeQuestions(questions, type = "technical") {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions
    .map((item, index) => {

      // -----------------------------------------------
      // If Gemini returns a string
      // -----------------------------------------------

      if (typeof item === "string") {
        const question = item.trim();

        if (!question) {
          return null;
        }

        return {
          question,

          intention:
            `The interviewer is testing the candidate's understanding of this specific ${type} topic and how well they can explain it.`,

          answer:
            `A strong answer should directly address "${question}", explain the relevant concept clearly, and include a practical example where appropriate.`,
        };
      }

      // -----------------------------------------------
      // If Gemini returns an object
      // -----------------------------------------------

      const question = toStringSafe(
        item?.question,
        `Interview question ${index + 1}`
      );

      const intention = toStringSafe(
        item?.intention
      );

      const answer = toStringSafe(
        item?.answer
      );

      return {
        question,

        intention:
          intention ||
          `The interviewer is testing the candidate's understanding of the specific topic covered by this question.`,

        answer:
          answer ||
          `The candidate should directly answer "${question}", explain the relevant concept, and provide a practical example when appropriate.`,
      };
    })
    .filter(Boolean);
}

// =========================================================
// NORMALIZE SKILL GAPS
// =========================================================

function normalizeSkillGaps(skillGaps) {
  if (!Array.isArray(skillGaps)) {
    return [];
  }

  return skillGaps
    .map((item) => {

      // -----------------------------------------------
      // Gemini returned a string
      // -----------------------------------------------

      if (typeof item === "string") {
        const skill = item.trim();

        if (!skill) {
          return null;
        }

        return {
          skill,
          severity: "medium",
        };
      }

      // -----------------------------------------------
      // Gemini returned an object
      // -----------------------------------------------

      let skill = toStringSafe(item?.skill);

      let severity = toStringSafe(
        item?.severity,
        "medium"
      ).toLowerCase();

      // Prevent bad severity values
      if (!["low", "medium", "high"].includes(severity)) {
        severity = "medium";
      }

      // Prevent generic field names from appearing
      const invalidSkills = [
        "skill",
        "skills",
        "severity",
        "high",
        "medium",
        "low",
        "additional technical skill",
      ];

      if (
        !skill ||
        invalidSkills.includes(skill.toLowerCase())
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
    // String
    // -----------------------------------------------

    if (typeof item === "string") {

      const match = item.match(/day\s*(\d+)/i);

      day = match
        ? Number(match[1])
        : index + 1;

      focus = item
        .replace(
          /day\s*\d+\s*[:\-]?\s*/i,
          ""
        )
        .trim();

      if (!focus) {
        focus = `Preparation Day ${day}`;
      }

      tasks = [
        `Study ${focus}`,
        `Practice ${focus} with practical examples`,
        `Revise interview questions related to ${focus}`,
      ];
    }

    // -----------------------------------------------
    // Object
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

      if (tasks.length === 0) {
        tasks = [
          `Study ${focus}`,
          `Practice ${focus} with practical examples`,
          `Revise interview questions related to ${focus}`,
        ];
      }
    }

    // -----------------------------------------------
    // Unique days
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

// =========================================================
// GET JOB TITLE
// =========================================================

function getJobTitle(jobDescription) {

  if (!jobDescription) {
    return "Interview Preparation";
  }

  const text = String(jobDescription).trim();

  const titleMatch = text.match(
    /(?:job\s*title|position|role)\s*[:\-]\s*([^\n]+)/i
  );

  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }

  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
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

  let matchScore = Number(
    data?.matchScore
  );

  if (!Number.isFinite(matchScore)) {
    matchScore = 0;
  }

  matchScore = Math.max(
    0,
    Math.min(100, matchScore)
  );

  const normalizedReport = {

    matchScore,

    technicalQuestions:
      normalizeQuestions(
        data?.technicalQuestions,
        "technical"
      ),

    behavioralQuestions:
      normalizeQuestions(
        data?.behavioralQuestions,
        "behavioral"
      ),

    skillGaps:
      normalizeSkillGaps(
        data?.skillGaps
      ),

    preparationPlan:
      normalizePreparationPlan(
        data?.preparationPlan
      ),

    title:
      toStringSafe(
        data?.title,
        getJobTitle(jobDescription)
      ),
  };

  if (!normalizedReport.title) {
    normalizedReport.title =
      getJobTitle(jobDescription);
  }

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

Your job is to generate a highly personalized interview preparation
report based ONLY on the candidate information and job description.

=========================================================
CANDIDATE RESUME
=========================================================

${resume}

=========================================================
SELF DESCRIPTION
=========================================================

${selfDescription}

=========================================================
JOB DESCRIPTION
=========================================================

${jobDescription}

=========================================================
GENERAL REQUIREMENTS
=========================================================

Return ONLY valid JSON.

Do not return Markdown.

Do not return explanations outside JSON.

The JSON MUST contain exactly:

{
  "matchScore": 0,
  "technicalQuestions": [],
  "behavioralQuestions": [],
  "skillGaps": [],
  "preparationPlan": [],
  "title": ""
}

=========================================================
TECHNICAL QUESTIONS
=========================================================

Generate 5 technical interview questions.

The questions MUST be relevant to:

- The candidate's resume
- Candidate's projects
- Candidate's technical skills
- The job description
- The expected responsibilities of the role

Each question MUST have:

{
  "question": "...",
  "intention": "...",
  "answer": "..."
}

CRITICAL REQUIREMENT:

EVERY QUESTION MUST HAVE ITS OWN UNIQUE INTENTION.

EVERY QUESTION MUST HAVE ITS OWN UNIQUE ANSWER.

DO NOT COPY OR REUSE answers.

DO NOT copy the same intention into multiple questions.

The answer MUST DIRECTLY ANSWER THE EXACT QUESTION.

Do NOT provide generic instructions such as:

"Explain the concept clearly."

Do NOT provide generic answers such as:

"Give a practical example."

Instead, write the actual answer the candidate could give during
an interview.

For example:

Question:

"How would you handle missing values in a Pandas DataFrame?"

The answer should actually explain:

- How to identify missing values
- isnull() / isna()
- dropna()
- fillna()
- mean/median/mode imputation
- when each approach is appropriate

Do NOT answer that question with:

"Explain the concept clearly and give a practical example."

Another example:

Question:

"What is the difference between WHERE and HAVING in SQL?"

The answer MUST specifically explain WHERE and HAVING,
including when each is used.

It must NOT reuse the answer from the Pandas question.

Every answer should normally be several sentences and should
demonstrate actual understanding.

=========================================================
BEHAVIORAL QUESTIONS
=========================================================

Generate 5 behavioral interview questions.

Questions should be relevant to:

- Candidate experience
- Candidate projects
- Self description
- Job requirements
- Teamwork
- Problem solving
- Communication
- Challenges
- Leadership where relevant

Each object MUST contain:

{
  "question": "...",
  "intention": "...",
  "answer": "..."
}

EVERY behavioral question MUST HAVE A UNIQUE intention.

EVERY behavioral question MUST HAVE A UNIQUE answer.

The answer should be an ACTUAL SAMPLE ANSWER that the candidate
could adapt.

Do NOT simply say:

"Use the STAR method."

Instead, provide a sample answer.

Do NOT invent experiences that are not present in the candidate's
resume or self description.

=========================================================
SKILL GAPS
=========================================================

Compare the candidate's resume and skills against the job description.

Identify actual areas where the candidate appears to have:

- Missing skills
- Weak skills
- Insufficiently demonstrated skills
- Skills required by the job but not clearly present

Each skill gap MUST be:

{
  "skill": "actual skill name",
  "severity": "low"
}

severity MUST be exactly:

"low"
"medium"
"high"

Examples of valid skill names:

"Advanced SQL"
"Python"
"Pandas"
"Data Visualization"
"Power BI"
"Statistics"
"REST API Development"
"System Design"
"Cloud Deployment"

NEVER use:

"skill"

"skills"

"severity"

"high"

"medium"

"low"

as the skill name.

The skill field MUST contain an ACTUAL TECHNICAL OR PROFESSIONAL
SKILL.

Severity meaning:

LOW:
Candidate mostly understands the skill but could improve.

MEDIUM:
Candidate has some exposure but needs more preparation.

HIGH:
The skill is important for the target role and the candidate
has a significant gap.

=========================================================
PREPARATION PLAN
=========================================================

Generate a multi-day interview preparation plan.

Every day must be unique.

Each object MUST be:

{
  "day": 1,
  "focus": "...",
  "tasks": [
    "...",
    "...",
    "..."
  ]
}

The day field MUST contain ONLY a NUMBER.

Correct:

"day": 1

Incorrect:

"day": "Day 1"

Generate multiple days.

The plan should focus more time on the candidate's actual skill gaps.

=========================================================
TITLE
=========================================================

"title" MUST contain the actual job title.

For example:

"title": "Software Development Intern"

=========================================================
MATCH SCORE
=========================================================

matchScore MUST be a NUMBER between 0 and 100.

It should represent how closely the candidate's resume matches
the job description.

=========================================================
FINAL CHECK BEFORE RETURNING
=========================================================

Before returning JSON, verify:

1. Every technical question is different.
2. Every technical intention is question-specific.
3. Every technical answer is question-specific.
4. No technical answer is copied from another question.
5. Every behavioral answer is question-specific.
6. Skill gaps contain actual skill names.
7. Skill gap severity is only low, medium, or high.
8. Preparation days are numbers.
9. Preparation days are unique.
10. Return ONLY JSON.
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

      parsedResponse =
        JSON.parse(
          response.text
        );

    } catch (jsonError) {

      console.error(
        "Gemini JSON parse error:",
        jsonError
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
      JSON.parse(
        response.text
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

  } 



// =========================================================
// EXPORTS
// =========================================================

module.exports = {

  generateInterviewReport,

  generateResumePdf,

};