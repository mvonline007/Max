# Max — Tracker (Vercel-ready)

**One-click deploy on Vercel:**
1) Go to https://vercel.com/new
2) Click **Upload** (top-right) and **drag & drop** this folder (unzipped), or push it to Git and import the repo.
3) Vercel auto-detects **Next.js**. Keep defaults: Build = `next build`, Output = `.next`.
4) **Deploy.**

No environment vars. Uses localStorage only.

Tech:
- Next.js App Router (client page)
- TailwindCSS
- Recharts

Files of interest:
- `app/MaxApp.jsx` — your app (wrapped from your JSX file)
- `app/page.jsx` — renders the app
- `app/layout.jsx` + `app/globals.css` — Tailwind wiring


## Repository
Name: **Max**
