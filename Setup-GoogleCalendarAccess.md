## Giving Music Spider access to a Google Calendar

1. First, create a project at [GCP](https://console.cloud.google.com).
2. Make sure `Google Calendar API` is enabled in that project (`APIs & Services` → `Library`)
3. Go to [Service Accounts in GCP](https://console.cloud.google.com/iam-admin/serviceaccounts) and confirm that this project you made is selected.
4. **+ Create service account**.
5. Name it something like `music-spider-calendar`.
6. Create and continue → on `Grant this service account access to project`, click `Continue`. Don't assign any IAM role. Calendar permission does not come from IAM here; it comes from sharing the calendar. Skip the third step too, and click `Done`.
7. Click into the new account → `Keys` tab → `Add` key → `Create new key` → `JSON`. It downloads immediately. This file is the only copy Google will give you.
8. At [Google Calendar](https://calendar.google.com), hover the calendar you want in the left sidebar → `⋮` → `Settings and sharing` → `Share with specific people or groups` → `Add people` → **paste the service account email** → **set permission to Make changes to events** → `Send`.
9. While on that same settings page, scroll to `Integrate calendar` and **copy the Calendar ID**. For your main calendar that's just your Gmail address. This will go in the `Calendar ID` setting — as noted, primary will silently write to the service account's own calendar instead of yours.

### Setting it up in Music Spider

10. In Music Spider, go to `Settings` → `Notification` → **Google Calendar (Service Account)**.
11. Check **Use a service account for Google Calendar events**.
12. Paste the contents of the JSON key file into **Service account key**. If you'd rather not paste a private key into the UI, put the file somewhere the container can read it (e.g. mount it at `/config/service-account.json`) and enter that path instead. Either can also be supplied through the `GOOGLE_SERVICE_ACCOUNT_JSON` env var. Once saved, the key is hidden in the UI behind a `Replace` / `Clear` control. The service account's email address will be shown below it so you can confirm.
13. Paste the **Calendar ID** from step 9. This is required - leaving it blank (or setting it to `primary`) would write to the service account's own calendar, which you can't see.
14. Click **Verify Calendar Access** to confirm the key works and the calendar is actually shared with the service account, then **Create Test Calendar Event** to write a real (deletable) event to it.
15. Check **Add all events to Google Calendar** if you want every newly found event synced automatically. With it off, events can still be added one at a time from the Events tab.

Notes:

- Service account mode only covers **calendar events**. Sending email still goes through SMTP, OAuth, or the Apps Script webhook — a service account can't send Gmail without domain-wide delegation.
- While it's enabled, calendar events use the service account even if `googleIntegrationMode` is set to OAuth or Apps Script. Uncheck it to go back to the other method.
- The app only ever requests the `calendar.events` scope, so the service account can only touch calendars you've explicitly shared with it.
