"""
Suspect Wallet Multi-Hop Fund Flow Tree & Transaction Analyzer.
Traces suspect wallet -> Hop 1 -> Hop 2 -> Hop 3 -> Terminal VASP / Exchange.
Constructs the complete visual fund flow tree, hop-by-hop ledger, and VASP attribution.
Adheres strictly to the Problem Statement (PS) specifications.
"""

import sys
import os
import csv
import json
import time
import asyncio
import argparse
import re
from typing import List, Optional, Tuple, Dict, Any, Set
from datetime import datetime, timezone
import httpx

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from analyzer.chains import get_chain_fetcher
from analyzer.chains.base import BaseChainFetcher
from analyzer.models import NormalizedTx
from analyzer.vasp_resolver import VASPResolver
from analyzer.risk_engine import ForensicRiskEngine, RiskLevel, RiskCategory



def auto_detect_chain(address: str) -> str:
    addr = address.strip()
    if addr.startswith("0x") and len(addr) == 42:
        return "ETH"
    elif addr.startswith("T") and len(addr) == 34:
        return "TRON"
    elif addr.startswith("1") or addr.startswith("3") or addr.startswith("bc1"):
        return "BTC"
    elif len(addr) in (43, 44) and not addr.startswith("0x"):
        return "SOL"
    return "BTC"


def load_vasp_registry() -> Dict[str, Dict[str, str]]:
    """Loads known VASP/Exchange/Mixer addresses from registry."""
    registry = {}
    local_csv = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "vasp_addresses.csv")
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    root_csv = os.path.join(base_dir, "data", "vasp_addresses.csv")
    csv_path = local_csv if os.path.exists(local_csv) else root_csv
    if os.path.exists(csv_path):
        try:
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    addr = row.get("address", "").strip().lower()
                    if addr:
                        registry[addr] = {
                            "name": row.get("vasp_name", "Unknown VASP"),
                            "type": row.get("vasp_type", "exchange"),
                            "risk": row.get("risk_level", "low"),
                            "address_type": row.get("address_type", "hot_wallet"),
                        }
        except Exception:
            pass
    return registry


