import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import {
  getInterviewReport,
  generateResumePdf,
} from "../services/interview.api";

import "../style/interview.scss";


// ============================================================
// HELPERS
// ============================================================

const isNonEmptyString = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};


const cleanText = (value) => {
  if (!isNonEmptyString(value)) {
    return "";
  }

  return value.trim();
};


// ============================================================
// PLACEHOLDER FILTER
// ============================================================
// Gemini/backend kabhi-kabhi actual data ke jagah:
//
// "question"
// "answer"
// "intention"
// "technicalQuestions"
// "behavioralQuestions"
//
// return kar deta hai.
//
// Inko actual interview question nahi maana jayega.
// ============================================================

const isPlaceholderQuestion = (value) => {

  if (!isNonEmptyString(value)) {
    return true;
  }

  const text = value.trim().toLowerCase();

  const placeholders = [
    "question",
    "questions",
    "answer",
    "answers",
    "intention",
    "intent",
    "technicalquestions",
    "technical question",
    "behavioralquestions",
    "behavioral questions",
    "behavioralquestion",
    "technicalquestion",
    "undefined",
    "null",
    "n/a",
    "na",
  ];

  return placeholders.includes(text);
};


// ============================================================
// GET FIELD
// ============================================================

const getQuestionField = (item, names) => {

  if (!item || typeof item !== "object") {
    return "";
  }

  for (const name of names) {

    if (isNonEmptyString(item[name])) {
      return item[name].trim();
    }

  }

  return "";
};


// ============================================================
// NORMALIZE QUESTIONS
// ============================================================
//
// Supported formats:
//
// 1.
// {
//   question: "...",
//   intention: "...",
//   answer: "..."
// }
//
// 2.
// [
//   { question: "..." },
//   { intention: "..." },
//   { answer: "..." },
//   { question: "..." },
//   { intention: "..." },
//   { answer: "..." }
// ]
//
// 3.
// [
//   {
//      Question: "...",
//      Intention: "...",
//      Answer: "..."
//   }
// ]
//
// 4. Nested arrays/objects
//
// ============================================================

const normalizeQuestions = (input) => {

  if (!input) {
    return [];
  }


  // ----------------------------------------------------------
  // Convert possible object wrappers into array
  // ----------------------------------------------------------

  let questions = input;


  if (!Array.isArray(questions)) {

    if (Array.isArray(questions?.questions)) {
      questions = questions.questions;
    }

    else if (Array.isArray(questions?.items)) {
      questions = questions.items;
    }

    else if (Array.isArray(questions?.data)) {
      questions = questions.data;
    }

    else if (
      questions &&
      typeof questions === "object"
    ) {
      questions = [questions];
    }

    else {
      return [];
    }

  }


  // ----------------------------------------------------------
  // Flatten nested arrays
  // ----------------------------------------------------------

  const flattened = [];

  const flatten = (value) => {

    if (Array.isArray(value)) {

      value.forEach((item) => {
        flatten(item);
      });

      return;
    }

    flattened.push(value);
  };


  flatten(questions);


  // ----------------------------------------------------------
  // Result
  // ----------------------------------------------------------

  const result = [];

  let currentQuestion = null;


  // ----------------------------------------------------------
  // PROCESS EVERY ITEM
  // ----------------------------------------------------------

  flattened.forEach((item) => {

    if (!item || typeof item !== "object") {
      return;
    }


    const question = getQuestionField(
      item,
      [
        "question",
        "Question",
        "prompt",
        "Prompt",
        "text",
        "Text",
      ]
    );


    const intention = getQuestionField(
      item,
      [
        "intention",
        "Intention",
        "intent",
        "Intent",
        "purpose",
        "Purpose",
      ]
    );


    const answer = getQuestionField(
      item,
      [
        "answer",
        "Answer",
        "modelAnswer",
        "ModelAnswer",
        "model_answer",
        "response",
        "Response",
      ]
    );


    // ========================================================
    // NEW REAL QUESTION
    // ========================================================

    if (
      question &&
      !isPlaceholderQuestion(question)
    ) {

      // Save previous question
      if (currentQuestion) {
        result.push(currentQuestion);
      }


      currentQuestion = {
        question: question,
        intention: "",
        answer: "",
      };


      // If intention is already present
      if (intention) {
        currentQuestion.intention = intention;
      }


      // If answer is already present
      if (answer) {
        currentQuestion.answer = answer;
      }


      return;
    }


    // ========================================================
    // INTENTION
    // ========================================================

    if (
      intention &&
      !isPlaceholderQuestion(intention) &&
      currentQuestion
    ) {

      if (!currentQuestion.intention) {
        currentQuestion.intention = intention;
      }

      return;
    }


    // ========================================================
    // ANSWER
    // ========================================================

    if (
      answer &&
      !isPlaceholderQuestion(answer) &&
      currentQuestion
    ) {

      if (!currentQuestion.answer) {
        currentQuestion.answer = answer;
      }

      return;
    }

  });


  // ----------------------------------------------------------
  // SAVE LAST QUESTION
  // ----------------------------------------------------------

  if (currentQuestion) {
    result.push(currentQuestion);
  }


  // ----------------------------------------------------------
  // FINAL CLEANUP
  // ----------------------------------------------------------

  return result
    .filter((item) => {

      return (
        item &&
        isNonEmptyString(item.question) &&
        !isPlaceholderQuestion(item.question)
      );

    })
    .map((item) => {

      return {
        question: cleanText(item.question),
        intention: cleanText(item.intention),
        answer: cleanText(item.answer),
      };

    });

};


