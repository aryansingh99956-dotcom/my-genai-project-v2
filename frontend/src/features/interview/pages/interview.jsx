import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

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
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
};


const cleanText = (value) => {
  if (!isNonEmptyString(value)) {
    return "";
  }

  return value.trim();
};


// ============================================================
// PLACEHOLDER DETECTOR
// ============================================================

const isPlaceholder = (value) => {
  if (!isNonEmptyString(value)) {
    return true;
  }

  const text = value
    .trim()
    .toLowerCase();

  const placeholders = [
    "question",
    "questions",
    "answer",
    "answers",
    "intention",
    "intent",
    "technicalquestions",
    "technical questions",
    "technicalquestion",
    "behavioralquestions",
    "behavioral questions",
    "behavioralquestion",
    "undefined",
    "null",
    "n/a",
    "na",
  ];

  return placeholders.includes(text);
};


// ============================================================
// QUESTION NORMALIZER
// ============================================================
// Backend should already return:
//
// {
//   question: "...",
//   intention: "...",
//   answer: "..."
// }
//
// This function intentionally DOES NOT merge separate
// question/intention/answer objects.
// ============================================================

const normalizeQuestions = (input) => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter(
      (item) =>
        item &&
        typeof item === "object"
    )
    .map((item) => {

      const question = cleanText(
        item.question ??
        item.Question ??
        ""
      );

      const intention = cleanText(
        item.intention ??
        item.Intention ??
        ""
      );

      const answer = cleanText(
        item.answer ??
        item.Answer ??
        item.modelAnswer ??
        item.ModelAnswer ??
        ""
      );

      return {
        question,
        intention,
        answer,
      };
    })
    .filter((item) => {

      return (
        isNonEmptyString(item.question) &&
        !isPlaceholder(item.question) &&
        isNonEmptyString(item.intention) &&
        !isPlaceholder(item.intention) &&
        isNonEmptyString(item.answer) &&
        !isPlaceholder(item.answer)
      );
    });
};


// ============================================================
// SKILL GAP NORMALIZER
// ============================================================

const normalizeSkillGaps = (
  skillGaps
) => {

  if (!Array.isArray(skillGaps)) {
    return [];
  }

  return skillGaps
    .filter(
      (gap) =>
        gap &&
        typeof gap === "object"
    )
    .map((gap) => {

      const skill =
        cleanText(
          gap.skill ??
          gap.Skill ??
          gap.name ??
          gap.Name ??
          ""
        );

      const severity =
        cleanText(
          gap.severity ??
          gap.Severity ??
          ""
        ).toLowerCase();

      if (!skill) {
        return null;
      }

      if (
        ![
          "low",
          "medium",
          "high",
        ].includes(severity)
      ) {
        return null;
      }

      // Never show invalid field names
      const invalidSkills = [
        "skill",
        "skills",
        "severity",
        "high",
        "medium",
        "low",
        "skill:",
        "severity:",
      ];

      if (
        invalidSkills.includes(
          skill.toLowerCase()
        )
      ) {
        return null;
      }

      return {
        skill,
        severity,
      };
    })
    .filter(Boolean);
};


// ============================================================
// ROADMAP NORMALIZER
// ============================================================

const normalizeRoadmap = (
  plan
) => {

  if (!Array.isArray(plan)) {
    return [];
  }

  return plan
    .filter(
      (day) =>
        day &&
        typeof day === "object"
    )
    .map((day, index) => {

      let dayNumber =
        Number(day.day);

      if (
        !Number.isInteger(dayNumber) ||
        dayNumber < 1
      ) {
        dayNumber = index + 1;
      }

      const focus =
        cleanText(
          day.focus ??
          day.topic ??
          day.title ??
          day.subject ??
          "Interview Preparation"
        );

      let tasks =
        day.tasks ??
        day.activities ??
        day.activity ??
        [];

      if (!Array.isArray(tasks)) {
        tasks = [];
      }

      const cleanTasks =
        tasks
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
              return cleanText(
                task.task ??
                task.title ??
                task.activity ??
                task.description ??
                ""
              );
            }

            return "";
          })
          .filter(Boolean);

      return {
        day: dayNumber,
        focus:
          focus ||
          "Interview Preparation",
        tasks: cleanTasks,
      };
    })
    .filter(
      (day) =>
        day.focus &&
        day.tasks.length > 0
    );
};


