const express = require("express");
const JobApplication = require("../models/JobApplication");

const router = express.Router();

// 📌 POST route to save job application (only name for now)
router.post("/jobapplications", async (req, res) => {
    console.log("Received Data:", req.body); // Add this line
    try {
        const newApplication = new JobApplication(req.body);
        await newApplication.save();
        res.status(201).json({ success: true, message: "Application Submitted!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