// ============================================================
// NORMALIZE SKILL GAPS
// ============================================================

const normalizeSkillGaps = (skillGaps) => {

  if (!skillGaps) {
    return [];
  }


  let gaps = skillGaps;


  // Handle wrapper objects
  if (!Array.isArray(gaps)) {

    if (Array.isArray(gaps?.skillGaps)) {
      gaps = gaps.skillGaps;
    }

    else if (Array.isArray(gaps?.skills)) {
      gaps = gaps.skills;
    }

    else if (Array.isArray(gaps?.data)) {
      gaps = gaps.data;
    }

    else if (gaps && typeof gaps === "object") {
      gaps = [gaps];
    }

    else {
      return [];
    }

  }


  return gaps
    .map((gap) => {

      // String format
      if (typeof gap === "string") {

        const skill = gap.trim();

        if (!skill) {
          return null;
        }

        return {
          skill,
          severity: "medium",
        };

      }


      // Object format
      if (!gap || typeof gap !== "object") {
        return null;
      }


      const skill =
        gap.skill ??
        gap.name ??
        gap.title ??
        gap.Skill ??
        gap.Name ??
        gap.Title ??
        "";


      const severity =
        gap.severity ??
        gap.Severity ??
        "medium";


      const cleanSkill = String(skill).trim();


      if (!cleanSkill) {
        return null;
      }


      return {
        skill: cleanSkill,
        severity: String(severity)
          .trim()
          .toLowerCase(),
      };

    })
    .filter(Boolean);

};


// ============================================================
// NORMALIZE ROADMAP
// ============================================================

