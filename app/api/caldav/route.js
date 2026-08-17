import { getResolvedConfig } from "@/lib/settings.js";
import { isCalDavConfigured, verifyCalDavAccess } from "@/lib/caldav.js";

// Reports whether CalDAV is enabled/configured, so Settings can show status
// without requiring a manual "Verify" click first.
export async function GET() {
  const config = await getResolvedConfig();
  return Response.json({
    enabled: !!config.caldavEnabled,
    configured: isCalDavConfigured(config),
    url: config.caldavUrl || "",
  });
}

// Checks the URL/credentials actually work, without creating an event.
export async function POST() {
  const config = await getResolvedConfig();
  if (!isCalDavConfigured(config)) {
    return Response.json(
      { error: "CalDAV isn't enabled and configured in Settings." },
      { status: 400 },
    );
  }

  try {
    const { url } = await verifyCalDavAccess(config);
    return Response.json({ ok: true, url });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
