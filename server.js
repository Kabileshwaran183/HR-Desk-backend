require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const authRoutes = require("./routes/auth");
const jobApplicationRoutes = require("./routes/jobApplicationRoutes");
const scheduleRoutes = require("./routes/schedule");
const JobApplication = require("./models/JobApplication");

const app = express();
const PORT = process.env.PORT || 5000;

const dashboardRoutes = require("./routes/dashboard");
app.use("/api/dashboard", dashboardRoutes);

// Middleware
app.use(cors());
app.use(express.json());

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/jobapplications", jobApplicationRoutes);
app.use("/api", scheduleRoutes); // Mount schedule routes under /api

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
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));

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

        const updatedApp = await JobApplication.findByIdAndUpdate(appId, { status }, { new: true });

        if (!updatedApp) {
            return res.status(404).json({ message: "Application not found" });
        }

        res.json({ message: "Status updated successfully", application: updatedApp });
    } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// DELETE route to delete candidate by ID
app.delete("/api/jobapplications/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const deleted = await JobApplication.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ error: "Candidate not found" });
        }

        return res.status(200).json({ message: "Candidate deleted successfully" });
    } catch (error) {
        console.error("Error deleting candidate:", error);
        return res.status(500).json({ error: "Server error while deleting candidate" });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
