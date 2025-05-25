require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));

// Mongoose schema
const jobApplicationSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: String,
    phoneNumber: String,
    jobTitle: String,
    status: { type: String, default: "Pending" },
    interviewDate: Date,
    ranking: Number,
}, { timestamps: true });

const JobApplication = mongoose.model("JobApplication", jobApplicationSchema);

// Google OAuth2 Client
const oAuth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

// Nodemailer transporter with OAuth2
async function createTransporter() {
    try {
        const accessToken = await oAuth2Client.getAccessToken();
        return nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: process.env.SENDER_EMAIL,
                clientId: process.env.CLIENT_ID,
                clientSecret: process.env.CLIENT_SECRET,
                refreshToken: process.env.REFRESH_TOKEN,
                accessToken: accessToken.token,
            },
        });
    } catch (err) {
        console.error("❌ Failed to create email transporter:", err);
        return null;
    }
}

// Routes
app.get("/", (req, res) => {
    res.send("Job Application API is running 🚀");
});

// Get all job applications
app.get("/api/jobapplications", async (req, res) => {
    try {
        const apps = await JobApplication.find().sort({ createdAt: -1 });
        res.json(apps);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch applications" });
    }
});

// Schedule Interview
app.post("/api/schedule", async (req, res) => {
    try {
        const { applicantId, interviewDate, ranking } = req.body;

        if (!applicantId || !interviewDate || typeof ranking !== "number") {
            return res.status(400).json({ error: "Missing or invalid fields" });
        }

        // Find applicant
        const applicant = await JobApplication.findById(applicantId);
        if (!applicant) return res.status(404).json({ error: "Applicant not found" });

        // Update applicant
        applicant.status = "Interview Scheduled";
        applicant.interviewDate = new Date(interviewDate);
        applicant.ranking = ranking;
        await applicant.save();

        // Create Calendar Event
        const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
        const event = {
            summary: `Interview with ${applicant.firstName} ${applicant.lastName}`,
            description: `Interview for ${applicant.jobTitle}`,
            start: { dateTime: new Date(interviewDate).toISOString() },
            end: {
                dateTime: new Date(
                    new Date(interviewDate).getTime() + 60 * 60 * 1000
                ).toISOString(),
            },
            attendees: [{ email: applicant.email }],
            reminders: {
                useDefault: false,
                overrides: [
                    { method: "email", minutes: 24 * 60 },
                    { method: "popup", minutes: 10 },
                ],
            },
        };

        const calendarResponse = await calendar.events.insert({
            calendarId: "primary",
            resource: event,
            sendUpdates: "all",
        });

        // Send Email
        const transporter = await createTransporter();
        if (!transporter) {
            return res.status(500).json({ error: "Failed to set up email transporter" });
        }

        const mailOptions = {
            from: `HR Desk <${process.env.SENDER_EMAIL}>`,
            to: applicant.email,
            subject: "Interview Scheduled - HR Desk",
            text: `Dear ${applicant.firstName},\n\nYour interview is scheduled on ${new Date(interviewDate).toLocaleString()}.\n\nBest regards,\nHR Desk`,
            html: `
                <p>Dear ${applicant.firstName},</p>
                <p>Your interview is scheduled on <strong>${new Date(interviewDate).toLocaleString()}</strong>.</p>
                <p>We've added the event to your calendar.</p>
                <p>Best regards,<br/>HR Desk</p>
            `,
        };

        await transporter.sendMail(mailOptions);

        res.json({
            message: "Interview scheduled and email sent",
            eventId: calendarResponse.data.id,
        });
    } catch (error) {
        console.error("❌ Error scheduling interview:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
