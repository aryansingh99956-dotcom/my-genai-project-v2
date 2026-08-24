import { useContext, useEffect } from "react";

import { InterviewContext } from "../context/interview.context";

import {
  generateInterviewReport,
  getInterviewReportById,
  getAllInterviewReports,
  generateResumePdf,
} from "../api/interview.api";

const useInterview = () => {
  const context = useContext(InterviewContext);

  if (!context) {
    throw new Error(
      "useInterview must be used within an InterviewProvider"
    );
  }

  const {
    loading,
    setLoading,

    report,
    setReport,

    reports,
    setReports,

    interviewId,
  } = context;

  // =========================================================
  // GENERATE INTERVIEW REPORT
  // =========================================================

  const generateReport = async ({
    jobDescription,
    selfDescription,
    resume,
  }) => {
    setLoading(true);

    try {
      const response = await generateInterviewReport({
        jobDescription,
        selfDescription,
        resume,
      });

      const interviewReport =
        response?.interviewReport ||
        response?.data?.interviewReport;

      if (interviewReport) {
        setReport(interviewReport);
      }

      return response;
    } catch (error) {
      console.error(
        "Failed to generate interview report:",
        error
      );

      throw error;
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // GET INTERVIEW REPORT BY ID
  // =========================================================

  const getReportById = async (interviewReportId) => {
    setLoading(true);

    try {
      const response =
        await getInterviewReportById(interviewReportId);

      const interviewReport =
        response?.interviewReport ||
        response?.data?.interviewReport;

      if (interviewReport) {
        setReport(interviewReport);
      }

      return response;
    } catch (error) {
      console.error(
        "Failed to fetch interview report:",
        error
      );

      throw error;
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // GET ALL INTERVIEW REPORTS
  // =========================================================

  const getReports = async () => {
    setLoading(true);

    try {
      const response = await getAllInterviewReports();

      const interviewReports =
        response?.interviewReports ||
        response?.reports ||
        response?.data?.interviewReports ||
        response?.data?.reports ||
        [];

      setReports(interviewReports);

      return response;
    } catch (error) {
      console.error(
        "Failed to fetch interview reports:",
        error
      );

      throw error;
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // GET RESUME PDF
  // =========================================================

  const getResumePdf = async (interviewReportId) => {
    setLoading(true);

    let response = null;

    try {
      response = await generateResumePdf({
        interviewReportId,
      });

      // Convert backend response into PDF Blob
      const pdfBlob = new Blob(
        [response],
        {
          type: "application/pdf",
        }
      );

      // Create temporary browser URL
      const url =
        window.URL.createObjectURL(pdfBlob);

      // Create download link
      const link =
        document.createElement("a");

      link.href = url;

      link.setAttribute(
        "download",
        `resume_${interviewReportId}.pdf`
      );

      document.body.appendChild(link);

      // Automatically download PDF
      link.click();

      // Remove temporary element
      document.body.removeChild(link);

      // Release memory
      window.URL.revokeObjectURL(url);

      return response;
    } catch (error) {
      console.error(
        "Failed to generate resume PDF:",
        error
      );

      throw error;
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // CLEAR REPORT
  // =========================================================

  const clearReport = () => {
    setReport(null);
  };

  // =========================================================
  // LOAD REPORT WHEN INTERVIEW ID EXISTS
  // =========================================================

  useEffect(() => {
    if (interviewId) {
      getReportById(interviewId);
    }
  }, [interviewId]);

  // =========================================================
  // RETURN
  // =========================================================

  return {
    loading,

    report,
    reports,

    generateReport,
    getReportById,
    getReports,

    getResumePdf,

    clearReport,
  };
};

export default useInterview;