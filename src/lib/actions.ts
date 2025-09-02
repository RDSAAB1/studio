
'use server';

import * as admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { Readable } from 'stream';

const tryInitializeAdminApp = () => {
    if (getApps().length > 0) {
        return admin.app();
    }
    
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccount) {
        console.error("Firebase service account key is not set in environment variables.");
        return null;
    }

    try {
        const parsedServiceAccount = JSON.parse(serviceAccount);
        return admin.initializeApp({
            credential: admin.credential.cert(parsedServiceAccount),
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
    } catch (error) {
        console.error("Failed to parse Firebase service account key or initialize app:", error);
        return null;
    }
};

export async function uploadFileToStorage(
  bufferData: number[], // Pass buffer as an array of numbers
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

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    await new Promise((resolve, reject) => {
        const writeStream = file.createWriteStream({
            metadata: {
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
        });
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
        stream.pipe(writeStream);
    });

    await file.makePublic();
    
    return file.publicUrl();

  } catch (error: any) {
    console.error("Error uploading file to Firebase Storage:", error);
    throw new Error("Failed to upload file. " + error.message);
  }
}
