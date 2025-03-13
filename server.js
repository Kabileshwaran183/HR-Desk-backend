const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Connection Error:", err));

// Define Mongoose Schema
const jobApplicationSchema = new mongoose.Schema({
    firstName: { type: String, required: false },
    lastName: { type: String, required: false },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: false },
    yearOfGraduation: { type: String, required: false },
    gender: { type: String, required: false },
    experience: { type: String, required: false },
    skills: { type: String, required: false },
    location: { type: String, required: false },
    pincode: { type: String, required: false },
    resume: { type: String, required: false },
    status: { type: String, default: "Pending" },
}, { timestamps: true });

const JobApplication = mongoose.model("JobApplication", jobApplicationSchema);

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: "./uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique file name
    }
});

const upload = multer({ storage });

// Routes
app.get("/", (req, res) => {
    res.send("Welcome to the Job Application API 🚀");
});

// GET all job applications
app.get("/api/jobapplications", async (req, res) => {
    try {
        const applications = await JobApplication.find();
        res.json(applications);
    } catch (error) {
        res.status(500).json({ error: "Error fetching applications" });
    }
});

// POST job application with resume upload
app.post("/api/jobapplications", upload.single("resume"), async (req, res) => {
    try {
        const { firstName, lastName, email, phoneNumber, yearOfGraduation, gender, experience, skills, location, pincode } = req.body;

        const newApplication = new JobApplication({
            firstName,
            lastName,
            email,
            phoneNumber,
            yearOfGraduation,
            gender,
            experience,
            skills,
            location,
            pincode,
            resume: req.file ? req.file.filename : "",  // Save filename if uploaded
            status: "Pending",
        });

        await newApplication.save();
        res.status(201).json({ message: "✅ Application submitted successfully!" });
    } catch (error) {
        console.error("❌ Error submitting application:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
