import { registerSyncProcessor } from "./sync-queue";
import { firestoreDB } from "./firebase";
import { doc, setDoc, updateDoc, deleteDoc, Timestamp, collection, writeBatch, getDoc, query, where, getDocs } from "firebase/firestore";
import type { Customer, Payment, CustomerPayment } from "./definitions";
import { markFirestoreDisabled, isQuotaError } from "./realtime-guard";
import { getTenantCollectionPath, getTenantDocPath } from "./tenancy";
import { withCreateMetadata, withEditMetadata, logActivity, moveToRecycleBin } from "./audit";

// Supplier upsert
registerSyncProcessor<Customer>("upsert:supplier", async (task) => {
	const payload = task.payload as Customer;
	if (!payload?.id) throw new Error("Missing supplier id");
	try {
		const ref = doc(firestoreDB, ...getTenantDocPath("suppliers", payload.id));
		const batch = writeBatch(firestoreDB);
		const data = (payload as any).createdBy ? payload : withCreateMetadata(payload as Record<string, unknown>);
		batch.set(ref, data, { merge: true });

		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('suppliers', { batch });
		await notifySyncRegistry('payments', { batch });

		await batch.commit();
		await logActivity({
			type: "create",
			collection: "suppliers",
			docId: payload.id,
			docPath: getTenantCollectionPath("suppliers").join("/"),
			summary: `Created supplier ${(payload as any).name || payload.id}`,
			afterData: data as Record<string, unknown>,
		});
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
		const ref = doc(firestoreDB, ...getTenantDocPath("suppliers", id));
		const batch = writeBatch(firestoreDB);
		const updateData = (data as any)?.editedBy ? data : withEditMetadata(data as Record<string, unknown>);
		batch.update(ref, updateData as any);

		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('suppliers', { batch });
		await notifySyncRegistry('payments', { batch });

		await batch.commit();
		await logActivity({
			type: "edit",
			collection: "suppliers",
			docId: id,
			docPath: getTenantCollectionPath("suppliers").join("/"),
			summary: `Updated supplier ${id}`,
			afterData: updateData as Record<string, unknown>,
		});
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
		const suppliersCollection = collection(firestoreDB, ...getTenantCollectionPath("suppliers"));

		let documentId = id;
		let docRef = doc(suppliersCollection, id);
		let docSnap = await getDoc(docRef);

		if (!docSnap.exists()) {
			const q = query(suppliersCollection, where('srNo', '==', id));
			const snap = await getDocs(q);
			if (!snap.empty) {
				documentId = snap.docs[0].id;
				docRef = doc(suppliersCollection, documentId);
				docSnap = await getDoc(docRef);
			} else {
				docRef = doc(suppliersCollection, id);
				docSnap = await getDoc(docRef);
				if (!docSnap.exists()) return;
			}
		}

		const beforeData = { id: docSnap.id, ...docSnap.data() } as Record<string, unknown>;
		await moveToRecycleBin({
			collection: "suppliers",
			docId: documentId,
			docPath: getTenantCollectionPath("suppliers").join("/"),
			data: beforeData,
			summary: `Deleted supplier ${(beforeData as any).name || documentId}`,
		});

		const batch = writeBatch(firestoreDB);
		batch.delete(docRef);

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
		const ref = doc(firestoreDB, ...getTenantDocPath("payments", payload.id));
		const base = { ...payload, updatedAt: payload.updatedAt || Timestamp.now() };
		const data = (payload as any).createdBy ? base : withCreateMetadata(base as Record<string, unknown>);
		const batch = writeBatch(firestoreDB);
		batch.set(ref, data, { merge: true });
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('payments', { batch });
		await batch.commit();
		await logActivity({
			type: "create",
			collection: "payments",
			docId: payload.id,
			docPath: getTenantCollectionPath("payments").join("/"),
			summary: `Created payment ${payload.id}`,
			afterData: data as Record<string, unknown>,
		});
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
		const ref = doc(firestoreDB, ...getTenantDocPath("payments", id));
		const snap = await getDoc(ref);
		if (snap.exists()) {
			const beforeData = { id: snap.id, ...snap.data() } as Record<string, unknown>;
			await moveToRecycleBin({
				collection: "payments",
				docId: id,
				docPath: getTenantCollectionPath("payments").join("/"),
				data: beforeData,
				summary: `Deleted payment ${id}`,
			});
		}
		const batch = writeBatch(firestoreDB);
		batch.delete(ref);
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
		const governmentFinalizedPaymentsCollection = collection(firestoreDB, ...getTenantCollectionPath("governmentFinalizedPayments"));
		const ref = doc(governmentFinalizedPaymentsCollection, payload.id);
		const base = { ...payload, updatedAt: payload.updatedAt || Timestamp.now() };
		const data = (payload as any).createdBy ? base : withCreateMetadata(base as Record<string, unknown>);
		const batch = writeBatch(firestoreDB);
		batch.set(ref, data, { merge: true });
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('governmentFinalizedPayments', { batch });
		await batch.commit();
		await logActivity({
			type: "create",
			collection: "governmentFinalizedPayments",
			docId: payload.id,
			docPath: getTenantCollectionPath("governmentFinalizedPayments").join("/"),
			summary: `Created government payment ${payload.id}`,
			afterData: data as Record<string, unknown>,
		});
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
		const governmentFinalizedPaymentsCollection = collection(firestoreDB, ...getTenantCollectionPath("governmentFinalizedPayments"));
		const ref = doc(governmentFinalizedPaymentsCollection, id);
		const snap = await getDoc(ref);
		if (snap.exists()) {
			const beforeData = { id: snap.id, ...snap.data() } as Record<string, unknown>;
			await moveToRecycleBin({
				collection: "governmentFinalizedPayments",
				docId: id,
				docPath: getTenantCollectionPath("governmentFinalizedPayments").join("/"),
				data: beforeData,
				summary: `Deleted government payment ${id}`,
			});
		}
		const batch = writeBatch(firestoreDB);
		batch.delete(ref);
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
		const customerPaymentsCollection = collection(firestoreDB, ...getTenantCollectionPath("customer_payments"));
		const ref = doc(customerPaymentsCollection, payload.id);
		const base = { ...payload, updatedAt: payload.updatedAt || Timestamp.now() };
		const data = (payload as any).createdBy ? base : withCreateMetadata(base as Record<string, unknown>);
		const batch = writeBatch(firestoreDB);
		batch.set(ref, data, { merge: true });
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('customerPayments', { batch });
		await batch.commit();
		await logActivity({
			type: "create",
			collection: "customer_payments",
			docId: payload.id,
			docPath: getTenantCollectionPath("customer_payments").join("/"),
			summary: `Created customer payment ${payload.id}`,
			afterData: data as Record<string, unknown>,
		});
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
		const customerPaymentsCollection = collection(firestoreDB, ...getTenantCollectionPath("customer_payments"));
		const ref = doc(customerPaymentsCollection, id);
		const snap = await getDoc(ref);
		if (snap.exists()) {
			const beforeData = { id: snap.id, ...snap.data() } as Record<string, unknown>;
			await moveToRecycleBin({
				collection: "customer_payments",
				docId: id,
				docPath: getTenantCollectionPath("customer_payments").join("/"),
				data: beforeData,
				summary: `Deleted customer payment ${id}`,
			});
		}
		const batch = writeBatch(firestoreDB);
		batch.delete(ref);
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('customerPayments', { batch });
		await batch.commit();
	} catch (e) {
		if (isQuotaError(e)) markFirestoreDisabled();
		throw e;
	}
});

