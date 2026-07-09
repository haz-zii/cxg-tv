# TV Website (Frontend + Backend)

Local-first TV dashboard. Use GitHub to **store and share code** — the app runs on your computer.

## Quick start (local)

```bash
cd backend
node server.js
```

Then open:

| Page | URL |
|------|-----|
| **Admin** (upload, queue, submit) | http://localhost:8080 |
| **TV display** (16:9 carousel) | http://localhost:8080/tv |

That is all you need for full functionality.

## GitHub

Commit the project to GitHub for backup and version control:

```bash
git add .
git commit -m "TV website"
git push
```

**GitHub Pages** (optional) can host the HTML/CSS for preview:

- https://haz-zii.github.io/cxg-tv/tv-website/backend/index.html
- https://haz-zii.github.io/cxg-tv/tv-website/frontend/index.html

GitHub cannot run `server.js`. For upload/queue/TV playback, run `node server.js` locally on the same machine. The config files point GitHub Pages at `http://localhost:8080` when the server is running.

## Project layout

- `backend/` — admin UI + API (`server.js`)
- `frontend/` — TV display (also served at `/tv` when backend runs)
- `backend/uploads/` — uploaded media (not committed; see `.gitignore`)
- `backend/data/state.json` — queue state (not committed)

## Notes

- No third-party hosting required
- Data and uploads stay on your machine
- `package.json` is included if you prefer `npm start` instead of `node server.js`
