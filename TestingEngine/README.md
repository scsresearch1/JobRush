# TestingEngine

## Load test page

Open **`/load-test`** (e.g. `https://jbrush.netlify.app/load-test`).

**Presets**

| Preset | URL |
|--------|-----|
| **Backend (Render)** | `https://jobrush.onrender.com/api/health` |
| **Frontend (Netlify)** | `https://jbrush.netlify.app/` (GET site root) |
| **Local dev API** | Same-origin or Vite proxy `/api/health` when developing locally |

- **Total requests** and **concurrency** (parallel requests per wave) are configurable.
- Testing the Netlify URL from **localhost** may hit **CORS**; for frontend load, open the load-test page on **jbrush.netlify.app**.
- For true distributed concurrency use **k6** or **Artillery**.

Only run load tests against environments you own.
