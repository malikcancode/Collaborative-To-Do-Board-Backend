const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER, // your Gmail
    pass: process.env.MAIL_PASS, // App password if 2FA enabled
  },
});

const sendMail = async ({ to, subject, text, html }) => {
  try {
    console.log("Sending email to:", to); // log recipient
    const info = await transporter.sendMail({
      from: `"Task Manager" <${process.env.MAIL_USER}>`, // sender display
      to,
      subject,
      text,
      html,
    });
    console.log("Email sent:", info.messageId);
    return info;
  } catch (err) {
    console.error("Email sending error:", err);
    throw err;
  }
};

module.exports = sendMail;
