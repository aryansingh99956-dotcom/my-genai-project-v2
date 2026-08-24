import { useState, useCallback } from "react";

/**
 * useInterviewSetup - Hook Layer
 * 
 * This custom hook manages the state and validation logic for the interview setup form.
 * It separates business logic from the UI component.
 * 
 * Returns: {
 *   - state: { jobDescription, selfDescription, resume, isLoading }
 *   - handlers: { onJobDescriptionChange, onSelfDescriptionChange, onResumeChange, onGenerate }
 *   - errors: { jobDescription, selfDescription, resume }
 * }
 */

const MAX_JOB_DESCRIPTION_LENGTH = 5000;
const MAX_SELF_DESCRIPTION_LENGTH = 2000;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const useInterviewSetup = (onSubmit = null) => {
  // State
  const [jobDescription, setJobDescription] = useState("");
  const [selfDescription, setSelfDescription] = useState("");
  const [resume, setResume] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  /**
   * Validate form before submission
   */
  const validateForm = useCallback(() => {
    const newErrors = {};

    // Job description validation
    if (!jobDescription.trim()) {
      newErrors.jobDescription = "Job description is required";
    }

    // Resume or self-description validation
    if (!resume && !selfDescription.trim()) {
      newErrors.resume =
        "Please upload a resume or provide a self-description";
      newErrors.selfDescription =
        "Please upload a resume or provide a self-description";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [jobDescription, resume, selfDescription]);

  /**
   * Validate and set job description
   */
  const handleJobDescriptionChange = useCallback((value) => {
    if (value.length <= MAX_JOB_DESCRIPTION_LENGTH) {
      setJobDescription(value);
      // Clear error when user starts typing
      if (errors.jobDescription) {
        setErrors((prev) => {
          const updated = { ...prev };
          delete updated.jobDescription;
          return updated;
        });
      }
    }
  }, [errors.jobDescription]);

  /**
   * Validate and set self description
   */
  const handleSelfDescriptionChange = useCallback((value) => {
    if (value.length <= MAX_SELF_DESCRIPTION_LENGTH) {
      setSelfDescription(value);
      // Clear error when user starts typing
      if (errors.selfDescription) {
        setErrors((prev) => {
          const updated = { ...prev };
          delete updated.selfDescription;
          return updated;
        });
      }
    }
  }, [errors.selfDescription]);

  /**
   * Validate and set resume file
   */
  const handleResumeChange = useCallback((file) => {
    if (!file) {
      setResume(null);
      return;
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        resume: "Please upload a PDF or DOCX file.",
      }));
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({
        ...prev,
        resume: "File size must be less than 5MB.",
      }));
      return;
    }

    setResume(file);
    // Clear error when file is selected
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated.resume;
      return updated;
    });
  }, []);

  /**
   * Handle form submission
   */
  const handleGenerate = useCallback(async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Call the external API callback if provided
      if (onSubmit) {
        await onSubmit({
          jobDescription,
          selfDescription,
          resume,
        });
      }
    } catch (error) {
      console.error("Error generating interview strategy:", error);
      setErrors((prev) => ({
        ...prev,
        submit: error.message || "Something went wrong. Please try again.",
      }));
    } finally {
      setIsLoading(false);
    }
  }, [jobDescription, selfDescription, resume, validateForm, onSubmit]);

  return {
    // State
    state: {
      jobDescription,
      selfDescription,
      resume,
      isLoading,
    },
    // Handlers
    handlers: {
      onJobDescriptionChange: handleJobDescriptionChange,
      onSelfDescriptionChange: handleSelfDescriptionChange,
      onResumeChange: handleResumeChange,
      onGenerate: handleGenerate,
    },
    // Errors
    errors,
    // Reset function
    reset: () => {
      setJobDescription("");
      setSelfDescription("");
      setResume(null);
      setErrors({});
    },
  };
};
