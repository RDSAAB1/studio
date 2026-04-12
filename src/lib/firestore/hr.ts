import { doc, getDoc, getDocs, query, where, writeBatch, collection, orderBy } from "firebase/firestore";
import { firestoreDB } from "../firebase";
import { db } from "../database";
import { isSqliteMode } from "../sqlite-storage";
import { getTenantCollectionPath, getTenantDocPath } from "../tenancy";
import { withCreateMetadata, withEditMetadata, logActivity, moveToRecycleBin } from "../audit";
import { 
  attendanceCollection, 
  projectsCollection, 
  employeesCollection, 
  payrollCollection,
  createLocalSubscription,
  handleSilentError,
  stripUndefined
} from "./core";
import { AttendanceEntry, Project, Employee, PayrollEntry } from "@/lib/definitions";
import { createMetadataBasedListener } from "../sync-registry-listener";

// --- Attendance Functions ---
export async function getAttendanceForPeriod(employeeId: string, startDate: string, endDate: string): Promise<AttendanceEntry[]> {
    const q = query(
        attendanceCollection, 
        where('employeeId', '==', employeeId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as AttendanceEntry));
}

export async function setAttendance(entry: AttendanceEntry): Promise<void> {
    const docRef = doc(attendanceCollection, entry.id);
    const data = withEditMetadata(stripUndefined({ ...entry, updatedAt: new Date().toISOString() } as Record<string, unknown>));
    if (!isSqliteMode()) {
        try {
            const batch = writeBatch(firestoreDB);
            batch.set(docRef, data, { merge: true });
            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('attendance', { batch });
            await batch.commit();
        } catch (error) {
            handleSilentError(error, `updateAttendance Firestore sync - id: ${entry.id}`);
        }
    }
    logActivity({ type: "edit", collection: "attendance", docId: entry.id, docPath: getTenantCollectionPath("attendance").join("/"), summary: `Updated attendance ${entry.id}`, afterData: data }).catch(() => {});
}

export function getAttendanceRealtime(
    callback: (data: AttendanceEntry[]) => void,
    onError: (error: Error) => void,
    dateFilter?: string
): () => void {
    return createLocalSubscription<AttendanceEntry>(
        "attendance",
        callback,
        dateFilter ? (entries) => entries.filter((e: any) => e.date === dateFilter) : undefined
    );
}

// --- Project Functions ---
export async function addProject(projectData: Omit<Project, 'id'>): Promise<Project> {
    const batch = writeBatch(firestoreDB);
    const newDocRef = doc(projectsCollection);
    const now = new Date().toISOString();
    const data = withCreateMetadata({ ...projectData, createdAt: now, updatedAt: now } as Record<string, unknown>);
    batch.set(newDocRef, data);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('projects', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "projects", docId: newDocRef.id, docPath: getTenantCollectionPath("projects").join("/"), summary: `Created project ${(projectData as any).name || newDocRef.id}`, afterData: data }).catch(() => {});
    return { id: newDocRef.id, ...projectData, createdAt: now, updatedAt: now };
}

export async function updateProject(id: string, projectData: Partial<Project>): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(projectsCollection, id);
    const data = withEditMetadata({ ...projectData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.update(docRef, data);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('projects', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "projects", docId: id, docPath: getTenantCollectionPath("projects").join("/"), summary: `Updated project ${id}`, afterData: data }).catch(() => {});
}

export async function deleteProject(id: string): Promise<void> {
    const docRef = doc(projectsCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "projects", docId: id, docPath: getTenantCollectionPath("projects").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted project ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('projects', { batch });
    await batch.commit();
}

// --- Employee Functions ---
export async function getAllEmployees(): Promise<Employee[]> {
    if (isSqliteMode() && db) return db.employees.toArray();
    const snapshot = await getDocs(employeesCollection);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
}

export async function getAllPayroll(): Promise<PayrollEntry[]> {
    if (isSqliteMode() && db) return db.payroll.toArray();
    const snapshot = await getDocs(payrollCollection);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PayrollEntry));
}

export async function getAllAttendance(): Promise<AttendanceEntry[]> {
    if (isSqliteMode() && db) return db.attendance.toArray();
    const snapshot = await getDocs(attendanceCollection);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceEntry));
}

export async function getAllProjects(): Promise<Project[]> {
    if (isSqliteMode() && db) return db.projects.toArray();
    const snapshot = await getDocs(projectsCollection);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Project));
}

