/* email.js - builds the weekly email and sends it via Gmail SMTP.
Sending requires the Worker runtime; the builder part is pure and Node-testable. */

import { buildDigest } from "./digest.js";
import { buildMime } from "./mime.js";

const FOOTER_HTML =
  '<p style="color:#667;margin-top:24px;font-size:11px;">' +
  "Generated automatically by the moisturizer-watch pipeline. " +
  "Values not verified are reported as unknown.</p>";

const FOOTER_TEXT =
  "\n--\nGenerated automatically by the moisturizer-watch pipeline. " +
  "Values not verified are reported as unknown.";

export function buildEmail(report) {
  const d = buildDigest(report);
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;' +
    'color:#233;line-height:1.5;">' + d.html + FOOTER_HTML + "</div>";
  return {
    subject: d.subject,
    html,
    text: d.text + FOOTER_TEXT,
  };
}

export async function sendGmail({ sender, recipient, appPassword, subject, html, text }) {
  const { sendSmtp } = await import("./smtp.js");
  const message = buildMime({ from: sender, to: recipient, subject, html, text });
  return sendSmtp({
    host: "smtp.gmail.com",
    port: 465,
    user: sender,
    password: appPassword,
    from: sender,
    to: recipient,
    message,
  });
}