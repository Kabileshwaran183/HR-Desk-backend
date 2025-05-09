const express = require("express");
const router = express.Router();
const multer = require("multer");
const JobApplication = require("../models/JobApplication");

// Set up Multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + "-" + file.originalname);
    }
});

const upload = multer({ storage });

// POST: Apply for a job
router.post("/apply", upload.single("resume"), async (req, res) => {
    try {
        const {
            jobId,
            firstName,
            lastName,
            email,
            phoneNumber,
            yearOfGraduation,
            gender,
            experience,
            skills,
            location,
            pincode
        } = req.body;

        const resume = req.file ? req.file.filename : null;

        const application = new JobApplication({
            jobId,
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
            resume,
        });

        await application.save();
        res.status(201).json({ message: "Application submitted successfully." });
    } catch (error) {
        console.error("Error submitting application:", error);
        res.status(500).json({ error: "Something went wrong." });
    }
});

module.exports = router;