export function getProjectsRealtime(
    callback: (data: Project[]) => void,
    onError: (error: Error) => void
): () => void {
    return createLocalSubscription<Project>("projects", callback);
}

function chunkArray<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
}

export async function bulkUpsertEmployees(employees: Employee[]) {
    if (!employees.length) return;
    const chunks = chunkArray(employees, 400);
    for (const chunk of chunks) {
        const batch = writeBatch(firestoreDB);
        chunk.forEach(e => batch.set(doc(employeesCollection, e.id), e, { merge: true }));
        await batch.commit();
    }
}

export function getEmployeesRealtime(callback: (data: Employee[]) => void, onError: (error: Error) => void) {
    return createLocalSubscription<Employee>("employees", callback);
}

export function getPayrollRealtime(callback: (data: PayrollEntry[]) => void, onError: (error: Error) => void) {
    return createLocalSubscription<PayrollEntry>("payroll", callback);
}

export async function addEmployee(employeeData: Omit<Employee, 'id'>): Promise<Employee> {
    const newDocRef = doc(employeesCollection);
    const docWithId = { id: newDocRef.id, ...employeeData };
    const data = withCreateMetadata(docWithId as Record<string, unknown>);
    if (!isSqliteMode()) {
        try {
            const batch = writeBatch(firestoreDB);
            batch.set(newDocRef, data);
            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('employees', { batch });
            await batch.commit();
        } catch (error) {
            handleSilentError(error, 'addEmployee Firestore sync');
        }
    }
    logActivity({ type: "create", collection: "employees", docId: newDocRef.id, docPath: getTenantCollectionPath("employees").join("/"), summary: `Created employee ${employeeData.name}`, afterData: data }).catch(() => {});
    return data as Employee;
}

export async function updateEmployee(id: string, employeeData: Partial<Employee>): Promise<void> {
    const docRef = doc(employeesCollection, id);
    const data = withEditMetadata(stripUndefined({ ...employeeData, updatedAt: new Date().toISOString() } as Record<string, unknown>));
    if (!isSqliteMode()) {
        try {
            const batch = writeBatch(firestoreDB);
            batch.update(docRef, data);
            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('employees', { batch });
            await batch.commit();
        } catch (error) {
            handleSilentError(error, `updateEmployee Firestore sync - id: ${id}`);
        }
    }
    logActivity({ type: "edit", collection: "employees", docId: id, docPath: getTenantCollectionPath("employees").join("/"), summary: `Updated employee ${id}`, afterData: data }).catch(() => {});
}

export async function deleteEmployee(id: string): Promise<void> {
    const docRef = doc(employeesCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "employees", docId: id, docPath: getTenantCollectionPath("employees").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted employee ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('employees', { batch });
    await batch.commit();
}

// --- Payroll Functions ---
export async function addPayrollEntry(payrollData: Omit<PayrollEntry, 'id'>): Promise<PayrollEntry> {
    const batch = writeBatch(firestoreDB);
    const newDocRef = doc(payrollCollection);
    const data = withCreateMetadata({ ...payrollData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.set(newDocRef, data);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('payroll', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "payroll", docId: newDocRef.id, docPath: getTenantCollectionPath("payroll").join("/"), summary: `Created payroll entry ${newDocRef.id}`, afterData: data }).catch(() => {});
    return { id: newDocRef.id, ...data } as PayrollEntry;
}

export async function updatePayrollEntry(id: string, payrollData: Partial<PayrollEntry>): Promise<void> {
    const docRef = doc(payrollCollection, id);
    const data = withEditMetadata(stripUndefined({ ...payrollData, updatedAt: new Date().toISOString() } as Record<string, unknown>));
    if (!isSqliteMode()) {
        try {
            const batch = writeBatch(firestoreDB);
            batch.update(docRef, data);
            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('payroll', { batch });
            await batch.commit();
        } catch (error) {
            handleSilentError(error, `updatePayroll Firestore sync - id: ${id}`);
        }
    }
    logActivity({ type: "edit", collection: "payroll", docId: id, docPath: getTenantCollectionPath("payroll").join("/"), summary: `Updated payroll entry ${id}`, afterData: data }).catch(() => {});
}

export async function deletePayrollEntry(id: string): Promise<void> {
    const docRef = doc(payrollCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "payroll", docId: id, docPath: getTenantCollectionPath("payroll").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted payroll entry ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('payroll', { batch });
    await batch.commit();
}