const normalizeRoadmap = (plan) => {

  if (!plan) {
    return [];
  }


  let roadmap = plan;


  // ----------------------------------------------------------
  // Handle different backend wrappers
  // ----------------------------------------------------------

  if (!Array.isArray(roadmap)) {

    if (Array.isArray(roadmap?.preparationPlan)) {
      roadmap = roadmap.preparationPlan;
    }

    else if (Array.isArray(roadmap?.roadmap)) {
      roadmap = roadmap.roadmap;
    }

    else if (Array.isArray(roadmap?.roadMap)) {
      roadmap = roadmap.roadMap;
    }

    else if (Array.isArray(roadmap?.days)) {
      roadmap = roadmap.days;
    }

    else if (Array.isArray(roadmap?.data)) {
      roadmap = roadmap.data;
    }

    else if (roadmap && typeof roadmap === "object") {
      roadmap = [roadmap];
    }

    else {
      return [];
    }

  }


  const result = [];


  roadmap.forEach((day, index) => {

    if (!day) {
      return;
    }


    // --------------------------------------------------------
    // If day is a string
    // --------------------------------------------------------

    if (typeof day === "string") {

      const text = day.trim();

      if (!text) {
        return;
      }


      result.push({
        day: index + 1,
        focus: text,
        tasks: [],
      });

      return;
    }


    if (typeof day !== "object") {
      return;
    }


    // --------------------------------------------------------
    // Day number
    // --------------------------------------------------------

    const dayNumber =
      day.day ??
      day.dayNumber ??
      day.Day ??
      day.number ??
      index + 1;


    // --------------------------------------------------------
    // Focus
    // --------------------------------------------------------

    const focus =
      day.focus ??
      day.topic ??
      day.title ??
      day.subject ??
      day.Focus ??
      day.Topic ??
      day.Title ??
      "Preparation";


    // --------------------------------------------------------
    // Tasks
    // --------------------------------------------------------

    let tasks =
      day.tasks ??
      day.activities ??
      day.activity ??
      day.todo ??
      day.todos ??
      day.Tasks ??
      day.Activities ??
      [];


    if (!Array.isArray(tasks)) {

      if (typeof tasks === "string") {
        tasks = [tasks];
      }

      else {
        tasks = [];
      }

    }


    const cleanTasks = tasks
      .map((task) => {

        if (
          typeof task === "string"
        ) {
          return task.trim();
        }


        if (
          task &&
          typeof task === "object"
        ) {

          return (
            task.task ??
            task.title ??
            task.activity ??
            task.description ??
            ""
          )
            .toString()
            .trim();

        }


        return "";

      })
      .filter(Boolean);


    result.push({

      day: dayNumber,

      focus:
        String(focus || "Preparation").trim(),

      tasks: cleanTasks,

    });

  });


  return result;

};


// ============================================================
// INTERVIEW
// ============================================================

