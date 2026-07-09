const API = window.TV_CONFIG?.apiBase ? `${window.TV_CONFIG.apiBase}/api` : null;

const backendNotice = document.getElementById("backendNotice");

const queueList = document.getElementById("queueList");
const mediaList = document.getElementById("mediaList");
const currentPreview = document.getElementById("currentPreview");
const uploadBtn = document.getElementById("uploadBtn");
const submitBtn = document.getElementById("submit");
const durationInput = document.getElementById("duration");
const durationValue = document.getElementById("durationValue");
const dateText = document.getElementById("liveDate");
const mediaInput = document.getElementById("mediaInput");
const carouselAddBtn = document.getElementById("carouselAddBtn");
const libraryAddBtn = document.getElementById("libraryAddBtn");
const clearQueueBtn = document.getElementById("clearQueueBtn");
const clearLibraryBtn = document.getElementById("clearLibraryBtn");

let uploadMode = "library";

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

function getDurationSec() {
  const value = Number(durationInput.value);
  return value > 0 ? value : 50;
}

function placeholderImg(src) {
  const img = document.createElement("img");
  img.src = src;
  img.alt = "media-box";
  return img;
}

function createDeleteButton(label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "media-delete";
  btn.textContent = "×";
  btn.setAttribute("aria-label", label);
  return btn;
}

function renderMediaElement(media) {
  if (media.type === "video") {
    const video = document.createElement("video");
    video.src = media.url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    return video;
  }
  const img = document.createElement("img");
  img.src = media.url;
  img.alt = media.name;
  return img;
}

function fillPlaceholders(container, className, count) {
  container.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    const card = document.createElement("div");
    card.className = `${className} is-placeholder`;
    card.appendChild(placeholderImg("media/test.png"));
    container.appendChild(card);
  }
}

