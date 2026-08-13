import { getResolvedConfig } from "@/lib/settings.js";
import {
  isServiceAccountEnabled,
  loadServiceAccountKey,
  verifyCalendarAccess,
} from "@/lib/googleServiceAccount.js";

// Reports what the configured service account key looks like, so Settings
// can show the address the user needs to share their calendar with.
export async function GET() {
  const config = await getResolvedConfig();
  const enabled = !!config.googleServiceAccountEnabled;
  const calendarId =
    config.googleServiceAccountCalendarId || config.calendarId || "";

  if (!(config.googleServiceAccountJson || "").trim()) {
    return Response.json({ enabled, configured: false, calendarId });
  }

  try {
    const key = await loadServiceAccountKey(config);
    return Response.json({
      enabled,
      configured: true,
      clientEmail: key.client_email,
      projectId: key.project_id || "",
      calendarId,
    });
  } catch (err) {
    return Response.json({
      enabled,
      configured: false,
      calendarId,
      error: err.message,
    });
  }
}

// Checks the key actually works and the calendar is shared with it,
// without creating an event.
export async function POST() {
  const config = await getResolvedConfig();
  if (!isServiceAccountEnabled(config)) {
    return Response.json(
      { error: "Service account calendar access isn't enabled in Settings." },
      { status: 400 },
    );
  }

  try {
    const { clientEmail, calendarId } = await verifyCalendarAccess(config);
    return Response.json({ ok: true, clientEmail, calendarId });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
