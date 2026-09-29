import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional

def generate_sahyog_notice(
    case_id: str,
    officer_name: str,
    officer_badge: str,
    police_station: str,
    fir_number: str,
    vasp_name: str,
    vasp_address: str,
    compliance_email: Optional[str] = None,
    statutory_section: Optional[str] = "Section 91 CrPC / Section 94 BNSS 2023",
    report_data: Optional[Dict[str, Any]] = None,
    specific_requests: Optional[list] = None
) -> Dict[str, Any]:
    """
    Generates a formal legal notice for the MHA SAHYOG Portal
    directed to the target VASP / Centralized Exchange.
    """
    now = datetime.now(timezone.utc)
    issue_date = now.strftime("%d %B %Y")
    notice_ref = f"MHA/SAHYOG/{now.year}/CYBER/{case_id[-8:]}"

    report = report_data or {}
    suspect_addr = report.get("suspect_wallet") or report.get("suspect_address") or "Target Suspect Address"
    chain = report.get("coin") or report.get("blockchain") or "Crypto"
    
    # Extract relevant tx hashes reaching or from the VASP
    tx_hashes = []
    ledger = report.get("chain_of_custody_ledger") or []
    for item in ledger:
        if item.get("to") == vasp_address or item.get("from") == vasp_address:
            tx_hashes.append({
                "hop": item.get("hop", 1),
                "tx_hash": item.get("tx_hash"),
                "amount": f"{item.get('amount')} {chain}",
                "timestamp": item.get("timestamp")
            })

    if not tx_hashes and ledger:
        # Include last 3 hops
        for item in ledger[-3:]:
            tx_hashes.append({
                "hop": item.get("hop", 1),
                "tx_hash": item.get("tx_hash"),
                "amount": f"{item.get('amount')} {chain}",
                "timestamp": item.get("timestamp")
            })

    default_requests = [
        "Immediate freezing and debit freeze on the target exchange account/wallet under Section 102 CrPC / Section 106 BNSS.",
        "Full KYC dossiers: Name, Verified Photo ID, PAN, Aadhaar, Passport, Mobile, Registered Email.",
        "Bank account details used for INR/Fiat deposits and P2P trades linked to this account.",
        "Complete login access logs including IPv4/IPv6 addresses, device identifiers, and timestamp history.",
        "All deposit and withdrawal transaction histories associated with this user ID."
    ]

    requisitions = specific_requests if specific_requests else default_requests

    # Build Printable HTML template
    html_template = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>SAHYOG Statutory Notice - {vasp_name}</title>
