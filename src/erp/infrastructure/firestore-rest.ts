import type { Firestore } from "firebase/firestore";

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { mapValue: { fields: Record<string, FirestoreValue> } }
  | { arrayValue: { values: FirestoreValue[] } };

type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
};

type FirestoreListResponse = {
  documents?: FirestoreDocument[];
  nextPageToken?: string;
};

function getFirebaseProjectId(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "bizsuite-dataflow";
}

function getFirestoreDatabaseId(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "(default)";
}

function getFirestoreBaseUrl(): string {
  const projectId = getFirebaseProjectId();
  const db = getFirestoreDatabaseId();
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${db}/documents`;
}

function asFirestoreValue(input: unknown): FirestoreValue {
  if (input === null || input === undefined) return { nullValue: null };
  if (typeof input === "boolean") return { booleanValue: input };
  if (typeof input === "number") {
    if (Number.isInteger(input)) return { integerValue: String(input) };
    return { doubleValue: input };
  }
  if (typeof input === "string") {
    const looksLikeIsoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/.test(
      input
    );
    if (looksLikeIsoTimestamp) return { timestampValue: input };
    return { stringValue: input };
  }
  if (Array.isArray(input)) {
    return { arrayValue: { values: input.map(asFirestoreValue) } };
  }
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue;
      fields[k] = asFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(input) };
}

function fromFirestoreValue(value: FirestoreValue): unknown {
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in value) {
    const out: Record<string, unknown> = {};
    const fields = value.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return null;
}

export function fromFirestoreDocument<T extends Record<string, unknown>>(doc: FirestoreDocument): T {
  const out: Record<string, unknown> = {};
  const fields = doc.fields || {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = fromFirestoreValue(v);
  }
  const id = doc.name.split("/").pop() || "";
  return { id, ...out } as T;
}

function buildHeaders(idToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${idToken}`,
    "Content-Type": "application/json",
  };
}

async function parseFirestoreError(res: Response): Promise<Error> {
  try {
    const json = (await res.json()) as any;
    const message = String(json?.error?.message || "Firestore request failed");
    const code = String(json?.error?.status || res.status);
    return new Error(`${code}: ${message}`);
  } catch {
    return new Error(`${res.status}: Firestore request failed`);
  }
}

export async function firestoreListDocuments<T extends Record<string, unknown>>(args: {
  idToken: string;
  collectionPath: string;
  pageSize?: number;
  pageToken?: string;
}): Promise<{ items: T[]; nextPageToken?: string }> {
  const pageSize = args.pageSize ?? 100;
  const url = new URL(`${getFirestoreBaseUrl()}/${args.collectionPath}`);
  url.searchParams.set("pageSize", String(pageSize));
  if (args.pageToken) url.searchParams.set("pageToken", args.pageToken);

  const res = await fetch(url.toString(), { headers: buildHeaders(args.idToken), method: "GET" });
  if (!res.ok) throw await parseFirestoreError(res);
  const json = (await res.json()) as FirestoreListResponse;
  const docs = json.documents || [];
  return { items: docs.map((d) => fromFirestoreDocument<T>(d)), nextPageToken: json.nextPageToken };
}

export async function firestoreGetDocument<T extends Record<string, unknown>>(args: {
  idToken: string;
  documentPath: string;
}): Promise<T | null> {
  const res = await fetch(`${getFirestoreBaseUrl()}/${args.documentPath}`, {
    headers: buildHeaders(args.idToken),
    method: "GET",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw await parseFirestoreError(res);
  const json = (await res.json()) as FirestoreDocument;
  return fromFirestoreDocument<T>(json);
}

export async function firestoreCreateDocument<T extends Record<string, unknown>>(args: {
  idToken: string;
  collectionPath: string;
  documentId?: string;
  data: Record<string, unknown>;
}): Promise<T> {
  const url = new URL(`${getFirestoreBaseUrl()}/${args.collectionPath}`);
  if (args.documentId) url.searchParams.set("documentId", args.documentId);

  const body = JSON.stringify({
    fields: (asFirestoreValue(args.data) as any).mapValue.fields,
  });

  const res = await fetch(url.toString(), {
    headers: buildHeaders(args.idToken),
    method: "POST",
    body,
  });
  if (!res.ok) throw await parseFirestoreError(res);
  const json = (await res.json()) as FirestoreDocument;
  return fromFirestoreDocument<T>(json);
}

export async function firestorePatchDocument<T extends Record<string, unknown>>(args: {
  idToken: string;
  documentPath: string;
  data: Record<string, unknown>;
  updateMaskPaths?: string[];
}): Promise<T> {
  const url = new URL(`${getFirestoreBaseUrl()}/${args.documentPath}`);
  for (const p of args.updateMaskPaths || []) {
    url.searchParams.append("updateMask.fieldPaths", p);
  }

  const body = JSON.stringify({
    fields: (asFirestoreValue(args.data) as any).mapValue.fields,
  });

  const res = await fetch(url.toString(), {
    headers: buildHeaders(args.idToken),
    method: "PATCH",
    body,
  });
  if (!res.ok) throw await parseFirestoreError(res);
  const json = (await res.json()) as FirestoreDocument;
  return fromFirestoreDocument<T>(json);
}

export async function firestoreDeleteDocument(args: { idToken: string; documentPath: string }): Promise<void> {
  const res = await fetch(`${getFirestoreBaseUrl()}/${args.documentPath}`, {
    headers: buildHeaders(args.idToken),
    method: "DELETE",
  });
  if (res.status === 404) return;
  if (!res.ok) throw await parseFirestoreError(res);
}

