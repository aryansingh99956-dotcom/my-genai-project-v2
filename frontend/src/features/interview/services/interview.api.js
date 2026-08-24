import axios from "axios";

// ============================================================
// API URL
// ============================================================

const API_URL = "https://my-genai-backend.onrender.com/api/interview";

// ============================================================
// GENERATE INTERVIEW
// ============================================================

export const generateInterview = async ({
  jobDescription,
  selfDescription,
  resume,
}) => {
  try {
    const formData = new FormData();

    formData.append("jobDescription", jobDescription || "");
    formData.append("selfDescription", selfDescription || "");

    if (resume) {
      formData.append("resume", resume);
    }

    const response = await axios.post(
      `${API_URL}`,
      formData,
      {
        withCredentials: true,
      }
    );

    console.log(
      "INTERVIEW GENERATION RESPONSE:",
      response.data
    );

    return response.data;

  } catch (error) {
    console.error(
      "GENERATE INTERVIEW ERROR:",
      error.response?.data || error.message
    );

    throw error;
  }
};


// ============================================================
// GET INTERVIEW REPORT
// ============================================================

export const getInterviewReport = async (interviewId) => {
  try {
    console.log(
      "FETCHING INTERVIEW REPORT:",
      interviewId
    );

    const response = await axios.get(
      `${API_URL}/report/${interviewId}`,
      {
        withCredentials: true,
      }
    );

    console.log(
      "INTERVIEW REPORT RESPONSE:",
      response.data
    );

    // IMPORTANT:
    // Backend response is:
    //
    // {
    //   interviewReport: {...},
    //   message: "Interview report fetched successfully."
    // }
    //
    // We only return interviewReport to the UI.

    return (
      response.data?.interviewReport ||
      response.data
    );

  } catch (error) {
    console.error(
      "GET INTERVIEW REPORT ERROR:",
      error.response?.data || error.message
    );

    throw error;
  }
};


// ============================================================
// GENERATE RESUME PDF
// ============================================================

export const generateResumePdf = async (interviewReportId) => {
  try {
    console.log(
      "GENERATING RESUME PDF:",
      interviewReportId
    );

    const response = await axios.post(
      `${API_URL}/resume/pdf/${interviewReportId}`,
      {},
      {
        responseType: "blob",
        withCredentials: true,
      }
    );

    const blob = new Blob(
      [response.data],
      {
        type: "application/pdf",
      }
    );

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "interview-resume.pdf";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error(
      "GENERATE RESUME PDF ERROR:",
      error.response?.data || error.message
    );

    throw error;
  }
};