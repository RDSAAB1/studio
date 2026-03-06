/**
 * Profile photo helpers - Firestore fallback when Firebase Storage is not configured.
 * Stores compressed base64 in users/{uid} for display when Storage upload fails.
 */

import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestoreDB } from "./firebase";

const MAX_SIZE = 200;
const JPEG_QUALITY = 0.7;

/** Compress image to base64 for Firestore storage */
export async function compressImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > height && width > MAX_SIZE) {
        height = (height * MAX_SIZE) / width;
        width = MAX_SIZE;
      } else if (height > MAX_SIZE) {
        width = (width * MAX_SIZE) / height;
        height = MAX_SIZE;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        let dataUrl: string;
        try {
          dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        } catch {
          dataUrl = canvas.toDataURL("image/png");
        }
        resolve(dataUrl);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error("Failed to load image"));
    };
    img.src = blobUrl;
  });
}

/** Save profile photo - use Firestore (Storage often hangs when rules not deployed) */
export async function saveProfilePhoto(
  userId: string,
  file: File
): Promise<string> {
  const base64 = await compressImageToBase64(file);
  const userRef = doc(firestoreDB, "users", userId);
  await setDoc(userRef, { profilePhotoBase64: base64 }, { merge: true });
  return base64;
}

/** Get profile photo URL - Auth photoURL, or Firestore base64 */
export async function getProfilePhotoUrl(
  userId: string,
  authPhotoUrl: string | null
): Promise<string | null> {
  if (authPhotoUrl) return authPhotoUrl;
  try {
    const userRef = doc(firestoreDB, "users", userId);
    const snap = await getDoc(userRef);
    const data = snap.data();
    return (data?.profilePhotoBase64 as string) || null;
  } catch {
    return null;
  }
}
