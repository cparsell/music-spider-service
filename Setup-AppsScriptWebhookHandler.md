### Setting up the Apps Script webhook

This is the simpler of the two Google options — no Cloud project, OAuth client, or HTTPS required on Music Spider's end. The script runs under your own Google account and Google hosts the endpoint for you.

1. Go to [script.google.com](https://script.google.com), create a new project, and replace the default `Code.gs` contents with this repo's [`apps-script/Code.gs`](apps-script/Code.gs).
2. **Deploy > New deployment**, select type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
3. Copy the resulting web app URL (ends in `/exec`) into Music Spider's Settings, under **Google (Email & Calendar) > Apps Script Webhook URL**, with **Apps Script Webhook** selected as the integration method.
4. **(Recommended) Set a shared secret** so a leaked or guessed webapp URL can't be used to send mail or create events on your behalf: in the Apps Script project, go to **Project Settings > Script Properties**, add a property named `SHARED_SECRET` with a value of your choosing, and enter that same value into Music Spider's **Apps Script Shared Secret** field. Leave both blank to skip this check.

If you ever edit the script afterward, redeploy via **Deploy > Manage deployments > edit (pencil icon) > New version** — otherwise the live URL keeps running the old code.

---

[Back to README](https://github.com/cparsell/music-spider-service/blob/main/README.md)
