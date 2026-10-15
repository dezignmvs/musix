# 🎵 Musics — Premium Minimal Dark Music Streaming Web App

A functional, modern music streaming web application built with a premium minimal dark aesthetic. Inspired by Spotify's ease of use, but crafted with an original visual identity, restrained geometry, and a high-performance vanilla JavaScript architecture.

---

## 🌟 Highlights & Key Features

- **Primary Music Streaming Backend:** Integrated with **BhariyaMusic API from GitHub** (`BhariyaConnect/BhariyaMusic`) with automatic fallback to high-reliability catalog providers.
- **Mandatory Hugeicons Integration:** 100% of the UI icons are powered by the official **Hugeicons** web icon font (`hgi-stroke` & `hgi-*` standard classes).
- **Premium Minimal Dark Aesthetic:** Built on a custom CSS variable design system (`#111111` background, `#1A1A1A` cards, `#B8F56A` refined lime accent, 6–12px corner radii, Satoshi typography from Fontshare).
- **Single Shared HTML5 Audio Engine:** Reusable player managing desktop bottom player, mobile floating mini-player, and expandable full-screen Now Playing sheet.
- **MediaSession API Integration:** Displays track title, artist, album, and artwork on system lock screens and external hardware media keys.
- **Local Music Import:** Import MP3, WAV, M4A, OGG, and FLAC files via drag-and-drop or file picker with client-side Blob URL playback (no server upload required).
- **Cloud Music Uploads via Cloudinary:** Upload personal audio tracks and cover artwork with progress tracking and secure serverless signature generation.
- **Firebase Authentication & Cloud Firestore:** User sign up, login, user playlists, liked tracks, recently played history, and security rules.
- **Progressive Web App (PWA):** Installable on Windows, macOS, Android, and iOS with service worker caching, `manifest.json`, and offline fallback screen.

---

## 🛠 Technology Stack

- **Structure:** Semantic HTML5 with accessibility ARIA labels
- **Styling:** Vanilla CSS3 with CSS custom properties (no Tailwind / Bootstrap)
- **Logic:** Vanilla JavaScript (ES6+ Modules, zero heavyweight JS frameworks)
- **Primary Music API:** BhariyaMusic API (`BhariyaConnect/BhariyaMusic`)
- **Fallback API:** iTunes Search API + Curated Royalty-Free Catalog
- **Icons:** Hugeicons (`https://use.hugeicons.com/font/icons.css`)
- **Typography:** Satoshi via Fontshare
- **Accounts & Database:** Firebase Auth & Cloud Firestore
- **Media Storage:** Cloudinary
- **Hosting & Serverless:** Vercel

---

## 🔍 Verified BhariyaMusic API Integration Report

As required by the specification, the actual BhariyaMusic GitHub repository was located, inspected, and verified:

