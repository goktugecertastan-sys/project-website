# Project Bridge

Project Bridge is a lightweight full-stack collaboration site for professionals across disciplines. It includes:

- A polished premium frontend with auth, multiple sections, and three themes:
  - `Neon Pulse`
  - `Earth Canvas`
  - `Citrus Tide`
- A backend API for:
  - login and registration
  - viewing users, projects, and project rooms
  - posting new projects
  - adding friends to a network
  - opening focused project rooms
  - sending room messages
- JSON-backed local data storage

## Run it

```bash
npm start
```

Then open `http://localhost:3000`.

## Project structure

```text
.
├── data/db.json
├── lib/store.js
├── public/app.js
├── public/index.html
├── public/styles.css
├── server.js
└── package.json
```

## Deploy to Vercel

- The project is now Vercel-ready with:
  - [api/index.js](./api/index.js) as the serverless entry
  - [vercel.json](./vercel.json) routing all requests through the same app handler
- Push the repo to GitHub, import it into Vercel, and deploy with the default settings.

## Notes

- Local development stores data in [data/db.json](./data/db.json).
- On Vercel, data is copied into `/tmp/project-bridge-db.json` at runtime.
- Vercel file storage is temporary, so new accounts, messages, and projects are not permanently persisted between cold starts or redeploys.
- The app is built with Node's built-in modules, so there are no external package dependencies to install.
