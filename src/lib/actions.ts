
'use server';

import * as admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin SDK at the module level
if (getApps().length === 0) {
    // This check is important for environments where env vars might not be set.
    // In Firebase Hosting, these are set automatically.
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            });
        } catch (error) {
            console.error("Server Action Error: Failed to parse Firebase service account key or initialize app:", error);
        }
    } else {
         // Fallback for local development or other environments if needed
         console.warn("Server Action Warning: FIREBASE_SERVICE_ACCOUNT environment variable not set. Attempting default initialization.");
         try {
            admin.initializeApp({
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            });
         } catch(error) {
             console.error("Server Action Error: Default initialization failed:", error);
         }
    }
}


export async function uploadFileToStorage(
  bufferData: number[],
  fileName: string
): Promise<string> {
  // Check if the app was initialized successfully before proceeding
  if (getApps().length === 0) {
      throw new Error("Firebase Admin SDK could not be initialized. Check server logs for configuration errors.");
  }
  
  const bucket = getStorage().bucket();
  
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
