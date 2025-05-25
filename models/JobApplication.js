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
    skills: {
        type: [String],  // ✅ This allows an array of strings
        required: true,
      },
    location: String,
    jobTitle: String,
    pincode: String,
    resume: String, // filename stored
    parsedResume: { type: Object, default: {} }, // parsed resume JSON from Affinda
    matchPercentage: { type: Number, default: 0 }, // match percentage score
    status: { type: String, default: "Pending" },
}, { timestamps: true });

const JobApplication = mongoose.model("JobApplication", JobApplicationSchema);
module.exports = JobApplication;
