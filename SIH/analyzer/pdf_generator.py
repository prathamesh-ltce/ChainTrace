import os
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm

def generate_fir_pdf(report_data: dict, officer_name: str = "Cyber Crime Investigator") -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    header_title = ParagraphStyle(
        'HeaderTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=16,
        textColor=colors.HexColor('#0f172a'),
        alignment=1,
    )
    header_sub = ParagraphStyle(
        'HeaderSub',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#334155'),
        alignment=1,
    )
    header_statutory = ParagraphStyle(
        'HeaderStatutory',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#64748b'),
        alignment=1,
    )
    section_h = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor('#0f172a'),
    )
    cell_text = ParagraphStyle(
        'CellText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#1e293b'),
    )
    cell_mono = ParagraphStyle(
        'CellMono',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=6.5,
        leading=8.5,
        textColor=colors.HexColor('#0f172a'),
    )
    legal_text = ParagraphStyle(
        'LegalText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#1e293b'),
    )

    story = []

    # 1. Government Police Header
    story.append(Paragraph("FORENSIC INVESTIGATION REPORT / ANNEXURE FOR FIR", header_title))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph("BLOCK FORENSICS &amp; CRYPTO ASSET ATTRIBUTION DIVISION", header_sub))
    story.append(Spacer(1, 1.5 * mm))
    story.append(Paragraph(
        "Generated under Section 91 Cr.P.C. / Section 94 BNSS 2023 &amp; Section 65B Indian Evidence Act 1872 / Section 63 BSA 2023",
        header_statutory
    ))
    story.append(Spacer(1, 3 * mm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0f172a'), spaceAfter=8))

    # Case metadata
    case_id = report_data.get("case_id", "CASE-UNKNOWN")
    suspect = report_data.get("suspect_address") or report_data.get("suspect_wallet") or "N/A"
    coin = report_data.get("blockchain") or report_data.get("coin") or "ETH"
    gen_time = report_data.get("generated_at", "N/A")
    total_out = report_data.get("total_outflow", 0.0)
    risk_level = report_data.get("risk_level") or (report_data.get("risk_assessment") or {}).get("risk_level", "MEDIUM")
    risk_score = report_data.get("risk_score") or (report_data.get("risk_assessment") or {}).get("risk_score", 40)

    meta_data = [
        [
            Paragraph(f"<b>CASE ID:</b> {case_id}", cell_text),
            Paragraph(f"<b>BLOCKCHAIN:</b> {coin}", cell_text),
        ],
        [
            Paragraph(f"<b>INVESTIGATING OFFICER:</b> {officer_name}", cell_text),
            Paragraph(f"<b>THREAT LEVEL:</b> {risk_level} ({risk_score}/100)", cell_text),
        ],
        [
            Paragraph(f"<b>SUSPECT WALLET:</b> <font name='Courier'>{suspect[:16]}...{suspect[-8:]}</font>", cell_text),
            Paragraph(f"<b>TOTAL PROCEEDS:</b> <b>{total_out:.6f} {coin}</b>", cell_text),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[90 * mm, 90 * mm])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 4 * mm))

    # Section 1: Chain of Custody Ledger Table
    story.append(Paragraph("1. CHAIN-OF-CUSTODY &amp; DIRECTIONAL FUND FLOW LEDGER", section_h))
    story.append(Spacer(1, 1.5 * mm))

    ledger = report_data.get("chain_of_custody_ledger") or []
    ledger_rows = [
        [
            Paragraph("<b>Hop</b>", cell_text),
            Paragraph("<b>From (Sender)</b>", cell_text),
            Paragraph("<b>To (Recipient)</b>", cell_text),
            Paragraph("<b>Amount</b>", cell_text),
            Paragraph("<b>ACC</b>", cell_text),
            Paragraph("<b>PAES</b>", cell_text),
            Paragraph("<b>Classification</b>", cell_text),
            Paragraph("<b>TxHash</b>", cell_text),
        ]
    ]

    for item in ledger[:12]:
        hop_num = item.get("hop", 1)
        f_addr = item.get("from", "")
        t_addr = item.get("to", "")
        amt = item.get("amount", 0.0)
        acc = int((item.get("acc_score", 0.7) or 0.7) * 100)
        paes = int((item.get("paes_score", 0.8) or 0.8) * 100)
        tx_h = item.get("tx_hash", "")
        prof = item.get("profile") or "UNHOSTED"
        v_name = (item.get("vasp_info") or {}).get("name", "")
        if "BINANCE" in prof or "EXCHANGE" in prof or v_name == "Binance":
            classif = "VASP: BINANCE"
        elif "BRIDGE" in prof:
            classif = "BRIDGE"
        elif "SWAP" in prof or "DEX" in prof:
            classif = f"DEX: {v_name}" if v_name else "DEX SWAP"
        else:
            classif = "UNHOSTED"

        f_short = f"{f_addr[:6]}...{f_addr[-4:]}" if len(f_addr) > 12 else f_addr
        t_short = f"{t_addr[:6]}...{t_addr[-4:]}" if len(t_addr) > 12 else t_addr
        tx_short = f"{tx_h[:8]}..." if len(tx_h) > 10 else "On-Chain"

        ledger_rows.append([
            Paragraph(f"<b>Hop {hop_num}</b>", cell_text),
            Paragraph(f_short, cell_mono),
            Paragraph(t_short, cell_mono),
            Paragraph(f"<b>{amt:.6f}</b>", cell_text),
            Paragraph(f"{acc}%", cell_text),
            Paragraph(f"{paes}%", cell_text),
            Paragraph(f"<b>{classif}</b>", cell_text),
            Paragraph(tx_short, cell_mono),
        ])

    ledger_table = Table(
        ledger_rows,
        colWidths=[14 * mm, 24 * mm, 24 * mm, 24 * mm, 12 * mm, 12 * mm, 38 * mm, 32 * mm]
    )
    ledger_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#94a3b8')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
    ]))
    story.append(ledger_table)
    story.append(Spacer(1, 4 * mm))

    # Section 2: Actionable VASP Requisition Target
    story.append(Paragraph("2. ACTIONABLE LAW ENFORCEMENT TARGETS (VASP CASH-OUT GATEWAYS)", section_h))
    story.append(Spacer(1, 1.5 * mm))

    vasps = report_data.get("vasp_targets") or []
    if vasps:
        for v in vasps:
            v_name = v.get("vasp_name", "Identified Exchange")
            v_addr = v.get("address", "N/A")
            v_email = v.get("compliance_email", "compliance@exchange.com")
            v_jurisdiction = v.get("jurisdiction", "Global")
            v_acc = int((v.get("acc_score", 0.95) or 0.95) * 100)
            v_paes = int((v.get("paes_score", 0.70) or 0.70) * 100)

            vasp_box_data = [
                [
                    Paragraph(f"<b>IDENTIFIED VASP:</b> <font color='#065f46'><b>{v_name.upper()}</b></font> ({v_jurisdiction})", cell_text),
                    Paragraph(f"<b>CONFIDENCE:</b> ACC {v_acc}% | PAES {v_paes}%", cell_text),
                ],
                [
                    Paragraph(f"<b>DEPOSIT ADDRESS:</b> <font name='Courier'>{v_addr}</font>", cell_text),
                    Paragraph(f"<b>COMPLIANCE DESK:</b> <b>{v_email}</b>", cell_text),
                ],
                [
                    Paragraph("<b>STATUTORY NOTICE:</b> Requisition under Section 91 CrPC / Section 94 BNSS 2023", cell_text),
                    Paragraph("<b>MANDATE:</b> Immediate Account Freeze &amp; KYC Disclosure", cell_text),
                ]
            ]
            v_table = Table(vasp_box_data, colWidths=[100 * mm, 80 * mm])
            v_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#ecfdf5')),
                ('BOX', (0, 0), (-1, -1), 1.5, colors.HexColor('#059669')),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#a7f3d0')),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]))
            story.append(v_table)
            story.append(Spacer(1, 2.5 * mm))
    else:
        story.append(Paragraph("<i>No terminal exchange target reached. Trail currently sitting in unhosted intermediary wallet.</i>", cell_text))
        story.append(Spacer(1, 2.5 * mm))

    # Section 3: Statutory Requisition Directive (Section 91 CrPC / Section 94 BNSS)
    story.append(Paragraph("3. STATUTORY SEIZURE &amp; PRESERVATION DIRECTIVE FOR VASP NODAL DESK", section_h))
    story.append(Spacer(1, 1.5 * mm))
    directive_p = Paragraph(
        "<b>PURSUANT TO SECTION 91 Cr.P.C. / SECTION 94 BHARATIYA NAGARIK SURAKSHA SANHITA (BNSS 2023):</b><br/>"
        "1. <b>Immediate Debit Freeze:</b> Freeze all crypto withdrawals, spot exchange trades, and fiat/P2P off-ramps for the target account.<br/>"
        "2. <b>KYC Disclosure:</b> Furnish complete verified KYC records (Full Legal Name, Government ID/Passport, Registered Phone/Email).<br/>"
        "3. <b>Financial Audit Trail:</b> Furnish linked fiat bank accounts, withdrawal transaction hashes, and domestic UPI references.<br/>"
        "4. <b>Access Logs:</b> Furnish login IP access audit logs with UTC timestamps and device fingerprints.",
        legal_text
    )
    dir_table = Table([[directive_p]], colWidths=[180 * mm])
    dir_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fef2f2')),
        ('BOX', (0, 0), (-1, -1), 1.5, colors.HexColor('#dc2626')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(dir_table)
    story.append(Spacer(1, 4 * mm))

    # Section 4: Section 65B Indian Evidence Act Certificate
    story.append(Paragraph("4. SECTION 65B INDIAN EVIDENCE ACT / SECTION 63 BSA ELECTRONIC CERTIFICATE", section_h))
    story.append(Spacer(1, 1.5 * mm))
    cert_text = Paragraph(
        "<b>CERTIFICATE UNDER SECTION 65B OF INDIAN EVIDENCE ACT, 1872 / SECTION 63 OF BHARATIYA SAKSHYA ADHINIYAM, 2023:</b><br/>"
        "I hereby certify that the blockchain cryptographic transaction ledger detailed in this document was extracted directly "
        "from decentralized public consensus ledger records without tampering or alteration. The computerized system, cryptographic "
        "verification routines, and RPC communication channels operated in normal course throughout the forensic ingestion process. "
        "This document constitutes an authenticated computerized electronic record of the specified blockchain transactions.",
        cell_text
    )
    cert_table = Table([[cert_text]], colWidths=[180 * mm])
    cert_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#ffffff')),
        ('BOX', (0, 0), (-1, -1), 0.8, colors.HexColor('#64748b')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(cert_table)
    story.append(Spacer(1, 5 * mm))

    # Signature Block
    sig_data = [
        [
            Paragraph("<b>Investigating Officer Signature &amp; Name</b><br/><font color='#64748b' size='6.5'>Cyber Crime Police Station</font>", cell_text),
            Paragraph(f"<b>Superintendent of Police / Nodal Seal</b><br/><font color='#64748b' size='6.5'>Certified Electronic Record</font>", cell_text),
        ]
    ]
    sig_table = Table(sig_data, colWidths=[90 * mm, 90 * mm])
    sig_table.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (0, 0), 1, colors.HexColor('#0f172a')),
        ('LINEABOVE', (1, 0), (1, 0), 1, colors.HexColor('#0f172a')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(sig_table)

    doc.build(story)
    return buffer.getvalue()
