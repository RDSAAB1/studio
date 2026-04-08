/**
 * Shared CSS styles for high-fidelity report generation (Mandi, Sales, Ledger).
 * These styles are designed for both screen preview and high-quality printing.
 */

export const REPORT_BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  
  * { 
    box-sizing: border-box; 
    font-family: 'Inter', -apple-system, system-ui, sans-serif; 
  }
  
  body { 
    margin: 0; 
    padding: 20px; 
    background-color: #f8fafc; 
    color: #0f172a; 
    line-height: 1.5;
  }
  
  .report-header {
    background: #ffffff;
    padding: 30px;
    border-radius: 12px 12px 0 0;
    border-bottom: 3px solid #0f172a;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
  }
  
  .firm-name { 
    font-size: 32px; 
    font-weight: 900; 
    color: #0f172a; 
    letter-spacing: -0.025em;
    margin: 0;
  }
  
  .firm-sub { 
    font-size: 14px; 
    font-weight: 500; 
    color: #64748b; 
    margin-top: 4px;
  }
  
  .header-chips {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
  }
  
  .chip {
    background: #f1f5f9;
    color: #475569;
    padding: 6px 16px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid #e2e8f0;
  }
  
  main { 
    background: white; 
    padding: 0; 
    border-radius: 0 0 12px 12px; 
    box-shadow: 0 10px 25px rgba(0,0,0,0.05);
    overflow: hidden;
  }
  
  table { 
    width: 100%; 
    border-collapse: collapse; 
    font-size: 11px;
    table-layout: auto;
  }
  
  th { 
    background: #0f172a; 
    color: #ffffff; 
    padding: 14px 10px; 
    text-transform: uppercase; 
    font-size: 10px; 
    font-weight: 800;
    letter-spacing: 0.05em;
    text-align: left;
    border: 1px solid #1e293b;
  }
  
  td { 
    padding: 12px 10px; 
    border: 1px solid #e2e8f0;
    color: #334155;
    font-weight: 500;
  }
  
  tr:nth-child(even) {
    background-color: #f8fafc;
  }
  
  .numeric { 
    text-align: right; 
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    color: #0f172a;
  }
  
  .bold { font-weight: 800; }
  
  .preview-toolbar {
    background: #0f172a; 
    color: white; 
    padding: 12px 30px; 
    position: sticky; 
    top: 0; 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    z-index: 1000; 
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    border-bottom: 2px solid #3b82f6;
  }
  
  .toolbar-title {
    font-weight: 900; 
    font-size: 13px; 
    letter-spacing: 0.1em;
    color: #3b82f6;
  }
  
  .print-btn {
    background: #3b82f6; 
    color: white; 
    border: none; 
    padding: 8px 24px; 
    border-radius: 6px; 
    font-weight: 800; 
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .print-btn:hover { background: #2563eb; transform: translateY(-1px); }

  @media print {
    body { background: white; padding: 0; }
    .report-header { box-shadow: none; border-radius: 0; padding: 20px; }
    main { box-shadow: none; border-radius: 0; }
    .preview-toolbar { display: none !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
`;