// Customer upsert
registerSyncProcessor<Customer>("upsert:customer", async (task) => {
	const payload = task.payload as Customer;
	if (!payload?.id) throw new Error("Missing customer id");
	try {
		const ref = doc(firestoreDB, ...getTenantDocPath("customers", payload.id));
		const batch = writeBatch(firestoreDB);
		const data = (payload as any).createdBy ? payload : withCreateMetadata(payload as Record<string, unknown>);
		batch.set(ref, data, { merge: true });
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('customers', { batch });
		await notifySyncRegistry('customerPayments', { batch });
		await batch.commit();
		await logActivity({
			type: "create",
			collection: "customers",
			docId: payload.id,
			docPath: getTenantCollectionPath("customers").join("/"),
			summary: `Created customer ${(payload as any).name || payload.id}`,
			afterData: data as Record<string, unknown>,
		});
	} catch (e) {
		if (isQuotaError(e)) markFirestoreDisabled();
		throw e;
	}
});

// Customer partial update
registerSyncProcessor<{ id: string; data: Partial<Customer> }>("update:customer", async (task) => {
	const { id, data } = task.payload as { id: string; data: Partial<Customer> };
	if (!id) throw new Error("Missing customer id");
	try {
		const ref = doc(firestoreDB, ...getTenantDocPath("customers", id));
		const batch = writeBatch(firestoreDB);
		const updateData = (data as any)?.editedBy ? data : withEditMetadata(data as Record<string, unknown>);
		batch.update(ref, updateData as any);
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('customers', { batch });
		await notifySyncRegistry('customerPayments', { batch });
		await batch.commit();
		await logActivity({
			type: "edit",
			collection: "customers",
			docId: id,
			docPath: getTenantCollectionPath("customers").join("/"),
			summary: `Updated customer ${id}`,
			afterData: updateData as Record<string, unknown>,
		});
	} catch (e) {
		if (isQuotaError(e)) markFirestoreDisabled();
		throw e;
	}
});

// Customer delete
registerSyncProcessor<{ id: string }>("delete:customer", async (task) => {
	const { id } = task.payload as { id: string };
	if (!id) throw new Error("Missing customer id");
	try {
		const customersCollection = collection(firestoreDB, ...getTenantCollectionPath("customers"));
		const ref = doc(customersCollection, id);
		const snap = await getDoc(ref);
		if (snap.exists()) {
			const beforeData = { id: snap.id, ...snap.data() } as Record<string, unknown>;
			await moveToRecycleBin({
				collection: "customers",
				docId: id,
				docPath: getTenantCollectionPath("customers").join("/"),
				data: beforeData,
				summary: `Deleted customer ${(beforeData as any).name || id}`,
			});
		}
		const batch = writeBatch(firestoreDB);
		batch.delete(ref);
		const { notifySyncRegistry } = await import('./sync-registry');
		await notifySyncRegistry('customers', { batch });
		await notifySyncRegistry('customerPayments', { batch });
		await batch.commit();
	} catch (e) {
		if (isQuotaError(e)) markFirestoreDisabled();
		throw e;
	}
});