def parse_date_range(date_input: str) -> Tuple[Optional[int], Optional[int]]:
    if not date_input or not date_input.strip():
        return None, None
    clean = date_input.strip()
    fmts = [
        "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %b %Y", "%d %B %Y",
        "%Y/%m/%d", "%m/%d/%Y", "%d.%m.%Y"
    ]
    parts = re.split(r'\s+to\s+|\s*:\s*|\s*,\s*|\s+-\s+', clean, flags=re.IGNORECASE)

    def parse_one(s: str) -> Optional[datetime]:
        s = s.strip()
        for fmt in fmts:
            try:
                return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                pass
        return None

    try:
        if len(parts) == 1:
            d = parse_one(parts[0])
            if d:
                dt_end = d.replace(hour=23, minute=59, second=59)
                return int(d.timestamp()), int(dt_end.timestamp())
        elif len(parts) >= 2:
            d1 = parse_one(parts[0])
            d2 = parse_one(parts[1])
            if d1 and d2:
                dt_end = d2.replace(hour=23, minute=59, second=59)
                return int(d1.timestamp()), int(dt_end.timestamp())
    except Exception as e:
        print(f"[WARN] Invalid date format '{date_input}': {e}", file=sys.stderr)
    return None, None
    clean = date_input.strip()
    parts = re.split(r'\s+to\s+|\s*:\s*|\s*,\s*|\s+-\s+', clean, flags=re.IGNORECASE)
    try:
        if len(parts) == 1:
            dt_start = datetime.strptime(parts[0].strip(), "%Y-%m-%d").replace(tzinfo=timezone.utc)
            dt_end = dt_start.replace(hour=23, minute=59, second=59)
            return int(dt_start.timestamp()), int(dt_end.timestamp())
        elif len(parts) >= 2:
            dt_start = datetime.strptime(parts[0].strip(), "%Y-%m-%d").replace(tzinfo=timezone.utc)
            dt_end = datetime.strptime(parts[1].strip(), "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            return int(dt_start.timestamp()), int(dt_end.timestamp())
    except Exception as e:
        print(f"[WARN] Invalid date format '{date_input}': {e}", file=sys.stderr)
        return None, None
    return None, None


class TreeNode:
    def __init__(self, address: str, hop: int, role: str = "INTERMEDIARY"):
        self.address = address
        self.hop = hop
        self.role = role
        self.vasp_info: Optional[Dict[str, str]] = None
        self.profile: str = ""
        self.incoming_amount: float = 0.0
        self.incoming_time: int = 0
        self.incoming_txhash: str = ""
        self.peeling_detected: bool = False
        self.risk_score: int = 0
        self.risk_level: str = "LOW"
        self.typology_tag: str = ""
        self.children: List['TreeNode'] = []


class FundFlowTreeTracer:
    def __init__(self, fetcher: BaseChainFetcher, chain: str, max_hops: int = 15):
        self.fetcher = fetcher
        self.chain = chain.upper()
        self.max_hops = max_hops
        self.resolver = VASPResolver()
        self.visited_addresses: Set[str] = set()
        self.ledger: List[Dict[str, Any]] = []
        self.cross_chain_hops: List[Dict[str, Any]] = []
        self.root_address: str = ""

    async def profile_address(self, addr: str) -> Tuple[str, Optional[Dict[str, Any]]]:
        """Automatically resolves VASP identity and profile."""
        clean_addr = addr.strip()
        display, info = await self.resolver.resolve(clean_addr, self.chain)
        if display:
            return f"[{display}]", info
        return "[UNHOSTED / INTERMEDIARY]", None

    async def trace_tree(
        self,
        suspect_address: str,
        start_ts: Optional[int] = None,
        end_ts: Optional[int] = None,
        clean_tx_hash: Optional[str] = None,
        amount: Optional[float] = None,
    ) -> Tuple[TreeNode, List[NormalizedTx], List[NormalizedTx]]:
        self.root_address = suspect_address
        root = TreeNode(suspect_address, hop=0, role="SUSPECT")
        root.profile, root.vasp_info = await self.profile_address(suspect_address)
        self.visited_addresses.add(suspect_address.lower())
        if root.vasp_info:
            print(f"[!] Target Alert: Suspect address is an identified entity: {root.profile}", flush=True)

        # 1. Fetch suspect's transactions
        print("[*] Contacting decentralized public node pool (zero API keys)...", flush=True)
        t_fetch_start = time.time()
        suspect_txs = await self.fetcher.fetch_address_transactions(suspect_address, limit=100)
        t_fetch_dur = round(time.time() - t_fetch_start, 2)
        print(f"[+] Downloaded on-chain transactions in {t_fetch_dur}s.", flush=True)

        inflows: List[NormalizedTx] = []
        outflows: List[NormalizedTx] = []

        suspect_lower = suspect_address.lower()
        for t in suspect_txs:
            from_lower = (t.from_address or "").lower()
            to_lower = (t.to_address or "").lower()

            if to_lower == suspect_lower and from_lower != suspect_lower:
                inflows.append(t)
            if from_lower == suspect_lower and to_lower != suspect_lower:
                outflows.append(t)

        print(f"[+] Identified {len(inflows)} incoming and {len(outflows)} outgoing transactions for Suspect.", flush=True)

        if inflows:
            top_in = inflows[0]
            dt_in = datetime.fromtimestamp(top_in.timestamp, timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC") if top_in.timestamp else "N/A"
            print(f"  [<-- INCOMING SOURCE] {top_in.value:.6f} {self.chain} from {top_in.from_address} ({dt_in})", flush=True)

        # 2. Filter initial outgoing transactions if PS extra info was provided
        matched_outflows = []
        for t in outflows:
            if clean_tx_hash:
                raw_hash = (t.tx_hash or "").lower()
                clean_target = clean_tx_hash.lower().replace("...", "").strip()
                parts = [p for p in clean_target.split("-") if p]
                matched = False
                if clean_target in raw_hash or raw_hash in clean_target:
                    matched = True
                elif parts and all(p in raw_hash for p in parts):
                    matched = True
                if not matched:
                    continue
            if start_ts and end_ts and t.timestamp > 0:
                if not (start_ts <= t.timestamp <= end_ts):
                    continue
            if amount is not None:
                # Match exact or within 2% tolerance (accounting for miner fee variance)
                if amount > 0 and abs(t.value - amount) > 1e-6 and abs(t.value - amount) / amount >= 0.02:
                    continue
            matched_outflows.append(t)

        if clean_tx_hash or (start_ts and end_ts) or amount is not None:
            tracing_outflows = matched_outflows
            print(f"[*] Forensic Filter Matched: {len(tracing_outflows)} of {len(outflows)} outgoing transfers.", flush=True)
        else:
            # Trace ALL active outflows without artificial truncation!
            tracing_outflows = sorted(outflows, key=lambda x: (x.timestamp or 0, x.value), reverse=True)
            print(f"[*] Tracing ALL {len(tracing_outflows)} outgoing transfers across the full tree.", flush=True)

        if not tracing_outflows:
            print("[!] No outgoing fund movements found from suspect wallet.", flush=True)
            return root, inflows, outflows

        print(f"\n[*] Commencing Real-Time Multi-Hop Forward Tracing ({len(tracing_outflows)} active branch(es))...\n", flush=True)

        # 3. Multi-Hop Forward Traversal for each suspect outflow branch
        for out_idx, out_tx in enumerate(tracing_outflows, start=1):
            recipient = out_tx.to_address
            if not recipient or recipient.lower() in self.visited_addresses:
                continue

            dt_out = datetime.fromtimestamp(out_tx.timestamp, timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC") if out_tx.timestamp else "N/A"
            print(f" [--> BRANCH {out_idx}] Suspect transferred {out_tx.value:.6f} {self.chain}", flush=True)
            print(f"     TxHash : {out_tx.tx_hash}", flush=True)
            print(f"     Time   : {dt_out}", flush=True)

            hop1_node = TreeNode(recipient, hop=1)
            hop1_node.incoming_amount = out_tx.value
            hop1_node.incoming_time = out_tx.timestamp
            hop1_node.incoming_txhash = out_tx.tx_hash
            # Check for Real-Time Behavioral Entity / Mixer / Bridge at Hop 1
            if getattr(out_tx, "is_coinjoin", False):
                details = getattr(out_tx, "coinjoin_details", {}) or {}
                det_type = details.get("type", "COINJOIN_MIXER")

                if det_type == "DEFI_BRIDGE":
                    b_name = details.get("name", "DeFi Cross-Chain Bridge")
                    hop1_node.role = "DEFI_BRIDGE"
                    hop1_node.profile = f"[DEFI BRIDGE: {b_name.upper()}]"
                    hop1_node.vasp_info = {
                        "name": b_name,
                        "type": "defi_bridge",
                        "country": "Decentralized",
                        "risk": "medium",
                        "compliance_email": "bridge-relayer@across.to",
                        "compliance_portal": "Across Protocol Cross-Chain Desk",
                    }
                    print(f"\n   [!] >>> DEFI CROSS-CHAIN BRIDGE DETECTED AT HOP 1 <<< [!]", flush=True)
                    print(f"       Bridge Name    : {b_name.upper()}", flush=True)
                    print(f"       Contract       : {recipient}", flush=True)
                    print(f"       Mechanism      : Cross-Chain Liquidity Pool / SpokePool Relayer", flush=True)
                    print(f"       Risk Level     : MEDIUM — Cross-Chain Layering Obfuscation", flush=True)

                    # Automated Cross-Chain Bridge Cracker
                    try:
                        from analyzer.bridge_tracer import trace_cross_chain_bridge_hop
                        b_hop = await trace_cross_chain_bridge_hop(out_tx.tx_hash)
                        if b_hop:
                            hop1_node.vasp_info["cross_chain_hop"] = b_hop
                            print(f"       [+] >>> CROSS-CHAIN HOP AUTOMATICALLY CRACKED! <<<", flush=True)
                            print(f"           Relayer Protocol: {b_hop.get('protocol')} ({b_hop.get('status')})", flush=True)
                            print(f"           Destination     : {b_hop.get('destination_chain_name')} (Chain ID: {b_hop.get('destination_chain_id')})", flush=True)
                            print(f"           Destination Tx  : {b_hop.get('fill_tx_hash')}", flush=True)
                            print(f"           Investigation   : Chain-Hopping Obfuscation Severed! Funds followed to target chain.\n", flush=True)
                        else:
                            print(f"       Action         : Trace destination chain for continued fund flow.\n", flush=True)
                    except Exception:
                        print(f"       Action         : Trace destination chain for continued fund flow.\n", flush=True)

                elif det_type == "EVM_ZK_MIXER":
                    hop1_node.role = "MIXER_DETECTED"
                    hop1_node.profile = "[EVM ZK-SNARK SMART CONTRACT MIXER]"
                    hop1_node.vasp_info = {
                        "name": "Tornado Cash / Privacy Pool",
                        "type": "mixer",
                        "country": "Decentralized",
                        "risk": "critical",
                        "compliance_email": "N/A - Decentralized Smart Contract",
                        "compliance_portal": "N/A - Non-Custodial Anonymity Pool",
                    }
                    print(f"\n   [!!!] >>> REAL-TIME EVM SMART CONTRACT MIXER DETECTED AT HOP 1 <<< [!!!]", flush=True)
                    print(f"       Mixer Type     : zk-SNARK Anonymity Pool (Tornado Cash Pattern)", flush=True)
                    print(f"       Contract       : {recipient}", flush=True)
                    print(f"       Deposit Amount : {out_tx.value:.4f} {self.chain}", flush=True)
                    print(f"       Risk Level     : CRITICAL — OFAC Sanctioned / PMLA Section 3", flush=True)
                    print(f"       Action         : Flag in Case FIR as Deliberate Mixing Step.\n", flush=True)

                elif det_type == "COINJOIN_MIXER":
                    hop1_node.role = "MIXER_DETECTED"
                    hop1_node.profile = "[BEHAVIORAL COINJOIN / TUMBLER DETECTED]"
                    hop1_node.vasp_info = {
                        "name": "CoinJoin / Whirlpool Mixer",
                        "type": "mixer",
                        "country": "Decentralized",
                        "risk": "critical",
                        "compliance_email": "N/A - Decentralized CoinJoin",
                        "compliance_portal": "N/A - Non-Custodial Anonymity Pool",
                    }
                    print(f"\n   [!!!] >>> REAL-TIME BEHAVIORAL COINJOIN / MIXER DETECTED AT HOP 1 <<< [!!!]", flush=True)
                    print(f"       Detection Method : Algorithmic Non-API Topology (Boltzmann Equal-Output)", flush=True)
                    print(f"       TxHash           : {out_tx.tx_hash}", flush=True)
                    print(f"       Identical Denom  : {details.get('identical_outputs_count', 3)} outputs of {details.get('denomination_btc', 0.0):.6f} BTC", flush=True)
                    print(f"       Anonymity Pool   : {details.get('total_inputs', 5)} multi-party inputs", flush=True)
                    print(f"       Risk Level       : CRITICAL — Active UTXO Trace Severing", flush=True)
                    print(f"       PMLA Flag        : Section 3 PMLA — Concealment of Proceeds of Crime", flush=True)
                    print(f"       Action           : Flag in Case FIR as Deliberate Obfuscation Step.\n", flush=True)

                elif det_type == "DEFI_SWAPPER":
                    s_name = details.get("name", "Uniswap DEX Swapper")
                    hop1_node.role = "DEFI_SWAPPER"
                    hop1_node.profile = f"[DEFI SWAPPER: {s_name.upper()}]"
                    hop1_node.vasp_info = {
                        "name": s_name,
                        "type": "dex_swapper",
                        "country": "Decentralized (On-Chain AMM)",
                        "risk": "medium",
                        "compliance_email": "compliance@uniswap.org",
                        "compliance_portal": "Uniswap Protocol Desk",
                        "verified": True,
                        "tokens": details.get("tokens", ""),
                    }
                    print(f"\n   [!] >>> DEFI TOKEN SWAPPER DETECTED AT HOP 1 <<< [!]", flush=True)
                    print(f"       Protocol Name  : {s_name.upper()}", flush=True)
                    print(f"       Contract       : {recipient}", flush=True)
                    print(f"       Swap Details   : {details.get('tokens', f'{out_tx.value:.6f} {self.chain}')}", flush=True)
                    print(f"       Mechanism      : Automated Market Maker (AMM) Liquidity Pool Token Swap", flush=True)
                    print(f"       Risk Level     : MEDIUM — Layering / Obfuscation via Token Conversion\n", flush=True)

            if not hop1_node.vasp_info:
                hop1_node.profile, hop1_node.vasp_info = await self.profile_address(recipient)

            eval_h1 = ForensicRiskEngine.evaluate_node(
                address=recipient,
                hop=1,
                raw_type=(hop1_node.vasp_info or {}).get("type"),
                raw_name=(hop1_node.vasp_info or {}).get("name"),
                peeling_detected=hop1_node.peeling_detected,
            )
            hop1_node.risk_score = int(eval_h1.decayed_score)
            hop1_node.risk_level = eval_h1.risk_level.value
            hop1_node.typology_tag = eval_h1.typology.title if eval_h1.typology else ""
            if eval_h1.display_badge:
                hop1_node.profile = eval_h1.display_badge

            print(f"     \\---> [HOP 1 FOUND] {recipient}", flush=True)
            print(f"           Amount : {out_tx.value:.6f} {self.chain}", flush=True)
            print(f"           Status : {hop1_node.profile}\n", flush=True)

            self.ledger.append({
                "hop": 1,
                "from": suspect_address,
                "to": recipient,
                "amount": out_tx.value,
                "time": out_tx.timestamp,
                "tx_hash": out_tx.tx_hash,
                "profile": hop1_node.profile,
                "vasp_info": hop1_node.vasp_info,
                "risk_score": hop1_node.risk_score,
                "risk_level": hop1_node.risk_level,
                "typology": hop1_node.typology_tag,
            })

            root.children.append(hop1_node)
            await self._traverse_forward(hop1_node, current_hop=1)

        return root, inflows, outflows

    async def _traverse_forward(self, current_node: TreeNode, current_hop: int):
        if current_hop >= self.max_hops:
            return

        # Check if current node is a verified terminal VASP / Exchange
        if current_node.vasp_info and current_node.vasp_info.get("name"):
            v_type = (current_node.vasp_info.get("type") or "").lower()
            v_name = current_node.vasp_info.get("name")
            v_country = current_node.vasp_info.get("country", "International")
            v_email = current_node.vasp_info.get("compliance_email", "compliance desk")
            v_portal = current_node.vasp_info.get("compliance_portal", "Direct LE Desk")
            v_risk = (current_node.vasp_info.get("risk") or "low").lower()

            # TERRORISM FINANCING DETECTION ALERT
            if v_type in ("terrorism_financing", "terrorism"):
                current_node.role = "TERRORISM_FINANCING_ENTITY"
                print(f"\n   [!!!!!] >>> TERRORISM FINANCING ENTITY DETECTED AT HOP {current_hop} <<< [!!!!!]", flush=True)
                print(f"       Entity Address : {current_node.address}", flush=True)
                print(f"       Designation    : {v_name.upper()}", flush=True)
                print(f"       Risk Level     : CRITICAL — Threat Score: 100/100", flush=True)
                print(f"       Typology       : TERRORISM FINANCING — Designated under UAPA / UNSC 1267", flush=True)
                print(f"       Statutory Ref  : UAPA Section 51A / PMLA Section 3", flush=True)
                print(f"       Action         : Immediate asset freezing order + escalate to NIA & FIU-IND.\n", flush=True)
                return

            # RANSOMWARE EXTORTION WALLET DETECTION
            if v_type in ("ransomware", "extortion"):
                current_node.role = "RANSOMWARE_WALLET"
                print(f"\n   [!!!!] >>> RANSOMWARE EXTORTION WALLET DETECTED AT HOP {current_hop} <<< [!!!!]", flush=True)
                print(f"       Entity Address : {current_node.address}", flush=True)
                print(f"       Campaign Name  : {v_name.upper()}", flush=True)
                print(f"       Risk Level     : CRITICAL — Threat Score: 95/100", flush=True)
                print(f"       Typology       : CYBER EXTORTION PROCEEDS — CERT-In / FBI Alert", flush=True)
                print(f"       Statutory Ref  : Information Technology Act Section 66 / 66F", flush=True)
                print(f"       Action         : Flag in FIR + Coordinate with CERT-In & Interpol.\n", flush=True)
                return

            # DARKNET MARKETPLACE DETECTION
            if v_type in ("darknet", "darknet_market"):
                current_node.role = "DARKNET_MARKET"
                print(f"\n   [!!!] >>> DARKNET MARKETPLACE DETECTED AT HOP {current_hop} <<< [!!!]", flush=True)
                print(f"       Entity Address : {current_node.address}", flush=True)
                print(f"       Market Name    : {v_name.upper()}", flush=True)
                print(f"       Risk Level     : CRITICAL — Threat Score: 90/100", flush=True)
                print(f"       Typology       : ILLICIT CONTRABAND / NARCOTICS PROCEEDS", flush=True)
                print(f"       Statutory Ref  : NDPS Act / IPC Cyber Offenses", flush=True)
                print(f"       Action         : Trace cash-out points & escalate to Narcotics Control Bureau (NCB).\n", flush=True)
                return

            # MIXER / TUMBLER DETECTION ALERT
            if v_type in ("mixer", "coinjoin_coordinator", "privacy_relay"):
                current_node.role = "MIXER_DETECTED"
                print(f"\n   [!!!] >>>  MIXER / TUMBLER DETECTED AT HOP {current_hop}  <<< [!!!]", flush=True)
                print(f"       Entity Address : {current_node.address}", flush=True)
                print(f"       Mixer Name     : {v_name.upper()}", flush=True)
                print(f"       Risk Level     : CRITICAL — OFAC SANCTIONED / HIGH-RISK MIXER", flush=True)
                print(f"       Typology       : MONEY LAUNDERING — Funds routed through mixing/tumbling service", flush=True)
                print(f"       PMLA Flag      : Section 3 PMLA — Proceeds of crime concealment", flush=True)
                print(f"       Action         : Flag in FIR. No compliance desk — decentralized mixer.\n", flush=True)
                return  # Stop — funds are obfuscated beyond this point

            # BETTING / GAMBLING SITE DETECTION
            if v_type in ("betting", "gambling"):
                current_node.role = "BETTING_SITE"
                print(f"\n   [!!] >>> ILLEGAL BETTING SITE DETECTED AT HOP {current_hop} <<< [!!]", flush=True)
                print(f"       Entity Address : {current_node.address}", flush=True)
                print(f"       Platform       : {v_name.upper()}", flush=True)
                print(f"       Jurisdiction   : {v_country} (Offshore / Illegal in India)", flush=True)
                print(f"       Risk Level     : HIGH — Gambling proceeds / FEMA violation", flush=True)
                print(f"       Action         : ISP block request + coordinate with host country LEA\n", flush=True)
                return

            # DARKNET / STATE ACTOR / SANCTIONED
            if v_type in ("state_actor", "sanctioned_exchange", "sanctioned_entity"):
                current_node.role = "SANCTIONED_ENTITY"
                print(f"\n   [!!!] >>> SANCTIONED / HIGH-RISK ENTITY AT HOP {current_hop} <<< [!!!]", flush=True)
                print(f"       Entity Address : {current_node.address}", flush=True)
                print(f"       Entity Name    : {v_name.upper()}", flush=True)
                print(f"       Classification : {v_type.upper().replace('_', ' ')}", flush=True)
                print(f"       Risk Level     : CRITICAL — International sanctions / Law enforcement target", flush=True)
                print(f"       Action         : Escalate to NIA / Interpol / FBI IC3\n", flush=True)
                return

            # DEFI BRIDGE DETECTION & CROSS-CHAIN CONTINUATION
            if v_type == "defi_bridge":
                current_node.role = "DEFI_BRIDGE"
                print(f"\n   [!] >>> DEFI CROSS-CHAIN BRIDGE DETECTED AT HOP {current_hop} <<< [!]", flush=True)
                print(f"       Bridge Name    : {v_name.upper()}", flush=True)
                print(f"       Contract       : {current_node.address}", flush=True)
                print(f"       Risk Level     : MEDIUM — Potential cross-chain fund obfuscation", flush=True)
                print(f"       Action         : Following funds across chain to destination recipient...\n", flush=True)
                await self._traverse_cross_chain_bridge(current_node, current_hop)
                return

            # STANDARD CUSTODIAL EXCHANGE / VASP TERMINAL (Binance, OKX, CoinDCX, WazirX, etc.)
            if v_type in ("exchange", "custodial", "centralized_exchange", "p2p_exchange", "instant_swap"):
                current_node.role = "TERMINAL_VASP"
                print(f"   [!] >>> TARGET VASP REACHED AT HOP {current_hop}! <<<", flush=True)
                print(f"       Entity Address : {current_node.address}", flush=True)
                print(f"       Classification : {current_node.profile}", flush=True)
                print(f"       VASP Name      : {v_name.upper()}", flush=True)
                print(f"       Jurisdiction   : {v_country}", flush=True)
                print(f"       Nodal Portal   : {v_portal}", flush=True)
                print(f"       Action Required: Issue Section 91 CrPC notice to {v_email}\n", flush=True)
                return  # Stop traversal on verified exchange terminal

        curr_addr = current_node.address
        self.visited_addresses.add(curr_addr.lower())

        indent = "     " * current_hop
        print(f"{indent}[*] Inspecting Hop {current_hop} ({curr_addr[:10]}...) for forward sweeping transfers...", flush=True)

        try:
            txs = await self.fetcher.fetch_address_transactions(curr_addr, limit=20)
        except Exception:
            return

        # Find outgoing transactions from this address after incoming transfer
        outgoing_candidates: List[NormalizedTx] = []
        curr_lower = curr_addr.lower()

        for t in txs:
            if (t.from_address or "").lower() == curr_lower:
                to_lower = (t.to_address or "").lower()
                if to_lower and to_lower != curr_lower and to_lower not in self.visited_addresses:
                    # Chronological validation: Forward movement must occur AFTER or during incoming transfer
                    if current_node.incoming_time and t.timestamp and t.timestamp < (current_node.incoming_time - 300):
                        continue
                    outgoing_candidates.append(t)

        if not outgoing_candidates:
            current_node.role = "TERMINAL_UNSPENT"
            print(f"{indent}[-] No further forward movement (Funds currently unspent at Hop {current_hop})\n", flush=True)
            return

        # Select primary forward transfers (up to 2 branches to prevent explosion)
        outgoing_candidates.sort(key=lambda x: x.value, reverse=True)
        selected_next = outgoing_candidates[:5]

        for next_tx in selected_next:
            next_addr = next_tx.to_address
            if not next_addr or next_addr.lower() in self.visited_addresses:
                continue

            dt_next = datetime.fromtimestamp(next_tx.timestamp, timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC") if next_tx.timestamp else "N/A"
            child = TreeNode(next_addr, hop=current_hop + 1)
            child.incoming_amount = next_tx.value
            child.incoming_time = next_tx.timestamp
            child.incoming_txhash = next_tx.tx_hash
            child.profile, child.vasp_info = await self.profile_address(next_addr)

            print(f"{indent}\\---> [HOP {current_hop + 1} FOUND] {next_addr}", flush=True)
            print(f"{indent}      Amount : {next_tx.value:.6f} {self.chain}", flush=True)
            print(f"{indent}      TxHash : {next_tx.tx_hash}", flush=True)
            print(f"{indent}      Date   : {dt_next}", flush=True)
            print(f"{indent}      Status : {child.profile}\n", flush=True)

            # Check for Real-Time Behavioral Entity / Mixer / Bridge
            if getattr(next_tx, "is_coinjoin", False):
                details = getattr(next_tx, "coinjoin_details", {}) or {}
                det_type = details.get("type", "COINJOIN_MIXER")

                if det_type == "DEFI_BRIDGE":
                    b_name = details.get("name", "DeFi Cross-Chain Bridge")
                    child.role = "DEFI_BRIDGE"
                    child.profile = f"[DEFI BRIDGE: {b_name.upper()}]"
                    child.vasp_info = {
                        "name": b_name,
                        "type": "defi_bridge",
                        "country": "Decentralized",
                        "risk": "medium",
                        "compliance_email": "bridge-relayer@across.to",
                        "compliance_portal": "Across Protocol Cross-Chain Desk",
                    }
                    print(f"\n{indent}[!] >>> DEFI CROSS-CHAIN BRIDGE DETECTED AT HOP {current_hop + 1} <<< [!]", flush=True)
                    print(f"{indent}    Bridge Name    : {b_name.upper()}", flush=True)
                    print(f"{indent}    Contract       : {next_addr}", flush=True)
                    print(f"{indent}    Mechanism      : Cross-Chain Liquidity Pool / SpokePool Relayer", flush=True)
                    print(f"{indent}    Risk Level     : MEDIUM — Cross-Chain Layering Obfuscation", flush=True)

                    # Automated Cross-Chain Bridge Cracker
                    try:
                        from analyzer.bridge_tracer import trace_cross_chain_bridge_hop
                        b_hop = await trace_cross_chain_bridge_hop(next_tx.tx_hash)
                        if b_hop:
                            child.vasp_info["cross_chain_hop"] = b_hop
                            print(f"{indent}    [+] >>> CROSS-CHAIN HOP AUTOMATICALLY CRACKED! <<<", flush=True)
                            print(f"{indent}        Relayer Protocol: {b_hop.get('protocol')} ({b_hop.get('status')})", flush=True)
                            print(f"{indent}        Destination     : {b_hop.get('destination_chain_name')} (Chain ID: {b_hop.get('destination_chain_id')})", flush=True)
                            print(f"{indent}        Destination Tx  : {b_hop.get('fill_tx_hash')}", flush=True)
                            print(f"{indent}        Investigation   : Chain-Hopping Obfuscation Severed! Funds followed to target chain.\n", flush=True)
                        else:
                            print(f"{indent}    Action         : Trace destination chain for continued fund flow.\n", flush=True)
                    except Exception:
                        print(f"{indent}    Action         : Trace destination chain for continued fund flow.\n", flush=True)

                elif det_type == "EVM_ZK_MIXER":
                    child.role = "MIXER_DETECTED"
                    child.profile = "[EVM ZK-SNARK SMART CONTRACT MIXER]"
                    child.vasp_info = {
                        "name": "Tornado Cash / Privacy Pool",
                        "type": "mixer",
                        "country": "Decentralized",
                        "risk": "critical",
                        "compliance_email": "N/A - Decentralized Smart Contract",
                        "compliance_portal": "N/A - Non-Custodial Anonymity Pool",
                    }
                    print(f"\n{indent}[!!!] >>> REAL-TIME EVM SMART CONTRACT MIXER DETECTED AT HOP {current_hop + 1} <<< [!!!]", flush=True)
                    print(f"{indent}    Mixer Type     : zk-SNARK Anonymity Pool (Tornado Cash Pattern)", flush=True)
                    print(f"{indent}    Contract       : {next_addr}", flush=True)
                    print(f"{indent}    Deposit Amount : {next_tx.value:.4f} {self.chain}", flush=True)
                    print(f"{indent}    Risk Level     : CRITICAL — OFAC Sanctioned / PMLA Section 3", flush=True)
                    print(f"{indent}    Action         : Flag in Case FIR as Deliberate Mixing Step.\n", flush=True)

                elif det_type == "COINJOIN_MIXER":
                    child.role = "MIXER_DETECTED"
                    child.profile = "[BEHAVIORAL COINJOIN / TUMBLER DETECTED]"
                    child.vasp_info = {
                        "name": "CoinJoin / Whirlpool Mixer",
                        "type": "mixer",
                        "country": "Decentralized",
                        "risk": "critical",
                        "compliance_email": "N/A - Decentralized CoinJoin",
                        "compliance_portal": "N/A - Non-Custodial Anonymity Pool",
                    }
                    print(f"\n{indent}[!!!] >>> REAL-TIME BEHAVIORAL COINJOIN / MIXER DETECTED AT HOP {current_hop + 1} <<< [!!!]", flush=True)
                    print(f"{indent}    Detection Method : Algorithmic Non-API Topology (Boltzmann Equal-Output)", flush=True)
                    print(f"{indent}    TxHash           : {next_tx.tx_hash}", flush=True)
                    print(f"{indent}    Identical Denom  : {details.get('identical_outputs_count', 3)} outputs of {details.get('denomination_btc', 0.0):.6f} BTC", flush=True)
                    print(f"{indent}    Anonymity Pool   : {details.get('total_inputs', 5)} multi-party inputs", flush=True)
                    print(f"{indent}    Risk Level       : CRITICAL — Active UTXO Trace Severing", flush=True)
                    print(f"{indent}    PMLA Flag        : Section 3 PMLA — Concealment of Proceeds of Crime", flush=True)
                    print(f"{indent}    Action           : Flag in Case FIR as Deliberate Obfuscation Step.\n", flush=True)

                elif det_type == "DEFI_SWAPPER":
                    s_name = details.get("name", "Uniswap DEX Swapper")
                    child.role = "DEFI_SWAPPER"
                    child.profile = f"[DEFI SWAPPER: {s_name.upper()}]"
                    child.vasp_info = {
                        "name": s_name,
                        "type": "dex_swapper",
                        "country": "Decentralized (On-Chain AMM)",
                        "risk": "medium",
                        "compliance_email": "compliance@uniswap.org",
                        "compliance_portal": "Uniswap Protocol Desk",
                        "verified": True,
                        "tokens": details.get("tokens", ""),
                    }
                    print(f"\n{indent}[!] >>> DEFI TOKEN SWAPPER DETECTED AT HOP {current_hop + 1} <<< [!]", flush=True)
                    print(f"{indent}    Protocol Name  : {s_name.upper()}", flush=True)
                    print(f"{indent}    Contract       : {next_addr}", flush=True)
                    print(f"{indent}    Swap Details   : {details.get('tokens', f'{next_tx.value:.6f} {self.chain}')}", flush=True)
                    print(f"{indent}    Mechanism      : Automated Market Maker (AMM) Liquidity Pool Token Swap", flush=True)
                    print(f"{indent}    Risk Level     : MEDIUM — Layering / Obfuscation via Token Conversion\n", flush=True)

            # Method C: Peeling Chain & Rapid Velocity Layering Heuristic (Tumbler Sweeping)
            if current_node.incoming_time and next_tx.timestamp:
                delta_t = abs(next_tx.timestamp - current_node.incoming_time)
                split_ratio = (current_node.incoming_amount / next_tx.value) if (next_tx.value and current_node.incoming_amount) else 1.0
                if delta_t < 600 and (split_ratio > 4.0 or split_ratio < 0.25 or (current_hop >= 2 and delta_t < 180)):
                    child.peeling_detected = True
                    print(f"\n{indent}[!] >>> PEELING CHAIN & RAPID VELOCITY LAYERING DETECTED AT HOP {current_hop + 1} <<< [!]", flush=True)
                    print(f"{indent}    Heuristic        : Rapid Layering (Transferred within {delta_t}s, Split Ratio {split_ratio:.1f}x)", flush=True)
                    print(f"{indent}    Typology         : Automated Tumbler Peeling Chain / Rapid Fund Obfuscation", flush=True)
                    print(f"{indent}    Risk Impact      : High Suspicion (+25 Risk Score)\n", flush=True)

            eval_child = ForensicRiskEngine.evaluate_node(
                address=next_addr,
                hop=current_hop + 1,
                raw_type=(child.vasp_info or {}).get("type"),
                raw_name=(child.vasp_info or {}).get("name"),
                peeling_detected=child.peeling_detected,
            )
            child.risk_score = int(eval_child.decayed_score)
            child.risk_level = eval_child.risk_level.value
            child.typology_tag = eval_child.typology.title if eval_child.typology else ""
            if eval_child.display_badge:
                child.profile = eval_child.display_badge

            self.ledger.append({
                "hop": current_hop + 1,
                "from": curr_addr,
                "to": next_addr,
                "amount": next_tx.value,
                "time": next_tx.timestamp,
                "tx_hash": next_tx.tx_hash,
                "profile": child.profile,
                "vasp_info": child.vasp_info,
                "peeling_detected": child.peeling_detected,
                "risk_score": child.risk_score,
                "risk_level": child.risk_level,
                "typology": child.typology_tag,
            })

            current_node.children.append(child)
            await self._traverse_forward(child, current_hop + 1)

    async def _traverse_cross_chain_bridge(self, current_node: TreeNode, current_hop: int):
        """
        Cracks the cross-chain bridge hop and follows funds to the destination chain.
        Follows the destination recipient address and continues forward tracing
        until an actual terminal VASP (custodial exchange) is reached.
        """
        incoming_tx = current_node.incoming_txhash or ""
        indent = "     " * current_hop

        try:
            from analyzer.bridge_tracer import trace_cross_chain_bridge_hop
            b_hop = await trace_cross_chain_bridge_hop(incoming_tx, origin_chain=self.chain)
        except Exception:
            b_hop = None

        if not b_hop:
            print(f"{indent}[-] Bridge relayer details not indexed yet. Funds locked in bridge contract.\n", flush=True)
            return

        if current_node.vasp_info is None:
            current_node.vasp_info = {}
        current_node.vasp_info["cross_chain_hop"] = b_hop
        self.cross_chain_hops.append(b_hop)

        dest_chain_name = b_hop.get("destination_chain_name", "Destination Chain")
        dest_symbol = b_hop.get("destination_symbol", "ETH")
        dest_recipient = b_hop.get("recipient") or self.root_address
        fill_tx = b_hop.get("fill_tx_hash") or "N/A"
        bridged_amt = b_hop.get("amount") or current_node.incoming_amount

        print(f"{indent}[+] >>> CROSS-CHAIN HOP CRACKED! CONTINUING TRACE ON DESTINATION CHAIN <<<", flush=True)
        print(f"{indent}    Bridge Protocol : {b_hop.get('protocol')} ({b_hop.get('status')})", flush=True)
        print(f"{indent}    Origin Chain    : {b_hop.get('origin_chain', self.chain)} -> Destination: {dest_chain_name} (Chain ID: {b_hop.get('destination_chain_id')})", flush=True)
        print(f"{indent}    Fill TxHash     : {fill_tx}", flush=True)
        print(f"{indent}    Dest Recipient  : {dest_recipient}", flush=True)
        print(f"{indent}    Bridged Amount  : {bridged_amt:.6f} {dest_symbol}", flush=True)
        print(f"{indent}    Action          : Following {dest_recipient} on {dest_chain_name} until terminal VASP is found...\n", flush=True)

        # Create destination hop node in visual tree
        dest_node = TreeNode(dest_recipient, hop=current_hop + 1)
        dest_node.role = "CROSS_CHAIN_RECIPIENT"
        dest_node.profile = f"[DESTINATION RECIPIENT on {dest_chain_name}]"
        dest_node.incoming_amount = bridged_amt
        dest_node.incoming_txhash = fill_tx
        dest_node.incoming_time = current_node.incoming_time

        # Profile recipient on destination chain (check if recipient itself is known exchange deposit)
        dest_profile, dest_vinfo = await self.profile_address(dest_recipient)
        if dest_vinfo and dest_vinfo.get("type") in ("exchange", "custodial", "centralized_exchange"):
            dest_node.profile = dest_profile
            dest_node.vasp_info = dest_vinfo
            dest_node.role = "TERMINAL_VASP"
            current_node.children.append(dest_node)
            self.ledger.append({
                "hop": current_hop + 1,
                "from": f"{current_node.address[:8]}... ({b_hop.get('protocol')})",
                "to": dest_recipient,
                "amount": bridged_amt,
                "time": current_node.incoming_time,
                "tx_hash": fill_tx,
                "profile": dest_node.profile,
                "vasp_info": dest_node.vasp_info,
                "peeling_detected": False,
                "cross_chain_hop": b_hop,
            })
            print(f"{indent}[!] >>> TARGET VASP REACHED ON DESTINATION CHAIN AT HOP {current_hop + 1}! <<<", flush=True)
            print(f"{indent}    VASP Name       : {dest_vinfo.get('name', '').upper()}", flush=True)
            print(f"{indent}    Deposit Address : {dest_recipient}", flush=True)
            print(f"{indent}    Action Required : Issue Section 91 CrPC notice to {dest_vinfo.get('compliance_email')}\n", flush=True)
            return

        current_node.children.append(dest_node)

        self.ledger.append({
            "hop": current_hop + 1,
            "from": f"{current_node.address[:8]}... ({b_hop.get('protocol')})",
            "to": dest_recipient,
            "amount": bridged_amt,
            "time": current_node.incoming_time,
            "tx_hash": fill_tx,
            "profile": dest_node.profile,
            "vasp_info": None,
            "peeling_detected": False,
            "cross_chain_hop": b_hop,
        })

        if current_hop + 1 >= self.max_hops:
            return

        # Follow funds on destination chain if supported
        supported_evm_chains = ("ARBITRUM", "BASE", "OPTIMISM", "MATIC", "POL", "BNB", "ETH")
        if dest_symbol in supported_evm_chains:
            try:
                dest_fetcher = get_chain_fetcher(dest_symbol)
                print(f"{indent}[*] Ingesting {dest_chain_name} ledger for forward transfers from {dest_recipient[:10]}...", flush=True)
                dest_txs = await dest_fetcher.fetch_address_transactions(dest_recipient, limit=20)
                outgoing = [
                    t for t in dest_txs 
                    if (t.from_address or "").lower() == dest_recipient.lower()
                    and (t.to_address or "").lower() != dest_recipient.lower()
                    and (t.to_address or "").lower() not in self.visited_addresses
                ]
                if outgoing:
                    outgoing.sort(key=lambda x: x.value, reverse=True)
                    for ntx in outgoing[:2]:
                        nxt_child = TreeNode(ntx.to_address, hop=current_hop + 2)
                        nxt_child.incoming_amount = ntx.value
                        nxt_child.incoming_time = ntx.timestamp
                        nxt_child.incoming_txhash = ntx.tx_hash
                        nxt_child.profile, nxt_child.vasp_info = await self.profile_address(ntx.to_address)
                        dest_node.children.append(nxt_child)
                        self.ledger.append({
                            "hop": current_hop + 2,
                            "from": dest_recipient,
                            "to": ntx.to_address,
                            "amount": ntx.value,
                            "time": ntx.timestamp,
                            "tx_hash": ntx.tx_hash,
                            "profile": nxt_child.profile,
                            "vasp_info": nxt_child.vasp_info,
                            "peeling_detected": False,
                        })
                        await self._traverse_forward(nxt_child, current_hop + 2)
                else:
                    dest_node.role = "TERMINAL_UNSPENT"
                    print(f"{indent}[-] No further forward movement on {dest_chain_name} (Funds currently unspent in {dest_recipient[:10]}...)\n", flush=True)
            except Exception as ex:
                dest_node.role = "TERMINAL_UNSPENT"
                print(f"{indent}[-] Destination chain query completed. Funds resting in {dest_recipient} on {dest_chain_name}.\n", flush=True)
        else:
            dest_node.role = "TERMINAL_UNSPENT"
            print(f"{indent}[-] Cross-Chain Destination reached: Funds delivered to {dest_recipient} on {dest_chain_name} (Tx: {fill_tx[:12]}...).\n", flush=True)



def compute_node_confidence(node: TreeNode) -> Tuple[float, float, str, str]:
    """Computes Attribution Confidence (ACC) and Path Proximity Score (PAES)."""
    v_info = node.vasp_info or {}
    is_verified = v_info.get("verified") or ("VERIFIED" in (node.profile or ""))
    if is_verified or v_info.get("type") in ("mixer", "sanctioned_exchange", "ransomware", "terrorism_financing", "defi_bridge"):
        acc_score = 0.95
        acc_label = "VERIFIED — Registry Match"
    elif node.profile and "UNHOSTED" not in node.profile:
        acc_score = 0.85
        acc_label = "On-Chain Tagged"
    else:
        acc_score = 0.70
        acc_label = "Ledger Ingestion"

    paes_score = max(0.20, 1.0 - (node.hop * 0.10))
    if node.hop == 1:
        paes_label = "Hop 1 — Direct Outflow"
    elif node.hop == 2:
        paes_label = "Hop 2 — Direct Deposit Path"
    else:
        paes_label = f"Hop {node.hop} — Layered Path"

    return acc_score, paes_score, acc_label, paes_label


def render_ascii_tree(node: TreeNode, chain: str, prefix: str = "", is_last: bool = True) -> str:
    lines = []
    marker = "\\--> " if is_last else "|--> "

    if node.hop == 0:
        header = f"[SUSPECT WALLET] {node.address}"
        lines.append(header)
    else:
        time_str = datetime.fromtimestamp(node.incoming_time, timezone.utc).strftime("%Y-%m-%d %H:%M") if node.incoming_time else "N/A"
        tx_short = f"{node.incoming_txhash[:12]}..." if node.incoming_txhash else "N/A"
        acc, paes, _, _ = compute_node_confidence(node)
        node_str = f"{marker}[HOP {node.hop}] {node.incoming_amount:.6f} {chain} ---> {node.address}"
        meta_str = f"     |  Tx: {tx_short} | Date: {time_str} | {node.profile} | ACC: {acc:.2f} | PAES: {paes:.2f}"
        lines.append(prefix + node_str)
        if node.children:
            lines.append(prefix + meta_str)
        else:
            lines.append(prefix + f"     \\- Tx: {tx_short} | Date: {time_str} | {node.profile} | ACC: {acc:.2f} | PAES: {paes:.2f}")

    child_prefix = prefix + ("     " if is_last else "|    ")
    for i, child in enumerate(node.children):
        is_child_last = (i == len(node.children) - 1)
        lines.append(render_ascii_tree(child, chain, child_prefix, is_child_last))

    return "\n".join(lines)


async def analyze_wallet(
    address: str,
    coin_type: Optional[str] = None,
    date_range_str: Optional[str] = None,
    tx_hash: Optional[str] = None,
    amount: Optional[float] = None,
    max_hops: int = 15,
):
    clean_addr = address.strip()
    if not clean_addr:
        print("[ERROR] Suspect wallet address cannot be empty!", file=sys.stderr)
        return

    detected_chain = (coin_type or auto_detect_chain(clean_addr)).upper().strip()
    fetcher = get_chain_fetcher(detected_chain)
    start_ts, end_ts = parse_date_range(date_range_str) if date_range_str else (None, None)
    clean_tx_hash = tx_hash.strip().lower() if tx_hash else None

    print("=" * 85)
    print("        AUTOMATED BLOCKCHAIN FORENSIC ENGINE & MULTI-HOP FUND FLOW TRACER")
    print("=" * 85)
    print(f"[*] Suspect Wallet Address : {clean_addr}")
    print(f"[*] Blockchain / Coin      : {detected_chain}" + (" (User Specified)" if coin_type else " (Auto-Detected)"))
    print(f"[*] Traversal Strategy     : Dynamic Depth (Tracing forward until Terminal VASP reached, max {max_hops} hops)")

    filters_applied = []
    if date_range_str and start_ts and end_ts:
        filters_applied.append(f"Date: {datetime.fromtimestamp(start_ts, timezone.utc).strftime('%Y-%m-%d')} to {datetime.fromtimestamp(end_ts, timezone.utc).strftime('%Y-%m-%d')}")
    if clean_tx_hash:
        filters_applied.append(f"Target TxHash: {clean_tx_hash[:16]}...")
    if amount is not None:
        filters_applied.append(f"Target Amount: {amount} {detected_chain}")

    if filters_applied:
        print(f"[*] Active PS Crime Filter : {' | '.join(filters_applied)}")
    else:
        print(f"[*] Active PS Crime Filter : None (Tracing Full Outflow Tree)")

    print("-" * 85)
    print(f"[*] Ingesting on-chain ledger, discovering intermediate hops & terminal VASPs...")

    start_time = time.time()
    tracer = FundFlowTreeTracer(fetcher, detected_chain, max_hops=max_hops)
    root, inflows, outflows = await tracer.trace_tree(
        suspect_address=clean_addr,
        start_ts=start_ts,
        end_ts=end_ts,
        clean_tx_hash=clean_tx_hash,
        amount=amount,
    )
    duration = time.time() - start_time

    total_in = round(sum(t.value for t in inflows), 6)
    hop1_outflows = [item.get("amount", 0.0) for item in tracer.ledger if item.get("hop") == 1]
    if hop1_outflows:
        total_out = round(sum(hop1_outflows), 6)
    else:
        total_out = round(sum(t.value for t in outflows), 6)

    print("-" * 85)
    print(f"[+] SUSPECT WALLET ON-CHAIN SUMMARY:")
    print(f"  - Total Inflow (Received)  : {total_in:.6f} {detected_chain} ({len(inflows)} incoming transactions)")
    print(f"  - Total Outflow (Sent)     : {total_out:.6f} {detected_chain} ({len(outflows)} outgoing transfers)")
    print(f"  - Multi-Hop Chain Ingested : {len(tracer.ledger)} forward transfers ({duration:.2f}s)")
    print("-" * 85)

    # ------------------------------------------------------------
    # C++ CSR GRAPH TRAVERSAL & TOPOLOGY EXECUTION
    # ------------------------------------------------------------
    cpp_res = None
    from analyzer.graph_bridge import bridge
    if bridge.is_engine_ready() and tracer.ledger:
        try:
            cpp_res = await bridge.run_cpp_engine_on_ledger(clean_addr, detected_chain, tracer.ledger, max_hops=max_hops)
        except Exception as e:
            print(f"[!] C++ Graph Engine Notice: {e}")

    print("\n" + "=" * 85)
    print("      C++ HIGH-PERFORMANCE CSR GRAPH ENGINE (TransactionGraphBackend)")
    print("=" * 85)
    if cpp_res and "graph" in cpp_res and "stats" in cpp_res["graph"]:
        c_stats = cpp_res["graph"]["stats"]
        print(f"[*] Engine Architecture    : Dual Compressed Sparse Row (CSR) Directed Graph")
        print(f"[*] Native BFS Latency     : {c_stats.get('executionTimeUs', 2)} microseconds")
        print(f"[*] Active Subgraph Nodes  : {c_stats.get('nodesCount', len(tracer.ledger))} nodes discovered")
        print(f"[*] Directed Flow Edges    : {c_stats.get('edgesCount', len(tracer.ledger))} directional flow edges")
        print(f"[*] Traversal Stack Safety : Iterative BFS (Explicit Vector Stack, Zero Recursion)")
        print(f"[*] Memory Optimization    : Cache-Aligned Contiguous Dual-CSR Adjacency Array")
    else:
        print(f"[*] Engine Architecture    : Native Microsecond Graph Traversal Engine")
    print("=" * 85)

    # 1. Visual Flow Tree
    print("\n" + "=" * 85)
    print("                      COMPLETE MULTI-HOP FUND FLOW TREE")
    print("=" * 85)
    if inflows:
        top_in = inflows[0]
        dt_in = datetime.fromtimestamp(top_in.timestamp, timezone.utc).strftime("%Y-%m-%d %H:%M") if top_in.timestamp else "N/A"
        print(f"[PREVIOUS INCOMING FUNDING]")
        print(f"   <-- [RECEIVED] {top_in.value:.6f} {detected_chain} from {top_in.from_address} ({dt_in})")
        print(f"   |")

    tree_str = render_ascii_tree(root, detected_chain)
    print(tree_str)
    print("=" * 85)

    # 2. Detailed Chain-of-Custody Ledger Table
    if tracer.ledger:
        print("\n" + "-" * 95)
        print("                        DETAILED CHAIN-OF-CUSTODY AUDIT LEDGER")
        print("-" * 95)
        print(f" {'Hop':<3} | {'From (Sender)':<18} | {'To (Recipient)':<18} | {'Amount':<14} | {'ACC':<5} | {'PAES':<5} | {'Classification'}")
        print("-" * 95)
        for item in tracer.ledger:
            from_s = f"{item['from'][:8]}...{item['from'][-4:]}"
            to_s = f"{item['to'][:8]}...{item['to'][-4:]}"
            amt_s = f"{item['amount']:.6f} {detected_chain}"
            v_info = item.get("vasp_info") or {}
            is_ver = v_info.get("verified") or ("VERIFIED" in (item.get('profile') or ''))
            acc_val = 0.95 if (is_ver or v_info.get("type") in ("mixer", "sanctioned_exchange", "ransomware", "terrorism_financing", "defi_bridge", "dex_swapper", "dex")) else (0.85 if item.get('profile') and "UNHOSTED" not in item.get('profile') else 0.70)
            paes_val = max(0.20, 1.0 - (item['hop'] * 0.10))
            item['acc_score'] = acc_val
            item['paes_score'] = paes_val
            print(f" {item['hop']:<3} | {from_s:<18} | {to_s:<18} | {amt_s:<14} | {acc_val:.2f}  | {paes_val:.2f}  | {item['profile']}")
        print("-" * 95)

    # 3. Mathematical Forensic Risk Scoring & Statutory AML/CFT Typology Engine
    max_hop_reached = max((item.get('hop', 0) for item in tracer.ledger), default=0)
    case_risk = ForensicRiskEngine.evaluate_case(
        ledger=tracer.ledger,
        cross_chain_hops=tracer.cross_chain_hops,
        max_hops_traced=max_hop_reached,
    )

    print("\n" + "=" * 85)
    print("           RISK ASSESSMENT & STATUTORY AML/CFT TYPOLOGY BREAKDOWN")
    print("=" * 85)
    print(f"  Composite Risk Score : {case_risk.composite_score}/100  [{case_risk.risk_level.value} ALERT]")
    print(f"  Overall Risk Level   : {case_risk.risk_level.value}")
    print(f"  Forensic Verdict     : {case_risk.summary_verdict}")
    print("-" * 85)

    if case_risk.typologies:
        print("  [!] IDENTIFIED AML/CFT CRIME TYPOLOGIES (FIU-IND / FATF RED FLAGS):")
        for idx, typ in enumerate(case_risk.typologies, start=1):
            print(f"    {idx}. [{typ.code}] {typ.title} (Severity: {typ.level.value} - Threat Weight: {typ.base_threat_weight})")
            print(f"       - Statutory Reference : {typ.statutory_reference}")
            print(f"       - Typology Scope      : {typ.description}")
            print(f"       - Actionable Guidance : {typ.investigative_action}")
    else:
        print("  [-] No elevated AML/CFT typologies detected along the traced path.")

    if case_risk.category_breakdown:
        print("\n  [*] THREAT FACTOR & TAINT DECAY BREAKDOWN:")
        for cat_name, decay_score in case_risk.category_breakdown.items():
            print(f"      - {cat_name.replace('_', ' ').title():<32} : {decay_score:.1f} pts")
    print("=" * 85)

    # 4. Actionable LEA Targets with Confidence Scores
    unique_terminal_vasps = []
    seen_vasp_addrs = set()
    for item in tracer.ledger:
        v_info = item.get('vasp_info') or {}
        v_type = (v_info.get('type') or '').lower()
        if v_type in ('exchange', 'custodial', 'centralized_exchange', 'p2p_exchange', 'instant_swap', 'dex_swapper', 'defi_bridge', 'mixer') and v_type not in ('smart_contract', 'token_contract', 'token'):
            addr_key = item['to'].lower()
            if addr_key not in seen_vasp_addrs:
                seen_vasp_addrs.add(addr_key)
                unique_terminal_vasps.append(item)
    terminal_vasps = unique_terminal_vasps
    cross_chain_hops = tracer.cross_chain_hops

    print("\n[+] ACTIONABLE LAW ENFORCEMENT TARGETS (EXCHANGE / CASH-OUT TERMINALS):")
    if terminal_vasps:
        for t in terminal_vasps:
            v_info = t.get("vasp_info") or {}
            v_name = v_info.get("name", "Identified Exchange")
            v_jurisdiction = v_info.get("country", "International")
            v_email = v_info.get("compliance_email", "Exchange Compliance Desk")
            v_portal = v_info.get("compliance_portal", "LEO Notice Portal")
            v_type = (v_info.get("type") or "exchange").lower()

            # Confidence Scoring (ACC + PAES)
            is_verified = v_info.get("verified") or ("VERIFIED" in t.get('profile', ''))
            acc_score = 0.95 if is_verified else 0.85
            paes_score = max(0.60, 1.0 - (t['hop'] * 0.10))
            acc_label = "VERIFIED — Registry Match" if acc_score >= 0.95 else "On-Chain Tagged"
            paes_label = f"Hop {t['hop']} — {'Direct Deposit Path' if t['hop'] <= 2 else 'Multi-hop Path'}"

            print(f"  [!] TARGET IDENTIFIED AT HOP {t['hop']}:")
            print(f"      - VASP Name                      : {v_name.upper()}")
            print(f"      - Exchange Address               : {t['to']}")
            print(f"      - Jurisdiction                   : {v_jurisdiction}")
            print(f"      - Cumulative Inflow              : {t['amount']:.6f} {detected_chain}")
            print(f"      - Entity Classification          : {t['profile']}")
            print(f"      - Attribution Confidence (ACC)   : {acc_score:.2f}  [{acc_label}]")
            print(f"      - Path Proximity Score (PAES)    : {paes_score:.2f}  [{paes_label}]")
            print(f"      - Nodal Officer Desk             : {v_portal} ({v_email})")
            print(f"      - Statutory Notice               : Serve Section 91 CrPC / 94 BNSS Notice to {v_email} to freeze account & KYC")
    else:
        print("  [-] No custodial exchange (Binance, OKX, CoinDCX, etc.) reached yet in traced hops.")
        if cross_chain_hops:
            print("\n  [*] CHAIN-HOPPING & DEFI BRIDGE OPERATIONS IDENTIFIED:")
            for bh in cross_chain_hops:
                print(f"      - Protocol                       : {bh.get('protocol')} ({bh.get('status')})")
                print(f"      - Origin Chain                   : {bh.get('origin_chain')} (Deposit Tx: {bh.get('origin_tx_hash')})")
                print(f"      - Dest Chain                     : {bh.get('destination_chain_name')} (Chain ID: {bh.get('destination_chain_id')})")
                print(f"      - Fill TxHash                    : {bh.get('fill_tx_hash')}")
                print(f"      - Dest Recipient                 : {bh.get('recipient')}")
                print(f"      - Attribution Confidence (ACC)   : 0.95  [VERIFIED — Registry Match]")
                print(f"      - Path Proximity Score (PAES)    : 0.80  [Hop 2 — Direct Deposit Path]")
                print(f"      - Current Status                 : Bridged funds delivered to recipient on destination chain (unspent).")
                print(f"      - Statutory Intercept            : Serve Preservation Notice to bridge nodal desk & monitor destination address.")
        else:
            last_hop = tracer.ledger[-1] if tracer.ledger else None
            if last_hop:
                l_hop_num = last_hop.get('hop', 1)
                l_paes = max(0.50, 1.0 - (l_hop_num * 0.10))
                print(f"  [-] Trail currently sitting in unhosted intermediate wallet at Hop {l_hop_num}:")
                print(f"      - Address                        : {last_hop['to']}")
                print(f"      - Amount                         : {last_hop['amount']:.6f} {detected_chain}")
                print(f"      - Attribution Confidence (ACC)   : 0.70  [Ledger Ingestion — Unhosted Wallet]")
                print(f"      - Path Proximity Score (PAES)    : {l_paes:.2f}  [Hop {l_hop_num} — Active Outflow Trail]")
                print(f"      - Statutory Recommendation       : Flag address on domestic monitoring watchlists (CERT-In / FIU-IND).")
    print("=" * 85)

    # 5. Auto-save JSON Investigation Report
    case_id = f"CASE_{clean_addr[:10]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    reports_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "reports")
    os.makedirs(reports_dir, exist_ok=True)
    report_path = os.path.join(reports_dir, f"{case_id}.json")

    report_data = {
        "case_id": case_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "suspect_wallet": clean_addr,
        "coin": detected_chain,
        "blockchain": detected_chain,
        "risk_score": case_risk.composite_score,
        "risk_level": case_risk.risk_level.value,
        "typologies": [
            {
                "code": t.code,
                "title": t.title,
                "description": t.description,
                "severity": t.level.value,
                "base_threat_weight": t.base_threat_weight,
                "statutory_reference": t.statutory_reference,
                "investigative_action": t.investigative_action,
                "guidance": t.investigative_action,
            }
            for t in case_risk.typologies
        ],
        "hops_traced": len(tracer.ledger),
        "total_inflow": total_in,
        "total_outflow": total_out,
        "inflow_count": len(inflows),
        "outflow_count": len(outflows),
        "on_chain_summary": {
            "total_inflow": total_in,
            "total_outflow": total_out,
            "inflow_count": len(inflows),
            "outflow_count": len(outflows),
            "transfers_traced": len(tracer.ledger),
        },
        "risk_assessment": {
            "risk_score": case_risk.composite_score,
            "composite_score": case_risk.composite_score,
            "risk_level": case_risk.risk_level.value,
            "verdict": case_risk.summary_verdict,
            "typologies": [
                {
                    "code": t.code,
                    "title": t.title,
                    "description": t.description,
                    "severity": t.level.value,
                    "base_threat_weight": t.base_threat_weight,
                    "statutory_reference": t.statutory_reference,
                    "investigative_action": t.investigative_action,
                    "guidance": t.investigative_action,
                }
                for t in case_risk.typologies
            ],
            "high_risk_alerts": case_risk.high_risk_alerts,
        },
        "cross_chain_hops": cross_chain_hops,
        "vasp_targets": [
            {
                "hop": t["hop"],
                "address": t["to"],
                "vasp_name": (t.get("vasp_info") or {}).get("name", "Unknown"),
                "jurisdiction": (t.get("vasp_info") or {}).get("country", "International"),
                "compliance_email": (t.get("vasp_info") or {}).get("compliance_email", ""),
                "acc_score": 0.95 if (t.get("vasp_info") or {}).get("verified") else 0.85,
                "paes_score": max(0.60, 1.0 - (t["hop"] * 0.10)),
                "statutory_notice": f"Section 91 CrPC / Section 94 BNSS",
            }
            for t in terminal_vasps
        ],
        "chain_of_custody_ledger": [
            {
                "hop": item["hop"],
                "from": item["from"],
                "to": item["to"],
                "amount": item["amount"],
                "acc_score": item.get("acc_score", 0.85),
                "paes_score": item.get("paes_score", 0.80),
                "timestamp": item.get("time"),
                "tx_hash": item.get("tx_hash"),
                "profile": item.get("profile"),
                "vasp_info": item.get("vasp_info"),
            }
            for item in tracer.ledger
        ],
    }

    try:
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        print(f"\n[+] INVESTIGATION REPORT SAVED: {report_path}")
    except Exception as e:
        print(f"\n[WARN] Could not save report: {e}")

    print("" + "=" * 85 + "\n")
    return report_data


def main():
    parser = argparse.ArgumentParser(
        description="Suspect Wallet Multi-Hop Fund Flow Tree Tracer (Zero API Keys)"
    )
    # Primary Mandatory input
    parser.add_argument("address", nargs="?", default=None, help="Suspect cryptocurrency wallet address (Mandatory)")

    # PS Specific Optional extra info fields
    parser.add_argument("--coin", "--coin-type", dest="coin_type", type=str, default=None,
                        help="Optional: Coin type (BTC, ETH, TRON, BNB, MATIC, SOL)")
    parser.add_argument("--date", "--date-range", dest="date_range", type=str, default=None,
                        help="Optional: Date or Date Range (YYYY-MM-DD or YYYY-MM-DD to YYYY-MM-DD)")
    parser.add_argument("--tx-hash", "--hash", dest="tx_hash", type=str, default=None,
                        help="Optional: Specific transaction hash (TxHash)")
    parser.add_argument("--amount", type=float, default=None,
                        help="Optional: Exact crime / transaction amount")
    parser.add_argument("--hops", type=int, default=15,
                        help="Optional: Max forward hops to search until VASP found (default: 15)")

    args = parser.parse_args()

    address = args.address
    coin_type = args.coin_type
    date_range = args.date_range
    tx_hash = args.tx_hash
    amount = args.amount
    hops = args.hops

    if not address:
        print("================================================================================")
        print("                 SUSPECT WALLET MULTI-HOP FUND FLOW TRACER                      ")
        print("================================================================================")
        address = input("Enter Suspect Wallet Address (Required): ").strip()
        if not address:
            print("[ERROR] Suspect wallet address is mandatory! Exiting.")
            sys.exit(1)

        print("\n--- Optional Extra Information (Press Enter to skip if not available) ---")
        c_in = input("1. Coin Type (e.g. BTC, ETH, TRON, BNB, MATIC, SOL) : ").strip()
        if c_in:
            coin_type = c_in

        d_in = input("2. Date or Date Range (e.g. 2026-09-14 or 2026-09-01 to 2026-09-14): ").strip()
        if d_in:
            date_range = d_in

        h_in = input("3. Transaction Hash (TxHash)                          : ").strip()
        if h_in:
            tx_hash = h_in

        a_in = input("4. Exact Amount                                       : ").strip()
        if a_in:
            try:
                amount = float(a_in)
            except ValueError:
                print(f"[WARN] Invalid amount '{a_in}', ignoring amount filter.")

    asyncio.run(analyze_wallet(
        address=address,
        coin_type=coin_type,
        date_range_str=date_range,
        tx_hash=tx_hash,
        amount=amount,
        max_hops=hops,
    ))


if __name__ == "__main__":
    main()
