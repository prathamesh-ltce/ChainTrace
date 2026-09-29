"""
Forensic Risk Classification & AML/CFT Typology Engine.
Compliant with FATF Red Flag Indicators, FIU-IND Guidance, and PMLA/UAPA Standards.

Calculates multi-factor risk scores without naive hardcoded if-else ladders:
- Category Threat Matrix (Entity Taxonomy)
- Geometric Hop Proximity Decay: Threat(h) = BaseScore * (lambda)^(h - 1)
- Algorithmic Behavioral Pattern Penalties (Peeling Chain, CoinJoin, Chain-Hopping)
- Standardized Statutory Typology Tagging (PMLA, UAPA, IT Act, FEMA)
"""

from enum import Enum
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field


class RiskLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class RiskCategory(str, Enum):
    TERRORISM_FINANCING = "terrorism_financing"
    RANSOMWARE = "ransomware"
    SANCTIONED_ENTITY = "sanctioned_entity"
    STATE_ACTOR = "state_actor"
    DARKNET = "darknet"
    MIXER = "mixer"
    BETTING = "betting"
    PEELING_CHAIN = "peeling_chain"
    DEFI_BRIDGE = "defi_bridge"
    HIGH_RISK_EXCHANGE = "high_risk_exchange"
    DEX = "dex"
    CUSTODIAL_EXCHANGE = "custodial_exchange"
    UNHOSTED = "unhosted"


@dataclass
class TypologyDefinition:
    code: str
    category: RiskCategory
    title: str
    description: str
    statutory_reference: str
    base_threat_weight: int
    level: RiskLevel
    investigative_action: str


