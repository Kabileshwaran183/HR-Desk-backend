const express = require("express");
const router = express.Router();
const multer = require("multer");
const mongoose = require("mongoose");
const stringSimilarity = require("string-similarity");
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

// Helper function to compute TF-IDF vectors
function computeTfIdfVectors(docs) {
    const tfidf = {};
    const docCount = docs.length;

    // Calculate term frequency for each document
    docs.forEach((doc, index) => {
        const terms = doc.toLowerCase().match(/\b\w+\b/g) || [];
        const termFreq = {};
        terms.forEach(term => {
            termFreq[term] = (termFreq[term] || 0) + 1;
        });
        tfidf[index] = termFreq;
    });

    // Calculate document frequency for each term
    const docFreq = {};
    Object.values(tfidf).forEach(termFreq => {
        Object.keys(termFreq).forEach(term => {
            docFreq[term] = (docFreq[term] || 0) + 1;
        });
    });

    // Calculate TF-IDF for each term in each document
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

// Helper function to compute cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
    const intersection = Object.keys(vecA).filter(term => term in vecB);
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    intersection.forEach(term => {
        dotProduct += vecA[term] * vecB[term];
    });

    magA = Math.sqrt(Object.values(vecA).reduce((sum, val) => sum + val * val, 0));
    magB = Math.sqrt(Object.values(vecB).reduce((sum, val) => sum + val * val, 0));

    if (magA === 0 || magB === 0) return 0;

    return dotProduct / (magA * magB);
}

// Helper function to calculate total years of experience from parsedResume work_experience array
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

const axios = require("axios");

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

function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        magA += vecA[i] * vecA[i];
        magB += vecB[i] * vecB[i];
    }
    if (magA === 0 || magB === 0) return 0;
    return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

