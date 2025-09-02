
'use server';

import * as admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { Readable } from 'stream';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : undefined;

if (!getApps().length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
}

const bucket = getStorage().bucket();

export async function uploadFileToStorage(
  bufferData: number[], // Pass buffer as an array of numbers
  fileName: string
): Promise<string> {
  try {
    const filePath = `rtgs-reports/${fileName}`;
    const file = bucket.file(filePath);
    
    // Convert the array of numbers back to a Buffer
    const buffer = Buffer.from(bufferData);

    // Create a readable stream from the buffer
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // Pipe the stream to the file in Firebase Storage
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

    // Make the file public and get its URL
    await file.makePublic();
    
    // Return the public URL
    return file.publicUrl();

  } catch (error: any) {
    console.error("Error uploading file to Firebase Storage:", error);
    throw new Error("Failed to upload file. " + error.message);
  }
}
