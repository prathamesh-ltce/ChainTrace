// ── Export Utilities for SIH Forensic Reports ──

export function downloadCsv(filename, rows) {
 const processRow = (row) =>
  row.map(val => {
   let text = val === null || val === undefined ? '' : String(val);
   text = text.replace(/"/g, '""');
   if (text.search(/("|,|\n)/g) >= 0) text = `"${text}"`;
   return text;
  }).join(',');

 const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(processRow).join('\r\n');
 const encodedUri = encodeURI(csvContent);
 const link = document.createElement('a');
 link.setAttribute('href', encodedUri);
 link.setAttribute('download', filename);
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
}

export function exportLedgerCsv(report) {
 if (!report || !report.chain_of_custody_ledger) return;
 const chain = report.coin || report.blockchain || 'BTC';
 const rows = [
  ['Hop', 'Sender (From)', 'Recipient (To)', `Amount (${chain})`, 'Timestamp', 'TxHash', 'Entity Profile', 'ACC Score', 'PAES Score'],
  ...report.chain_of_custody_ledger.map(item => [
   item.hop,
   item.from,
   item.to,
   item.amount,
   item.timestamp ? new Date(item.timestamp * 1000).toISOString() : 'N/A',
   item.tx_hash,
   item.profile || '',
   item.acc_score || 0.70,
   item.paes_score || 0.80
  ])
 ];
 downloadCsv(`Ledger_${report.case_id || 'Case'}.csv`, rows);
}

export function exportVaspsCsv(report) {
 if (!report || !report.vasp_targets) return;
 const rows = [
  ['Hop', 'Target Exchange / VASP', 'Deposit Address', 'Jurisdiction', 'Compliance Email', 'ACC Score', 'PAES Score', 'Statutory Action'],
  ...report.vasp_targets.map(v => [
   v.hop,
   v.vasp_name,
   v.address,
   v.jurisdiction || 'International',
   v.compliance_email || '',
   v.acc_score || 0.85,
   v.paes_score || 0.60,
   v.statutory_notice || 'Section 91 CrPC / Section 94 BNSS'
  ])
 ];
 downloadCsv(`VASP_Targets_${report.case_id || 'Case'}.csv`, rows);
}

export function exportSvg(svgElement, filename = 'Fund_Flow_Graph.svg') {
 if (!svgElement) return;
 const serializer = new XMLSerializer();
 let source = serializer.serializeToString(svgElement);
 if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
  source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
 }
 const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = filename;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 URL.revokeObjectURL(url);
}

export function exportPng(svgElement, filename = 'Fund_Flow_Graph.png', width = 1920, height = 1080) {
 if (!svgElement) return;
 const serializer = new XMLSerializer();
 let source = serializer.serializeToString(svgElement);
 if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
  source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
 }
 const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
 const url = URL.createObjectURL(svgBlob);
 const img = new Image();
 img.onload = () => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f172a'; // dark navy bg
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(url);
  const pngUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = pngUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
 };
 img.src = url;
}

export function exportExecutiveSummary(report) {
 if (!report) return;
 const printWindow = window.open('', '_blank');
 if (!printWindow) return;

 const suspect = report.suspect_wallet || report.suspect_address || 'N/A';
 const chain = report.coin || report.blockchain || 'BTC';
 const risk = report.risk_assessment || {};
 const score = risk.composite_score || risk.risk_score || 0;
 const level = risk.risk_level || 'LOW';
 const vasps = report.vasp_targets || [];

 const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Executive Brief: ${report.case_id}</title>
<style>
 body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 30px; color: #1e293b; line-height: 1.5; font-size: 13px; }
 .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
 .title { font-size: 20px; font-weight: bold; color: #0f172a; }
 .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; text-transform: uppercase; }
 .badge-CRITICAL { background: #fee2e2; color: #dc2626; border: 1px solid #f87171; }
 .badge-HIGH { background: #ffedd5; color: #ea580c; border: 1px solid #fb923c; }
 .badge-LOW { background: #dcfce7; color: #16a34a; border: 1px solid #4ade80; }
 .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
 .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; }
 .card-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px; }
 .card-val { font-size: 16px; font-weight: bold; color: #0f172a; word-break: break-all; }
 table { width: 100%; border-collapse: collapse; margin-top: 10px; }
 th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
 th { background: #f1f5f9; font-weight: 600; }
 .action-box { background: #eff6ff; border-left: 4px solid #2563eb; padding: 12px; margin-top: 20px; }
</style>
</head>
<body>
 <div class="header">
  <div>
   <div class="title">EXECUTIVE FORENSIC BRIEFING</div>
   <div style="color: #64748b; font-size: 12px;">Automated Blockchain VASP Attribution Engine | Case: ${report.case_id}</div>
  </div>
  <div>
   <span class="badge badge-${level}">${level} RISK (${score}/100)</span>
  </div>
 </div>

 <div class="grid">
  <div class="card">
   <div class="card-label">Suspect Wallet</div>
   <div class="card-val" style="font-size: 13px;">${suspect}</div>
   <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Blockchain: ${chain}</div>
  </div>
  <div class="card">
   <div class="card-label">Multi-Hop Traversal</div>
   <div class="card-val">${report.hops_traced || (report.chain_of_custody_ledger || []).length} Hops Traced</div>
   <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Duration: ${report.duration_seconds || '0.00'}s</div>
  </div>
  <div class="card">
   <div class="card-label">Actionable Targets</div>
   <div class="card-val">${vasps.length} Centralized Exchange(s)</div>
   <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Gateways ready for KYC notice</div>
  </div>
 </div>

 <div style="font-weight: bold; font-size: 14px; margin-top: 15px; margin-bottom: 8px;">Actionable Terminal VASP Targets:</div>
 <table>
  <thead>
   <tr>
    <th>Hop</th>
    <th>Exchange Name</th>
    <th>Target Deposit Address</th>
    <th>Jurisdiction</th>
    <th>Compliance Contact</th>
    <th>Attribution Confidence</th>
   </tr>
  </thead>
  <tbody>
   ${vasps.length ? vasps.map(v => `
    <tr>
     <td>Hop ${v.hop}</td>
     <td><strong>${v.vasp_name}</strong></td>
     <td><code>${v.address}</code></td>
     <td>${v.jurisdiction || 'Global'}</td>
     <td>${v.compliance_email || 'Desk Portal'}</td>
     <td>${Math.round((v.acc_score || 0.85) * 100)}% Verified</td>
    </tr>
   `).join('') : '<tr><td colspan="6">No custodial VASP reached in traced hops. Funds unspent at intermediate unhosted hop.</td></tr>'}
  </tbody>
 </table>

 <div class="action-box">
  <strong>RECOMMENDED STATUTORY ACTION:</strong><br>
  ${vasps.length 
   ? `Serve formal requisition notices under Section 91 CrPC / Section 94 BNSS 2023 to the compliance desks of the identified exchanges above (${vasps.map(v => v.vasp_name).join(', ')}) to freeze beneficiary accounts and obtain KYC dossiers.`
   : `Flag the unhosted intermediate recipient wallet on domestic intelligence watchlists (FIU-IND / CERT-In) and monitor for future exchange deposit transactions.`
  }
 </div>

 <div style="margin-top: 30px; text-align: right; color: #94a3b8; font-size: 11px;">
  Generated on ${new Date().toUTCString()} | CONFIDENTIAL - LAW ENFORCEMENT SENSITIVE
 </div>
</body>
</html>`;

 printWindow.document.write(html);
 printWindow.document.close();
 setTimeout(() => printWindow.print(), 300);
}
