import { getResolvedConfig } from "@/lib/settings.js";
import HomeClient from "./components/HomeClient";

function isConfigured(config) {
  const hasTautulli = !!(config.tautulliUrl && config.tautulliApiKey);
  const hasSpotify = !!(config.spotifyClientId && config.spotifyClientSecret);
  return hasTautulli || hasSpotify;
}

export default async function Home() {
  const config = await getResolvedConfig();
  return (
    <HomeClient defaultTab={isConfigured(config) ? "events" : "settings"} />
  );
}
