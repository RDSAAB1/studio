import { registerSyncProcessor } from "./sync-queue";
import { firestoreDB } from "./firebase";
import { doc, setDoc, updateDoc, deleteDoc, Timestamp, collection, writeBatch } from "firebase/firestore";
import type { Customer, Payment, CustomerPayment } from "./definitions";
import { markFirestoreDisabled, isQuotaError } from "./realtime-guard";

// Supplier upsert
registerSyncProcessor<Customer>("upsert:supplier", async (task) => {
	const payload = task.payload as Customer;
	if (!payload?.id) throw new Error("Missing supplier id");
	try {
		const ref = doc(firestoreDB, "suppliers", payload.id);
		const batch = writeBatch(firestoreDB);
		batch.set(ref, payload, { merge: true });
		
		// ✅ Update sync registry atomically
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('suppliers', { batch });
		
		await batch.commit();
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
		const batch = writeBatch(firestoreDB);
		batch.update(ref, data as any);
		
		// ✅ Update sync registry atomically
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('suppliers', { batch });
		
		await batch.commit();
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
		const batch = writeBatch(firestoreDB);
		batch.delete(ref);
		
		// ✅ Update sync registry atomically
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('suppliers', { batch });
		
		await batch.commit();
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
		// Ensure updatedAt is set for incremental sync
		const paymentWithTimestamp = {
			...payload,
			updatedAt: payload.updatedAt || Timestamp.now()
		};
		const batch = writeBatch(firestoreDB);
		batch.set(ref, paymentWithTimestamp, { merge: true });
		
		// ✅ Update sync registry atomically
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('payments', { batch });
		
		await batch.commit();
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
		const batch = writeBatch(firestoreDB);
		batch.delete(ref);
		
		// ✅ Update sync registry atomically
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('payments', { batch });
		
		await batch.commit();
	} catch (e) {
		if (isQuotaError(e)) markFirestoreDisabled();
		throw e;
	}
});

// Government Finalized Payment upsert
registerSyncProcessor<Payment>("upsert:governmentFinalizedPayment", async (task) => {
	const payload = task.payload as Payment;
	if (!payload?.id) throw new Error("Missing government payment id");
	try {
		const { collection } = await import("firebase/firestore");
		const { firestoreDB } = await import("./firebase");
		const governmentFinalizedPaymentsCollection = collection(firestoreDB, "governmentFinalizedPayments");
		const ref = doc(governmentFinalizedPaymentsCollection, payload.id);
		// Ensure updatedAt is set for incremental sync
		const paymentWithTimestamp = {
			...payload,
			updatedAt: payload.updatedAt || Timestamp.now()
		};
		const batch = writeBatch(firestoreDB);
		batch.set(ref, paymentWithTimestamp, { merge: true });
		
		// ✅ Update sync registry atomically
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('governmentFinalizedPayments', { batch });
		
		await batch.commit();
	} catch (e) {
		if (isQuotaError(e)) markFirestoreDisabled();
		throw e;
	}
});

// Government Finalized Payment delete
registerSyncProcessor<{ id: string }>("delete:governmentFinalizedPayment", async (task) => {
	const { id } = task.payload as { id: string };
	if (!id) throw new Error("Missing government payment id");
	try {
		const { collection } = await import("firebase/firestore");
		const { firestoreDB } = await import("./firebase");
		const governmentFinalizedPaymentsCollection = collection(firestoreDB, "governmentFinalizedPayments");
		const ref = doc(governmentFinalizedPaymentsCollection, id);
		const batch = writeBatch(firestoreDB);
		batch.delete(ref);
		
		// ✅ Update sync registry atomically
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('governmentFinalizedPayments', { batch });
		
		await batch.commit();
	} catch (e) {
		if (isQuotaError(e)) markFirestoreDisabled();
		throw e;
	}
});

// Customer Payment upsert
registerSyncProcessor<CustomerPayment>("upsert:customerPayment", async (task) => {
	const payload = task.payload as CustomerPayment;
	if (!payload?.id) throw new Error("Missing customer payment id");
	try {
		const customerPaymentsCollection = collection(firestoreDB, "customer_payments");
		const ref = doc(customerPaymentsCollection, payload.id);
		// Ensure updatedAt is set for incremental sync
		const paymentWithTimestamp = {
			...payload,
			updatedAt: payload.updatedAt || Timestamp.now()
		};
		const batch = writeBatch(firestoreDB);
		batch.set(ref, paymentWithTimestamp, { merge: true });
		
		// ✅ Update sync registry atomically
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('customerPayments', { batch });
		
		await batch.commit();
	} catch (e) {
		if (isQuotaError(e)) markFirestoreDisabled();
		throw e;
	}
});

// Customer Payment delete
registerSyncProcessor<{ id: string }>("delete:customerPayment", async (task) => {
	const { id } = task.payload as { id: string };
	if (!id) throw new Error("Missing customer payment id");
	try {
		const customerPaymentsCollection = collection(firestoreDB, "customer_payments");
		const ref = doc(customerPaymentsCollection, id);
		const batch = writeBatch(firestoreDB);
		batch.delete(ref);
		
		// ✅ Update sync registry atomically
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('customerPayments', { batch });
		
		await batch.commit();
	} catch (e) {
		if (isQuotaError(e)) markFirestoreDisabled();
		throw e;
	}
});