const Interview = () => {

  const { interviewId } = useParams();


  const [report, setReport] =
    useState(null);


  const [loading, setLoading] =
    useState(true);


  const [error, setError] =
    useState("");


  const [activeSection, setActiveSection] =
    useState("technical");


  const [isDownloading, setIsDownloading] =
    useState(false);


  // ==========================================================
  // FETCH REPORT
  // ==========================================================

  useEffect(() => {

    let mounted = true;


    const fetchReport = async () => {

      if (!interviewId) {

        if (mounted) {

          setError(
            "Interview ID is missing."
          );

          setLoading(false);

        }

        return;
      }


      try {

        setLoading(true);

        setError("");


        console.log(
          "FETCHING INTERVIEW REPORT:",
          interviewId
        );


        const data =
          await getInterviewReport(
            interviewId
          );


        console.log(
          "INTERVIEW REPORT RECEIVED:",
          data
        );


        if (!mounted) {
          return;
        }


        const actualReport =
          data?.interviewReport ||
          data?.report ||
          data?.data ||
          data;


        setReport(actualReport);

      }

      catch (err) {

        console.error(
          "INTERVIEW REPORT FETCH ERROR:",
          err
        );


        if (!mounted) {
          return;
        }


        setError(
          err?.response?.data?.message ||
          err?.message ||
          "Unable to load interview report."
        );

      }

      finally {

        if (mounted) {
          setLoading(false);
        }

      }

    };


    fetchReport();


    return () => {
      mounted = false;
    };

  }, [interviewId]);


  // ==========================================================
  // DOWNLOAD RESUME
  // ==========================================================

  const getResumePdf = async () => {

    if (isDownloading) {
      return;
    }


    if (!interviewId) {

      alert(
        "Interview ID is missing."
      );

      return;
    }


    try {

      setIsDownloading(true);


      console.log(
        "STARTING RESUME DOWNLOAD:",
        interviewId
      );


      const response =
        await generateResumePdf(
          interviewId
        );


      console.log(
        "RESUME DOWNLOAD RESPONSE:",
        response
      );


      // ======================================================
      // IMPORTANT
      // ======================================================
      // generateResumePdf agar blob/arrayBuffer return karta
      // hai to yahan browser download handle hoga.
      // Agar API function already download trigger karta hai,
      // to ye block simply skip ho jayega.
      // ======================================================

      if (response) {

        let blob = null;


        // Axios response with blob
        if (
          response?.data instanceof Blob
        ) {

          blob = response.data;

        }


        // Direct Blob
        else if (
          response instanceof Blob
        ) {

          blob = response;

        }


        // ArrayBuffer
        else if (
          response instanceof ArrayBuffer
        ) {

          blob = new Blob(
            [response],
            {
              type: "application/pdf",
            }
          );

        }


        // Axios response data as ArrayBuffer
        else if (
          response?.data instanceof ArrayBuffer
        ) {

          blob = new Blob(
            [response.data],
            {
              type: "application/pdf",
            }
          );

        }


        // ----------------------------------------------------
        // Create browser download
        // ----------------------------------------------------

       if (blob && blob.size > 0) {
  const url = window.URL.createObjectURL(blob);

  // Try opening the PDF first.
  // This works more reliably on mobile browsers.
  const pdfWindow = window.open("", "_blank");

  if (pdfWindow) {
    pdfWindow.location.href = url;

    // Give the browser time to load the PDF
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 60000);
  } else {
    // Fallback for browsers that block new tabs
    const link = document.createElement("a");

    link.href = url;
    link.download = `interview-resume-${interviewId}.pdf`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Don't revoke immediately
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 60000);
  }


        }

      }


      console.log(
        "RESUME DOWNLOAD COMPLETED"
      );

    }

    catch (err) {

      console.error(
        "RESUME DOWNLOAD ERROR:",
        err
      );


      alert(
        err?.response?.data?.message ||
        err?.message ||
        "Unable to download resume."
      );

    }

    finally {

      // VERY IMPORTANT
      // Button kabhi permanently
      // "Downloading..." mein nahi rahega.

      setIsDownloading(false);

    }

  };


  // ==========================================================
  // NORMALIZED QUESTIONS
  // ==========================================================

  const allTechnicalQuestions =
    useMemo(() => {

      return normalizeQuestions(
        report?.technicalQuestions
      );

    }, [report]);


  const allBehavioralQuestions =
    useMemo(() => {

      return normalizeQuestions(
        report?.behavioralQuestions
      );

    }, [report]);


  // ==========================================================
  // EXACT QUESTION LIMIT
  // ==========================================================
  // User requested:
  //
  // Technical = 5
  // Behavioral = 4
  //
  // ==========================================================

  const technicalQuestions =
    useMemo(() => {

      return allTechnicalQuestions
        .filter(
          (item) =>
            isNonEmptyString(
              item.question
            )
        )
        .slice(0, 5);

    }, [allTechnicalQuestions]);


  const behavioralQuestions =
    useMemo(() => {

      return allBehavioralQuestions
        .filter(
          (item) =>
            isNonEmptyString(
              item.question
            )
        )
        .slice(0, 4);

    }, [allBehavioralQuestions]);


  // ==========================================================
  // SKILL GAPS
  // ==========================================================

  const skillGaps =
    useMemo(() => {

      return normalizeSkillGaps(
        report?.skillGaps
      );

    }, [report]);


  // ==========================================================
  // ROADMAP
  // ==========================================================

  const preparationPlan =
    useMemo(() => {

      return normalizeRoadmap(
        report?.preparationPlan
      );

    }, [report]);


  // ==========================================================
  // MATCH SCORE
  // ==========================================================

  const matchScore =
    Number(
      report?.matchScore
    ) || 0;


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (

      <div className="interview-page loading-page">

        <div className="loading-text">

          Generating your interview strategy...

        </div>

      </div>

    );

  }


  // ==========================================================
  // ERROR
  // ==========================================================

  if (error) {

    return (

      <div className="interview-page loading-page">

        <div className="loading-text">

          {error}

        </div>

      </div>

    );

  }


  // ==========================================================
  // NO REPORT
  // ==========================================================

  if (!report) {

    return (

      <div className="interview-page loading-page">

        <div className="loading-text">

          No interview report found.

        </div>

      </div>

    );

  }


  // ============================================================
// MAIN UI
// ============================================================

