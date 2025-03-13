const mongoose = require("mongoose");

const JobApplicationSchema = new mongoose.Schema({
    firstName: String,
    lastName: String
});

const JobApplication = mongoose.model("JobApplication", JobApplicationSchema);
module.exports = JobApplication;
