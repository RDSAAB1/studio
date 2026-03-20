const { processSupplierImportRow } = require('./src/lib/supplier-import-processor');

// Mock crypto.randomUUID for node
global.crypto = {
  randomUUID: () => 'test-uuid'
};

const sampleRow = {
  'RST': '628',
  'VEHICLE NO': 'SWARAJ 855',
  'CUSTOMER': 'HARISH',
  'ADDRESS': 'BANDA',
  'MATERIAL': 'HUSK',
  'DATE': '01-10-2025',
  'TIER': 58.60,
  'GROSS': 169.10,
  'KARDA': 1, // 1%
  'RATE': 1800,
  'LABOURY': 221,
  'KANTA': 50
};

try {
    const result = processSupplierImportRow(sampleRow, 1);
    console.log('Processed Result:');
    console.log('SR NO:', result.srNo);
    console.log('Weight (L):', result.weight, '(Expected: 110.50)');
    console.log('Karta Wt (M):', result.kartaWeight, '(Expected: 1.11 approx)');
    console.log('Net Wt (N):', result.netWeight, '(Expected: 109.39)');
    console.log('Total Amt (P):', result.amount, '(Expected: 198900)');
    console.log('Net Amt (S):', result.netAmount, '(Expected: 196640)');
    
    if (result.amount === 198900 && result.netAmount === 196640) {
        console.log('\nSUCCESS: Logic matches screenshot Row 3!');
    } else {
        console.log('\nFAILURE: Totals do not match.');
    }
} catch (e) {
    console.error('Test failed with error:', e);
}
