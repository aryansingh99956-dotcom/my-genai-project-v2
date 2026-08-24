import axios from "axios";

const API_URL = "http://localhost:3000/api/interview";

export const generateInterviewReport = async (formData) => {
  try {
    const response = await axios.post(
      API_URL,
      formData,
      {
        withCredentials: true,
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "GENERATE INTERVIEW REPORT ERROR:",
      error.response?.data || error.message
    );

    throw error;
  }
};

export const getInterviewReport = async (interviewId) => {
  try {
    console.log("Fetching interview report:", interviewId);

    const response = await axios.get(
      `${API_URL}/report/${interviewId}`,
      {
        withCredentials: true,
      }
    );

    console.log("Interview report response:", response.data);

    return response.data;
  } catch (error) {
    console.error(
      "GET INTERVIEW REPORT ERROR:",
      error.response?.data || error.message
    );

    throw error;
  }
};