function tokenize(text) {
    if (!text) return [];
    return text.toLowerCase().match(/\b\w+\b/g) || [];
}

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
    } else {
        candidateExp = parseFloat(candidate.experience) || 0;
    }

    // Check for projects/internships if experience is 0 or empty
    if (candidateExp === 0 && candidate.work_experience && Array.isArray(candidate.work_experience)) {
        const projectKeywords = ["project", "internship", "intern", "training"];
        const workExpText = candidate.work_experience.map(exp => JSON.stringify(exp).toLowerCase()).join(" ");
        const hasProject = projectKeywords.some(keyword => workExpText.includes(keyword));
        if (hasProject) {
            candidateExp = 0.5; // Assign partial experience for projects/internships
        }
    }

    // Treat 0 experience as fresher with minimum 0.5 years
    if (candidateExp === 0) {
        candidateExp = 0.5;
    }

    const requiredExp = parseFloat(candidate.minExperience) || 0;

    let experienceScore = 0;
    if (requiredExp === 0) {
        experienceScore = 100;
    } else if (candidateExp >= requiredExp) {
        experienceScore = 100;
    } else {
        experienceScore = Math.round((candidateExp / requiredExp) * 100);
    }

    // Semantic similarity using OpenAI embeddings if available, else fallback to TF-IDF
    const candidateText = [
        candidate.education || "",
        candidate.work_experience ? (Array.isArray(candidate.work_experience) ? candidate.work_experience.join(" ") : candidate.work_experience) : "",
        candidate.summary || ""
    ].join(" ").toLowerCase();

    const jobText = [jobTitle || "", jobDescription || ""].join(" ").toLowerCase();

    let semanticSimilarity = 0;
    const embeddingJob = await getEmbedding(jobText);
    const embeddingCandidate = await getEmbedding(candidateText);

    if (embeddingJob && embeddingCandidate) {
        semanticSimilarity = cosineSimilarity(embeddingJob, embeddingCandidate);
    } else {
        // Fallback to TF-IDF cosine similarity
        const tfidfVectors = computeTfIdfVectors([jobText, candidateText]);
        semanticSimilarity = cosineSimilarity(tfidfVectors[0], tfidfVectors[1]);
    }

    // Objective score as keyword overlap
    const objectiveText = (candidate.summary || "").toLowerCase();
    const objectiveTokens = new Set(tokenize(objectiveText));
    const jobTokens = new Set(tokenize(jobText));

    let objectiveOverlapCount = 0;
    jobTokens.forEach(token => {
        if (objectiveTokens.has(token)) objectiveOverlapCount++;
    });

    const objectiveScore = jobTokens.size > 0 ? (objectiveOverlapCount / jobTokens.size) * 100 : 0;

    // Skill match score weighted higher with partial credit
    const skillMatchScore = requiredSkills.length > 0 ? ((matchedSkills.length + 0.5 * partiallyMatchedSkills.length) / requiredSkills.length) * 100 : 0;

    // Combine scores: 45% skill match, 40% experience match, 15% semantic similarity (max of objectiveScore and semanticSimilarity)
    const semanticScore = Math.max(objectiveScore / 100, semanticSimilarity) * 100;

    const combinedScore = (0.45 * skillMatchScore) + (0.40 * experienceScore) + (0.15 * semanticScore);

    // Ensure matchPercentage is never zero unless no match at all
    const matchPercentage = combinedScore > 0 ? Math.round(combinedScore) : 1;

    // Generate detailed explanation
    let summary = "";
    if (matchPercentage === 1) {
        summary = "Candidate has minimal or no match with the job requirements.";
    } else {
        summary = `Candidate has relevant skills: ${matchedSkills.join(", ")}.`;
        if (partiallyMatchedSkills.length > 0) {
            summary += ` Partially matched skills: ${partiallyMatchedSkills.join(", ")}.`;
        }
        if (missingSkills.length > 0) {
            summary += ` Missing skills: ${missingSkills.join(", ")}.`;
        }
        summary += ` Experience match score: ${experienceScore}%. Semantic similarity score: ${semanticSimilarity.toFixed(1)}%. Objective match score: ${objectiveScore.toFixed(1)}%.`;
    }

    return {
        matchPercentage,
        skillsMatchScore: skillMatchScore,
        experienceScore,
        semanticScore,
        matchedSkills,
        partiallyMatchedSkills,
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
            jobSkills,
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
            parsedResume,
            minExperience
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

        // Parse jobSkills JSON string if needed
        let jobSkillsArray = [];
        if (jobSkills) {
            try {
                jobSkillsArray = typeof jobSkills === "string" ? JSON.parse(jobSkills) : jobSkills;
            } catch (err) {
                console.error("Error parsing jobSkills JSON:", err);
            }
        }

        // Compute match details
        const candidateData = {
            education: parsedResumeObj.education ? (Array.isArray(parsedResumeObj.education) ? parsedResumeObj.education.map(ed => ed.degree || "").join(" ") : parsedResumeObj.education) : "",
            skills: parsedResumeObj.skills ? (Array.isArray(parsedResumeObj.skills) ? parsedResumeObj.skills.map(s => s.name || s).join(", ") : parsedResumeObj.skills) : skills || "",
            work_experience: parsedResumeObj.work_experience || "",
            summary: parsedResumeObj.summary || "",
            experience: experience,
            minExperience: minExperience
        };

        const matchDetails = await computeMatchDetails(jobTitle, jobDescription, jobSkillsArray, candidateData);

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

// POST: Apply for a job
router.post("/apply", upload.single("resume"), async (req, res) => {
    try {
        let {
            jobId,
            jobDescription,
            jobSkills,
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
            parsedResume,
            minExperience
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

        // Parse jobSkills JSON string if needed
        let jobSkillsArray = [];
        if (jobSkills) {
            try {
                jobSkillsArray = typeof jobSkills === "string" ? JSON.parse(jobSkills) : jobSkills;
            } catch (err) {
                console.error("Error parsing jobSkills JSON:", err);
            }
        }

        // Compute match details
        const candidateData = {
            education: parsedResumeObj.education ? (Array.isArray(parsedResumeObj.education) ? parsedResumeObj.education.map(ed => ed.degree || "").join(" ") : parsedResumeObj.education) : "",
            skills: parsedResumeObj.skills ? (Array.isArray(parsedResumeObj.skills) ? parsedResumeObj.skills.map(s => s.name || s).join(", ") : parsedResumeObj.skills) : skills || "",
            work_experience: parsedResumeObj.work_experience || "",
            summary: parsedResumeObj.summary || "",
            experience: experience,
            minExperience: minExperience
        };

        const matchDetails = computeMatchDetails(jobTitle, jobDescription, jobSkillsArray, candidateData);

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