const mongoose = require("mongoose");

const JobApplicationSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    yearOfGraduation: { type: Number, required: true },
    gender: { type: String, required: true },
    experience: { type: String, required: true },
    skills: { type: String, required: true },
    location: { type: String, required: true },
    pincode: { type: String, required: true },
    jobTitle: { type: String, required: true },
    resume: { type: String, required: true },
    status: { type: String, default: "Pending" }
}, { timestamps: true });

const JobApplication = mongoose.model("JobApplication", JobApplicationSchema);
module.exports = JobApplication;
