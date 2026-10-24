# LYNKO CHAT

Files (all in one folder, nothing in sub-folders):

| File | What it does |
|---|---|
| server.js | Node/Express backend (number login, contacts, messages, statuses) |
| storage.js | media storage (unchanged) |
| index.html | Login / Sign up page (Name + Number + Password) |
| chat.html | The chat app |
| ios.css | iOS theme (light / dark / auto) |
| settings.js | Settings, Contacts, add by number, rename contacts |
| sw.js | Service worker: install + offline |
| install.js | "Install app" button (Android + iPhone guide) |
| manifest.json | App name / icons for install |
| icons.js | Builds app icons from the LYNKO CHAT logo (needs `sharp`) |
| icon-*.png, maskable-512.png, apple-touch-icon.png | Built-in fallback icons |
| package.json | dependencies (`sharp` added) |
| .env | YOUR existing secrets file — keep the one you already have |

Notes
- Numbers: `0771234567`, `771234567` and `+94771234567` are the same number (country code 94 is the default; change `CC` in server.js, index.html and settings.js together to use another country).
- One number = one device. A new login signs the old device out.
- Old accounts (made with a username) can't log in any more — sign up again with a number.
- Optional: put your logo as `logo.png` / `logo.jpg` next to server.js, or set `ICON_URL` in .env.
