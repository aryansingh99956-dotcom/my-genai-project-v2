import React from "react";
import { useNavigate } from "react-router-dom";
import InterviewSetupUI from "../components/InterviewSetupUI";
import { useInterviewSetup } from "../hooks/useInterviewSetup";
// import { submitInterviewSetup } from "../services/interview.api";

/**
 * Example: How to use the 4-Layer Architecture
 * 
 * This file demonstrates how to compose the layers together.
 * 
 * Current status: UI Layer ✓ | Hook Layer ✓ | State Layer (next) | API Layer (next)
 * 
 * LAYERS:
 * 1. UI Layer (InterviewSetupUI.jsx) - Pure presentational component
 *    - No state, no side effects
 *    - Only receives props and calls handlers
 * 
 * 2. Hook Layer (useInterviewSetup.js) - Business logic & state management
 *    - Manages form state
 *    - Validates input
 *    - Handles errors
 * 
 * 3. State Layer (Context/Redux) - Global state (if needed)
 *    - Can be added later for cross-component communication
 *    - Not needed for this single form
 * 
 * 4. API Layer (interview.api.js) - External API communication
 *    - Handles HTTP requests
 *    - Data transformation
 *    - Error handling
 */

const InterviewSetupContainer = () => {
  const navigate = useNavigate();

  // Use the custom hook to get state, handlers, and errors
  const { state, handlers, errors, reset } = useInterviewSetup(
    async (formData) => {
      // This is where you would call the API layer
      // const result = await submitInterviewSetup(formData);
      // navigate("/interview/result-id");

      console.log("Form submitted with data:", formData);

      // For now, just navigate as a temporary solution
      navigate("/interview/12345");
    }
  );

  return (
    <InterviewSetupUI
      jobDescription={state.jobDescription}
      onJobDescriptionChange={handlers.onJobDescriptionChange}
      selfDescription={state.selfDescription}
      onSelfDescriptionChange={handlers.onSelfDescriptionChange}
      resume={state.resume}
      onResumeChange={handlers.onResumeChange}
      onGenerate={handlers.onGenerate}
      isLoading={state.isLoading}
      errors={errors}
    />
  );
};

export default InterviewSetupContainer;

/**
 * NEXT STEPS:
 * 
 * 1. API Layer (interview.api.js):
 *    - Create the submitInterviewSetup() function
 *    - Handle file upload (FormData)
 *    - Transform response
 * 
 * 2. State Layer (if needed):
 *    - Use Context API to share interview data
 *    - Store generated strategy globally
 *    - Share between multiple pages
 * 
 * 3. Integration:
 *    - Replace the temporary navigation with actual API call
 *    - Handle response and errors properly
 *    - Show success/error notifications
 */
