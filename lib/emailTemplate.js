import {
  formatDateString,
  formatTimeAs12HourWithoutMinutes,
} from "./common.js";

const SERVICE_NAME = "Music Spider";
const LOGO_URL = "https://i.postimg.cc/xjv4nbBV/music-spider-logo-nobg.png";

function eventCell(event) {
  const acts = event.acts || [];
  const eNameLower = (event.eName || "").toLowerCase();
  const otherActs = acts.filter((a) => !eNameLower.includes(a.toLowerCase()));

  const primaryUrl = event.urls?.[0]?.url || "#";
  const secondaryUrl = event.urls?.[1]?.url;

  const eventDate = new Date(event.date);
  const dateLine = formatDateString(eventDate);
  const timeLine = formatTimeAs12HourWithoutMinutes(eventDate, true);

  let cell = `<td class="tg-0lax" style="height:300px;vertical-align:top;"><div style="text-align: left;margin-left: 10px;">`;

  if (event.image) {
    cell += `<div><a href="${primaryUrl}">`;
    cell += `<img src="${event.image}" style="width:90%;float:center;object-position:top;width:350px;height:200px;object-fit:cover;"/></a></div>`;
  }

  cell += `<span style="font-family: Averta,Helvetica Neue,Helvetica,Arial,sans-serif;">`;
  cell += `<a href="${primaryUrl}" style="text-decoration:none;"><span style="color:#44494c;font-size:20px;"><strong>${event.eName || ""}</strong></span></a><br/>`;

  if (otherActs.length) {
    cell += `with ${otherActs.slice(0, 6).join(", ")}`;
    if (otherActs.length > 6) cell += `...`;
    cell += `<br/>`;
  }

  cell += `<span style="color:#696969;font-size:12px;font-family:georgia,times,times new roman,serif;">at ${event.venue || ""}${event.city ? `, ${event.city}` : ""}<br/> `;
  cell += `<strong>${dateLine}</strong> ${timeLine}</span></span>`;

  if (secondaryUrl) {
    cell += `<br><span><a href="${secondaryUrl}" style="text-decoration:none;color:#696969;font-size:11px;font-family:georgia,times,times new roman,serif;">Tickets also available here</a></span></br>`;
  }

  cell += `</div><br/></td>`;
  return cell;
}

/**
 * Builds the HTML body for an events digest email, styled to match the
 * original Music Spider Apps Script email template (2-column event grid).
 * @param {array} events
 */
export function buildEventsEmailHtml(events) {
  let html = `<style type="text/css">
    .tg { border-collapse:collapse; border-spacing:0; }
    .tg td { border-color:black; border-style:solid; border-width:1px; font-family:georgia,times,times new roman,serif; font-size:14px; overflow:hidden; padding:5px 5px; word-break:normal; }
    .tg th { border-color:black; border-style:solid; border-width:1px; font-family:georgia,times,times new roman,serif; font-size:14px; font-weight:normal; overflow:hidden; padding:5px 5px; word-break:normal; }
    .tg .tg-0lax { text-align:left; vertical-align:top; }
  </style>`;
  html += `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:0;border-spacing:0px;padding:0;margin:0;width:100%;background-repeat:repeat;background-position:center top;background-color:#f8f8f8;">`;
  html += `<tbody><tr style="border-collapse: collapse;"><td valign="top" style="padding: 0;Margin: 0;">`;
  html += `<table class="tg" align="center" style="border-collapse: collapse;border-spacing: 0px;background-color: #ffffff;width: 750px;"><thead>`;
  html += `<tr><td colspan=2><div style="text-align: center;"><br/><br/>`;
  html += `<img src="${LOGO_URL}" height="22%" width="22%"/><br>`;
  html += `<span style="font-family:helvetica, sans-serif;font-size:30px;color:#e9e9e9;">`;
  html += `<strong>${SERVICE_NAME.toLowerCase()}</strong><br><br></span></div></td></tr></thead>`;
  html += `<tbody>`;

  events.forEach((event, i) => {
    if (i % 2 === 0) html += `<tr>`;
    html += eventCell(event);
    if (i % 2 !== 0) html += `</tr><br/>`;
  });
  if (events.length % 2 !== 0) html += `</tr>`;

  html += `<br/></tbody></table></td></tr></tbody></table>`;
  return html;
}

/**
 * Builds the email subject line: service name + first act (or event name)
 * from each event, deduplicated - matches the original template's approach.
 * @param {array} events
 */
export function buildEventsEmailSubject(events) {
  const acts = [];
  for (const event of events) {
    if (event.acts?.length) acts.push(event.acts[0]);
    else if (event.eName) acts.push(event.eName);
  }
  const uniqueActs = [...new Set(acts)];
  return `${SERVICE_NAME} - ${uniqueActs.join(", ")}`.slice(0, 249);
}
