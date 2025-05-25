const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const JobApplication = require("../models/JobApplication");

router.post("/schedule", async (req, res) => {
    const { email, date } = req.body;

    if (!email || !date) {
        return res.status(400).json({ message: "Missing required fields: email and date" });
    }

    try {
        const applicant = await JobApplication.findOne({ email });

        if (!applicant) {
            return res.status(404).json({ message: "Applicant not found" });
        }

        const { firstName, lastName, jobTitle } = applicant;
        const name = `${firstName} ${lastName}`;
        const formattedDate = new Date(date).toLocaleString();

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD,
            },
        });

        const mailOptions = {
            from: process.env.SMTP_EMAIL,
            to: email,
            subject: `Interview Scheduled for ${jobTitle}`,
            html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #2c3e50;">Hello ${name},</h2>
          <p>We are pleased to inform you that your interview for the position of <strong>${jobTitle}</strong> has been scheduled.</p>
          <p><strong>Interview Details:</strong></p>
          <ul>
            <li><strong>Date & Time:</strong> ${formattedDate}</li>
            <li><strong>Mode:</strong> Online via Zoom (link will be shared prior to the interview)</li>
            <li><strong>Interviewer:</strong> HR Team</li>
          </ul>
          <p>Please ensure that you are available at the scheduled time and have a stable internet connection.</p>
          <p>If you have any questions or need to reschedule, feel free to reply to this email or contact our HR department at <a href="mailto:hr@example.com">hr@example.com</a>.</p>
          <p>Looking forward to speaking with you!</p>
          <br/>
          <p>Best regards,</p>
          <p><strong>HR Team</strong><br/>Your Company Name</p>
        </div>
      `,
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "Interview scheduled successfully" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ message: "Failed to schedule interview" });
    }
});

module.exports = router;
