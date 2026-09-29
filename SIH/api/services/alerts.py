from typing import Dict, Any, List
from api.database import get_db_connection, create_alert

def evaluate_and_store_alerts(case_id: str, report_data: Dict[str, Any]):
    """
    Evaluates report data against statutory AML/CFT threat rules
    and records alerts into the database.
    """
    suspect = report_data.get("suspect_wallet") or report_data.get("suspect_address") or "Unknown"
    risk_assessment = report_data.get("risk_assessment", {})
    risk_score = risk_assessment.get("composite_score", risk_assessment.get("risk_score", 0))
    typologies = risk_assessment.get("typologies", [])
    vasp_targets = report_data.get("vasp_targets", [])
    cross_chain_hops = report_data.get("cross_chain_hops", [])
    ledger = report_data.get("chain_of_custody_ledger", [])

    # 1. High/Critical Risk Score Alert
    if risk_score >= 70:
        create_alert(
            case_id=case_id,
            severity="CRITICAL",
            title="Critical Risk Score Detected",
            message=f"Wallet {suspect[:12]}... exhibits critical composite risk score of {risk_score}/100.",
            entity_address=suspect,
            entity_name="Suspect Wallet"
        )
    elif risk_score >= 40:
        create_alert(
            case_id=case_id,
            severity="HIGH",
            title="Elevated Forensic Risk Detected",
            message=f"Composite risk score of {risk_score}/100 detected with structured movement.",
            entity_address=suspect,
            entity_name="Suspect Wallet"
        )

    # 2. Typology-specific alerts
    for typ in typologies:
        code = typ.get("code", "")
        title = typ.get("title", "")
        sev = typ.get("severity", "MEDIUM")
        if "CFT" in code or "Terrorism" in title:
            create_alert(
                case_id=case_id,
                severity="CRITICAL",
                title=f"Terrorism Financing Red Flag [{code}]",
                message=f"Direct/indirect nexus detected under UAPA Sec 51A: {title}.",
                entity_address=suspect,
                entity_name="CFT Designated Entity"
            )
        elif "SANCT" in code or "Sanctioned" in title:
            create_alert(
                case_id=case_id,
                severity="CRITICAL",
                title=f"International Sanctioned Entity [{code}]",
                message=f"Nexus with OFAC/UNSC SDN list identified: {title}.",
                entity_address=suspect,
                entity_name="Sanctioned Entity"
            )
        elif "AML" in code or "Mixer" in title:
            create_alert(
                case_id=case_id,
                severity="HIGH",
                title=f"Mixer / Tumbler Obfuscation [{code}]",
                message=f"Fund laundering via mixing protocol identified under PMLA Sec 3: {title}.",
                entity_address=suspect,
                entity_name="Mixer Protocol"
            )
        elif "PEEL" in code or "Peeling" in title:
            create_alert(
                case_id=case_id,
                severity="MEDIUM",
                title=f"Peeling Chain Pattern [{code}]",
                message=f"Automated rapid fragmentation detected along the trail: {title}.",
                entity_address=suspect,
                entity_name="Peeling Chain"
            )

    # 3. Cross-Chain Bridge Alerts
    if cross_chain_hops:
        for b_hop in cross_chain_hops:
            proto = b_hop.get("protocol", "Decentralized Bridge")
            dest = b_hop.get("destination_chain_name", "Target Chain")
            create_alert(
                case_id=case_id,
                severity="HIGH",
                title="Cross-Chain Bridge Hopping Detected",
                message=f"Funds hopped across chain via {proto} to {dest}. Destination recipient: {b_hop.get('recipient')}.",
                entity_address=b_hop.get("recipient"),
                entity_name=proto
            )

    # 4. Terminal VASP Gateway Alerts
    if vasp_targets:
        for vt in vasp_targets:
            v_name = vt.get("vasp_name", "Identified Exchange")
            hop_num = vt.get("hop", 1)
            create_alert(
                case_id=case_id,
                severity="INFO",
                title=f"Terminal VASP Reached ({v_name})",
                message=f"Funds deposited into {v_name} at Hop {hop_num}. Section 91 CrPC notice ready.",
                entity_address=vt.get("address"),
                entity_name=v_name
            )

def get_alerts(limit: int = 50, severity: str = None) -> List[Dict[str, Any]]:
    """Fetches alerts from database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    if severity and severity.upper() != "ALL":
        cursor.execute(
            "SELECT * FROM alerts WHERE severity = ? ORDER BY id DESC LIMIT ?",
            (severity.upper(), limit)
        )
    else:
        cursor.execute(
            "SELECT * FROM alerts ORDER BY id DESC LIMIT ?",
            (limit,)
        )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def mark_alert_read(alert_id: int):
    """Marks an alert as read."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE alerts SET is_read = 1 WHERE id = ?", (alert_id,))
    conn.commit()
    conn.close()

def get_unread_alerts_count() -> int:
    """Returns count of unread alerts."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM alerts WHERE is_read = 0")
    row = cursor.fetchone()
    conn.close()
    return row["cnt"] if row else 0
