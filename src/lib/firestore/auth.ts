import { doc, setDoc, getDoc } from "firebase/firestore";
import { firestoreDB } from "../firebase";
import { retryFirestoreOperation } from "../retry-utils";
import { logError } from "../error-logger";

export async function saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    try {
        const userDocRef = doc(firestoreDB, "users", userId);
        await retryFirestoreOperation(
            () => setDoc(userDocRef, { refreshToken: refreshToken }, { merge: true }),
            `saveRefreshToken for user ${userId}`
        );
    } catch (error) {
        logError(error, `saveRefreshToken(${userId})`, 'medium');
        throw error;
    }
}

export async function getRefreshToken(userId: string): Promise<string | null> {
    try {
        const userDocRef = doc(firestoreDB, "users", userId);
        const docSnap = await retryFirestoreOperation(
            () => getDoc(userDocRef),
            `getRefreshToken for user ${userId}`
        );
        if (docSnap.exists() && docSnap.data().refreshToken) {
            return docSnap.data().refreshToken;
        }
        return null;
    } catch (error) {
        logError(error, `getRefreshToken(${userId})`, 'medium');
        throw error;
    }
}
