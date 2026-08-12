## Giving Music Spider access to a Google Calendar

1. First, create a project at [GCP](https://console.cloud.google.com).
2. Go to [Service Accounts in GCP](https://console.cloud.google.com/iam-admin/serviceaccounts) and confirm that this project you made is selected.
3. **+ Create service account**.
4. Name it something like `music-spider-calendar`.
5. Create and continue → on `Grant this service account access to project`, click `Continue`. Don't assign any IAM role. Calendar permission does not come from IAM here; it comes from sharing the calendar. Skip the third step too, and click `Done`.
6. Click into the new account → `Keys` tab → `Add` key → `Create new key` → `JSON`. It downloads immediately. This file is the only copy Google will give you.
7. At [Google Calendar](https://calendar.google.com), hover the calendar you want in the left sidebar → `⋮` → `Settings and sharing` → `Share with specific people or groups` → `Add people` → **paste the service account email** → **set permission to Make changes to events** → `Send`.
