import { getResolvedConfig } from "@/lib/settings.js";
import { sendGmailMessage } from "@/lib/gmail.js";

// Sends a trivial test email, independent of whether there are any upcoming
// events - lets a user confirm their OAuth connection or Apps Script
// webhook is wired up correctly without waiting on real event data.
export async function POST() {
  const config = await getResolvedConfig();
  if (!config.emailRecipient) {
    return Response.json(
      { error: "No recipient email configured in Settings" },
      { status: 400 },
    );
  }

  try {
    await sendGmailMessage({
      to: config.emailRecipient,
      subject: "Music Spider test email",
      html: "<p>This is a test email from Music Spider. If you got this, email sending is working.</p>",
    });
    return Response.json({ sent: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
