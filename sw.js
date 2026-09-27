// Offline support for the installed app. Network first, so updates arrive as
// soon as there is a connection; the cached copy is used when there is none.
// tests/site.test.js checks that FILES lists every public file.
const CACHE = "tic-quest-v1";
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/css/diary.css",
  "./assets/css/feedback.css",
  "./assets/css/game.css",
  "./assets/css/grades.css",
  "./assets/css/presentation.css",
  "./assets/css/styles.css",
  "./assets/css/workspace.css",
  "./assets/images/classroom-stage.webp",
  "./assets/images/icon-192.png",
  "./assets/images/icon-512.png",
  "./assets/images/students-classic.webp",
  "./assets/images/students-extra.webp",
  "./assets/images/teacher-default.webp",
  "./assets/images/teachers.webp",
  "./src/activities.js",
  "./src/app.js",
  "./src/attention.js",
  "./src/audio.js",
  "./src/avatars.js",
  "./src/backup-ui.js",
  "./src/backup.js",
  "./src/diary-data.js",
  "./src/diary.js",
  "./src/dom.js",
  "./src/grades-ui.js",
  "./src/grading.js",
  "./src/hub.js",
  "./src/lesson-log.js",
  "./src/model.js",
  "./src/performance.js",
  "./src/persistence.js",
  "./src/points.js",
  "./src/presentation-dom.js",
  "./src/presentation.js",
  "./src/raffle.js",
  "./src/roster.js",
  "./src/storage.js",
  "./src/students.js",
  "./src/teacher.js",
  "./src/teams.js",
  "./src/theme.js",
  "./src/utils.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== location.origin
  )
    return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })),
  );
});