// ============================================================
// SCORE NORMALIZER
// ============================================================

const normalizeScore = (
  value
) => {

  const score =
    Number(value);

  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(score)
    )
  );
};


// ============================================================
// MAIN COMPONENT
// ============================================================

const Interview = () => {

  const {
    interviewId,
  } = useParams();


  // ==========================================================
  // STATE
  // ==========================================================

  const [
    report,
    setReport,
  ] = useState(null);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState("");


  const [
    activeSection,
    setActiveSection,
  ] = useState("technical");


  const [
    isDownloading,
    setIsDownloading,
  ] = useState(false);


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


        const response =
          await getInterviewReport(
            interviewId
          );


        console.log(
          "INTERVIEW REPORT RESPONSE:",
          response
        );


        if (!mounted) {
          return;
        }


        // ==================================================
        // HANDLE BACKEND WRAPPERS
        // ==================================================

        const actualReport =
          response?.interviewReport ??
          response?.report ??
          response?.data ??
          response;


        if (
          !actualReport ||
          typeof actualReport !== "object"
        ) {

          throw new Error(
            "Invalid interview report received."
          );
        }


        setReport(
          actualReport
        );

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
  // TECHNICAL QUESTIONS
  // ==========================================================

  const technicalQuestions =
    useMemo(() => {

      return normalizeQuestions(
        report?.technicalQuestions
      ).slice(0, 5);

    }, [report]);


  // ==========================================================
  // BEHAVIORAL QUESTIONS
  // ==========================================================

  const behavioralQuestions =
    useMemo(() => {

      return normalizeQuestions(
        report?.behavioralQuestions
      ).slice(0, 5);

    }, [report]);


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
  // ROAD MAP
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
    normalizeScore(
      report?.matchScore
    );


  // ==========================================================
  // TITLE
  // ==========================================================

  const title =
    cleanText(
      report?.title
    ) ||
    "Interview Preparation";


  // ==========================================================
  // DOWNLOAD RESUME
  // ==========================================================

  const handleResumeDownload =
    async () => {

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

        setIsDownloading(
          true
        );


        console.log(
          "STARTING RESUME PDF:",
          interviewId
        );


        const response =
          await generateResumePdf(
            interviewId
          );


        console.log(
          "RESUME PDF RESPONSE:",
          response
        );


        // ==================================================
        // AXIOS RESPONSE
        // ==================================================

        let blob = null;


        if (
          response?.data instanceof Blob
        ) {

          blob =
            response.data;

        }

        // ==================================================
        // DIRECT BLOB
        // ==================================================

        else if (
          response instanceof Blob
        ) {

          blob =
            response;

        }

        // ==================================================
        // ARRAY BUFFER
        // ==================================================

        else if (
          response?.data instanceof ArrayBuffer
        ) {

          blob =
            new Blob(
              [
                response.data,
              ],
              {
                type:
                  "application/pdf",
              }
            );

        }

        else if (
          response instanceof ArrayBuffer
        ) {

          blob =
            new Blob(
              [
                response,
              ],
              {
                type:
                  "application/pdf",
              }
            );

        }


        // ==================================================
        // DOWNLOAD
        // ==================================================

        if (
          !blob ||
          blob.size === 0
        ) {

          throw new Error(
            "PDF file was empty."
          );
        }


        const url =
          window.URL.createObjectURL(
            blob
          );


        // Try opening PDF
        const newWindow =
          window.open(
            "",
            "_blank"
          );


        if (newWindow) {

          newWindow.location.href =
            url;

        }

        else {

          // Browser blocked popup
          const link =
            document.createElement(
              "a"
            );

          link.href = url;

          link.download =
            `interview-resume-${interviewId}.pdf`;

          document.body.appendChild(
            link
          );

          link.click();

          document.body.removeChild(
            link
          );

        }


        setTimeout(() => {

          window.URL.revokeObjectURL(
            url
          );

        }, 60000);


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

        setIsDownloading(
          false
        );

      }

    };


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

          Interview report not found.

        </div>

      </div>

    );

  }


  // ==========================================================
  // QUESTION CARD
  // ==========================================================

  const QuestionCard = ({
    item,
    index,
  }) => {

    return (

      <div
        className="question-card"
        key={`question-${index}`}
      >

        {/* ===================================================
            QUESTION
        ==================================================== */}

        <div className="question-header">

          <span className="question-number">

            Q{index + 1}

          </span>

          <h3>

            {item.question}

          </h3>

        </div>


        {/* ===================================================
            INTERVIEWER INTENTION
        ==================================================== */}

        <div className="question-block intention-block">

          <div className="question-label">

            INTERVIEWER INTENTION

          </div>

          <p>

            {item.intention}

          </p>

        </div>


        {/* ===================================================
            ANSWER
        ==================================================== */}

        <div className="question-block answer-block">

          <div className="question-label">

            MODEL ANSWER

          </div>

          <p>

            {item.answer}

          </p>

        </div>

      </div>

    );

  };


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="interview-page">


      {/* ====================================================
          HEADER
      ===================================================== */}

      <header className="interview-header">

        <div>

          <h1>
            {title}
          </h1>

          <p>
            Personalized Interview Preparation
          </p>

        </div>


        <button
          className="download-resume-btn"
          onClick={
            handleResumeDownload
          }
          disabled={
            isDownloading
          }
        >

          {isDownloading
            ? "Generating Resume..."
            : "Download Resume"}

        </button>

      </header>


      {/* ====================================================
          MAIN LAYOUT
      ===================================================== */}

      <div className="interview-layout">


        {/* ==================================================
            LEFT SIDEBAR
        =================================================== */}

        <aside className="interview-sidebar">


          <button
            className={
              activeSection === "technical"
                ? "sidebar-btn active"
                : "sidebar-btn"
            }
            onClick={() =>
              setActiveSection(
                "technical"
              )
            }
          >

            Technical Questions

            

          </button>


          <button
            className={
              activeSection === "behavioral"
                ? "sidebar-btn active"
                : "sidebar-btn"
            }
            onClick={() =>
              setActiveSection(
                "behavioral"
              )
            }
          >

            Behavioral Questions

            

          </button>


          <button
            className={
              activeSection === "roadmap"
                ? "sidebar-btn active"
                : "sidebar-btn"
            }
            onClick={() =>
              setActiveSection(
                "roadmap"
              )
            }
          >

            Road Map

          </button>


          <button
            className={
              activeSection === "skills"
                ? "sidebar-btn active"
                : "sidebar-btn"
            }
            onClick={() =>
              setActiveSection(
                "skills"
              )
            }
          >

            Skill Gaps

            

          </button>


        </aside>


        {/* ==================================================
            CENTER CONTENT
        =================================================== */}

        <main className="interview-content">


          {/* ============================================================
    TECHNICAL QUESTIONS
============================================================ */}

