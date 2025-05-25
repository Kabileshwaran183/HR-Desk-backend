const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
require("dotenv").config();

router.post("/schedule", async (req, res) => {
    const { email, name, date } = req.body;

    if (!email || !name || !date) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
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
            subject: "Interview Scheduled",
            html: `
        <h2>Hello ${name},</h2>
        <p>Your interview has been scheduled for:</p>
        <p><strong>${new Date(date).toLocaleString()}</strong></p>
        <p>We look forward to speaking with you.</p>
        <br />
        <p>Best regards,<br/>HR Team</p>
      `,
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: "Interview scheduled and email sent" });
    } catch (error) {
        console.error("Email error:", error);
        res.status(500).json({ error: "Failed to send email" });
    }
});

module.exports = router;
