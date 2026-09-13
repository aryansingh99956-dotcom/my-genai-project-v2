import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://my-genai-backend.onrender.com/api/interview";


// =========================================================
// GENERATE INTERVIEW REPORT
// =========================================================

export const generateInterviewReport = async (
  formData
) => {
  try {
    const response = await axios.post(
      API_URL,
      formData,
      {
        withCredentials: true,
      }
    );

    console.log(
      "GENERATED INTERVIEW REPORT:",
      response.data
    );

    return response.data;

  } catch (error) {

    console.error(
      "GENERATE INTERVIEW REPORT ERROR:",
      error.response?.data ||
      error.message
    );

    throw error;
  }
};


// =========================================================
// GET INTERVIEW REPORT
// =========================================================

export const getInterviewReport = async (
  interviewId
) => {
  try {

    console.log(
      "FETCHING INTERVIEW REPORT:",
      interviewId
    );

    const response =
      await axios.get(
        `${API_URL}/report/${interviewId}`,
        {
          withCredentials: true,
        }
      );

    console.log(
      "INTERVIEW REPORT RESPONSE:",
      response.data
    );

    return response.data;

  } catch (error) {

    console.error(
      "GET INTERVIEW REPORT ERROR:",
      error.response?.data ||
      error.message
    );

    throw error;
  }
};


// =========================================================
// GENERATE RESUME PDF
// =========================================================

export const generateResumePdf = async (
  interviewId
) => {

  try {

    console.log(
      "GENERATING RESUME PDF:",
      interviewId
    );

    const response =
      await axios.get(
        `${API_URL}/resume/${interviewId}`,
        {
          withCredentials: true,
          responseType: "blob",
        }
      );

    return response;

  } catch (error) {

    console.error(
      "GENERATE RESUME PDF ERROR:",
      error.response?.data ||
      error.message
    );

    throw error;
  }
};