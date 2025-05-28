const express = require("express");
const router = express.Router();
const multer = require("multer");
const mongoose = require("mongoose");
const stringSimilarity = require("string-similarity");
const axios = require("axios");
const JobApplication = require("../models/JobApplication");

// Multer storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + "-" + file.originalname);
    }
});
const upload = multer({ storage });

// Synonyms dictionary for skill matching
const synonyms = {
    "react": ["front-end", "frontend", "reactjs", "react.js"],
    "node.js": ["node", "nodejs", "backend", "back-end"],
    "rest apis": ["rest", "api", "apis", "restful"],
    "git": ["version control", "github"],
    "javascript": ["js", "ecmascript"],
    "mysql": ["sql", "database", "mariadb"],
    "python": ["py"],
    "java": ["jvm"],
    "c++": ["cpp"],
    "docker": ["containerization"],
    "kubernetes": ["k8s", "container orchestration"],
    "manual testing": ["qa", "quality assurance", "testing"],
    "automation testing": ["automation", "selenium", "cypress"],
    "communication": ["soft skills", "interpersonal"],
    "negotiation": ["sales", "bargaining"],
    "crm": ["customer relationship management"],
    "css": ["css3"],
    "html": ["html5"],
    "ui": ["frontend", "user interface"]
};

// Tokenize text into words
function tokenize(text) {
    if (!text) return [];
    return text.toLowerCase().match(/\b\w+\b/g) || [];
}

// Skill matching with synonyms and fuzzy logic
function skillsMatch(skillA, skillB) {
    if (skillA === skillB) return true;
    if (synonyms[skillA] && synonyms[skillA].includes(skillB)) return true;
    if (synonyms[skillB] && synonyms[skillB].includes(skillA)) return true;
    if (skillA.includes(skillB) || skillB.includes(skillA)) return true;
    return false;
}

function fuzzySkillMatch(reqSkill, candidateSkills) {
    let bestMatch = { skill: null, rating: 0 };
    candidateSkills.forEach(candSkill => {
        if (skillsMatch(reqSkill, candSkill)) {
            bestMatch = { skill: candSkill, rating: 1 };
        } else {
            const rating = stringSimilarity.compareTwoStrings(reqSkill, candSkill);
            if (rating > bestMatch.rating) {
                bestMatch = { skill: candSkill, rating };
            }
        }
    });
    return bestMatch;
}

// Calculate total years of experience from work experience array
function calculateYearsOfExperience(workExperience) {
    if (!workExperience || !Array.isArray(workExperience)) return 0;

    let totalMonths = 0;

    workExperience.forEach(exp => {
        const startDateStr = exp.dates?.start_date || exp.start_date || "";
        const endDateStr = exp.dates?.end_date || exp.end_date || "";

        const startDate = new Date(startDateStr);
        let endDate;

        if (!endDateStr || endDateStr.toLowerCase() === "present") {
            endDate = new Date();
        } else {
            endDate = new Date(endDateStr);
        }

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return; // skip invalid dates
        }

        const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
        if (months > 0) {
            totalMonths += months;
        }
    });

    return totalMonths / 12; // convert months to years
}

// Compute TF-IDF vectors for fallback semantic similarity
function computeTfIdfVectors(docs) {
    const tfidf = {};
    const docCount = docs.length;

    docs.forEach((doc, index) => {
        const terms = doc.toLowerCase().match(/\b\w+\b/g) || [];
        const termFreq = {};
        terms.forEach(term => {
            termFreq[term] = (termFreq[term] || 0) + 1;
        });
        tfidf[index] = termFreq;
    });

    const docFreq = {};
    Object.values(tfidf).forEach(termFreq => {
        Object.keys(termFreq).forEach(term => {
            docFreq[term] = (docFreq[term] || 0) + 1;
        });
    });

    const tfidfVectors = {};
    Object.entries(tfidf).forEach(([docIndex, termFreq]) => {
        const vector = {};
        Object.entries(termFreq).forEach(([term, freq]) => {
            const idf = Math.log(docCount / (docFreq[term] || 1));
            vector[term] = freq * idf;
        });
        tfidfVectors[docIndex] = vector;
    });

    return tfidfVectors;
}

