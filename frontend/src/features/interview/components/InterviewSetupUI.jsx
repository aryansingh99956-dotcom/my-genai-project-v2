import React from "react";
import "../style/interview-setup-ui.scss";

/**
 * InterviewSetupUI - Pure UI Component (UI Layer)
 * 
 * This is a presentational component that renders the interview setup form.
 * It receives all state via props and communicates changes through callback functions.
 * 
 * Props:
 *   - jobDescription: string - The job description text
 *   - onJobDescriptionChange: (value: string) => void - Handler for job description change
 *   - selfDescription: string - The self description text
 *   - onSelfDescriptionChange: (value: string) => void - Handler for self description change
 *   - resume: File | null - The selected resume file
 *   - onResumeChange: (file: File | null) => void - Handler for resume file change
 *   - onGenerate: () => void - Handler for generate button click
 *   - isLoading: boolean - Loading state
 *   - errors: { [key: string]: string } - Error messages for each field
 */
const InterviewSetupUI = ({
  jobDescription = "",
  onJobDescriptionChange = () => {},
  selfDescription = "",
  onSelfDescriptionChange = () => {},
  resume = null,
  onResumeChange = () => {},
  onGenerate = () => {},
  isLoading = false,
  errors = {},
}) => {
  const handleResumeInputChange = (e) => {
    const file = e.target.files?.[0] || null;
    onResumeChange(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove("drag-over");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
    const file = e.dataTransfer.files?.[0] || null;
    onResumeChange(file);
  };

  return (
    <div className="interview-setup-ui">
      {/* Hero Section */}
      <div className="hero-section">
        <h1 className="hero-title">
          Create Your Custom <span>Interview Plan</span>
        </h1>
        <p className="hero-subtitle">
          Let our AI analyze the job requirements and your unique profile to build a
          winning strategy.
        </p>
      </div>

      {/* Main Layout */}
      <div className="interview-layout">
        {/* Left Panel - Job Description */}
        <div className="panel left-panel">
          <div className="panel-header">
            <div className="title-wrap">
              <span className="panel-icon">📄</span>
              <span>Target Job Description</span>
            </div>
            <span className="required-badge">Required</span>
          </div>

          <textarea
            className="job-textarea"
            placeholder="Paste the full job description here...
e.g. 'Senior Frontend Engineer at Google requires proficiency in React, TypeScript, and large-scale system design...'"
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            maxLength={5000}
            disabled={isLoading}
          />

          <div className="char-counter">
            {jobDescription.length} / 5000 chars
          </div>

          {errors.jobDescription && (
            <div className="error-message">{errors.jobDescription}</div>
          )}
        </div>

        {/* Right Panel - Profile & Resume */}
        <div className="panel right-panel">
          <div className="panel-header">
            <div className="title-wrap">
              <span className="panel-icon">👤</span>
              <span>Your Profile</span>
            </div>
          </div>

          {/* Upload Resume Section */}
          <div className="upload-section">
            <div className="upload-label">
              Upload Resume
              <small> (Best Results)</small>
            </div>

            <label
              className="upload-box"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleResumeInputChange}
                disabled={isLoading}
                hidden
              />

              <div className="upload-inner">
                <div className="upload-icon">☁</div>
                <p>
                  <span>Click to upload or drag & drop</span>
                  <span>PDF or DOCX (Max 5MB)</span>
                </p>
              </div>

              {resume && (
                <div className="file-selected">
                  ✓ Selected: <strong>{resume.name}</strong>
                </div>
              )}
            </label>

            {errors.resume && (
              <div className="error-message">{errors.resume}</div>
            )}
          </div>

          {/* Divider */}
          <div className="section-divider">OR</div>

          {/* Self Description Section */}
          <div className="self-description-section">
            <label className="section-label">Quick Self-Description</label>

            <textarea
              className="self-description-textarea"
              placeholder="Briefly describe your experience, key skills, and years of experience if you don't have a resume handy..."
              value={selfDescription}
              onChange={(e) => onSelfDescriptionChange(e.target.value)}
              maxLength={2000}
              disabled={isLoading}
            />

            <div className="char-counter">
              {selfDescription.length} / 2000 chars
            </div>

            {errors.selfDescription && (
              <div className="error-message">{errors.selfDescription}</div>
            )}
          </div>

          {/* Info Banner */}
          <div className="info-banner">
            <div className="dot" />
            <p>Either a Resume or a Self Description is required to generate a personalized plan.</p>
          </div>
        </div>
      </div>

      {/* Generate Bar */}
      <div className="generate-bar">
        <div className="ai-note">
          ✨ AI-Powered Strategy Generation • Approx 30s
        </div>

        <button
          className="generate-btn"
          onClick={onGenerate}
          disabled={isLoading}
        >
          {isLoading ? "Generating..." : "✨ Generate My Interview Strategy"}
        </button>
      </div>
    </div>
  );
};

export default InterviewSetupUI;
