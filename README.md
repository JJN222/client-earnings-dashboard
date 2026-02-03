# Client Earnings Dashboard

A clean, minimal dashboard for tracking monthly YouTube and Facebook earnings across clients.

## Quick Deploy to Railway (5 minutes)

### Step 1: Create a GitHub Repository

1. Go to [github.com](https://github.com) and create a new repository
2. Name it something like `client-earnings-dashboard`
3. Keep it private if you don't want the data public

### Step 2: Push This Code to GitHub

Download this folder, then in your terminal:

```bash
cd client-dashboard
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/client-earnings-dashboard.git
git push -u origin main
```

### Step 3: Deploy to Railway

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Pick your `client-earnings-dashboard` repository
5. Railway auto-detects Vite and starts deploying
6. Once deployed, go to **Settings → Networking → Generate Domain**

Your dashboard will be live at something like: `client-earnings-dashboard-production.up.railway.app`

---

## How to Use

### For Viewers (your team)
Just share the URL. They'll see the dashboard with current data.

### For Admin (you)
Access admin mode by either:
- Adding `?admin=true` to the URL
- Clicking the tiny dot (•) in the bottom-right corner and entering the password

**Default password:** `shorthand2026`

To change the password, edit `src/App.jsx` and find these two lines:
```javascript
return params.get('admin') === 'true' || params.get('key') === 'shorthand2026';
// and
if (passwordInput === 'shorthand2026')
```

---

## Updating Data Each Month

### Option A: Quick Update (Admin Only Sees New Data)
1. Go to admin mode
2. Upload your CSVs
3. Data saves to your browser's localStorage
4. ⚠️ Only YOU see this data — your team sees the default data

### Option B: Update for Everyone (Recommended)
1. Go to admin mode
2. Upload your CSVs
3. Click **"Export Data"** — this copies the data as JSON
4. Open `src/App.jsx`
5. Replace the `INITIAL_DATA` object (around line 15) with the exported JSON
6. Commit and push to GitHub
7. Vercel auto-deploys — everyone sees the new data!

```javascript
// Replace this section in src/App.jsx:
const INITIAL_DATA = {
  // Paste your exported JSON here
};
```

---

## Adding New Platforms

When you're ready to add TikTok, Snapchat, etc.:

1. Add a new parser function in `src/App.jsx` (follow the pattern of `parseYoutubeCSV`)
2. Add the platform to the `detectFileType` function
3. Add a new button in the platform selector
4. Add the platform to the combined totals and charts

---

## Local Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`

---

## File Structure

```
client-dashboard/
├── index.html          # HTML template
├── package.json        # Dependencies
├── vite.config.js      # Build config
├── src/
│   ├── main.jsx        # Entry point
│   └── App.jsx         # Main dashboard (edit INITIAL_DATA here)
└── README.md           # This file
```
