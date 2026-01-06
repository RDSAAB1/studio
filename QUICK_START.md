# 🚀 Quick Start Guide - Native Apps

## ✅ Sab Kuch Ready Hai!

Aapke liye Windows Native App (Electron) aur Android Native App (Capacitor) dono setup ho chuke hain.

---

## 📋 PEHLE KYA KARNA HAI:

### 1. Icons Add Karo (Zaroori!)

```bash
# Development server start karo
npm run dev

# Browser mein kholo:
http://localhost:3000/generate-icons.html

# Icons download karo aur PUBLIC folder mein copy karo:
# - icon-192.png
# - icon-512.png
```

---

## 🪟 WINDOWS NATIVE APP (Electron)

### Development Mode (Test Karne Ke Liye):

```bash
npm run electron:dev
```

Yeh command:
- Next.js dev server start karega
- Electron window automatically khol dega
- Hot reload kaam karega

### Windows .exe File Banana:

```bash
npm run electron:build:win
```

**Output:** `dist` folder mein `.exe` file ban jayega

---

## 🤖 ANDROID NATIVE APP (Capacitor)

### Prerequisites (Pehli Baar):

1. **Java JDK 11+** install karo
2. **Android Studio** install karo
3. **Android SDK** setup karo

### First Time Setup:

```bash
# Step 1: Build Next.js app
npm run build

# Step 2: Initialize Capacitor (pehli baar sirf)
npm run capacitor:init

# Step 3: Add Android platform
npm run capacitor:add:android

# Step 4: Sync files
npm run capacitor:sync
```

### Development Workflow:

```bash
# Step 1: Build aur Sync
npm run capacitor:build:android

# Yeh automatically:
# - Next.js build karega
# - Files sync karega
# - Android Studio khol dega
```

**Android Studio mein:**
- "Run" button click karo (green play icon)
- Emulator ya device select karo
- App install ho jayega

---

## 📝 IMPORTANT COMMANDS:

```bash
# Electron Development
npm run electron:dev

# Electron Build (Windows)
npm run electron:build:win

# Capacitor Sync & Open
npm run capacitor:build:android
```

---

## ⚠️ COMMON ISSUES:

### Electron window blank hai?
- Check karo: Next.js server running hai?
- DevTools kholo: `Ctrl+Shift+I`

### Capacitor command not found?
```bash
npm install @capacitor/cli --save-dev
```

### Android Studio errors?
- Android SDK properly install hua hai?
- `npm run build` successful hua?

---

## 📚 Detailed Guides:

- **Complete Setup:** `NATIVE_APPS_COMPLETE_SETUP.md`
- **Icon Instructions:** `PUBLIC/ICON_INSTRUCTIONS.md`
- **PWA Setup:** `SETUP_INSTRUCTIONS.md`

---

## ✅ CHECKLIST:

- [ ] Icons add kiye (`icon-192.png`, `icon-512.png`)
- [ ] Electron dev mode test kiya (`npm run electron:dev`)
- [ ] Android Studio install kiya (agar Android app chahiye)
- [ ] Capacitor setup kiya (agar Android app chahiye)

---

**Happy Coding! 🎉**














