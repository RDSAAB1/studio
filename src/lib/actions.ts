
'use server';

import * as admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

const tryInitializeAdminApp = () => {
    if (getApps().length > 0) {
        return admin.app();
    }
    
    // This check is important for environments where env vars might not be set.
    // In Firebase Hosting, these are set automatically.
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            return admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            });
        } catch (error) {
            console.error("Failed to parse Firebase service account key or initialize app:", error);
            return null; // Explicitly return null on failure
        }
    } else {
         // Fallback for local development or other environments if needed
         console.warn("FIREBASE_SERVICE_ACCOUNT environment variable not set. Attempting default initialization.");
         try {
            return admin.initializeApp({
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            });
         } catch(error) {
             console.error("Default initialization failed:", error);
             return null;
         }
    }
};

export async function uploadFileToStorage(
  bufferData: number[],
  fileName: string
): Promise<string> {
  const app = tryInitializeAdminApp();
  if (!app) {
      throw new Error("Firebase Admin SDK not initialized. Check server logs.");
  }
  const bucket = getStorage(app).bucket();
  
  try {
    const filePath = `rtgs-reports/${fileName}`;
    const file = bucket.file(filePath);
    
    const buffer = Buffer.from(bufferData);

    await file.save(buffer, {
        metadata: {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        public: true, // Make the file publicly accessible
    });
    
    // Return the public URL
    return file.publicUrl();

  } catch (error: any) {
    console.error("Error uploading file to Firebase Storage:", error);
    throw new Error("Failed to upload file. " + error.message);
  }
}
