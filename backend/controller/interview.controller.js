const pdfParse = require("pdf-parse");

const {
  generateInterviewReport,
  generateResumePdf,
} = require("../src/services/ai.service");

const interviewReportModel =
  require("../src/models/interviewReport.model");


// =========================================================
// GENERATE INTERVIEW REPORT
// =========================================================

async function generateInterviewController(req, res) {

  try {

    // Check uploaded resume

    if (!req.file) {

      return res.status(400).json({
        message: "Resume file is required.",
      });

    }


    // Parse PDF

    const parsedPdf =
      await new pdfParse.PDFParse({
        data: req.file.buffer,
      }).getText();


    const resumeContent =
      parsedPdf.text;


    // Get form data

    const {
      selfDescription,
      jobDescription,
    } = req.body;


    // Generate AI report

    const interviewReportByAi =
      await generateInterviewReport({

        resume: resumeContent,

        selfDescription,

        jobDescription,

      });


    // Save report

    const interviewReport =
      await interviewReportModel.create({

        user: req.user._id,

        resume: resumeContent,

        selfDescription,

        jobDescription,

        ...interviewReportByAi,

      });


    return res.status(201).json({

      message:
        "Interview report generated successfully.",

      interviewReport,

    });

  } catch (error) {

    console.error(
      "GENERATE INTERVIEW REPORT ERROR:",
      error
    );

    return res.status(500).json({

      message:
        "Failed to generate interview report.",

      error: error.message,

    });

  }
}


// =========================================================
// GET INTERVIEW REPORT
// =========================================================

async function getInterviewReportByIdController(
  req,
  res
) {

  try {

    const {
      interviewId,
    } = req.params;


    const interviewReport =
      await interviewReportModel.findById(
        interviewId
      );


    if (!interviewReport) {

      return res.status(404).json({

        message:
          "Interview report not found.",

      });

    }


    return res.status(200).json({

      message:
        "Interview report fetched successfully.",

      interviewReport,

    });

  } catch (error) {

    console.error(
      "GET INTERVIEW REPORT ERROR:",
      error
    );

    return res.status(500).json({

      message:
        "Failed to get interview report.",

      error: error.message,

    });

  }
}


// =========================================================
// GENERATE RESUME PDF
// =========================================================

async function generateResumePdfController(
  req,
  res
) {

  try {

    const {
      interviewReportId,
    } = req.params;


    // Find report

    const interviewReport =
      await interviewReportModel.findById(
        interviewReportId
      );


    if (!interviewReport) {

      return res.status(404).json({

        message:
          "Interview report not found.",

      });

    }


    // Get candidate information

    const {
      resume,
      jobDescription,
      selfDescription,
    } = interviewReport;


    // Generate PDF

    const pdfBuffer =
      await generateResumePdf({

        resume,

        jobDescription,

        selfDescription,

      });


    // Send PDF

    res.set({

      "Content-Type":
        "application/pdf",

      "Content-Disposition":
        `attachment; filename=resume_${interviewReportId}.pdf`,

    });


    return res.send(pdfBuffer);

  } catch (error) {

    console.error(
      "GENERATE RESUME PDF ERROR:",
      error
    );

    return res.status(500).json({

      message:
        "Failed to generate resume PDF.",

      error: error.message,

    });

  }
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

  generateInterviewController,

  getInterviewReportByIdController,

  generateResumePdfController,

};