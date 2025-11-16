import { registerSyncProcessor } from "./sync-queue";
import { firestoreDB } from "./firebase";
import { doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import type { Customer, Payment } from "./definitions";
import { markFirestoreDisabled, isQuotaError } from "./realtime-guard";

// Supplier upsert
registerSyncProcessor<Customer>("upsert:supplier", async (task) => {
	const payload = task.payload as Customer;
	if (!payload?.id) throw new Error("Missing supplier id");
	try {
		const ref = doc(firestoreDB, "suppliers", payload.id);
		await setDoc(ref, payload, { merge: true });
	} catch (e) {
		if (isQuotaError(e)) markFirestoreDisabled();
		throw e;
	}
});

// Supplier partial update
registerSyncProcessor<{ id: string; data: Partial<Customer> }>("update:supplier", async (task) => {
	const { id, data } = task.payload as { id: string; data: Partial<Customer> };
	if (!id) throw new Error("Missing supplier id");
	try {
		const ref = doc(firestoreDB, "suppliers", id);
		await updateDoc(ref, data as any);
	} catch (e) {
		if (isQuotaError(e)) markFirestoreDisabled();
		throw e;
	}
});

// Supplier delete
registerSyncProcessor<{ id: string }>("delete:supplier", async (task) => {
	const { id } = task.payload as { id: string };
	if (!id) throw new Error("Missing supplier id");
	try {
		const ref = doc(firestoreDB, "suppliers", id);
		await deleteDoc(ref);
	} catch (e) {
		if (isQuotaError(e)) markFirestoreDisabled();
		throw e;
	}
});

// Payment upsert (basic)
registerSyncProcessor<Payment>("upsert:payment", async (task) => {
	const payload = task.payload as Payment;
	if (!payload?.id) throw new Error("Missing payment id");
	try {
		const ref = doc(firestoreDB, "payments", payload.id);
		await setDoc(ref, payload, { merge: true });
	} catch (e) {
		if (isQuotaError(e)) markFirestoreDisabled();
		throw e;
	}
});

// Payment delete
registerSyncProcessor<{ id: string }>("delete:payment", async (task) => {
	const { id } = task.payload as { id: string };
	if (!id) throw new Error("Missing payment id");
	try {
		const ref = doc(firestoreDB, "payments", id);
		await deleteDoc(ref);
	} catch (e) {
		if (isQuotaError(e)) markFirestoreDisabled();
		throw e;
	}
});


