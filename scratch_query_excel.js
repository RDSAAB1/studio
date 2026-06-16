const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const baseDir = 'C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE\\ACCOUNTING\\companies\\JAGDAMBE RICE MILL\\JRMD\\PADDY 2025\\Payments';
const files = ['customer-payments.xlsx', 'supplier-payments.xlsx'];

files.forEach(f => {
  const filePath = path.join(baseDir, f);
  if (fs.existsSync(filePath)) {
    console.log(`Reading file: ${f}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`Total rows: ${data.length}`);
    const match = data.filter(row => row.paymentId === 'L00433' || row.id === 'L00433' || String(row.paymentId).startsWith('L00433') || String(row.id).startsWith('L00433'));
    if (match.length > 0) {
      console.log(`FOUND in ${f}:`, JSON.stringify(match, null, 2));
    }
  } else {
    console.log(`File not found: ${filePath}`);
  }
});
