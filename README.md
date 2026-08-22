# linkedin-jd-intelligence

> 🤖 This repo is built with AI-assisted coding (Claude Code).

Chrome browser extension: Smart LinkedIn JD intelligence.

Not affiliated with, endorsed by, or sponsored by LinkedIn Corporation.

Full design (architecture, diagrams, data model, algorithms) lives in
[`docs/DESIGN.md`](docs/DESIGN.md). For a guided tour of the code — the file layout and how a click
on "Analyze" actually flows end to end — see [`src/README.md`](src/README.md).

## Build & load

```
npm install
npm run build      # tsc --noEmit && vite build -> dist/
```

Then `chrome://extensions` → Developer mode → "Load unpacked" → select `dist/`.

## Screenshots

| Skill / experience match | Settings — resumes, model, block list |
|---|---|
| ![Skill match against a resume, with company & role brief](docs/screenshots/linkedin-jd-int-screenshot-fullpage-2-skillmatch.png) | ![Settings page: API key, resume profiles, blocked companies/jobs, keyword blocks](docs/screenshots/linkedin-jd-int-screenshot-settings.png) |

![Interview process and footer actions](docs/screenshots/linkedin-jd-int-screenshot-section-interview-rounds.png)
