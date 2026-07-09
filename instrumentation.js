// Runs once when the Next.js server starts. Used to set up periodic
// background checks (weekly events-digest email, top-artists auto-refresh)
// - this app has no external cron/queue infra, so a simple in-process
// interval is enough for a single-instance, personal-use deployment.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { checkAndSendWeeklyEmail } = await import("./lib/emailScheduler.js");
  const { checkAndSendWeeklyWebhook } = await import(
    "./lib/webhookScheduler.js"
  );
  const { checkAndRefreshTopArtists } = await import(
    "./lib/topArtistsRefreshScheduler.js"
  );
  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

  const runChecks = () => {
    checkAndSendWeeklyEmail().catch((err) =>
      console.error("Weekly email scheduler error:", err),
    );
    checkAndSendWeeklyWebhook().catch((err) =>
      console.error("Weekly webhook scheduler error:", err),
    );
    checkAndRefreshTopArtists().catch((err) =>
      console.error("Top artists refresh scheduler error:", err),
    );
  };

  setInterval(runChecks, CHECK_INTERVAL_MS);

  // Also check shortly after startup, in case the interval elapsed while
  // the server was down and the next hourly check would otherwise be a while.
  runChecks();
}
