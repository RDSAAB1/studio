# 🚀 Native Apps Complete Setup Guide

Yeh guide aapko Windows Native App (Electron) aur Android Native App (Capacitor) setup karne mein help karega.

---

## ✅ KYA HO GAYA (What's Done):

### Electron (Windows Native App):
- ✅ `electron/main.js` - Main Electron process
- ✅ `electron/preload.js` - Preload script for security
- ✅ `electron-builder.yml` - Build configuration
- ✅ Package.json scripts updated

### Capacitor (Android Native App):
- ✅ `capacitor.config.ts` - TypeScript config
- ✅ `capacitor.config.json` - JSON config
- ✅ Package.json scripts updated

---

## 🪟 WINDOWS NATIVE APP (Electron) - Setup

### Development Mode (Testing):

```bash
# Development mode - Next.js server + Electron window
npm run electron:dev
```

Yeh command:
1. Next.js dev server start karega (port 3000)
2. Electron window automatically khol dega
3. Hot reload kaam karega

### Production Build (Windows .exe):

```bash
# Step 1: Build Next.js app
npm run build

# Step 2: Build Electron app
npm run electron:build:win
```

**Output:** `dist` folder mein `.exe` file ban jayega

### Build Options:

```bash
# Windows only
npm run electron:build:win

# Mac only (agar Mac par build kar rahe ho)
npm run electron:build:mac

# Linux only
npm run electron:build:linux

# All platforms (agar cross-platform build chahiye)
npm run electron:build
```

---

## 🤖 ANDROID NATIVE APP (Capacitor) - Setup

### Prerequisites Install Karo:

1. **Java JDK 11+**
   - Download: https://adoptium.net/
   - Install karo aur `JAVA_HOME` environment variable set karo

2. **Android Studio**
   - Download: https://developer.android.com/studio
   - Install karo
   - Android SDK install karo (SDK Manager se)

3. **Environment Variables Set Karo:**
   ```bash
   # Windows PowerShell
   $env:ANDROID_HOME = "C:\Users\YourName\AppData\Local\Android\Sdk"
   $env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools"
   ```

### First Time Setup:

```bash
# Step 1: Build Next.js app
npm run build

# Step 2: Initialize Capacitor (pehli baar)
npm run capacitor:init

# Step 3: Add Android platform
npm run capacitor:add:android

# Step 4: Sync files
npm run capacitor:sync
```

### Development Workflow:

```bash
# Step 1: Build Next.js app
npm run build

# Step 2: Sync to Android
npm run capacitor:sync

# Step 3: Open Android Studio
npm run capacitor:open:android
```

**Android Studio mein:**
1. "Run" button click karo (green play icon)
2. Emulator ya connected device select karo
3. App install ho jayega

### Build APK:

**Android Studio mein:**
1. `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
2. APK file `android/app/build/outputs/apk/` mein milega

**Ya command line se:**
```bash
cd android
./gradlew assembleRelease
```

---

## 📋 QUICK COMMANDS REFERENCE

### Electron (Windows):
```bash
npm run electron:dev          # Development mode
npm run electron:build:win     # Build Windows .exe
```

### Capacitor (Android):
```bash
npm run capacitor:sync         # Sync files to Android
npm run capacitor:open:android # Open Android Studio
npm run capacitor:build:android # Build + Sync + Open
```

---

## 🔧 TROUBLESHOOTING

### Electron Issues:

**Problem:** Window blank dikh raha hai
**Solution:** 
- Check karo ki Next.js server running hai
- DevTools kholo: `Ctrl+Shift+I` (Windows) ya `Cmd+Option+I` (Mac)

**Problem:** Build fail ho raha hai
**Solution:**
- `out` folder check karo - Next.js build successful hua?
- Icons exist karte hain? (`PUBLIC/icon-192.png`, `PUBLIC/icon-512.png`)

### Capacitor Issues:

**Problem:** `npx cap` command not found
**Solution:**
```bash
npm install @capacitor/cli --save-dev
```

**Problem:** Android Studio mein errors
**Solution:**
- Android SDK properly install hua hai?
- `capacitor.config.json` mein `webDir: "out"` sahi hai?
- Next.js build successful hua? (`npm run build`)

**Problem:** App blank screen dikhata hai
**Solution:**
- `capacitor.config.json` mein `server.url` check karo
- Production build ke liye `server.url` comment out karo

---

## 📱 ICONS SETUP

Icons add karna zaroori hai:

1. **PWA Icons** (browser install ke liye):
   - `PUBLIC/icon-192.png` (192x192)
   - `PUBLIC/icon-512.png` (512x512)

2. **Electron Icons**:
   - Same icons use hote hain
   - `electron-builder.yml` mein path check karo

3. **Android Icons**:
   - Android Studio automatically generate karega
   - Ya manually add kar sakte ho: `android/app/src/main/res/`

**Icons generate karne ke liye:**
- `PUBLIC/generate-icons.html` use karo
- Ya online converter: https://convertio.co/svg-png/

---

## 🎯 NEXT STEPS

1. **Icons Add Karo:**
   ```bash
   # Browser mein kholo
   http://localhost:3000/generate-icons.html
   # Icons download karo aur PUBLIC folder mein copy karo
   ```

2. **Test Electron App:**
   ```bash
   npm run electron:dev
   ```

3. **Test Android App:**
   ```bash
   npm run build
   npm run capacitor:sync
   npm run capacitor:open:android
   ```

4. **Build Production Apps:**
   ```bash
   # Windows .exe
   npm run electron:build:win
   
   # Android APK (Android Studio se)
   ```

---

## 📝 NOTES

- **Electron:** Windows .exe file `dist` folder mein milega
- **Capacitor:** Android APK Android Studio se build karna hoga
- **Icons:** Dono platforms ke liye same icons use ho sakte hain
- **Development:** Electron dev mode mein hot reload kaam karta hai
- **Production:** Dono platforms ke liye pehle `npm run build` zaroori hai

---

## ✅ CHECKLIST

- [ ] Icons add kiye (`icon-192.png`, `icon-512.png`)
- [ ] Electron dev mode test kiya
- [ ] Electron Windows build test kiya
- [ ] Android Studio install kiya
- [ ] Capacitor sync test kiya
- [ ] Android app Android Studio mein khola
- [ ] Android APK build kiya

---

**Happy Building! 🚀**


