- **Repository:** [`BhariyaConnect/BhariyaMusic`](https://github.com/BhariyaConnect/BhariyaMusic)
- **Author:** BhariyaConnect
- **Language:** Python (~96%), HTML (~4%)
- **Backend Architecture:** Flask / WSGI with MySQL caching and YouTube/Spotify extraction logic.
- **Default Documented Base URL:** `https://bhindi1.ddns.net/music`

### Documented Endpoints:

1. **Request Song ID (Prepare):**
   ```http
   GET /music/api/prepare/{song_name_or_url}
   ```
   Takes a song title or platform URL and returns a unique `song_id`.

2. **Request Song Metadata & Audio URL (Fetch):**
   ```http
   GET /music/api/fetch/{song_id}
   ```
   Returns the song data:
   ```json
   {
     "ID": "unique_song_id",
     "SONG_NAME": "Title",
     "YT_ID": "youtube_id",
     "SPOTIFY_ID": "spotify_id",
     "DURATION": 215.5,
     "AUDIO_URL": "https://...audio.mp3",
     "THUMBNAIL": "https://...thumbnail.jpg",
     "EXPIRY": "2026-10-15 12:00:00",
     "LYRICS": "..."
   }
   ```

3. **Request Audio Stream Fallback:**
   ```http
   GET /music/api/audio/{song_id}
   ```
   Directly streams audio data if the client cannot reach the third-party `AUDIO_URL`.

### Internal Normalization:
`js/providers/bhariyamusic.js` maps raw response fields into our internal standard:
- `id`: `bhariya:<song_id>`
- `title`: Extracted title
- `artist`: Extracted artist
- `album`: Album or 'Single'
- `artwork`: `THUMBNAIL`
- `duration`: `DURATION` (in seconds)
- `audioUrl`: `AUDIO_URL` or `/api/audio/{id}`
- `provider`: `'bhariyamusic'`
- `isPlayable`: `true`
- `isPreview`: `false`

### Reliability & Custom Server Setup:
`bhindi1.ddns.net` is a dynamic DNS instance operated by the author. If it is offline, blocked by CORS, or unreachable, the application automatically engages the secondary fallback provider (`js/providers/fallback.js`) so search and playback remain functional. Furthermore, users running their own self-hosted BhariyaMusic Python server can change the API URL directly in the **Settings & Integrations** page!

---

## 🎨 Color Palette & Design System

The application strictly adheres to the specified minimal dark theme:

```css
--bg-main:       #111111; /* Main view background */
--bg-sidebar:    #151515; /* Sidebar & Player background */
--bg-card:       #1A1A1A; /* Music cards & tiles */
--bg-elevated:   #222222; /* Modals & elevated surfaces */
--text-primary:  #F5F5F5; /* Primary headings and text */
--text-secondary:#A3A3A3; /* Subtitles and artist names */
--border-subtle: #303030; /* Clean borders */
--accent:        #B8F56A; /* Refined lime accent */
--color-error:   #F87171; /* Errors */
--color-success: #86EFAC; /* Success toasts */
```

---

## 🚀 Getting Started Locally

### Prerequisites:
- Node.js (v18+) for local static server (or any HTTP server like Python `http.server` or VS Code Live Server).

### Steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/musics.git
   cd musics
   ```

2. **Start the local development server:**
   ```bash
   npm run dev
   ```
   or using npx:
   ```bash
   npx serve . -l 3000
   ```

3. **Open the application:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Integrations & Configuration

### 1. In-App Setup (Zero Setup Required for Demo):
The app functions immediately out of the box using guest sessions, local storage, and curated streaming music. You can plug in credentials anytime via **Settings (`#settings`)**:

- **BhariyaMusic API URL:** Change to your self-hosted server e.g. `http://localhost:5000/music`.
- **Cloudinary:** Enter your Cloud Name and unsigned Upload Preset.
- **Firebase:** Paste your Web App configuration JSON to enable cross-device cloud sync.

### 2. Environment Variables (for Vercel deployment):
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate the values:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `BHARIYA_API_BASE_URL`

### 3. Deploying to Vercel:
The project includes `vercel.json` configured for static routing and the `api/upload-signature.js` serverless function.
```bash
npx vercel
```

---

## 🔒 Firestore Security Rules

Deploy the included `firestore.rules` to ensure strict user privacy:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /{subcollection}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / Pause |
| `Arrow Right` | Seek Forward 5s |
| `Arrow Left` | Seek Backward 5s |
| `Arrow Up` | Increase Volume +5% |
| `Arrow Down` | Decrease Volume -5% |
| `M` | Mute / Unmute |
| `L` | Like / Save Current Track |

---

## 📱 Progressive Web App (PWA)

To install on Desktop or Mobile:
1. Open the website in Google Chrome, Edge, Safari, or Brave.
2. Click the **"Install App"** button in the sidebar or settings, or tap the browser install icon in the address bar.
3. The app will launch in standalone window mode with offline fallback support.

---

## 📄 License

MIT License. BhariyaMusic is maintained by `BhariyaConnect`.
