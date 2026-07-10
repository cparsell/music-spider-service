import { getResolvedConfig } from "@/lib/settings.js";
import HomeClient from "./components/HomeClient";

// getResolvedConfig() reads settings.json from disk, which Next.js's static
// analysis has no way to know changes at runtime (it only auto-detects
// request-specific APIs like cookies()/headers()) - without this, the page
// gets prerendered once at build time and isConfigured()'s result is frozen
// forever, regardless of what's later saved in the Settings tab.
export const dynamic = "force-dynamic";

function isConfigured(config) {
  const hasTautulli = !!(config.tautulliUrl && config.tautulliApiKey);
  const hasSpotify = !!(config.spotifyClientId && config.spotifyClientSecret);
  return hasTautulli || hasSpotify;
}

export default async function Home() {
  const config = await getResolvedConfig();
  return (
    <HomeClient
      defaultTab={isConfigured(config) ? "events" : "settings"}
      isConfigured={isConfigured(config)}
    />
  );
}