# Standardized FIU-IND / FATF Typology Registry
TYPOLOGY_REGISTRY: Dict[str, TypologyDefinition] = {
    "TYP-CFT-01": TypologyDefinition(
        code="TYP-CFT-01",
        category=RiskCategory.TERRORISM_FINANCING,
        title="Terrorism Financing Risk",
        description="Direct or indirect linkage with addresses designated under UAPA / UNSC 1267 for funding terrorist organizations.",
        statutory_reference="Unlawful Activities (Prevention) Act (UAPA) Sec 51A / PMLA Sec 3",
        base_threat_weight=100,
        level=RiskLevel.CRITICAL,
        investigative_action="Immediate freeze request via FIU-IND / NIA escalation / UNSC designated asset freeze.",
    ),
    "TYP-CYBER-01": TypologyDefinition(
        code="TYP-CYBER-01",
        category=RiskCategory.RANSOMWARE,
        title="Ransomware Extortion Proceeds",
        description="Funds linked to ransomware extortion campaigns (LockBit, WannaCry, BlackCat, Conti).",
        statutory_reference="IT Act Section 66 / 66F (Cyber Terrorism) & CERT-In Mandatory Incident Reporting",
        base_threat_weight=95,
        level=RiskLevel.CRITICAL,
        investigative_action="Coordinate with CERT-In & international law enforcement (Interpol / FBI IC3) to track cash-out points.",
    ),
    "TYP-SANCT-01": TypologyDefinition(
        code="TYP-SANCT-01",
        category=RiskCategory.SANCTIONED_ENTITY,
        title="International Sanctioned Entity / State Actor",
        description="Interaction with addresses on OFAC SDN, EU, or UN sanctions lists, including DPRK Lazarus Group cyber-theft.",
        statutory_reference="United Nations (Security Council) Act / Ministry of External Affairs Directives",
        base_threat_weight=95,
        level=RiskLevel.CRITICAL,
        investigative_action="Issue formal blacklisting notification to all domestic reporting entities (REs).",
    ),
    "TYP-DNM-01": TypologyDefinition(
        code="TYP-DNM-01",
        category=RiskCategory.DARKNET,
        title="Darknet Marketplace Contraband",
        description="Transactions routed to or from illicit darknet markets (Hydra, AlphaBay, Silk Road) for narcotics/weapons.",
        statutory_reference="Narcotic Drugs and Psychotropic Substances (NDPS) Act / IPC Cyber Offenses",
        base_threat_weight=90,
        level=RiskLevel.CRITICAL,
        investigative_action="Procure vendor transaction identifiers & initiate NCB / Cyber Police investigation.",
    ),
    "TYP-AML-01": TypologyDefinition(
        code="TYP-AML-01",
        category=RiskCategory.MIXER,
        title="Money Laundering via Mixer/Tumbler",
        description="Deliberate concealment and severing of blockchain audit trails via zero-knowledge or UTXO coin mixing services.",
        statutory_reference="Section 3 Prevention of Money Laundering Act (PMLA) 2002",
        base_threat_weight=85,
        level=RiskLevel.CRITICAL,
        investigative_action="Record in FIR as deliberate concealment of proceeds of crime. Flag non-custodial anonymity pool.",
    ),
    "TYP-FEMA-01": TypologyDefinition(
        code="TYP-FEMA-01",
        category=RiskCategory.BETTING,
        title="Illegal Offshore Betting / Gambling",
        description="Outflows directed into unauthorized offshore betting platforms (1xBet, Stake, Cloudbet) violating Indian gaming laws.",
        statutory_reference="Foreign Exchange Management Act (FEMA) / State Public Gambling Acts",
        base_threat_weight=65,
        level=RiskLevel.HIGH,
        investigative_action="Submit domain/ISP blocking order under IT Act 69A and summon Indian payment intermediary gateways.",
    ),
    "TYP-PEEL-01": TypologyDefinition(
        code="TYP-PEEL-01",
        category=RiskCategory.PEELING_CHAIN,
        title="Peeling Chain & Rapid Layering",
        description="Automated sweeping where funds are rapidly fragmented across short timeframes (<10 mins) with high split ratios.",
        statutory_reference="FATF Red Flag Indicator — Automated Structuring & Layering",
        base_threat_weight=60,
        level=RiskLevel.HIGH,
        investigative_action="Construct topological fund flow graph to identify the terminal consolidation or cash-out wallet.",
    ),
    "TYP-XCHAIN-01": TypologyDefinition(
        code="TYP-XCHAIN-01",
        category=RiskCategory.DEFI_BRIDGE,
        title="Cross-Chain Bridge Hopping",
        description="Use of decentralized cross-chain bridge protocols (Across, Stargate, Wormhole) to hop chains and break linear forensics.",
        statutory_reference="FIU-IND Red Flag Indicator — Cross-Chain Capital Flight",
        base_threat_weight=45,
        level=RiskLevel.MEDIUM,
        investigative_action="Decode cross-chain relayer deposit/fill transaction logs to follow funds on the destination ledger.",
    ),
    "TYP-LAYER-01": TypologyDefinition(
        code="TYP-LAYER-01",
        category=RiskCategory.UNHOSTED,
        title="Multi-Hop Structured Layering",
        description="Funds traversed through multiple intermediary unhosted hops (>= 4 hops) without legitimate commercial justification.",
        statutory_reference="PMLA Section 12 — Suspicious Transaction Report (STR) Indicator",
        base_threat_weight=35,
        level=RiskLevel.MEDIUM,
        investigative_action="Trace forward until a custodial VASP / KYC gateway is identified for Section 91 CrPC notice.",
    ),
    "TYP-GATEWAY-01": TypologyDefinition(
        code="TYP-GATEWAY-01",
        category=RiskCategory.CUSTODIAL_EXCHANGE,
        title="Regulated Custodial VASP Gateway",
        description="Funds deposited into centralized custodial exchange (Binance, OKX, CoinDCX, WazirX) offering KYC records.",
        statutory_reference="Section 91 CrPC / Section 94 Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023",
        base_threat_weight=5,
        level=RiskLevel.LOW,
        investigative_action="Serve statutory preservation & account-freeze notice under Section 91 CrPC / 94 BNSS to Exchange Nodal Desk.",
    ),
    "TYP-SWAP-01": TypologyDefinition(
        code="TYP-SWAP-01",
        category=RiskCategory.DEX,
        title="Decentralized Token Swapping / AMM Layering",
        description="Conversion of assets through decentralized liquidity pools (Uniswap, Sushi, Pancake) to obfuscate fund flows.",
        statutory_reference="PMLA Section 3 / FIU-IND Layering Typology",
        base_threat_weight=40,
        level=RiskLevel.MEDIUM,
        investigative_action="Inspect token transfer swap logs, liquidity pair routing, and destination token recipient address.",
    ),
}

