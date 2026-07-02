const API = "http://localhost:8080/api";
const MEDIA_BASE = "http://localhost:8080";

const videoPlayer = document.getElementById("videoPlayer");
const imagePlayer = document.getElementById("imagePlayer");

let currentItemId = null;
let slideTimer = null;

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function clearSlideTimer() {
  if (slideTimer) {
    clearTimeout(slideTimer);
    slideTimer = null;
  }
}

function showMedia(media) {
  if (!media) {
    videoPlayer.style.display = "none";
    imagePlayer.style.display = "none";
    videoPlayer.removeAttribute("src");
    imagePlayer.removeAttribute("src");
    return;
  }

  const url = `${MEDIA_BASE}${media.url}`;

  if (media.type === "video") {
    imagePlayer.style.display = "none";
    imagePlayer.removeAttribute("src");
    videoPlayer.style.display = "block";
    if (videoPlayer.src !== url) {
      videoPlayer.src = url;
    }
    videoPlayer.play().catch(() => {});
  } else {
    videoPlayer.pause();
    videoPlayer.style.display = "none";
    videoPlayer.removeAttribute("src");
    imagePlayer.style.display = "block";
    imagePlayer.src = url;
  }
}

function scheduleNext(durationSec) {
  clearSlideTimer();
  if (!durationSec) return;
  slideTimer = setTimeout(async () => {
    try {
      await jsonFetch(`${API}/control/next`, { method: "POST" });
      await refresh();
    } catch {
      /* retry on next poll */
    }
  }, durationSec * 1000);
}

async function refresh() {
  const state = await jsonFetch(`${API}/state`);
  const queueItem = state.currentItem;
  const media = queueItem ? state.media.find((m) => m.id === queueItem.mediaId) : null;

  if (!queueItem) {
    currentItemId = null;
    clearSlideTimer();
    showMedia(null);
    return;
  }

  if (queueItem.id !== currentItemId) {
    currentItemId = queueItem.id;
    showMedia(media);
    scheduleNext(queueItem.durationSec);
  }
}

refresh().catch(() => {});
setInterval(() => refresh().catch(() => {}), 3000);
