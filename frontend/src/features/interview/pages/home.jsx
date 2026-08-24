import React, { useState } from "react";
import { generateInterview } from "../services/interview.api";
import "./home.scss";

const Home = () => {
  const [jobDescription, setJobDescription] = useState("");
  const [profile, setProfile] = useState("");
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleResumeChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a PDF or DOC/DOCX file.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Resume size must be less than 5MB.");
      e.target.value = "";
      return;
    }

    setError("");
    setResume(file);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();

    setError("");

    if (!jobDescription.trim()) {
      setError("Please enter the target job description.");
      return;
    }

    if (!resume && !profile.trim()) {
      setError("Please upload a resume or enter your profile.");
      return;
    }

    try {
      setLoading(true);

      console.log("Starting interview generation...");

      const response = await generateInterview({
        jobDescription: jobDescription.trim(),
        profile: profile.trim(),
        resume,
      });

      console.log("Generation successful:", response);

      const interviewId =
        response?.interviewReport?._id ||
        response?.data?.interviewReport?._id ||
        response?.report?._id ||
        response?.data?.report?._id ||
        response?._id ||
        response?.data?._id;

      if (!interviewId) {
        console.error("Interview ID missing:", response);

        setError(
          "Interview was generated, but the interview ID was not returned by the server."
        );

        return;
      }

      console.log("Interview ID:", interviewId);

      window.location.href = `/interview/${interviewId}`;
    } catch (err) {
      console.error("Interview generation error:", err);

      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Something went wrong while generating the interview.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-page">

      {/* HEADER */}
      <header className="home-header">

        <div className="header-icon">
          ✦
        </div>

        <h1>
          Create Your Custom <span>Interview Plan</span>
        </h1>

        <p>
          Let our AI analyze the job requirements and your unique profile
          to build a winning strategy.
        </p>

      </header>


      {/* MAIN */}
      <main className="home-main">

        <form
          className="interview-form"
          onSubmit={handleGenerate}
        >

          <div className="form-columns">

            {/* LEFT — JOB DESCRIPTION */}
            <section className="form-section job-section">

              <div className="section-heading">

                <div>
                  <h2>
                    <span className="heading-icon">▣</span>
                    Target Job Description
                  </h2>

                  <span className="required-badge">
                    REQUIRED
                  </span>
                </div>

              </div>

              <textarea
                className="job-description-input"
                value={jobDescription}
                onChange={(e) => {
                  setJobDescription(e.target.value);
                  setError("");
                }}
                placeholder="Paste the target job description here..."
                maxLength={5000}
              />

              <div className="character-count">
                {jobDescription.length} / 5000 chars
              </div>

            </section>


            {/* RIGHT — PROFILE */}
            <section className="form-section profile-section">

              <div className="section-heading">

                <div>
                  <h2>
                    <span className="heading-icon">♟</span>
                    Your Profile
                  </h2>
                </div>

              </div>


              {/* RESUME */}
              <div className="upload-heading">

                <span>
                  Upload Resume
                </span>

                <span className="best-results-badge">
                  BEST RESULTS
                </span>

              </div>


              <label
                className={`resume-upload ${
                  resume ? "resume-selected" : ""
                }`}
              >

                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleResumeChange}
                  hidden
                />

                <div className="upload-icon">
                  ↑
                </div>

                {resume ? (
                  <>
                    <div className="uploaded-file-name">
                      {resume.name}
                    </div>

                    <div className="upload-subtext">
                      PDF or DOCX • Max 5MB
                    </div>
                  </>
                ) : (
                  <>
                    <div className="upload-main-text">
                      Click to upload or drag & drop
                    </div>

                    <div className="upload-subtext">
                      PDF or DOCX • Max 5MB
                    </div>
                  </>
                )}

              </label>


              {/* OR */}
              <div className="or-divider">
                <span>OR</span>
              </div>


              {/* SELF DESCRIPTION */}
              <div className="self-description-wrapper">

                <div className="self-description-label">
                  Quick Self-Description
                </div>

                <textarea
                  className="profile-input"
                  value={profile}
                  onChange={(e) => {
                    setProfile(e.target.value);
                    setError("");
                  }}
                  placeholder="Tell us briefly about yourself, your skills, experience and career goals..."
                  maxLength={2000}
                />

                <div className="character-count">
                  {profile.length} / 2000 chars
                </div>

              </div>


              {/* INFO */}
              <div className="info-message">
                <span>•</span>

                <span>
                  Either a Resume or a Self Description is required
                  to generate a personalized plan.
                </span>
              </div>

            </section>

          </div>


          {/* ERROR */}
          {error && (
            <div className="generation-error">
              <span className="error-icon">
                !
              </span>

              <span>
                {error}
              </span>
            </div>
          )}


          {/* FOOTER / GENERATE */}
          <div className="generation-footer">

            <div className="generation-info">

              <span className="sparkle">
                ✦
              </span>

              <span>
                AI-Powered Strategy Generation
              </span>

              <span className="separator">
                •
              </span>

              <span>
                Approx. 30s
              </span>

            </div>


            <button
              type="submit"
              className="generate-button"
              disabled={loading}
            >

              {loading ? (
                <>
                  <span className="button-spinner"></span>
                  Generating...
                </>
              ) : (
                <>
                  ✦ Generate My Interview Strategy
                </>
              )}

            </button>

          </div>

        </form>

      </main>


      {/* FOOTER */}
      <footer className="home-footer">

        <div className="footer-links">

          <span>
            Privacy Policy
          </span>

          <span>
            Terms of Service
          </span>

          <span>
            Help Center
          </span>

        </div>

      </footer>

    </div>
  );
};

export default Home;