
'use server';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export async function uploadFileToStorage(
  buffer: ArrayBuffer,
  fileName: string
): Promise<string> {
  try {
    const storageRef = ref(storage, `rtgs-reports/${fileName}`);
    
    // Upload the file buffer
    await uploadBytes(storageRef, buffer);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
  } catch (error: any) {
    console.error("Error uploading file to Firebase Storage:", error);
    // It's better to throw the error to be caught by the client
    throw new Error("Failed to upload file. " + error.message);
  }
}
