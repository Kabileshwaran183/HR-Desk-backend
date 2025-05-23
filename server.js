const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const dotenv = require("dotenv");
const authRoutes = require("./routes/auth");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Auth Routes
app.use("/api/auth", authRoutes);

// Job Application Schema
const jobApplicationSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    yearOfGraduation: Number,
    gender: String,
    experience: Number,
    skills: String,
    jobTitle: String,
    location: String,
    pincode: String,
    resume: String,
    status: { type: String, default: "Pending" },
}, { timestamps: true });

const JobApplication = mongoose.model("JobApplication", jobApplicationSchema);

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

// Root Route
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

// Submit a job application
app.post("/api/jobapplications", upload.single("resume"), async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            phoneNumber,
            jobTitle,
            experience,
            skills,
            location,
            pincode,
            yearOfGraduation,
            gender
        } = req.body;

        const newApplication = new JobApplication({
            firstName,
            lastName,
            email,
            phoneNumber,
            experience,
            skills,
            location,
            pincode,
            jobTitle,
            yearOfGraduation,
            gender,
            resume: req.file?.filename || "",
        });

        await newApplication.save();
        res.status(201).json({ message: "✅ Application submitted successfully!" });
    } catch (error) {
        console.error("❌ Error submitting application:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
