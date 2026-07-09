/**
 * Music Spider - Apps Script webapp.
 *
 * An alternative to connecting a Google account via OAuth: this script runs
 * under your own Google account and exposes a single webhook URL that Music
 * Spider posts to for both sending email and creating Calendar events. No
 * Google Cloud project, OAuth client, redirect URI, or HTTPS on Music
 * Spider's own end is required - Google hosts this endpoint for you.
 *
 * Setup:
 *
 *   1. Go to https://script.google.com, create a new project, and replace
 *      the default Code.gs contents with this file.
 *
 *   2. Deploy > New deployment > select type "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone
 *
 *   3. Copy the resulting web app URL (ends in /exec) into Music Spider's
 *      Settings tab, under Google (Email & Calendar) > Apps Script Webhook
 *      URL, with "Apps Script Webhook" selected as the integration mode.
 *
 *   4. (Optional but recommended) In this project's Project Settings >
 *      Script Properties, add a property named SHARED_SECRET with a value
 *      of your choosing, and enter the same value into Music Spider's
 *      "Apps Script Shared Secret" field. This stops anyone who guesses or
 *      leaks your webapp URL from sending mail or creating events through
 *      it. Leave both blank to skip this check.
 *
 * If you ever change this script, redeploy via Deploy > Manage deployments
 * > edit (pencil icon) > New version, otherwise the live URL keeps running
 * the old code.
 */

function doPost(e) {
  var result;
  try {
    var payload = JSON.parse(e.postData.contents);
    assertSecret_(payload.secret);

    if (payload.type === "email") {
      result = sendEmail_(payload);
    } else if (payload.type === "calendar") {
      result = createCalendarEvent_(payload);
    } else {
      throw new Error("Unknown type: " + payload.type);
    }
  } catch (err) {
    return jsonResponse_({
      ok: false,
      error: String((err && err.message) || err),
    });
  }
  return jsonResponse_(Object.assign({ ok: true }, result));
}

function assertSecret_(provided) {
  var expected =
    PropertiesService.getScriptProperties().getProperty("SHARED_SECRET");
  if (expected && provided !== expected) {
    throw new Error("Invalid or missing secret");
  }
}

function sendEmail_(payload) {
  if (!payload.to) throw new Error("Missing 'to'");
  MailApp.sendEmail({
    to: payload.to,
    subject: payload.subject || "",
    body: payload.html || "", // plain-text fallback for clients that ignore htmlBody
    htmlBody: payload.html || "",
  });
  return {};
}

function createCalendarEvent_(payload) {
  var calendar = payload.calendarId
    ? CalendarApp.getCalendarById(payload.calendarId)
    : CalendarApp.getDefaultCalendar();
  if (!calendar) {
    throw new Error("Calendar not found: " + payload.calendarId);
  }
  if (!payload.summary || !payload.start) {
    throw new Error("Missing 'summary' or 'start'");
  }

  var start = new Date(payload.start);
  var end = new Date(start.getTime() + 3 * 60 * 60 * 1000); // 3 hours, matching Music Spider's own default

  var description = payload.description || "";
  if (payload.url) {
    description += (description ? "\n\n" : "") + "Tickets: " + payload.url;
  }

  var event = calendar.createEvent(payload.summary, start, end, {
    description: description,
    location: payload.location || "",
  });

  return { id: event.getId() };
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
