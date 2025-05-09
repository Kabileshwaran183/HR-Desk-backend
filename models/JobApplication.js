const mongoose = require("mongoose");

const jobApplicationSchema = new mongoose.Schema({
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    firstName: String,
    lastName: String,
    email: { type: String, required: true },
    phoneNumber: String,
    yearOfGraduation: String,
    gender: String,
    experience: String,
    skills: String,
    location: String,
    pincode: String,
    resume: String, // filename stored
    status: { type: String, default: "Pending" },
}, { timestamps: true });

const JobApplication = mongoose.model("JobApplication", jobApplicationSchema);
module.exports = JobApplication;