{activeSection === "technical" && (
  <section>

    <div className="section-heading">
      <div>
        <h2>Technical Questions</h2>
        <span>
          {technicalQuestions.length} questions
        </span>
      </div>
    </div>

    {technicalQuestions.length === 0 ? (

      <div className="empty-state">
        No technical questions available.
      </div>

    ) : (

      <div className="questions-list">

        {technicalQuestions.map((item, index) => (

          <QuestionCard
            key={`technical-${index}`}
            item={item}
            index={index}
          />

        ))}

      </div>

    )}

  </section>
)}


{/* ============================================================
    BEHAVIORAL QUESTIONS
============================================================ */}

{activeSection === "behavioral" && (
  <section>

    <div className="section-heading">
      <div>
        <h2>Behavioral Questions</h2>
        <span>
          {behavioralQuestions.length} questions
        </span>
      </div>
    </div>

    {behavioralQuestions.length === 0 ? (

      <div className="empty-state">
        No behavioral questions available.
      </div>

    ) : (

      <div className="questions-list">

        {behavioralQuestions.map((item, index) => (

          <QuestionCard
            key={`behavioral-${index}`}
            item={item}
            index={index}
          />

        ))}

      </div>

    )}

  </section>
)}


{/* ============================================================
    ROAD MAP
============================================================ */}

