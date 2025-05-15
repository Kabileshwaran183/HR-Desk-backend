const mongoose = require("mongoose");

const JobApplicationSchema = new mongoose.Schema({
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
    jobTitle:String,
    pincode: String,
    jobTitle: String,
    resume: String, // filename stored
    status: { type: String, default: "Pending" },
}, { timestamps: true });

const JobApplication = mongoose.model("JobApplication", JobApplicationSchema);
module.exports = JobApplication;
