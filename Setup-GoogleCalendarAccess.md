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