function updateClock() {
  const now = new Date();
  dateText.textContent = now.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setPreviewMedia(media) {
  currentPreview.innerHTML = "";
  if (media) {
    currentPreview.appendChild(renderMediaElement(media));
  } else {
    currentPreview.appendChild(placeholderImg("media/picture.png"));
  }
}

function showBackendNotice() {
  if (backendNotice) backendNotice.hidden = false;
}

function hideBackendNotice() {
  if (backendNotice) backendNotice.hidden = true;
}

async function loadState() {
  if (!API) {
    showBackendNotice();
    return;
  }
  hideBackendNotice();

  const state = await jsonFetch(`${API}/state`);

  if (state.defaultDurationSec) {
    durationInput.value = state.defaultDurationSec;
    durationValue.textContent = state.defaultDurationSec;
  }

  const currentMedia = state.currentItem
    ? state.media.find((m) => m.id === state.currentItem.mediaId)
    : null;
  setPreviewMedia(currentMedia);

  queueList.innerHTML = "";
  if (!state.queue.length) {
    fillPlaceholders(queueList, "media-queue", 7);
  } else {
    for (const item of state.queue) {
      const media = state.media.find((m) => m.id === item.mediaId);
      if (!media) continue;
      const card = document.createElement("div");
      card.className = "media-queue is-interactive";
      if (item.id === state.currentItemId) card.classList.add("is-live");
      card.dataset.queueId = item.id;
      card.title = "Click to set live";
      card.appendChild(renderMediaElement(media));

      const deleteBtn = createDeleteButton("Remove from carousel");
      deleteBtn.dataset.deleteQueue = item.id;
      card.appendChild(deleteBtn);

      queueList.appendChild(card);
    }
  }

  mediaList.innerHTML = "";
  if (!state.media.length) {
    fillPlaceholders(mediaList, "media-queue2", 7);
  } else {
    for (const media of state.media) {
      const card = document.createElement("div");
      card.className = "media-queue2 is-interactive";
      card.dataset.mediaId = media.id;
      card.title = "Click to add to carousel";
      card.appendChild(renderMediaElement(media));

      const deleteBtn = createDeleteButton("Delete media");
      deleteBtn.dataset.deleteMedia = media.id;
      card.appendChild(deleteBtn);

      mediaList.appendChild(card);
    }
  }
}

async function uploadFile(file, immediate = false) {
  uploadBtn.classList.add("is-loading");
  uploadBtn.textContent = "uploading...";
  try {
    const formData = new FormData();
    formData.append("media", file);
    const media = await jsonFetch(`${API}/upload`, { method: "POST", body: formData });

    if (immediate) {
      await jsonFetch(`${API}/queue/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: media.id, durationSec: getDurationSec(), immediate: true }),
      });
    }

    await loadState();
  } finally {
    uploadBtn.classList.remove("is-loading");
    uploadBtn.textContent = "upload";
  }
}

function openFilePicker(mode) {
  uploadMode = mode;
  mediaInput.click();
}

durationInput.addEventListener("input", () => {
  durationValue.textContent = durationInput.value;
});

uploadBtn.addEventListener("click", () => openFilePicker("immediate"));
carouselAddBtn.addEventListener("click", () => openFilePicker("immediate"));
libraryAddBtn.addEventListener("click", () => openFilePicker("library"));

clearQueueBtn.addEventListener("click", async () => {
  if (!confirm("Clear the entire carousel queue?")) return;
  try {
    await jsonFetch(`${API}/queue/clear`, { method: "POST" });
    await loadState();
  } catch (error) {
    alert(error.message);
  }
});

clearLibraryBtn.addEventListener("click", async () => {
  if (!confirm("Delete all media from the library? This also clears the carousel.")) return;
  try {
    await jsonFetch(`${API}/media/clear-all`, { method: "POST" });
    await loadState();
  } catch (error) {
    alert(error.message);
  }
});

mediaInput.addEventListener("change", async () => {
  const file = mediaInput.files[0];
  if (!file) return;
  try {
    await uploadFile(file, uploadMode === "immediate");
  } catch (error) {
    alert(error.message);
  } finally {
    mediaInput.value = "";
  }
});

mediaList.addEventListener("click", async (e) => {
  const deleteBtn = e.target.closest("[data-delete-media]");
  if (deleteBtn) {
    e.stopPropagation();
    if (!confirm("Delete this media from the library?")) return;
    try {
      await jsonFetch(`${API}/media/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: deleteBtn.dataset.deleteMedia }),
      });
      await loadState();
    } catch (error) {
      alert(error.message);
    }
    return;
  }

  const card = e.target.closest("[data-media-id]");
  if (!card) return;
  try {
    await jsonFetch(`${API}/queue/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId: card.dataset.mediaId, durationSec: getDurationSec() }),
    });
    await loadState();
  } catch (error) {
    alert(error.message);
  }
});

queueList.addEventListener("click", async (e) => {
  const deleteBtn = e.target.closest("[data-delete-queue]");
  if (deleteBtn) {
    e.stopPropagation();
    try {
      await jsonFetch(`${API}/queue/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueItemId: deleteBtn.dataset.deleteQueue }),
      });
      await loadState();
    } catch (error) {
      alert(error.message);
    }
    return;
  }

  const card = e.target.closest("[data-queue-id]");
  if (!card) return;

  try {
    await jsonFetch(`${API}/control/set-current`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queueItemId: card.dataset.queueId }),
    });
    await loadState();
  } catch (error) {
    alert(error.message);
  }
});

submitBtn.addEventListener("click", async () => {
  try {
    await jsonFetch(`${API}/control/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSec: getDurationSec() }),
    });
    submitBtn.classList.add("is-published");
    await loadState();
    setTimeout(() => submitBtn.classList.remove("is-published"), 1500);
  } catch (error) {
    alert(error.message);
  }
});

updateClock();
setInterval(updateClock, 1000);
if (API) {
  loadState().catch(() => showBackendNotice());
  setInterval(() => loadState().catch(() => {}), 4000);
} else {
  showBackendNotice();
}
