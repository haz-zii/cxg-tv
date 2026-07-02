# TV Website (Frontend + Backend)

Two separate web apps:

- `frontend/` -> live TV dashboard display (16:9 stage)
- `backend/` -> your styled admin UI (`index.html`, `styles.css`, `media/` assets) + API server

## Features included

- Upload image/video media from backend panel
- Queue media items and control carousel playback
- Frontend dashboard auto-polls and displays current queue item
- Backend UI matches your original styled design
- Frontend display is locked to **16:9** and shows only published queue media

## Run backend

```bash
cd backend
node server.js
```

Backend URLs:

- Admin/control site: `http://localhost:8080/admin`
- API base: `http://localhost:8080/api`

## Run frontend

Use any static web server from `frontend/`. Example with Node:

```bash
cd frontend
node -e "require('http').createServer((req,res)=>{const fs=require('fs');const p=require('path');const f=p.join(process.cwd(),req.url==='/'?'index.html':req.url);fs.readFile(f,(e,d)=>{if(e){res.statusCode=404;res.end('Not found');return;}res.end(d);});}).listen(5173)"
```

Then open:

- `http://localhost:5173`

## Notes

- Data persists in `backend/data/state.json`
- Uploaded media files are saved in `backend/uploads/`
- UI assets (logo, placeholders) are in `backend/media/`
