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
// RESUME PDF SCHEMA
// =========================================================

const resumePdfSchema = z.object({

  html: z
    .string()
    .describe(
      "Complete HTML content of the resume which can be converted into a PDF using Puppeteer."
    ),

});


// =========================================================
// BASIC STRING CLEANER
// =========================================================

function toStringSafe(
  value,
  fallback = ""
) {

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
// PARSE JSON STRING SAFELY
// =========================================================

function tryParseJSON(value) {

  if (
    typeof value !== "string"
  ) {
    return null;
  }

  let text = value.trim();

  // Remove markdown fences if Gemini adds them
  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {

    return JSON.parse(text);

  } catch {

    return null;
  }
}


// =========================================================
// EXTRACT OBJECT FROM A STRING
// =========================================================

function extractJSONObject(value) {

  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const text = value.trim();

  const firstBrace =
    text.indexOf("{");

  const lastBrace =
    text.lastIndexOf("}");

  if (
    firstBrace === -1 ||
    lastBrace === -1 ||
    lastBrace <= firstBrace
  ) {
    return null;
  }

  const jsonText =
    text.substring(
      firstBrace,
      lastBrace + 1
    );

  return tryParseJSON(jsonText);
}


// =========================================================
// CLEAN TEXT
// =========================================================

function cleanText(value) {

  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  let text =
    String(value).trim();

  // Remove markdown code fences
  text =
    text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

  return text;
}


// =========================================================
// EXTRACT QUESTION
// =========================================================

function extractQuestion(value) {

  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  // -----------------------------------------------
  // If already object
  // -----------------------------------------------

  if (
    typeof value === "object"
  ) {

    return cleanText(
      value.question
    );
  }

  let text =
    cleanText(value);


  // -----------------------------------------------
  // Try complete JSON
  // -----------------------------------------------

  let parsed =
    tryParseJSON(text);

  if (
    parsed &&
    typeof parsed === "object"
  ) {

    return cleanText(
      parsed.question
    );
  }


  // -----------------------------------------------
  // Try JSON inside string
  // -----------------------------------------------

  parsed =
    extractJSONObject(text);

  if (
    parsed &&
    typeof parsed === "object" &&
    parsed.question
  ) {

    return cleanText(
      parsed.question
    );
  }


  // -----------------------------------------------
  // Remove accidental prefix
  // -----------------------------------------------

  text =
    text.replace(
      /^\s*["']?question["']?\s*:\s*/i,
      ""
    );


  return text.trim();
}


// =========================================================
// EXTRACT INTENTION
// =========================================================

function extractIntention(value) {

  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }


  // -----------------------------------------------
  // Object
  // -----------------------------------------------

  if (
    typeof value === "object"
  ) {

    return cleanText(
      value.intention
    );
  }


  let text =
    cleanText(value);


  // -----------------------------------------------
  // JSON
  // -----------------------------------------------

  let parsed =
    tryParseJSON(text);

  if (
    parsed &&
    typeof parsed === "object"
  ) {

    return cleanText(
      parsed.intention
    );
  }


  // -----------------------------------------------
  // JSON inside text
  // -----------------------------------------------

  parsed =
    extractJSONObject(text);

  if (
    parsed &&
    typeof parsed === "object" &&
    parsed.intention
  ) {

    return cleanText(
      parsed.intention
    );
  }


  // -----------------------------------------------
  // Remove accidental prefixes
  // -----------------------------------------------

  text =
    text.replace(
      /^\s*["']?intention["']?\s*:\s*/i,
      ""
    );

  text =
    text.replace(
      /^\s*interviewer\s*intention\s*:\s*/i,
      ""
    );


  return text.trim();
}


// =========================================================
// EXTRACT ANSWER
// =========================================================

function extractAnswer(value) {

  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }


  // -----------------------------------------------
  // Object
  // -----------------------------------------------

  if (
    typeof value === "object"
  ) {

    return cleanText(
      value.answer
    );
  }


  let text =
    cleanText(value);


  // -----------------------------------------------
  // JSON
  // -----------------------------------------------

  let parsed =
    tryParseJSON(text);

  if (
    parsed &&
    typeof parsed === "object"
  ) {

    return cleanText(
      parsed.answer
    );
  }


  // -----------------------------------------------
  // JSON inside text
  // -----------------------------------------------

  parsed =
    extractJSONObject(text);

  if (
    parsed &&
    typeof parsed === "object" &&
    parsed.answer
  ) {

    return cleanText(
      parsed.answer
    );
  }


  // -----------------------------------------------
  // Remove accidental prefixes
  // -----------------------------------------------

  text =
    text.replace(
      /^\s*["']?answer["']?\s*:\s*/i,
      ""
    );

  text =
    text.replace(
      /^\s*model\s*answer\s*:\s*/i,
      ""
    );


  return text.trim();
}


// =========================================================
// EXTRACT SKILL
// =========================================================

function extractSkill(value) {

  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }


  // -----------------------------------------------
  // Object
  // -----------------------------------------------

  if (
    typeof value === "object"
  ) {

    return cleanSkillName(
      value.skill
    );
  }


  let text =
    cleanText(value);


  // -----------------------------------------------
  // Try JSON
  // -----------------------------------------------

  let parsed =
    tryParseJSON(text);

  if (
    parsed &&
    typeof parsed === "object"
  ) {

    return cleanSkillName(
      parsed.skill
    );
  }


  // -----------------------------------------------
  // JSON inside text
  // -----------------------------------------------

  parsed =
    extractJSONObject(text);

  if (
    parsed &&
    typeof parsed === "object" &&
    parsed.skill
  ) {

    return cleanSkillName(
      parsed.skill
    );
  }


  // -----------------------------------------------
  // Remove skill prefix
  // -----------------------------------------------

  text =
    text.replace(
      /^\s*["']?skill["']?\s*:\s*/i,
      ""
    );


  return cleanSkillName(
    text
  );
}


// =========================================================
// CLEAN SKILL NAME
// =========================================================

function cleanSkillName(value) {

  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  let skill =
    String(value).trim();


  // -------------------------------------------------
  // If skill itself contains JSON
  // -------------------------------------------------

  let parsed =
    tryParseJSON(skill);

  if (
    parsed &&
    typeof parsed === "object"
  ) {

    skill =
      parsed.skill || "";
  }


  // -------------------------------------------------
  // Remove JSON-like wrappers
  // -------------------------------------------------

  skill =
    skill
      .replace(
        /^\s*["']?skill["']?\s*:\s*/i,
        ""
      )
      .replace(
        /^\s*["']+/,
        ""
      )
      .replace(
        /["']+\s*$/,
        ""
      )
      .trim();


  // -------------------------------------------------
  // Remove accidental severity
  // -------------------------------------------------

  skill =
    skill.replace(
      /,\s*["']?severity["']?\s*:\s*["']?(low|medium|high)["']?/i,
      ""
    );


  // -------------------------------------------------
  // Remove braces if any remain
  // -------------------------------------------------

  skill =
    skill
      .replace(/^\s*\{\s*/, "")
      .replace(/\s*\}\s*$/, "")
      .trim();


  // -------------------------------------------------
  // Never allow these as skill names
  // -------------------------------------------------

  const invalidSkills = [
    "skill",
    "skills",
    "severity",
    "high",
    "medium",
    "low",
    "{",
    "}",
    "{ skill",
    "skill:",
  ];


  if (
    invalidSkills.includes(
      skill.toLowerCase()
    )
  ) {
    return "";
  }


  return skill;
}


// =========================================================
// NORMALIZE SEVERITY
// =========================================================

function normalizeSeverity(
  value
) {

  let severity =
    String(
      value || "medium"
    )
      .toLowerCase()
      .trim();


  // Only these 3 values are allowed
  if (
    severity !== "low" &&
    severity !== "medium" &&
    severity !== "high"
  ) {
    severity = "medium";
  }


  return severity;
}


// =========================================================
// NORMALIZE QUESTIONS
// =========================================================

function normalizeQuestions(
  questions,
  type = "technical"
) {

  if (
    !Array.isArray(questions)
  ) {
    return [];
  }


  return questions
    .map(
      (item, index) => {

        // =================================================
        // STRING ITEM
        // =================================================

        if (
          typeof item === "string"
        ) {

          let parsed =
            tryParseJSON(item);

          if (!parsed) {
            parsed =
              extractJSONObject(item);
          }


          // -----------------------------------------------
          // Gemini accidentally returned complete object
          // inside a string
          // -----------------------------------------------

          if (
            parsed &&
            typeof parsed === "object"
          ) {

            let question =
              extractQuestion(
                parsed.question
              );

            let intention =
              extractIntention(
                parsed.intention
              );

            let answer =
              extractAnswer(
                parsed.answer
              );


            return {

              question:
                question ||
                `Interview question ${index + 1}`,

              intention:
                intention ||
                (
                  type === "technical"
                    ? "Evaluate the candidate's technical understanding of this topic."
                    : "Evaluate the candidate's communication, problem-solving and behavioral approach."
                ),

              answer:
                answer ||
                (
                  type === "technical"
                    ? "The candidate should explain the concept accurately and support the explanation with a relevant example."
                    : "The candidate should provide a specific example from their experience and explain their actions and results."
                ),

            };
          }


          // -----------------------------------------------
          // Plain string
          // -----------------------------------------------

          return {

            question:
              extractQuestion(item) ||
              `Interview question ${index + 1}`,

            intention:
              type === "technical"
                ? "Evaluate the candidate's technical understanding of this topic."
                : "Evaluate the candidate's communication, problem-solving and behavioral approach.",

            answer:
              type === "technical"
                ? "The candidate should explain the concept accurately and support the explanation with a relevant example."
                : "The candidate should provide a specific example from their experience and explain their actions and results.",

          };
        }


        // =================================================
        // OBJECT ITEM
        // =================================================

        let itemObject =
          item;


        // Sometimes nested object is inside a field
        if (
          typeof itemObject === "string"
        ) {

          itemObject =
            tryParseJSON(
              itemObject
            );
        }


        let question =
          extractQuestion(
            itemObject?.question
          );


        let intention =
          extractIntention(
            itemObject?.intention
          );


        let answer =
          extractAnswer(
            itemObject?.answer
          );


        // =================================================
        // IMPORTANT:
        // If question accidentally contains the whole object,
        // extract ONLY question.
        // =================================================

        const questionParsed =
          extractJSONObject(
            question
          );

        if (
          questionParsed &&
          typeof questionParsed === "object"
        ) {

          question =
            extractQuestion(
              questionParsed.question
            );

          if (
            !intention &&
            questionParsed.intention
          ) {
            intention =
              extractIntention(
                questionParsed.intention
              );
          }

          if (
            !answer &&
            questionParsed.answer
          ) {
            answer =
              extractAnswer(
                questionParsed.answer
              );
          }
        }


        // =================================================
        // IMPORTANT:
        // If intention accidentally contains whole object
        // =================================================

        const intentionParsed =
          extractJSONObject(
            intention
          );

        if (
          intentionParsed &&
          typeof intentionParsed === "object"
        ) {

          intention =
            extractIntention(
              intentionParsed.intention
            );

          if (
            !question &&
            intentionParsed.question
          ) {
            question =
              extractQuestion(
                intentionParsed.question
              );
          }

          if (
            !answer &&
            intentionParsed.answer
          ) {
            answer =
              extractAnswer(
                intentionParsed.answer
              );
          }
        }


        // =================================================
        // IMPORTANT:
        // If answer accidentally contains whole object
        // =================================================

        const answerParsed =
          extractJSONObject(
            answer
          );

        if (
          answerParsed &&
          typeof answerParsed === "object"
        ) {

          answer =
            extractAnswer(
              answerParsed.answer
            );

          if (
            !question &&
            answerParsed.question
          ) {
            question =
              extractQuestion(
                answerParsed.question
              );
          }

          if (
            !intention &&
            answerParsed.intention
          ) {
            intention =
              extractIntention(
                answerParsed.intention
              );
          }
        }


        // =================================================
        // FALLBACKS
        // =================================================

        if (!question) {

          question =
            `Interview question ${index + 1}`;
        }


        if (!intention) {

          intention =
            type === "technical"
              ? "Evaluate the candidate's technical understanding of this topic."
              : "Evaluate the candidate's communication, problem-solving and behavioral approach.";
        }


        if (!answer) {

          answer =
            type === "technical"
              ? "The candidate should explain the concept accurately and support the explanation with a relevant example."
              : "The candidate should provide a specific example from their experience and explain their actions and results.";
        }


        return {

          question:
            question.trim(),

          intention:
            intention.trim(),

          answer:
            answer.trim(),

        };

      }
    );
}


// =========================================================
// NORMALIZE SKILL GAPS
// =========================================================

function normalizeSkillGaps(
  skillGaps
) {

  if (
    !Array.isArray(skillGaps)
  ) {
    return [];
  }


  return skillGaps
    .map(
      (item) => {

        let skill = "";
        let severity = "medium";


        // =================================================
        // STRING
        // =================================================

        if (
          typeof item === "string"
        ) {

          let parsed =
            tryParseJSON(item);

          if (!parsed) {
            parsed =
              extractJSONObject(item);
          }


          if (
            parsed &&
            typeof parsed === "object"
          ) {

            skill =
              extractSkill(
                parsed.skill
              );

            severity =
              normalizeSeverity(
                parsed.severity
              );

          } else {

            skill =
              extractSkill(item);

            severity =
              "medium";
          }

        }


        // =================================================
        // OBJECT
        // =================================================

        else if (
          item &&
          typeof item === "object"
        ) {

          skill =
            extractSkill(
              item.skill
            );


          severity =
            normalizeSeverity(
              item.severity
            );


          // -----------------------------------------------
          // If skill field contains complete JSON
          // -----------------------------------------------

          const parsedSkill =
            tryParseJSON(
              item.skill
            );

          if (
            parsedSkill &&
            typeof parsedSkill === "object"
          ) {

            skill =
              extractSkill(
                parsedSkill.skill
              );

            severity =
              normalizeSeverity(
                parsedSkill.severity ||
                item.severity
              );
          }
        }


        // =================================================
        // FINAL CLEAN
        // =================================================

        skill =
          cleanSkillName(skill);

        severity =
          normalizeSeverity(severity);


        // =================================================
        // INVALID SKILL
        // =================================================

        if (!skill) {
          return null;
        }


        return {

          skill,

          // ONLY:
          // low / medium / high
          severity,

        };

      }
    )
    .filter(Boolean);
}


// =========================================================
// NORMALIZE PREPARATION PLAN
// =========================================================

function normalizePreparationPlan(
  plan
) {

  if (
    !Array.isArray(plan)
  ) {
    return [];
  }


  const usedDays =
    new Set();


  return plan
    .map(
      (item, index) => {

        let day;
        let focus;
        let tasks;


        // =================================================
        // STRING
        // =================================================

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


        // =================================================
        // OBJECT
        // =================================================

        else {

          day =
            Number(item?.day);


          if (
            !Number.isInteger(day) ||
            day < 1
          ) {

            day =
              index + 1;
          }


          focus =
            toStringSafe(
              item?.focus,
              `Interview Preparation - Day ${day}`
            );


          tasks =
            Array.isArray(
              item?.tasks
            )

              ? item.tasks
                  .map(
                    (task) =>
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


        // =================================================
        // UNIQUE DAYS
        // =================================================

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

      }
    );
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
    String(jobDescription)
      .trim();


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
      .map(
        (line) =>
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
// NORMALIZE COMPLETE INTERVIEW REPORT
// =========================================================

function normalizeInterviewReport(
  data,
  jobDescription
) {

  // =====================================================
  // MATCH SCORE
  // =====================================================

  let matchScore =
    Number(
      data?.matchScore
    );


  if (
    !Number.isFinite(matchScore)
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


  // =====================================================
  // NORMALIZED REPORT
  // =====================================================

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
        getJobTitle(
          jobDescription
        )
      ),

  };


  // =====================================================
  // TITLE FALLBACK
  // =====================================================

  if (
    !normalizedReport.title
  ) {

    normalizedReport.title =
      getJobTitle(
        jobDescription
      );
  }


  // =====================================================
  // FINAL ZOD VALIDATION
  // =====================================================

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

Generate a highly personalized interview preparation report based ONLY
on the candidate information and job description.

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
ABSOLUTE JSON REQUIREMENTS
=========================================================

Return ONLY valid JSON.

Do not return Markdown.

Do not return explanations.

Do not put JSON objects inside strings.

Every field must contain its actual value.

=========================================================
EXACT STRUCTURE
=========================================================

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

Generate EXACTLY 5 technical questions.

Each item MUST be:

{
  "question": "ONLY THE QUESTION",
  "intention": "ONLY THE INTERVIEWER INTENTION",
  "answer": "ONLY THE ACTUAL ANSWER"
}

CRITICAL:

The "question" field must contain ONLY the question.

DO NOT write:

"question: ..."

DO NOT write:

{
  "question": "...",
  "intention": "...",
  "answer": "..."
}

inside the question string.

The "intention" field must contain ONLY why the interviewer asks
that question.

The "answer" field must contain ONLY the actual answer to that
question.

Do NOT put the question inside the answer.

Do NOT put the intention inside the answer.

Do NOT put JSON inside the answer.

Every answer must directly answer its own question.

Every question must have a unique intention.

Every question must have a unique answer.

=========================================================
BEHAVIORAL QUESTIONS
=========================================================

Generate EXACTLY 5 behavioral questions.

Each item MUST be:

{
  "question": "ONLY THE QUESTION",
  "intention": "ONLY THE INTERVIEWER INTENTION",
  "answer": "ONLY THE ACTUAL SAMPLE ANSWER"
}

Again:

question = ONLY question

intention = ONLY intention

answer = ONLY answer

Do NOT mix these fields.

Do NOT return JSON inside any field.

Do NOT invent experiences that are not supported by the
candidate resume or self description.

=========================================================
SKILL GAPS
=========================================================

Compare the candidate's skills with the job description.

Return actual missing or weak skills.

Each item MUST be EXACTLY:

{
  "skill": "Actual Skill Name",
  "severity": "high"
}

The skill field MUST contain ONLY the skill name.

Examples:

"Advanced SQL"

"Python"

"Pandas"

"Power BI"

"Data Visualization"

"Statistics"

"REST API Development"

"System Design"

"Cloud Deployment"

NEVER return these as skill names:

"skill"

"skills"

"severity"

"high"

"medium"

"low"

IMPORTANT:

severity MUST contain ONLY ONE of these exact values:

"low"

"medium"

"high"

Nothing else.

Do NOT write:

"severity: high"

Do NOT write:

"high severity"

Do NOT write:

{
  "severity": "high"
}

inside the severity string.

Correct:

{
  "skill": "Power BI",
  "severity": "high"
}

=========================================================
PREPARATION PLAN
=========================================================

Generate a multi-day preparation plan.

Each day must be unique.

Each item MUST be:

{
  "day": 1,
  "focus": "Main topic",
  "tasks": [
    "Task 1",
    "Task 2",
    "Task 3"
  ]
}

day MUST be a NUMBER.

Correct:

"day": 1

Incorrect:

"day": "Day 1"

=========================================================
TITLE
=========================================================

"title" MUST contain the actual job title from the job description.

=========================================================
MATCH SCORE
=========================================================

matchScore MUST be a NUMBER from 0 to 100.

=========================================================
FINAL VALIDATION
=========================================================

Before returning the JSON verify:

1. Exactly 5 technical questions.
2. Exactly 5 behavioral questions.
3. Question contains ONLY question.
4. Intention contains ONLY intention.
5. Answer contains ONLY answer.
6. No question is inside answer.
7. No intention is inside answer.
8. No JSON is inside a string.
9. Every technical answer is different and question-specific.
10. Every behavioral answer is question-specific.
11. Skill contains ONLY an actual skill name.
12. Severity contains ONLY "low", "medium", or "high".
13. No "skill:" text.
14. No "severity:" text.
15. Preparation day is a number.
16. Preparation days are unique.
17. Return ONLY valid JSON.
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
    // LOG FINAL CLEAN REPORT
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
2. HTML must be suitable for A4 PDF.
3. Use inline CSS or a style tag.
4. Make the resume professional and readable.
5. Do not use Markdown.
6. Do not add explanations outside HTML.
7. Return the HTML inside JSON field "html".
8. Do not invent important personal information.
9. Return only JSON matching the provided schema.
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