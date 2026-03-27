# Project Bridge

Project Bridge is a lightweight full-stack collaboration site for doctors and engineers. It includes:

- A polished frontend with two themes:
  - `Earth Canvas`: brown, green, and warm white as the calm default mode
  - `Neon Pulse`: blue and purple contrast with a glowing presentation style
- A backend API for:
  - viewing users, projects, and project rooms
  - posting new projects
  - adding friends to a network
  - opening focused project rooms
  - sending room messages
- JSON file persistence so changes remain after refresh

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

## Notes

- This is an MVP without authentication.
- Data is stored in `data/db.json`.
- The app is built with Node's built-in modules, so there are no external package dependencies to install.
