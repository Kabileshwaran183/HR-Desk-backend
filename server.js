require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const dotenv = require("dotenv");
const authRoutes = require("./routes/auth");
const jobApplicationRoutes = require("./routes/jobApplicationRoutes");
const JobApplication = require("./models/JobApplication");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));

// Auth Routes
app.use("/api/auth", authRoutes);

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "uploads"));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});
const upload = multer({ storage });

// Nodemailer transporter with OAuth2
async function createTransporter() {
    try {
        const accessToken = await oAuth2Client.getAccessToken();
        return nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: process.env.SENDER_EMAIL,
                clientId: process.env.CLIENT_ID,
                clientSecret: process.env.CLIENT_SECRET,
                refreshToken: process.env.REFRESH_TOKEN,
                accessToken: accessToken.token,
            },
        });
    } catch (err) {
        console.error("❌ Failed to create email transporter:", err);
        return null;
    }
}

// Routes
app.get("/", (req, res) => {
    res.send("Job Application API is running 🚀");
});

// Get all job applications
app.get("/api/jobapplications", async (req, res) => {
    try {
        const apps = await JobApplication.find().sort({ createdAt: -1 });
        res.json(apps);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch applications" });
    }
});


// Register jobApplicationRoutes
app.use("/api/jobapplications", jobApplicationRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
