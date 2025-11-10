/*
  Reconciles negative outstanding by trimming paidFor allocations on payments.
  Usage:
  1) Paste your JSON into the DATA constant below.
  2) Run in a Node/TS context (ts-node) or import and call runReconciliation(DATA, { apply: false }) for dry-run.
*/

import { writeBatch, doc, getDoc, updateDoc } from 'firebase/firestore';
import { firestoreDB } from '@/lib/firebase';

type ReportPayment = {
  id: string;
  paymentId: string;
  date: string;
  receiptType: string;
  amount: number;
  rtgsAmount?: number;
  cdAmount?: number;
  paidForAmountForThisSrNo: number;
  totalAllocated: number;
};

type ReportEntry = {
  srNo: string;
  name: string;
  fatherName?: string;
  originalNetAmount: number;
  totalPaid: number;
  totalCd: number;
  outstanding: number; // negative
  excess: number;
  reasons: string[];
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  payments: ReportPayment[];
};

type PaidForItem = { srNo: string; amount: number };

type PaymentDoc = {
  id?: string;
  paymentId?: string;
  date: string;
  receiptType: string;
  amount: number;
  rtgsAmount?: number;
  cdAmount?: number;
  paidFor?: PaidForItem[];
};

export type ReconcileOptions = {
  apply: boolean; // if false, dry-run only
  capAllocationsToPaymentTotal?: boolean; // also fix Allocation>Payment by trimming proportionally
};

export type PlannedChange = {
  paymentDocId: string;
  paymentId?: string;
  beforePaidFor: PaidForItem[];
  afterPaidFor: PaidForItem[];
  notes: string[];
};

export async function planReconciliation(entries: ReportEntry[], options: ReconcileOptions): Promise<PlannedChange[]> {
  const plans: PlannedChange[] = [];

  // Sort payments per entry by date desc so we trim latest first
  for (const entry of entries) {
    let remainingExcess = Math.round(entry.excess || 0);
    if (!(remainingExcess > 0)) continue;

    const paymentsSorted = [...(entry.payments || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    for (const rp of paymentsSorted) {
      if (remainingExcess <= 0) break;
      const ref = doc(firestoreDB, 'payments', rp.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        plans.push({ paymentDocId: rp.id, paymentId: rp.paymentId, beforePaidFor: [], afterPaidFor: [], notes: [`Skip: payment doc not found`] });
        continue;
      }
      const p = snap.data() as PaymentDoc;
      const beforePaidFor = Array.isArray(p.paidFor) ? p.paidFor.map(x => ({ ...x })) : [];
      const targetIndex = beforePaidFor.findIndex(x => x.srNo === entry.srNo);
      if (targetIndex === -1) {
        plans.push({ paymentDocId: rp.id, paymentId: rp.paymentId, beforePaidFor, afterPaidFor: beforePaidFor, notes: [`Skip: no paidFor for ${entry.srNo}`] });
        continue;
      }
      const usedAmount = Number(p.rtgsAmount || p.amount || 0);
      const currentAlloc = beforePaidFor[targetIndex].amount || 0;
      if (currentAlloc <= 0) {
        plans.push({ paymentDocId: rp.id, paymentId: rp.paymentId, beforePaidFor, afterPaidFor: beforePaidFor, notes: [`Skip: allocation already zero for ${entry.srNo}`] });
        continue;
      }

      const reduction = Math.min(currentAlloc, remainingExcess);
      const after = beforePaidFor.map((x, i) => i === targetIndex ? { ...x, amount: Math.max(0, Math.round((x.amount || 0) - reduction)) } : { ...x });

      // Remove zeroed entries for cleanliness
      const afterClean = after.filter(x => (x.amount || 0) > 0);
      const notes: string[] = [`Trim ${entry.srNo} by ${reduction}`];

      // Optionally cap total allocations to used amount
      if (options.capAllocationsToPaymentTotal) {
        const totalAfter = afterClean.reduce((s, x) => s + (x.amount || 0), 0);
        if (totalAfter > usedAmount) {
          const overflow = totalAfter - usedAmount;
          // Proportionally scale down all allocations
          const scaled = proportionallyScaleDown(afterClean, usedAmount);
          notes.push(`Cap allocation: -${overflow} (total ${totalAfter} -> ${usedAmount})`);
          plans.push({ paymentDocId: rp.id, paymentId: rp.paymentId, beforePaidFor, afterPaidFor: scaled, notes });
        } else {
          plans.push({ paymentDocId: rp.id, paymentId: rp.paymentId, beforePaidFor, afterPaidFor: afterClean, notes });
        }
      } else {
        plans.push({ paymentDocId: rp.id, paymentId: rp.paymentId, beforePaidFor, afterPaidFor: afterClean, notes });
      }

      remainingExcess -= reduction;
    }
  }

  return mergePlansByPayment(plans);
}

export async function applyReconciliation(plans: PlannedChange[]): Promise<void> {
  if (!plans.length) return;
  const batch = writeBatch(firestoreDB);
  for (const plan of plans) {
    const ref = doc(firestoreDB, 'payments', plan.paymentDocId);
    batch.update(ref, { paidFor: plan.afterPaidFor });
  }
  await batch.commit();
}

export async function runReconciliation(entries: ReportEntry[], options: ReconcileOptions) {
  const plans = await planReconciliation(entries, options);
  if (!options.apply) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(plans, null, 2));
    return { applied: false, count: plans.length };
  }
  await applyReconciliation(plans);
  return { applied: true, count: plans.length };
}

function mergePlansByPayment(plans: PlannedChange[]): PlannedChange[] {
  const byId = new Map<string, PlannedChange>();
  for (const p of plans) {
    const existing = byId.get(p.paymentDocId);
    if (!existing) {
      byId.set(p.paymentDocId, p);
      continue;
    }
    // Merge afterPaidFor by latest version
    existing.afterPaidFor = p.afterPaidFor;
    existing.notes = [...existing.notes, ...p.notes];
  }
  return Array.from(byId.values());
}

function proportionallyScaleDown(items: PaidForItem[], targetTotal: number): PaidForItem[] {
  const current = items.reduce((s, x) => s + (x.amount || 0), 0);
  if (current <= targetTotal || current === 0) return items;
  const ratio = targetTotal / current;
  // Scale and round, then adjust rounding residual on the largest items
  const scaled = items.map(x => ({ ...x, amount: Math.max(0, Math.round((x.amount || 0) * ratio)) }));
  let diff = targetTotal - scaled.reduce((s, x) => s + (x.amount || 0), 0);
  if (diff !== 0) {
    const sortedIdx = scaled.map((x, i) => ({ i, amt: x.amount || 0 })).sort((a, b) => b.amt - a.amt).map(x => x.i);
    for (const i of sortedIdx) {
      if (diff === 0) break;
      const adj = diff > 0 ? 1 : -1;
      const newAmt = Math.max(0, (scaled[i].amount || 0) + adj);
      // Avoid negative
      if (newAmt >= 0) {
        scaled[i].amount = newAmt;
        diff -= adj;
      }
    }
  }
  return scaled.filter(x => (x.amount || 0) > 0);
}

// Optional: paste your data here and invoke runReconciliation(DATA, { apply: false }) in a custom runner
// const DATA: ReportEntry[] = [];
// runReconciliation(DATA, { apply: false, capAllocationsToPaymentTotal: true }).then(console.log);