return (
  <div className="interview-page">

    {/* ========================================================
        HEADER
    ======================================================== */}

    <header className="interview-header">

      <h1>
        Interview Strategy
      </h1>

      <p>
        Your personalized AI-powered interview preparation plan.
      </p>

    </header>


    {/* ========================================================
        MAIN CONTAINER
    ======================================================== */}

    <div className="interview-container">


      {/* ======================================================
          LEFT SIDEBAR
      ====================================================== */}

      <aside className="interview-sidebar">

        <div className="sidebar-title">
          SECTIONS
        </div>


        {/* TECHNICAL QUESTIONS */}

        <button
          type="button"
          className={`sidebar-item ${
            activeSection === "technical"
              ? "active"
              : ""
          }`}
          onClick={() => {
            setActiveSection("technical");
          }}
        >

          <span className="sidebar-icon">
            &lt;/&gt;
          </span>

          <span className="sidebar-label">
            Technical Questions
          </span>

        </button>


        {/* BEHAVIORAL QUESTIONS */}

        <button
          type="button"
          className={`sidebar-item ${
            activeSection === "behavioral"
              ? "active"
              : ""
          }`}
          onClick={() => {
            setActiveSection("behavioral");
          }}
        >

          <span className="sidebar-icon">
            ▢
          </span>

          <span className="sidebar-label">
            Behavioral Questions
          </span>

        </button>


        {/* ROADMAP */}

        <button
          type="button"
          className={`sidebar-item ${
            activeSection === "roadmap"
              ? "active"
              : ""
          }`}
          onClick={() => {
            setActiveSection("roadmap");
          }}
        >

          <span className="sidebar-icon">
            ➤
          </span>

          <span className="sidebar-label">
            Road Map
          </span>

        </button>


        {/* DOWNLOAD RESUME */}

        <button
          type="button"
          className="download-resume-btn"
          onClick={getResumePdf}
          disabled={isDownloading}
          aria-busy={isDownloading}
        >

          <span className="download-icon">

            {isDownloading
              ? "↻"
              : "↓"}

          </span>

          <span>

            {isDownloading
              ? "Downloading..."
              : "Download Resume"}

          </span>

        </button>

      </aside>


      {/* ======================================================
          CENTER CONTENT
      ====================================================== */}

      <main className="interview-content">


        {/* ====================================================
            TECHNICAL QUESTIONS
        ==================================================== */}

        {activeSection === "technical" && (

          <section>

            <div className="section-heading">

              <div className="section-heading-inner">

                <h2>
                  Technical Questions
                </h2>

                <span className="question-count">

                  {technicalQuestions.length}

                  {" "}

                  questions

                </span>

              </div>

            </div>


            <div className="questions-list">

              {technicalQuestions.length > 0 ? (

                technicalQuestions.map(
                  (item, index) => (

                    <QuestionCard
                      key={`technical-${index}`}
                      index={index}
                      question={item.question}
                      intention={item.intention}
                      answer={item.answer}
                    />

                  )
                )

              ) : (

                <div className="empty-state">
                  No technical questions available.
                </div>

              )}

            </div>

          </section>

        )}


        {/* ====================================================
            BEHAVIORAL QUESTIONS
        ==================================================== */}

        {activeSection === "behavioral" && (

          <section>

            <div className="section-heading">

              <div className="section-heading-inner">

                <h2>
                  Behavioral Questions
                </h2>

                <span className="question-count">

                  {behavioralQuestions.length}

                  {" "}

                  questions

                </span>

              </div>

            </div>


            <div className="questions-list">

              {behavioralQuestions.length > 0 ? (

                behavioralQuestions.map(
                  (item, index) => (

                    <QuestionCard
                      key={`behavioral-${index}`}
                      index={index}
                      question={item.question}
                      intention={item.intention}
                      answer={item.answer}
                    />

                  )
                )

              ) : (

                <div className="empty-state">
                  No behavioral questions available.
                </div>

              )}

            </div>

          </section>

        )}


        {/* ====================================================
            ROADMAP
        ==================================================== */}

        {activeSection === "roadmap" && (

          <section>

            <div className="section-heading">

              <div className="section-heading-inner">

                <h2>
                  Preparation Roadmap
                </h2>

                <span className="question-count">

                  {preparationPlan.length}

                  {" "}

                  days

                </span>

              </div>

            </div>


            <div className="roadmap-list">

              {preparationPlan.length > 0 ? (

                preparationPlan.map(
                  (day, index) => (

                    <div
                      className="roadmap-card"
                      key={`roadmap-${index}`}
                    >

                      <div className="roadmap-day">

                        DAY{" "}

                        {day.day || index + 1}

                      </div>


                      <div className="roadmap-content">

                        <h3>
                          {day.focus || "Preparation"}
                        </h3>


                        {day.tasks &&
                          day.tasks.length > 0 && (

                            <ul>

                              {day.tasks.map(
                                (
                                  task,
                                  taskIndex
                                ) => (

                                  <li
                                    key={`task-${index}-${taskIndex}`}
                                  >
                                    {task}
                                  </li>

                                )
                              )}

                            </ul>

                          )}

                      </div>

                    </div>

                  )
                )

              ) : (

                <div className="empty-state">
                  No preparation roadmap available.
                </div>

              )}

            </div>

          </section>

        )}

      </main>


      {/* ======================================================
          RIGHT SIDEBAR
      ====================================================== */}

      <aside className="interview-right">


        {/* ====================================================
            MATCH SCORE
        ==================================================== */}

        <div className="match-score-section">

          <h3>
            MATCH SCORE
          </h3>


          <div className="score-circle">

            <span className="score-number">
              {matchScore}
            </span>

            <span className="score-percent">
              %
            </span>

          </div>


          <div
            className={`score-message ${
              matchScore >= 70
                ? "strong"
                : matchScore >= 40
                ? "medium"
                : "weak"
            }`}
          >

            {matchScore >= 70
              ? "Strong match for this role"
              : matchScore >= 40
              ? "Moderate match for this role"
              : "Needs improvement"}

          </div>

        </div>


        {/* ====================================================
            DIVIDER
        ==================================================== */}

        <div className="right-divider" />


        {/* ====================================================
            SKILL GAPS
        ==================================================== */}

        <div className="skill-gap-section">

          <h3>
            SKILL GAPS
          </h3>


          <div className="skill-gap-list">

            {skillGaps.length > 0 ? (

              skillGaps.map(
                (gap, index) => (

                  <div
                    key={`skill-gap-${index}`}
                    className={`skill-gap ${
                      gap.severity || "medium"
                    }`}
                  >

                    <div className="skill-gap-name">
                      {gap.skill}
                    </div>


                    <div className="skill-gap-severity">
                      {gap.severity}
                    </div>

                  </div>

                )
              )

            ) : (

              <div className="no-gaps">
                No major skill gaps found.
              </div>

            )}

          </div>

        </div>

      </aside>

    </div>

  </div>
);


