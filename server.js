require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const nodemailer = require("nodemailer");
const authRoutes = require("./routes/auth");
const jobApplicationRoutes = require("./routes/jobApplicationRoutes");
const JobApplication = require("./models/JobApplication");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "uploads"));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});
const upload = multer({ storage });

// MongoDB connection
mongoose
    .connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));

// Auth Routes
app.use("/api/auth", authRoutes);

// Base route
app.get("/", (req, res) => {
    res.send("Welcome to the Job Application API 🚀");
});

// Get all applications
app.get("/api/jobapplications", async (req, res) => {
    try {
        const applications = await JobApplication.find().sort({ createdAt: -1 });
        res.json(applications);
    } catch (error) {
        res.status(500).json({ error: "Error fetching applications" });
    }
});

// PATCH route to update application status
app.patch("/api/jobapplications/:id/status", async (req, res) => {
    try {
        const { status } = req.body;
        const appId = req.params.id;

        if (!status) {
            return res.status(400).json({ message: "Status is required" });
        }

        const updatedApp = await JobApplication.findByIdAndUpdate(
            appId,
            { status },
            { new: true }
        );

        if (!updatedApp) {
            return res.status(404).json({ message: "Application not found" });
        }

        res.json({ message: "Status updated successfully", application: updatedApp });
    } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Use other job application routes (if any)
app.use("/api/jobapplications", jobApplicationRoutes);

// Schedule Interview Route
app.post("/api/schedule", async (req, res) => {
    try {
        const { email, name, date } = req.body;

        if (!email || !name || !date) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const formattedDate = new Date(date).toLocaleString();

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD,
            },
        });

        const mailOptions = {
            from: `HR Desk <${process.env.SMTP_EMAIL}>`,
            to: email,
            subject: "Interview Scheduled",
            html: `
                <h3>Hello ${name},</h3>
                <p>Your interview is scheduled for:</p>
                <p><strong>${formattedDate}</strong></p>
                <br/>
                <p>Best regards,<br/>HR Team</p>
            `,
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "Interview scheduled successfully" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ message: "Failed to schedule interview" });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
