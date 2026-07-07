// Runs once when the Next.js server starts. Used to set up the weekly
// events-digest email check (see lib/emailScheduler.js) - this app has no
// external cron/queue infra, so a simple in-process interval is enough for
// a single-instance, personal-use deployment.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { checkAndSendWeeklyEmail } = await import("./lib/emailScheduler.js");
  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

  setInterval(() => {
    checkAndSendWeeklyEmail().catch((err) =>
      console.error("Weekly email scheduler error:", err),
    );
  }, CHECK_INTERVAL_MS);

  // Also check shortly after startup, in case a week elapsed while the
  // server was down and the next hourly check would otherwise be a while.
  checkAndSendWeeklyEmail().catch((err) =>
    console.error("Weekly email scheduler error:", err),
  );
}
