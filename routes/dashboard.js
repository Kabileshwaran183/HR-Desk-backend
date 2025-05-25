// routes/dashboard.js (create this file or add to existing routes)
const express = require("express");
const router = express.Router();
const JobApplication = require("../models/JobApplication");

// GET /api/dashboard/stats
router.get("/stats", async (req, res) => {
    try {
        const totalApplicants = await JobApplication.countDocuments();
        const scheduled = await JobApplication.countDocuments({ status: "Interview Scheduled" });
        const offers = await JobApplication.countDocuments({ status: "Offer Sent" });
        const pending = await JobApplication.countDocuments({ status: "Pending" });

        res.json({
            totalApplicants,
            scheduled,
            offers,
            pending,
        });
    } catch (err) {
        console.error("Error fetching dashboard stats:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
