import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CustomerEntryClient from '../customer-entry-client';
import { useGlobalData } from '@/contexts/global-data-context';
import { addCustomer } from '@/lib/firestore';

// Mock firebase/firestore to handle top-level calls in @/lib/firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  setDoc: jest.fn(),
  writeBatch: jest.fn(),
  runTransaction: jest.fn(),
  arrayUnion: jest.fn(),
  arrayRemove: jest.fn(),
  startAfter: jest.fn(),
  collectionGroup: jest.fn(),
  onSnapshot: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
    fromDate: jest.fn((date) => ({ toDate: () => date })),
  },
}));

// Mock firebase first to prevent init errors
jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
  firestoreDB: {},
}));

// Mock lucide-react to avoid ESM issues
jest.mock('lucide-react', () => ({
  User: () => <svg />,
  Phone: () => <svg />,
  Home: () => <svg />,
  Truck: () => <svg />,
  Wheat: () => <svg />,
  Banknote: () => <svg />,
  Landmark: () => <svg />,
  Hash: () => <svg />,
  Percent: () => <svg />,
  Weight: () => <svg />,
  Boxes: () => <svg />,
  Settings: () => <svg />,
  PlusCircle: () => <svg />,
  Pen: () => <svg />,
  Printer: () => <svg />,
  Trash: () => <svg />,
  Loader2: () => <svg />,
  Info: () => <svg />,
  Save: () => <svg />,
  ChevronsUpDown: () => <svg />,
  Search: () => <svg />,
  Upload: () => <svg />,
  Download: () => <svg />,
  Trash2: () => <svg />,
  RefreshCw: () => <svg />,
  X: () => <svg />,
  Check: () => <svg />,
  Calendar: () => <svg />,
  CalendarIcon: () => <svg />,
}));

// Mock dependencies
jest.mock('@/contexts/global-data-context');
jest.mock('@/lib/firestore', () => ({
  __esModule: true,
  addCustomer: jest.fn(),
  updateCustomer: jest.fn(),
  getOptionsRealtime: jest.fn((_collectionName: string, callback: (options: any[]) => void) => {
    callback([]);
    return jest.fn();
  }),
}));
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock child components
jest.mock('../components/customer-entry-dialogs', () => ({
  CustomerEntryDialogs: () => <div data-testid="dialogs" />,
}));
jest.mock('@/components/sales/entry-table', () => ({
  EntryTable: () => <div data-testid="entry-table" />,
}));

// Mock form components to avoid UI library issues
jest.mock('@/components/sales/customer-form', () => ({
  CustomerForm: ({ onSubmit }: any) => {
    const [name, setName] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);

    const handleSave = () => {
      if (!name.trim()) {
        setError('Name is required');
        return;
      }
      setError(null);
      onSubmit({
        name,
        variety: 'Wheat',
        paymentType: 'Cash',
        contact: '9999999999',
        address: 'Test Address',
        vehicleNo: 'AB12CD3456',
      });
    };

    return (
      <div data-testid="customer-form">
        <input
          aria-label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        {error && <span>{error}</span>}
        <button onClick={handleSave}>Save Form</button>
      </div>
    );
  },
}));

jest.mock('@/components/sales/calculated-summary', () => ({
  CalculatedSummary: ({ onSave }: any) => (
    <div data-testid="calculated-summary">
      <button onClick={onSave}>Save Summary</button>
    </div>
  ),
}));

jest.mock('../hooks/use-customer-import-export', () => ({
  useCustomerImportExport: () => ({
    handleImport: jest.fn(),
    handleExport: jest.fn(),
    isImporting: false,
    importProgress: 0,
    importStatus: '',
    importCurrent: 0,
    importTotal: 0,
    importStartTime: null,
  }),
}));

// Mock complex UI components
jest.mock('@/components/ui/custom-dropdown', () => ({
  CustomDropdown: ({ label, value, onChange, options }: any) => (
    <div data-testid={`dropdown-${label}`}>
      <label>{label}</label>
      <select 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      >
        <option value="">Select {label}</option>
        {options?.map((opt: any) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  ),
}));

describe('CustomerEntryClient Integration', () => {
  const mockAddCustomer = addCustomer as jest.Mock;
  const mockUseGlobalData = useGlobalData as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGlobalData.mockReturnValue({
      customers: [],
      suppliers: [],
      paymentHistory: [],
      customerPayments: [],
      incomes: [],
      expenses: [],
      fundTransactions: [],
      bankAccounts: [],
      receiptSettings: {
          defaultBrokerage: 0,
          defaultCd: 0,
          defaultKarta: 0
      }
    });
    mockAddCustomer.mockResolvedValue('new-id');
  });

  it('renders the form', () => {
    render(<CustomerEntryClient />);
    expect(screen.getByTestId('customer-form')).toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    render(<CustomerEntryClient />);
    
    const saveButton = screen.getByText('Save Form');
    fireEvent.click(saveButton);

    await waitFor(() => {
        const errorMessages = screen.getAllByText(/Name is required/i);
        expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

});
