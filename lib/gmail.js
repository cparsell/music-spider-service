import { getValidGoogleAccessToken } from "./googleTokens.js";

function encodeBase64Url(str) {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Sends an HTML email via the Gmail API, from the connected Google account.
 * @param {object} params {to, subject, html}
 */
export async function sendGmailMessage({ to, subject, html }) {
  const accessToken = await getValidGoogleAccessToken();

  const message = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodeBase64Url(message) }),
    },
  );

  if (!res.ok) {
    // Gmail error bodies are sometimes JSON and sometimes plain text.
    const text = await res.text();
    let errMessage = text;
    try {
      errMessage = JSON.parse(text)?.error?.message || text;
    } catch {
      // not JSON - use the raw text as-is
    }
    throw new Error(`Gmail API error: ${errMessage} (${res.status})`);
  }

  return res.json();
}