{activeSection === "roadmap" && (
  <section className="roadmap-section">

    <div className="section-heading">
      <div>
        <h2>Preparation Road Map</h2>
        <span>
          {preparationPlan.length} days
        </span>
      </div>
    </div>


    {preparationPlan.length === 0 ? (

      <div className="empty-state">
        No preparation roadmap available.
      </div>

    ) : (

      <div className="roadmap-list">

        {preparationPlan.map((day) => (

          <div
            className="roadmap-day"
            key={`roadmap-day-${day.day}`}
          >

            <div className="roadmap-day-number">
              Day {day.day}
            </div>


            <div className="roadmap-day-content">

              <h3>
                {day.focus}
              </h3>


              <ul>

                {day.tasks.map((task, index) => (

                  <li
                    key={`task-${day.day}-${index}`}
                  >
                    {task}
                  </li>

                ))}

              </ul>

            </div>

          </div>

        ))}

      </div>

    )}

  </section>
)}


{/* ============================================================
    SKILL GAPS
============================================================ */}

{activeSection === "skills" && (
  <section className="skills-section">

    <div className="section-heading">
      <div>
        <h2>Skill Gaps</h2>
        <span>
          {skillGaps.length} areas
        </span>
      </div>
    </div>


    {skillGaps.length === 0 ? (

      <div className="empty-state">
        No major skill gaps found.
      </div>

    ) : (

      <div className="skill-gaps-list">

        {skillGaps.map((gap, index) => (

          <div
            className={`skill-gap-card ${gap.severity}`}
            key={`skill-gap-${index}`}
          >

            <div className="skill-gap-info">

              <h3>
                {gap.skill}
              </h3>

            </div>


            <div
              className={`severity-badge ${gap.severity}`}
            >
              {gap.severity.toUpperCase()}
            </div>

          </div>

        ))}

      </div>

    )}

  </section>
)}

</main>


{/* ============================================================
    RIGHT SIDEBAR
============================================================ */}

<aside className="interview-right-sidebar">


  {/* ==========================================================
      MATCH SCORE
  =========================================================== */}

  <div className="match-score-card">

    <h3>
      MATCH SCORE
    </h3>


    <div className="score-circle">

      <span>
        {matchScore}
      </span>

      <small>
        %
      </small>

    </div>


    <p>
      {matchScore >= 80
        ? "Strong match for this role"
        : matchScore >= 60
        ? "Moderate match for this role"
        : "Needs improvement for this role"}
    </p>

  </div>


  {/* ==========================================================
      SKILL GAPS
  =========================================================== */}

  <div className="right-skill-gaps">

    <h3>
      SKILL GAPS
    </h3>


    {skillGaps.length === 0 ? (

      <p className="no-skill-gaps">
        No major skill gaps found.
      </p>

    ) : (

      skillGaps.map((gap, index) => (

        <div
          className={`right-skill-gap ${gap.severity}`}
          key={`right-gap-${index}`}
        >

          <div className="right-gap-skill">
            {gap.skill}
          </div>

          <div className="right-gap-severity">
            {gap.severity}
          </div>

        </div>

      ))

    )}

  </div>

</aside>

</div>


{/* ============================================================
    END INTERVIEW LAYOUT
============================================================ */}

</div>

);

};

export default Interview;