# Mapping raw entity types from resolvers/registries to normalized RiskCategory
ENTITY_CATEGORY_MAP: Dict[str, RiskCategory] = {
    "terrorism_financing": RiskCategory.TERRORISM_FINANCING,
    "terrorism": RiskCategory.TERRORISM_FINANCING,
    "terrorist": RiskCategory.TERRORISM_FINANCING,
    "ransomware": RiskCategory.RANSOMWARE,
    "extortion": RiskCategory.RANSOMWARE,
    "sanctioned_entity": RiskCategory.SANCTIONED_ENTITY,
    "sanctioned_exchange": RiskCategory.SANCTIONED_ENTITY,
    "sanction": RiskCategory.SANCTIONED_ENTITY,
    "state_actor": RiskCategory.STATE_ACTOR,
    "darknet": RiskCategory.DARKNET,
    "darknet_market": RiskCategory.DARKNET,
    "mixer": RiskCategory.MIXER,
    "tumbler": RiskCategory.MIXER,
    "coinjoin_coordinator": RiskCategory.MIXER,
    "privacy_relay": RiskCategory.MIXER,
    "betting": RiskCategory.BETTING,
    "gambling": RiskCategory.BETTING,
    "defi_bridge": RiskCategory.DEFI_BRIDGE,
    "bridge": RiskCategory.DEFI_BRIDGE,
    "dex": RiskCategory.DEX,
    "dex_swapper": RiskCategory.DEX,
    "defi_swapper": RiskCategory.DEX,
    "amm_pool": RiskCategory.DEX,
    "exchange": RiskCategory.CUSTODIAL_EXCHANGE,
    "custodial": RiskCategory.CUSTODIAL_EXCHANGE,
    "centralized_exchange": RiskCategory.CUSTODIAL_EXCHANGE,
    "p2p_exchange": RiskCategory.CUSTODIAL_EXCHANGE,
    "instant_swap": RiskCategory.HIGH_RISK_EXCHANGE,
    "unhosted": RiskCategory.UNHOSTED,
}

# Category to primary typology code
CATEGORY_TO_TYPOLOGY: Dict[RiskCategory, str] = {
    RiskCategory.TERRORISM_FINANCING: "TYP-CFT-01",
    RiskCategory.RANSOMWARE: "TYP-CYBER-01",
    RiskCategory.SANCTIONED_ENTITY: "TYP-SANCT-01",
    RiskCategory.STATE_ACTOR: "TYP-SANCT-01",
    RiskCategory.DARKNET: "TYP-DNM-01",
    RiskCategory.MIXER: "TYP-AML-01",
    RiskCategory.BETTING: "TYP-FEMA-01",
    RiskCategory.PEELING_CHAIN: "TYP-PEEL-01",
    RiskCategory.DEFI_BRIDGE: "TYP-XCHAIN-01",
    RiskCategory.DEX: "TYP-SWAP-01",
    RiskCategory.CUSTODIAL_EXCHANGE: "TYP-GATEWAY-01",
}


@dataclass
class NodeRiskAssessment:
    category: RiskCategory
    base_score: int
    decayed_score: float
    hop: int
    risk_level: RiskLevel
    typology: Optional[TypologyDefinition]
    display_badge: str


@dataclass
class CaseRiskReport:
    composite_score: int
    risk_level: RiskLevel
    typologies: List[TypologyDefinition]
    high_risk_alerts: List[Dict[str, Any]]
    category_breakdown: Dict[str, float]
    summary_verdict: str