<style>
  body {{ font-family: 'Times New Roman', Times, serif; margin: 40px; color: #111; line-height: 1.5; font-size: 14px; }}
  .header {{ text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }}
  .title {{ font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }}
  .sub-title {{ font-size: 13px; font-weight: bold; margin-top: 4px; color: #333; }}
  .meta-grid {{ display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }}
  .recipient-box {{ background: #f8f9fa; border: 1px solid #ccc; padding: 12px; margin-bottom: 20px; font-family: sans-serif; font-size: 13px; }}
  .subject {{ font-weight: bold; font-size: 15px; margin: 20px 0; text-decoration: underline; }}
  .section-title {{ font-weight: bold; margin-top: 16px; margin-bottom: 8px; font-size: 14px; text-transform: uppercase; border-bottom: 1px solid #ddd; }}
  table {{ width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }}
  th, td {{ border: 1px solid #999; padding: 6px 10px; text-align: left; }}
  th {{ background: #eee; font-weight: bold; }}
  ol {{ padding-left: 20px; }}
  li {{ margin-bottom: 6px; }}
  .footer {{ margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }}
  .stamp-box {{ width: 160px; height: 90px; border: 2px dashed #999; text-align: center; line-height: 90px; color: #999; font-size: 12px; }}
  .signature-box {{ text-align: center; }}
</style>
</head>
<body>
  <div class="header">
    <div class="title">GOVERNMENT OF INDIA - MINISTRY OF HOME AFFAIRS</div>
    <div class="sub-title">SAHYOG PORTAL - LAW ENFORCEMENT VASP INFORMATION REQUISITION</div>
    <div style="font-size: 12px; margin-top: 5px;">ISSUED UNDER {statutory_section.upper()}</div>
  </div>

  <div class="meta-grid">
    <div>
      <strong>Notice Ref:</strong> {notice_ref}<br>
      <strong>Police Station:</strong> {police_station}<br>
      <strong>FIR / Crime No:</strong> {fir_number}
    </div>
    <div style="text-align: right;">
      <strong>Date:</strong> {issue_date}<br>
      <strong>Case ID:</strong> {case_id}<br>
      <strong>Priority:</strong> URGENT / CRIME PROCEEDS
    </div>
  </div>

  <div class="recipient-box">
    <strong>TO:</strong><br>
    <strong>The Nodal / Grievance Officer & Legal Compliance Desk</strong><br>
    <strong>Entity:</strong> {vasp_name}<br>
    <strong>Address / Target Identifier:</strong> {vasp_address}<br>
    <strong>Compliance Email:</strong> {compliance_email or 'nodal-desk@' + vasp_name.lower().replace(' ', '') + '.com'}
  </div>

  <div class="subject">
    SUBJECT: NOTICE UNDER {statutory_section} REQUIRING DISCLOSURE OF SUBSCRIBER INFORMATION, KYC DOSSIER, AND IMMEDIATE FREEZE OF PROCEEDS OF CRIME.
  </div>

  <p>
    WHEREAS, an investigation into cyber fraud and money laundering of digital assets is in progress at <strong>{police_station}</strong> under FIR No. <strong>{fir_number}</strong>.
  </p>
  <p>
    AND WHEREAS, automated multi-hop forensic attribution tracing conducted by the cyber investigation unit has established that proceeds of crime originating from suspect wallet <code>{suspect_addr}</code> have been routed directly into deposit wallet / account operated by your platform:
  </p>

  <div class="section-title">Evidence Chain-of-Custody & Transaction Details</div>
  <table>
    <thead>
      <tr>
        <th>Hop</th>
        <th>Transaction Hash (TxID)</th>
        <th>Volume</th>
        <th>Beneficiary Target Address</th>
      </tr>
    </thead>
    <tbody>
      {"".join(f"<tr><td>Hop {t.get('hop')}</td><td><code>{t.get('tx_hash')}</code></td><td>{t.get('amount')}</td><td><code>{vasp_address}</code></td></tr>" for t in tx_hashes) if tx_hashes else f"<tr><td colspan='4'>Target Address: <code>{vasp_address}</code> (Attributed to {vasp_name})</td></tr>"}
    </tbody>
  </table>

  <div class="section-title">Statutory Information Requisition</div>
  <p>
    You are hereby directed under the provisions of <strong>{statutory_section}</strong> to preserve, furnish, and submit the following information within <strong>24 hours</strong> via the SAHYOG Portal:
  </p>
  <ol>
    {"".join(f"<li>{req}</li>" for req in requisitions)}
  </ol>

  <p style="font-size: 12px; color: #444; margin-top: 15px;">
    <strong>LEGAL NOTICE:</strong> Failure to comply with this lawful requisition without justifiable delay invites penal prosecution under Section 175/176 of the Indian Penal Code (IPC) / Section 210/211 of Bharatiya Nyaya Sanhita (BNS) 2023.
  </p>

  <div class="footer">
    <div class="stamp-box">OFFICIAL POLICE SEAL</div>
    <div class="signature-box">
      <br><br>
      <strong>({officer_name})</strong><br>
      Investigating Officer<br>
      Badge ID: {officer_badge}<br>
      {police_station}
    </div>
  </div>
</body>
</html>"""

    return {
        "notice_ref": notice_ref,
        "issue_date": issue_date,
        "case_id": case_id,
        "vasp_name": vasp_name,
        "vasp_address": vasp_address,
        "compliance_email": compliance_email,
        "statutory_section": statutory_section,
        "officer": {
            "name": officer_name,
            "badge": officer_badge,
            "police_station": police_station,
            "fir_number": fir_number
        },
        "requisitions": requisitions,
        "html_document": html_template
    }
