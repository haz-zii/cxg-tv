(function () {
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const isGitHubPages = host.endsWith("github.io");

  const LOCAL_BACKEND = "http://localhost:8080";

  let apiBase = "";
  if (isLocal) {
    apiBase =
      window.location.port === String(new URL(LOCAL_BACKEND).port || 8080)
        ? window.location.origin
        : LOCAL_BACKEND;
  } else if (isGitHubPages) {
    apiBase = LOCAL_BACKEND.replace(/\/$/, "");
  }

  window.TV_CONFIG = {
    apiBase,
    isGitHubPages,
    isLocalOnly: true,
  };
})();