class ForensicRiskEngine:
    """
    Mathematical Risk Scoring & Typology Tagging Engine.
    Employs geometric taint decay: Risk(h) = Base * (lambda)^(h - 1), where lambda = 0.75.
    """

    TAINT_DECAY_FACTOR = 0.75

    @classmethod
    def classify_entity_type(cls, raw_type: Optional[str], raw_name: Optional[str] = None) -> RiskCategory:
        """Determines the standardized RiskCategory without dirty nested if/else."""
        norm_type = (raw_type or "").lower().strip()
        norm_name = (raw_name or "").lower().strip()

        # Check explicit type mapping
        if norm_type in ENTITY_CATEGORY_MAP:
            return ENTITY_CATEGORY_MAP[norm_type]

        # Name-based heuristic dictionary lookup
        for kw, cat in [
            ("terror", RiskCategory.TERRORISM_FINANCING),
            ("hamas", RiskCategory.TERRORISM_FINANCING),
            ("isis", RiskCategory.TERRORISM_FINANCING),
            ("al-qaeda", RiskCategory.TERRORISM_FINANCING),
            ("ransomware", RiskCategory.RANSOMWARE),
            ("lockbit", RiskCategory.RANSOMWARE),
            ("wannacry", RiskCategory.RANSOMWARE),
            ("blackcat", RiskCategory.RANSOMWARE),
            ("conti", RiskCategory.RANSOMWARE),
            ("lazarus", RiskCategory.STATE_ACTOR),
            ("hydra", RiskCategory.DARKNET),
            ("alphabay", RiskCategory.DARKNET),
            ("silk road", RiskCategory.DARKNET),
            ("tornado", RiskCategory.MIXER),
            ("wasabi", RiskCategory.MIXER),
            ("whirlpool", RiskCategory.MIXER),
            ("chipmixer", RiskCategory.MIXER),
            ("sinbad", RiskCategory.MIXER),
            ("blender", RiskCategory.MIXER),
            ("1xbet", RiskCategory.BETTING),
            ("stake", RiskCategory.BETTING),
            ("cloudbet", RiskCategory.BETTING),
            ("bridge", RiskCategory.DEFI_BRIDGE),
            ("spokepool", RiskCategory.DEFI_BRIDGE),
            ("across", RiskCategory.DEFI_BRIDGE),
            ("stargate", RiskCategory.DEFI_BRIDGE),
            ("wormhole", RiskCategory.DEFI_BRIDGE),
        ]:
            if kw in norm_name or kw in norm_type:
                return cat

        return RiskCategory.UNHOSTED

    @classmethod
    def evaluate_node(
        cls,
        address: str,
        hop: int,
        raw_type: Optional[str] = None,
        raw_name: Optional[str] = None,
        peeling_detected: bool = False,
    ) -> NodeRiskAssessment:
        """Evaluates risk and assigns typology for a single graph node."""
        if raw_type in ("exchange", "custodial", "centralized_exchange", "p2p_exchange", "dex", "dex_swapper", "defi_bridge", "mixer") or raw_name:
            category = cls.classify_entity_type(raw_type, raw_name)
        elif peeling_detected:
            category = RiskCategory.PEELING_CHAIN
        else:
            category = cls.classify_entity_type(raw_type, raw_name)

        typology_code = CATEGORY_TO_TYPOLOGY.get(category)
        typology = TYPOLOGY_REGISTRY.get(typology_code) if typology_code else None

        base_score = typology.base_threat_weight if typology else (20 if hop > 0 else 0)

        # Apply geometric decay based on hop distance from suspect
        effective_hop = max(1, hop)
        decay = cls.TAINT_DECAY_FACTOR ** (effective_hop - 1)
        decayed_score = round(base_score * decay, 2)

        if decayed_score >= 70:
            level = RiskLevel.CRITICAL
        elif decayed_score >= 45:
            level = RiskLevel.HIGH
        elif decayed_score >= 25:
            level = RiskLevel.MEDIUM
        else:
            level = RiskLevel.LOW

        # Generate standard forensic badge
        if category == RiskCategory.CUSTODIAL_EXCHANGE:
            badge = f"[VERIFIED VASP: {(raw_name or 'EXCHANGE').upper()} | RISK: LOW]"
        elif category == RiskCategory.DEFI_BRIDGE:
            badge = f"[DEFI BRIDGE: {(raw_name or 'BRIDGE').upper()} | RISK: MEDIUM]"
        elif category == RiskCategory.DEX:
            badge = f"[DEFI SWAPPER: {(raw_name or 'DEX').upper()} | RISK: MEDIUM]"
        elif typology:
            badge = f"[{typology.title.upper()} | RISK: {level.value}]"
        else:
            badge = f"[UNHOSTED INTERMEDIARY | RISK: {level.value}]"

        return NodeRiskAssessment(
            category=category,
            base_score=base_score,
            decayed_score=decayed_score,
            hop=hop,
            risk_level=level,
            typology=typology,
            display_badge=badge,
        )

    @classmethod
    def evaluate_case(
        cls,
        ledger: List[Dict[str, Any]],
        cross_chain_hops: List[Dict[str, Any]],
        max_hops_traced: int,
    ) -> CaseRiskReport:
        """
        Synthesizes all discovered graph nodes, transactions, and behavioral patterns
        into a unified, mathematically derived Case Risk Report with formal Typology tags.
        """
        category_max_decayed: Dict[RiskCategory, float] = {}
        triggered_typologies: Dict[str, TypologyDefinition] = {}
        high_risk_alerts: List[Dict[str, Any]] = []

        # 1. Process Ledger Entries
        for item in ledger:
            hop = item.get("hop", 1)
            v_info = item.get("vasp_info") or {}
            raw_type = v_info.get("type")
            raw_name = v_info.get("name")
            peeling = item.get("peeling_detected", False)

            node_eval = cls.evaluate_node(
                address=item.get("to", ""),
                hop=hop,
                raw_type=raw_type,
                raw_name=raw_name,
                peeling_detected=peeling,
            )

            cat = node_eval.category
            score = node_eval.decayed_score
            category_max_decayed[cat] = max(category_max_decayed.get(cat, 0.0), score)

            if node_eval.typology:
                t = node_eval.typology
                triggered_typologies[t.code] = t
                if t.level in (RiskLevel.CRITICAL, RiskLevel.HIGH):
                    high_risk_alerts.append({
                        "hop": hop,
                        "entity": raw_name or item.get("to"),
                        "typology": t.title,
                        "statutory_ref": t.statutory_reference,
                        "severity": t.level.value,
                        "action": t.investigative_action,
                    })

        # 2. Process Cross-Chain Hops
        if cross_chain_hops:
            bridge_typ = TYPOLOGY_REGISTRY["TYP-XCHAIN-01"]
            triggered_typologies[bridge_typ.code] = bridge_typ
            category_max_decayed[RiskCategory.DEFI_BRIDGE] = max(
                category_max_decayed.get(RiskCategory.DEFI_BRIDGE, 0.0), 40.0
            )

        # 3. Process Deep Layering Heuristic
        if max_hops_traced >= 4:
            layer_typ = TYPOLOGY_REGISTRY["TYP-LAYER-01"]
            triggered_typologies[layer_typ.code] = layer_typ
            category_max_decayed[RiskCategory.UNHOSTED] = max(
                category_max_decayed.get(RiskCategory.UNHOSTED, 0.0), 30.0
            )

        # 4. Mathematical Risk Aggregation Formula
        # Primary threat = max single decayed exposure + additive behavioral compounding
        max_entity_threat = max(category_max_decayed.values(), default=0.0)

        # Compound penalties for multiple disparate evasion techniques
        compounding_bonus = 0.0
        if category_max_decayed.get(RiskCategory.MIXER, 0) > 0:
            compounding_bonus += 20.0
        if category_max_decayed.get(RiskCategory.DEFI_BRIDGE, 0) > 0:
            compounding_bonus += 15.0
        if category_max_decayed.get(RiskCategory.PEELING_CHAIN, 0) > 0:
            compounding_bonus += 15.0
        if max_hops_traced >= 3:
            compounding_bonus += min(max_hops_traced * 3.0, 15.0)

        composite_score = int(min(100.0, round(max_entity_threat + compounding_bonus)))

        # Assign composite risk level
        if composite_score >= 70:
            overall_level = RiskLevel.CRITICAL
        elif composite_score >= 45:
            overall_level = RiskLevel.HIGH
        elif composite_score >= 20:
            overall_level = RiskLevel.MEDIUM
        else:
            overall_level = RiskLevel.LOW

        # Generate Executive Verdict
        typo_titles = [t.title for t in triggered_typologies.values() if t.level != RiskLevel.LOW]
        if typo_titles:
            verdict = f"Risk Level: {overall_level.value} | Typology: {' + '.join(typo_titles)}"
        else:
            verdict = f"Risk Level: {overall_level.value} | Typology: Standard Unflagged Transfer Tree"

        cat_breakdown = {k.value: round(v, 2) for k, v in category_max_decayed.items()}

        return CaseRiskReport(
            composite_score=composite_score,
            risk_level=overall_level,
            typologies=list(triggered_typologies.values()),
            high_risk_alerts=high_risk_alerts,
            category_breakdown=cat_breakdown,
            summary_verdict=verdict,
        )
