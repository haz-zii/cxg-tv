(function () {
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const isGitHubPages = host.endsWith("github.io");

  // Local-only setup: run `node server.js` on your machine, then use:
  //   Admin: http://localhost:8080
  //   TV:    http://localhost:8080/tv
  //
  // If you open the GitHub Pages site on the SAME computer while the server
  // is running, this points the UI at your local API:
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