// ============================================================
// QUESTION CARD
// ============================================================

function QuestionCard ({
  index,
  question,
  intention,
  answer,
}) {

  const [open, setOpen] = useState(false);


  return (

    <article
      className={`question-card ${
        open ? "open" : ""
      }`}
    >

      {/* ======================================================
          QUESTION HEADER
      ====================================================== */}

      <button
        type="button"
        className="question-header"
        onClick={() => {
          setOpen(
            (previous) => !previous
          );
        }}
      >

        <span className="question-number">

          Q
          {String(index + 1).padStart(2, "0")}

        </span>


        <span className="question-text">
          {question}
        </span>


        <span className="question-arrow">

          {open
            ? "⌃"
            : "⌄"}

        </span>

      </button>


      {/* ======================================================
          QUESTION DETAILS
      ====================================================== */}

      {open && (

        <div className="question-details">


          {/* ==================================================
              INTERVIEWER INTENTION
          ================================================== */}

          {intention && (

            <div className="answer-block intention-block">

              <div className="answer-label">
                INTERVIEWER INTENTION
              </div>

              <p>
                {intention}
              </p>

            </div>

          )}


          {/* ==================================================
              MODEL ANSWER
          ================================================== */}

          {answer && (

            <div className="answer-block model-block">

              <div className="answer-label">
                MODEL ANSWER
              </div>

              <p>
                {answer}
              </p>

            </div>

          )}


          {/* ==================================================
              NO DETAILS
          ================================================== */}

          {!intention && !answer && (

            <div className="empty-state">
              No additional information available.
            </div>

          )}

        </div>

      )}

    </article>

  );

};


// ============================================================
// EXPORT
// ============================================================
}
export default Interview;