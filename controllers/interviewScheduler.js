const nodemailer = require("nodemailer");
const { google } = require("googleapis");

const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GOOGLE_REFRESH_TOKEN,
    GMAIL_USER,
} = process.env;

const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

const sendInterviewEmailAndCalendarInvite = async (applicant, date, ranking) => {
    try {
        const accessToken = await oAuth2Client.getAccessToken();

        const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
        const event = {
            summary: `Interview with ${applicant.firstName} ${applicant.lastName}`,
            location: "Google Meet",
            description: `Interview for ${applicant.jobTitle}. Ranking: ${ranking}`,
            start: { dateTime: new Date(date), timeZone: "Asia/Kolkata" },
            end: {
                dateTime: new Date(new Date(date).getTime() + 30 * 60 * 1000),
                timeZone: "Asia/Kolkata",
            },
            attendees: [{ email: applicant.email }],
            conferenceData: {
                createRequest: {
                    requestId: `interview-${Date.now()}`,
                    conferenceSolutionKey: { type: "hangoutsMeet" },
                },
            },
        };

        const eventResponse = await calendar.events.insert({
            calendarId: "primary",
            resource: event,
            conferenceDataVersion: 1,
        });

        const meetLink = eventResponse.data.hangoutLink;

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: GMAIL_USER,
                clientId: GOOGLE_CLIENT_ID,
                clientSecret: GOOGLE_CLIENT_SECRET,
                refreshToken: GOOGLE_REFRESH_TOKEN,
                accessToken: accessToken.token,
            },
        });

        const mailOptions = {
            from: `HR Team <${GMAIL_USER}>`,
            to: applicant.email,
            subject: "Interview Scheduled",
            html: `
        <h3>Hi ${applicant.firstName},</h3>
        <p>Your interview for the position of <strong>${applicant.jobTitle}</strong> has been scheduled.</p>
        <p><strong>Date:</strong> ${new Date(date).toLocaleString()}</p>
        <p><strong>Join via Google Meet:</strong> <a href="${meetLink}">${meetLink}</a></p>
        <p><strong>Ranking:</strong> ${ranking}</p>
      `,
        };

        await transporter.sendMail(mailOptions);
        return { success: true, meetLink };
    } catch (err) {
        console.error("❌ Error scheduling interview:", err);
        throw err;
    }
};

module.exports = { sendInterviewEmailAndCalendarInvite };
