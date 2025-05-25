const express = require("express");
const router = express.Router();
const multer = require("multer");
const mongoose = require("mongoose");
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

// Helper function to compute match percentage and detailed matching info
function computeMatchDetails(jobTitle, jobDescription, jobSkills, candidate) {
    // Normalize and tokenize helper
    const tokenize = (text) => {
        if (!text) return [];
        return text.toLowerCase().match(/\b\w+\b/g) || [];
    };

    // Extract job skills from jobSkills string or from jobDescription if jobSkills empty
    let requiredSkills = [];
    if (jobSkills && jobSkills.length > 0) {
        if (typeof jobSkills === "string") {
            requiredSkills = jobSkills.split(",").map(s => s.trim().toLowerCase());
        } else if (Array.isArray(jobSkills)) {
            requiredSkills = jobSkills.map(s => s.toLowerCase());
        }
    } else if (jobDescription) {
        // Try to extract skills from jobDescription by looking for known skill keywords (simple heuristic)
        const knownSkills = ["javascript", "node.js", "react", "apis", "rest", "agile", "git", "mysql", "python", "java", "c++", "docker", "kubernetes"];
        const descTokens = tokenize(jobDescription);
        requiredSkills = knownSkills.filter(skill => descTokens.includes(skill));
    }

    // Candidate skills from parsedResume or candidate.skills string
    let candidateSkills = [];
    if (candidate.skills) {
        if (Array.isArray(candidate.skills)) {
            candidateSkills = candidate.skills.map(s => s.toLowerCase());
        } else if (typeof candidate.skills === "string") {
            candidateSkills = candidate.skills.split(",").map(s => s.trim().toLowerCase());
        }
    }

    // Matched and missing skills
    const matchedSkills = requiredSkills.filter(skill => candidateSkills.includes(skill));
    const missingSkills = requiredSkills.filter(skill => !candidateSkills.includes(skill));

    // Simple keyword overlap between job description and candidate resume text (education + experience + summary)
    const candidateText = [
        candidate.education || "",
        candidate.work_experience ? (Array.isArray(candidate.work_experience) ? candidate.work_experience.join(" ") : candidate.work_experience) : "",
        candidate.summary || ""
    ].join(" ").toLowerCase();

    const jobText = [jobTitle || "", jobDescription || ""].join(" ").toLowerCase();

    const jobTokens = new Set(tokenize(jobText));
    const candidateTokens = new Set(tokenize(candidateText));

    if (jobTokens.size === 0 || candidateTokens.size === 0) {
        return {
            matchPercentage: 0,
            matchedSkills,
            missingSkills,
            summary: "Insufficient information to compute match."
        };
    }

    let overlapCount = 0;
    jobTokens.forEach(token => {
        if (candidateTokens.has(token)) overlapCount++;
    });

    const keywordOverlapScore = overlapCount / jobTokens.size;

    // Skill match score weighted higher
    const skillMatchScore = requiredSkills.length > 0 ? (matchedSkills.length / requiredSkills.length) : 0;

    // Combine scores: 70% skill match, 30% keyword overlap
    const combinedScore = (0.7 * skillMatchScore) + (0.3 * keywordOverlapScore);

    const matchPercentage = Math.round(combinedScore * 100);

    // Generate summary
    let summary = "";
    if (matchPercentage === 0) {
        summary = "Candidate does not match the job requirements.";
    } else {
        summary = `Candidate has relevant skills: ${matchedSkills.join(", ")}.`;
        if (missingSkills.length > 0) {
            summary += ` Missing skills: ${missingSkills.join(", ")}.`;
        }
    }

    return {
        matchPercentage,
        matchedSkills,
        missingSkills,
        summary
    };
}

// POST: Apply for a job
router.post("/apply", upload.single("resume"), async (req, res) => {
    try {
        let {
            jobId,
            jobDescription,
            firstName,
            lastName,
            email,
            phoneNumber,
            yearOfGraduation,
            gender,
            jobTitle,
            experience,
            skills,
            location,
            pincode,
            parsedResume
        } = req.body;

        const resume = req.file ? req.file.filename : null;

        // Validate jobId as ObjectId
        if (jobId && !mongoose.Types.ObjectId.isValid(jobId)) {
            console.warn(`Invalid jobId received: ${jobId}. Setting jobId to undefined.`);
            jobId = undefined;
        }

        // Parse parsedResume JSON string if needed
        let parsedResumeObj = {};
        if (parsedResume) {
            try {
                parsedResumeObj = typeof parsedResume === "string" ? JSON.parse(parsedResume) : parsedResume;
            } catch (err) {
                console.error("Error parsing parsedResume JSON:", err);
            }
        }

        // Compute match details
        const candidateData = {
            education: parsedResumeObj.education ? (Array.isArray(parsedResumeObj.education) ? parsedResumeObj.education.map(ed => ed.degree || "").join(" ") : parsedResumeObj.education) : "",
            skills: parsedResumeObj.skills ? (Array.isArray(parsedResumeObj.skills) ? parsedResumeObj.skills.map(s => s.name || s).join(", ") : parsedResumeObj.skills) : skills || "",
            work_experience: parsedResumeObj.work_experience || "",
            summary: parsedResumeObj.summary || ""
        };

        const matchDetails = computeMatchDetails(jobTitle, jobDescription, skills, candidateData);

        const application = new JobApplication({
            jobId,
            firstName,
            lastName,
            email,
            phoneNumber,
            yearOfGraduation,
            gender,
            jobTitle,
            experience,
            skills,
            location,
            pincode,
            resume,
            parsedResume: parsedResumeObj,
            matchPercentage: matchDetails.matchPercentage,
            matchedSkills: matchDetails.matchedSkills,
            missingSkills: matchDetails.missingSkills,
            summary: matchDetails.summary
        });

        await application.save();
        res.status(201).json({ message: "Application submitted successfully.", matchDetails });
    } catch (error) {
        console.error("Error submitting application:", error);
        console.error(error.stack);
        res.status(500).json({ error: "Something went wrong." });
    }
});

// GET: Get all candidates sorted by matchPercentage descending
router.get("/candidates", async (req, res) => {
    try {
        const candidates = await JobApplication.find()
            .sort({ matchPercentage: -1 })
            .exec();
        res.json(candidates);
    } catch (error) {
        console.error("Error fetching candidates:", error);
        res.status(500).json({ error: "Something went wrong." });
    }
});

module.exports = router;