// Cosine similarity for TF-IDF vectors (objects)
function cosineSimilarity(vecA, vecB) {
    if (Array.isArray(vecA) && Array.isArray(vecB)) {
        // Vector arrays version (OpenAI embeddings)
        if (vecA.length !== vecB.length) return 0;
        let dotProduct = 0, magA = 0, magB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            magA += vecA[i] * vecA[i];
            magB += vecB[i] * vecB[i];
        }
        if (magA === 0 || magB === 0) return 0;
        return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
    } else {
        // Object vectors version (TF-IDF fallback)
        const intersection = Object.keys(vecA).filter(term => term in vecB);
        if (intersection.length === 0) return 0;
        let dotProduct = 0;
        intersection.forEach(term => {
            dotProduct += vecA[term] * vecB[term];
        });
        const magA = Math.sqrt(Object.values(vecA).reduce((sum, val) => sum + val * val, 0));
        const magB = Math.sqrt(Object.values(vecB).reduce((sum, val) => sum + val * val, 0));
        if (magA === 0 || magB === 0) return 0;
        return dotProduct / (magA * magB);
    }
}

// Get OpenAI embedding vector
async function getEmbedding(text) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn("OpenAI API key not set. Falling back to TF-IDF semantic similarity.");
        return null;
    }

    try {
        const response = await axios.post(
            "https://api.openai.com/v1/embeddings",
            {
                input: text,
                model: "text-embedding-ada-002"
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`
                }
            }
        );
        return response.data.data[0].embedding;
    } catch (error) {
        console.error("Error fetching embedding from OpenAI:", error);
        return null;
    }
}

// Main function to compute match details and scores
async function computeMatchDetails(jobTitle, jobDescription, jobSkills, candidate) {
    // Extract required skills
    let requiredSkills = [];
    if (jobSkills && jobSkills.length > 0) {
        if (typeof jobSkills === "string") {
            requiredSkills = jobSkills.split(",").map(s => s.trim().toLowerCase());
        } else if (Array.isArray(jobSkills)) {
            requiredSkills = jobSkills.map(s => s.toLowerCase());
        }
    } else if (jobDescription) {
        const knownSkills = Object.keys(synonyms);
        const descTokens = tokenize(jobDescription);
        requiredSkills = knownSkills.filter(skill => descTokens.includes(skill));
    }

    // Candidate skills
    let candidateSkills = [];
    if (candidate.skills) {
        if (Array.isArray(candidate.skills)) {
            candidateSkills = candidate.skills.map(s => s.toLowerCase());
        } else if (typeof candidate.skills === "string") {
            candidateSkills = candidate.skills.split(",").map(s => s.trim().toLowerCase());
        }
    }

    // Skill matching with fuzzy and substring matching
    const matchedSkills = [];
    const partiallyMatchedSkills = [];
    const missingSkills = [];

    requiredSkills.forEach(reqSkill => {
        const bestMatch = fuzzySkillMatch(reqSkill, candidateSkills);
        if (bestMatch.rating === 1) {
            matchedSkills.push(reqSkill);
        } else if (bestMatch.rating >= 0.5) {
            partiallyMatchedSkills.push(reqSkill);
        } else {
            missingSkills.push(reqSkill);
        }
    });

    // Experience calculation
    let candidateExp = 0;
    if (candidate.work_experience && Array.isArray(candidate.work_experience)) {
        candidateExp = calculateYearsOfExperience(candidate.work_experience);
    }

    // Minimum experience (from candidate.minExperience or 0)
    const minExpRequired = candidate.minExperience || 0;

    // Experience match score (0 to 1)
    const expMatchScore = candidateExp >= minExpRequired ? 1 : candidateExp / minExpRequired;

    // Skill match score weights: full match=1, partial=0.6, missing=0
    const skillMatchScore = (matchedSkills.length + partiallyMatchedSkills.length * 0.6) / requiredSkills.length || 0;

    // Text semantic similarity (job title + description vs candidate resume + skills)
    const jobText = (jobTitle + " " + jobDescription).toLowerCase();
    const candidateText = (
        candidate.resume_text +
        " " +
        candidate.skills?.join(" ") +
        " " +
        (candidate.work_experience ? candidate.work_experience.map(exp => exp.title + " " + exp.description).join(" ") : "")
    ).toLowerCase();

    // Get OpenAI embeddings
    let embeddingJob = await getEmbedding(jobText);
    let embeddingCandidate = await getEmbedding(candidateText);

    let semanticSimilarity = 0;

    if (embeddingJob && embeddingCandidate) {
        semanticSimilarity = cosineSimilarity(embeddingJob, embeddingCandidate);
     } else {
        // fallback TF-IDF semantic similarity
        const tfidfVectors = computeTfIdfVectors([jobText, candidateText]);
        semanticSimilarity = cosineSimilarity(tfidfVectors[0], tfidfVectors[1]);
    }

    return {
        matchedSkills,
        partiallyMatchedSkills,
        missingSkills,
        experience: {
            candidateYears: candidateExp,
            minimumRequired: minExpRequired,
            matchScore: expMatchScore
        },
        skillMatchScore,
        semanticSimilarity,
        overallScore: (skillMatchScore * 0.5 + expMatchScore * 0.2 + semanticSimilarity * 0.3)
    };


    // Composite match score (weighted average)
    const compositeScore = (skillMatchScore * 0.5) + (expMatchScore * 0.3) + (semanticSimilarity * 0.2);

    return {
        matchedSkills,
        partiallyMatchedSkills,
        missingSkills,
        candidateExperience: candidateExp,
        minimumExperienceRequired: minExpRequired,
        experienceMatchScore: expMatchScore,
        skillMatchScore,
        semanticSimilarity,
        compositeScore
    };
}

// POST route to submit a job application with resume upload and match computation
router.post("/apply", upload.single("resume"), async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            linkedin,
            github,
            portfolio,
            currentLocation,
            applyingLocation,
            jobTitle,
            jobDescription,
            jobSkills,
            experience,
            minExperience,
            education,
            work_experience,
            skills,
            resume_text
        } = req.body;

        // Validate required fields (basic example)
        if (!firstName || !lastName || !email || !jobTitle) {
            return res.status(400).json({ error: "Missing required fields: firstName, lastName, email, or jobTitle" });
        }

        // Parse skills & work_experience JSON if sent as string
        let parsedSkills = [];
        if (skills) {
            if (typeof skills === "string") {
                try {
                    parsedSkills = JSON.parse(skills);
                    if (!Array.isArray(parsedSkills)) parsedSkills = skills.split(",").map(s => s.trim());
                } catch {
                    parsedSkills = skills.split(",").map(s => s.trim());
                }
            } else if (Array.isArray(skills)) {
                parsedSkills = skills;
            }
        }

        let parsedWorkExperience = [];
        if (work_experience) {
            if (typeof work_experience === "string") {
                try {
                    parsedWorkExperience = JSON.parse(work_experience);
                } catch {
                    parsedWorkExperience = [];
                }
            } else if (Array.isArray(work_experience)) {
                parsedWorkExperience = work_experience;
            }
        }

        // Convert experience values to numbers
        const experienceNum = parseFloat(experience) || 0;
        const minExperienceNum = parseFloat(minExperience) || 0;

        // Candidate data structure
        const candidateData = {
            firstName,
            lastName,
            email,
            phone,
            linkedin,
            github,
            portfolio,
            currentLocation,
            applyingLocation,
            jobTitle,
            jobDescription,
            skills: parsedSkills,
            work_experience: parsedWorkExperience,
            experience: experienceNum,
            minExperience: minExperienceNum,
            education,
            resume_text
        };

        // Compute match details
        const matchDetails = await computeMatchDetails(jobTitle, jobDescription, jobSkills, candidateData);

        // Save uploaded resume file path
        if (req.file) {
            candidateData.resume = req.file.path;
        }

        // Save application to MongoDB
        const newApplication = new JobApplication({
            ...candidateData,
            matchDetails,
            status: "Applied",
            appliedAt: new Date()
        });

        await newApplication.save();

        res.status(201).json({
            message: "Application submitted successfully",
            matchDetails
        });
    } catch (error) {
        console.error("Error submitting application:", error);
        res.status(500).json({ error: "Failed to submit application", details: error.message });
    }
});

module.exports = router;
