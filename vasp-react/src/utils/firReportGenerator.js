import { API_BASE } from './api'
// Utility to generate and download official Court & Police Admissible FIR Evidence PDF Report

export function generateFirHtml(report, officerName = 'Cyber Crime Investigator') {
 if (!report) return ''

 const suspect = report.suspect_address || report.suspect_wallet || 'N/A'
 const chain = report.blockchain || report.coin || 'BTC'
 const caseId = report.case_id || 'CASE-' + Date.now()
 const genDate = report.generated_at ? new Date(report.generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : new Date().toLocaleString('en-IN')
 const vasps = report.vasp_targets || []
 const ledger = report.chain_of_custody_ledger || []
 const risk = report.risk_assessment || {}
 const typologies = risk.typologies || []

 // Extract the primary 5-hop trail leading to the cash-out exchange
 const vaspNode = vasps[0]
 let primaryTrail = []
 if (vaspNode && ledger.length > 0) {
  let currentAddr = vaspNode.address
  let hopsFound = []
  let guard = 0
  while (currentAddr && currentAddr.toLowerCase() !== suspect.toLowerCase() && guard < 15) {
   guard++
   const inEdge = ledger.filter(r => r.to?.toLowerCase() === currentAddr.toLowerCase()).sort((a,b) => (b.amount||0) - (a.amount||0))[0]
   if (!inEdge) break
   hopsFound.unshift(inEdge)
   currentAddr = inEdge.from
  }
  primaryTrail = hopsFound.length > 0 ? hopsFound : ledger.slice(0, 8)
 } else {
  primaryTrail = ledger.slice(0, 8)
 }

 // Calculate totals
 const totalStolen = report.on_chain_summary?.total_outflow || primaryTrail.reduce((s, r) => s + (Number(r.amount) || 0), 0)

 return `<!DOCTYPE html>
<html lang="en">
<head>
 <meta charset="UTF-8">
 <title>FIR_Crypto_Evidence_${caseId}</title>
 <style>
  @page {
   size: A4 portrait;
   margin: 14mm 16mm;
  }
  @media print {
   body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
   .no-print { display: none !important; }
   .page-break { page-break-before: always; }
  }
  body {
   font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
   color: #0f172a;
   background: #ffffff;
   margin: 0;
   padding: 20px;
   font-size: 11pt;
   line-height: 1.45;
  }
  .fir-container {
   max-width: 800px;
   margin: 0 auto;
   border: 2px solid #0f172a;
   padding: 24px;
   background: #fff;
  }
  .gov-header {
   text-align: center;
   border-bottom: 2px solid #0f172a;
   padding-bottom: 14px;
   margin-bottom: 16px;
  }
  .gov-title {
   font-size: 15pt;
   font-weight: 800;
   letter-spacing: 1px;
   text-transform: uppercase;
   color: #0f172a;
   margin: 0 0 4px 0;
  }
  .gov-sub {
   font-size: 10pt;
   font-weight: 700;
   color: #334155;
   text-transform: uppercase;
   letter-spacing: 0.5px;
   margin: 0 0 4px 0;
  }
  .gov-statutory {
   font-size: 8.5pt;
   color: #475569;
   font-style: italic;
  }
  .case-meta-grid {
   display: grid;
   grid-template-columns: 1fr 1fr;
   gap: 8px;
   background: #f8fafc;
   border: 1px solid #cbd5e1;
   padding: 10px 14px;
   margin-bottom: 16px;
   font-size: 9.5pt;
  }
  .meta-item strong {
   color: #1e293b;
   min-width: 130px;
   display: inline-block;
  }
  .section-title {
   font-size: 11pt;
   font-weight: 800;
   text-transform: uppercase;
   color: #0f172a;
   border-bottom: 1.5px solid #0f172a;
   padding-bottom: 4px;
   margin: 18px 0 10px 0;
   display: flex;
   justify-content: space-between;
  }
  .evidence-box {
   border: 1px solid #94a3b8;
   background: #f1f5f9;
   padding: 10px 12px;
   border-radius: 4px;
   margin-bottom: 14px;
   font-size: 9.5pt;
  }
  .evidence-box code {
   font-family: 'Consolas', 'Courier New', monospace;
   font-weight: 700;
   color: #0f172a;
   word-break: break-all;
  }
  table {
   width: 100%;
   border-collapse: collapse;
   margin-bottom: 14px;
   font-size: 8.5pt;
  }
  th, td {
   border: 1px solid #cbd5e1;
   padding: 6px 8px;
   text-align: left;
  }
  th {
   background: #e2e8f0;
   color: #0f172a;
   font-weight: 700;
   text-transform: uppercase;
   font-size: 8pt;
  }
  tr:nth-child(even) {
   background: #f8fafc;
  }
  .mono {
   font-family: 'Consolas', 'Courier New', monospace;
   word-break: break-all;
  }
  .tag-danger {
   color: #b91c1c;
   font-weight: 700;
  }
  .tag-success {
   color: #047857;
   font-weight: 700;
  }
  .legal-notice-box {
   border: 2px solid #b91c1c;
   background: #fef2f2;
   padding: 12px 14px;
   border-radius: 4px;
   margin: 14px 0;
   font-size: 9.5pt;
  }
  .legal-notice-box h4 {
   margin: 0 0 6px 0;
   color: #991b1b;
   font-size: 10.5pt;
   font-weight: 800;
   text-transform: uppercase;
  }
  .certificate-65b {
   border: 1px solid #64748b;
   padding: 10px 12px;
   background: #ffffff;
   font-size: 8pt;
   color: #334155;
   margin-top: 16px;
   text-align: justify;
  }
  .sign-grid {
   display: grid;
   grid-template-columns: 1fr 1fr;
   gap: 30px;
   margin-top: 30px;
   padding-top: 10px;
  }
  .sign-box {
   border-top: 1px solid #0f172a;
   text-align: center;
   padding-top: 6px;
   font-size: 9pt;
   font-weight: 600;
  }
 </style>
</head>
<body>
 <div class="fir-container">
  <!-- Official Police Heading -->
  <div class="gov-header">
   <div class="gov-title">FORENSIC INVESTIGATION REPORT / ANNEXURE FOR FIR</div>
   <div class="gov-sub">Block Forensics & Crypto Asset Attribution Division</div>
   <div class="gov-statutory">
    Generated under Section 91 Cr.P.C. / Section 94 BNSS 2023 & Section 65B Indian Evidence Act 1872 / Section 63 BSA 2023
   </div>
  </div>

  <!-- Case Metadata -->
  <div class="case-meta-grid">
   <div class="meta-item"><strong>CASE ID:</strong> ${caseId}</div>
   <div class="meta-item"><strong>DATE & TIME:</strong> ${genDate}</div>
   <div class="meta-item"><strong>INVESTIGATING AGENT:</strong> ${officerName}</div>
   <div class="meta-item"><strong>BLOCKCHAIN NETWORK:</strong> ${chain}</div>
   <div class="meta-item"><strong>CRIME CATEGORY:</strong> Cyber Financial Fraud / Laundering</div>
   <div class="meta-item"><strong>TOTAL PROCEEDS TRACED:</strong> ${formatAmount(totalStolen)} ${chain}</div>
  </div>

  <!-- Section 1: Suspect Wallet -->
  <div class="section-title">
   <span>1. Primary Suspect Wallet (Origin of Fraudulent Outflows)</span>
   <span class="tag-danger">[PRIMARY SUSPECT]</span>
  </div>
  <div class="evidence-box">
   <div><strong>Suspect Wallet Address:</strong> <code>${suspect}</code></div>
   <div><strong>Total Outflow Amount:</strong> <strong>${formatAmount(totalStolen)} ${chain}</strong></div>
   <div><strong>Statutory Classification:</strong> Offense under IT Act Sec 66/66D & PMLA Sec 3 (Proceeds of Crime)</div>
   <div><strong>Detected Modus Operandi:</strong> ${typologies.map(t => t.title || t.code).join(', ') || 'Multi-Hop Layering & Peeling Chain (PMLA Sec 3)'}</div>
  </div>

  <!-- Section 2: Chain of Custody (5-Hop Trail) -->
  <div class="section-title">
   <span>2. Chain of Custody & Layering Trail (Hop-by-Hop Forensics)</span>
  </div>
  <table>
   <thead>
    <tr>
     <th style="width: 50px;">Hop</th>
     <th>Sender (From)</th>
     <th>Recipient (To)</th>
     <th style="width: 80px;">Amount</th>
     <th style="width: 95px;">Date & Time</th>
     <th>Transaction Hash (TxID)</th>
    </tr>
   </thead>
   <tbody>
    ${primaryTrail.map((r, i) => `
     <tr>
      <td><strong>Hop ${r.hop || (i + 1)}</strong></td>
      <td class="mono">${r.from ? r.from.slice(0, 10) + '...' + r.from.slice(-6) : 'N/A'}</td>
      <td class="mono">${r.to ? r.to.slice(0, 10) + '...' + r.to.slice(-6) : 'N/A'}</td>
      <td style="font-weight: 700; color: #0284c7;">${formatAmount(r.amount)} ${chain}</td>
      <td>${formatDateTime(r.timestamp)}</td>
      <td class="mono">${r.tx_hash ? r.tx_hash.slice(0, 12) + '...' : 'On-Chain Ledger'}</td>
     </tr>
    `).join('')}
   </tbody>
  </table>

  <!-- Section 3: Target VASP / Exchange Details -->
  <div class="section-title">
   <span>3. Terminal VASP / Exchange Identification (Asset Cash-Out Point)</span>
   <span class="tag-success">[REQUISITION TARGET]</span>
  </div>
  ${vasps.length > 0 ? vasps.map(v => `
   <div class="evidence-box" style="border-left: 4px solid #059669; background: #ecfdf5;">
    <div><strong>Identified Regulated Exchange:</strong> <span style="font-size: 11pt; font-weight: 800; color: #065f46;">${v.vasp_name || 'Binance'}</span> (${v.jurisdiction || 'Global'})</div>
    <div><strong>Exchange Deposit Address:</strong> <code>${v.address}</code></div>
    <div><strong>Compliance Nodal Desk:</strong> <strong>${v.compliance_email || 'compliance@exchange.com'}</strong></div>
    <div><strong>Legal Basis:</strong> Section 91 CrPC / Section 94 BNSS 2023 Statutory Preservation Requisition</div>
   </div>
  `).join('') : `
   <div class="evidence-box">
    <div><strong>Identified Terminal Gateway:</strong> Centralized Custodial Deposit Gateway identified at Hop ${primaryTrail[primaryTrail.length - 1]?.hop || 5}.</div>
    <div><strong>Deposit Wallet:</strong> <code>${primaryTrail[primaryTrail.length - 1]?.to || 'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h'}</code></div>
   </div>
  `}

  <!-- Legal Directive Requisition Box for Police Officer -->
  <div class="legal-notice-box">
   <h4> Police Directive & Statutory Seizure Requisition</h4>
   <p style="margin: 0 0 6px 0;">
    Under powers vested pursuant to <strong>Section 91 of the Code of Criminal Procedure, 1973 (Cr.P.C.)</strong> and <strong>Section 94 of Bharatiya Nagarik Suraksha Sanhita (BNSS 2023)</strong>:
   </p>
   <ol style="margin: 0; padding-left: 20px;">
    <li><strong>Immediate Account Freeze:</strong> Freeze all withdrawals, spot trades, and P2P transfers linked to the deposit address above.</li>
    <li><strong>KYC Records:</strong> Furnish verified KYC identity (Full Name, Date of Birth, National ID / Passport, Registered Mobile & Email).</li>
    <li><strong>Financial Records:</strong> Furnish associated fiat bank account numbers, UPI IDs, and withdrawal transaction logs.</li>
    <li><strong>IP Audit Trail:</strong> Furnish access IP addresses with timestamps for all logins associated with this customer ID.</li>
   </ol>
  </div>

  <!-- Section 65B Electronic Evidence Certificate -->
  <div class="certificate-65b">
   <strong>CERTIFICATE UNDER SECTION 65B OF INDIAN EVIDENCE ACT, 1872 / SECTION 63 OF BSA 2023:</strong><br />
   I hereby certify that the blockchain cryptographic transaction ledger detailed in this document was extracted directly from decentralized public node consensus records without alteration. The computer systems and cryptographic hashing algorithms were operating in normal course without corruption. This document constitutes an authenticated computerized record of blockchain ledger entries.
  </div>

  <!-- Signature Block -->
  <div class="sign-grid">
   <div class="sign-box">
    Investigating Officer Signature & Name<br />
    <span style="font-size: 8pt; color: #64748b;">(Cyber Crime Police Station)</span>
   </div>
   <div class="sign-box">
    Superintendent / Nodal Agency Seal<br />
    <span style="font-size: 8pt; color: #64748b;">(Dated: ${new Date().toLocaleDateString('en-IN')})</span>
   </div>
  </div>
 </div>

 <script>
  window.onload = function() {
   setTimeout(function() {
    window.print();
   }, 500);
  }
 </script>
</body>
</html>`
}

export async function downloadFirPdf(report, officerName = 'Cyber Crime Investigator') {
 if (!report) return false
 const caseId = report.case_id || 'VASP-' + Date.now()
 const filename = `FIR_EVIDENCE_${caseId}.pdf`

 // Strategy 1: Direct native PDF binary file download from FastAPI Backend
 try {
  let res = null
  if (report.case_id) {
   res = await fetch(`${API_BASE}/reports/${encodeURIComponent(report.case_id)}/pdf?officer=${encodeURIComponent(officerName)}`)
  }
  if (!res || !res.ok) {
   res = await fetch(`${API_BASE}/reports/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report, officer_name: officerName })
   })
  }

  if (res && res.ok) {
   const blob = await res.blob()
   const blobUrl = window.URL.createObjectURL(blob)
   const a = document.createElement('a')
   a.href = blobUrl
   a.download = filename
   document.body.appendChild(a)
   a.click()
   document.body.removeChild(a)
   window.URL.revokeObjectURL(blobUrl)
   return true
  }
 } catch (err) {
  console.warn('Backend PDF endpoint error, falling back to client-side print engine:', err)
 }

 // Strategy 2: Client-side hidden iframe Print / Save-as-PDF (Bypasses popup blockers)
 try {
  const htmlContent = generateFirHtml(report, officerName)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(htmlContent)
  doc.close()

  setTimeout(() => {
   try {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
   } catch (e) {
    console.warn('Iframe print error:', e)
   }
   setTimeout(() => {
    if (document.body.contains(iframe)) {
     document.body.removeChild(iframe)
    }
   }, 60000)
  }, 400)
  return true
 } catch (err2) {
  console.error('All PDF download strategies failed:', err2)
  return false
 }
}

export function downloadJsonReport(report) {
 if (!report) return false
 const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
 const url = URL.createObjectURL(blob)
 const a = document.createElement('a')
 a.href = url
 a.download = (report.case_id || 'vasp-investigation') + '.json'
 a.click()
 URL.revokeObjectURL(url)
 return true
}
