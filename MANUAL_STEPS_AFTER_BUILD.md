# Manual Steps - Build Ke Baad Kya Karna Hai

## 📍 EXE FILE KAHAN HAI (Sabse pehle yeh dekho)

Build ke baad exe **project ke andar `dist` folder** mein hoti hai:

| Kaunsa exe | Full path (project = studio folder) |
|------------|-------------------------------------|
| **Installer** (install karke use karo) | `studio\dist\JRMD Studio Setup 0.1.0.exe` |
| **Portable** (bina install chalane ke liye) | `studio\dist\win-unpacked\JRMD Studio.exe` |

**Windows Explorer mein jaldi kholne ke liye:**  
Project folder kholo → **dist** folder open karo → wahan **JRMD Studio Setup 0.1.0.exe** (installer) ya **win-unpacked** folder ke andar **JRMD Studio.exe** (portable).

---

## ✅ Jo Ho Chuka Hai (Automatically)

- ✅ Next.js build complete
- ✅ Electron Windows build complete
- ✅ Installer bana: `dist\JRMD Studio Setup 0.1.0.exe` (~375 MB)
- ✅ Portable app: `dist\win-unpacked\JRMD Studio.exe` (~201 MB)
- ✅ App launch test ho chuka hai

---

## 📋 Tumhein Manually Kya Karna Hai

### 1. App Test Karo
- **Portable:** `dist\win-unpacked\JRMD Studio.exe` double-click karke run karo
- **Installer:** `dist\JRMD Studio Setup 0.1.0.exe` run karke install karo, phir Start Menu se open karo
- Login, data entry, folder export – sab features check karo

### 2. Users Ko Distribute Karo
- **JRMD Studio Setup 0.1.0.exe** ko USB, Google Drive, ya download link se share karo
- Users ko yeh file run karni hogi aur install karni hogi

### 3. (Optional) Code Signing – SmartScreen Warning Hatane Ke Liye
- Unsigned app pe Windows "Unknown publisher" warning dikhata hai
- Code signing certificate lena hoga (DigiCert, Sectigo, etc.) – paid
- `electron-builder.yml` mein signing config add karna hoga

### 4. (Optional) Custom Installer Icon
- NSIS installer ke liye `.ico` file chahiye (abhi default icon hai)
- `build/icon.ico` banao (256x256) aur `electron-builder.yml` mein add karo

### 5. Version Update (Jab Naya Release Ho)
- `package.json` mein `"version": "0.1.0"` change karo (e.g. `"0.2.0"`)
- Phir `npm run electron:build:win` dobara chalao

---

## 📁 Build Output Location

```
dist/
├── JRMD Studio Setup 0.1.0.exe   ← Installer (share this)
├── win-unpacked/
│   └── JRMD Studio.exe           ← Portable app
└── win-ia32-unpacked/
    └── JRMD Studio.exe           ← 32-bit portable
```

---

## 🔄 Future Builds

Code change ke baad:
```bash
npm run electron:build:win
```
