import {
  formatDateString,
  formatTimeAs12HourWithoutMinutes,
} from "./common.js";
import { formatActsList } from "./formatActs.js";

const SERVICE_NAME = "Music Spider";
const LOGO_URL = "https://i.postimg.cc/xjv4nbBV/music-spider-logo-nobg.png";

function eventCell(event, knownArtists) {
  const acts = event.acts || [];
  const eNameLower = (event.eName || "").toLowerCase();
  const otherActs = acts.filter((a) => !eNameLower.includes(a.toLowerCase()));
  const actsLine = formatActsList(otherActs, knownArtists, 9);

  const dates = event.dates || [];
  const primaryUrl = dates[0]?.urls?.[0]?.url || "#";

  let cell = `<td class="tg-0lax" style="height:300px;vertical-align:top;"><div style="text-align: left;margin-left: 10px;">`;

  if (event.image) {
    cell += `<div><a href="${primaryUrl}">`;
    cell += `<img src="${event.image}" style="width:90%;float:center;object-position:top;width:350px;height:200px;object-fit:cover;"/></a></div>`;
  }

  cell += `<span style="font-family: Averta,Helvetica Neue,Helvetica,Arial,sans-serif;">`;
  cell += `<a href="${primaryUrl}" style="text-decoration:none;"><span style="color:#44494c;font-size:20px;"><strong>${event.eName || ""}</strong></span></a><br/>`;

  if (actsLine) {
    cell += `with ${actsLine}<br/>`;
  }

  cell += `<span style="color:#696969;font-size:12px;font-family:georgia,times,times new roman,serif;">at ${event.venue || ""}${event.city ? `, ${event.city}` : ""}<br/> `;

  dates.forEach((d, i) => {
    const dDate = new Date(d.date);
    const dateLine = formatDateString(dDate);
    const timeLine = formatTimeAs12HourWithoutMinutes(dDate, true);
    if (i > 0) cell += `<br/>`;
    cell += `<strong>${dateLine}</strong> ${timeLine}`;
    (d.urls || []).forEach((u) => {
      cell += ` - <a href="${u.url}" style="text-decoration:none;color:#696969;">${u.name}</a>`;
    });
  });

  cell += `</span></span>`;
  cell += `</div><br/></td>`;
  return cell;
}

/**
 * Builds the HTML body for an events digest email, styled to match the
 * original Music Spider Apps Script email template (2-column event grid).
 * @param {array} events
 * @param {Set<string>|string[]} [knownArtists] artists from the user's own
 *   lists, shown first in each event's act list (see formatActsList)
 */
export function buildEventsEmailHtml(events, knownArtists) {
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
    html += eventCell(event, knownArtists);
    if (i % 2 !== 0) html += `</tr><br/>`;
  });
  if (events.length % 2 !== 0) html += `</tr>`;

  html += `<br/></tbody></table></td></tr></tbody></table>`;
  return html;
}

/**
 * Builds the email subject line: service name + one act (or event name)
 * from each event, deduplicated - matches the original template's approach.
 * Prefers an act from the user's own lists over an unrelated opener/co-bill.
 * @param {array} events
 * @param {Set<string>|string[]} [knownArtists]
 */
export function buildEventsEmailSubject(events, knownArtists) {
  const known =
    knownArtists instanceof Set ? knownArtists : new Set(knownArtists || []);
  const acts = [];
  for (const event of events) {
    if (event.acts?.length) {
      acts.push(event.acts.find((a) => known.has(a)) || event.acts[0]);
    } else if (event.eName) {
      acts.push(event.eName);
    }
  }
  const uniqueActs = [...new Set(acts)];
  return `${SERVICE_NAME} - ${uniqueActs.join(", ")}`.slice(0, 249);
}
