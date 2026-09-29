"""
Graph Bridge: Integrates Live Blockchain Ingestion & VASP Attribution
with the High-Performance C++ CSR Transaction Graph Engine (TransactionGraphBackend).
"""

import os
import sys
import json
import csv
import subprocess
import asyncio
from typing import Dict, Any, Optional, List

from analyzer.wallet import FundFlowTreeTracer, auto_detect_chain
from analyzer.chains import get_chain_fetcher
from analyzer.vasp_resolver import VASPResolver


class GraphEngineBridge:
    def __init__(self, engine_dir: Optional[str] = None):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if engine_dir is not None:
            self.engine_dir = engine_dir
        else:
            candidates = [
                os.path.join(base_dir, "TransactionGraphBackend"),
                os.path.join(base_dir, "analyzer", "TransactionGraphBackend"),
                os.path.abspath("TransactionGraphBackend"),
            ]
            self.engine_dir = candidates[0]
            for c in candidates:
                if os.path.exists(os.path.join(c, "build", "graph_demo.exe")):
                    self.engine_dir = c
                    break

        self.exe_path = os.path.join(self.engine_dir, "build", "graph_demo.exe")
        self.resolver = VASPResolver()

    def is_engine_ready(self) -> bool:
        return os.path.exists(self.exe_path)

    async def run_cpp_engine_on_ledger(
        self,
        clean_addr: str,
        chain: str,
        ledger: List[Dict[str, Any]],
        max_hops: int = 15,
    ) -> Dict[str, Any]:
        """
        Runs C++ CSR Graph Engine on an already-ingested on-chain ledger.
        """
        temp_dir = os.path.join(self.engine_dir, "data")
        os.makedirs(temp_dir, exist_ok=True)

        tx_csv_path = os.path.join(temp_dir, f"live_{clean_addr[:10]}_txs.csv")
        json_out_path = os.path.join(temp_dir, f"live_{clean_addr[:10]}_result.json")

        with open(tx_csv_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["tx_id", "from", "to", "amount", "timestamp", "asset"])
            for idx, item in enumerate(ledger, start=1):
                tx_id = item.get("tx_hash") or f"TX_{idx:04d}"
                f_addr = item["from"]
                t_addr = item["to"]
                amt = item["amount"]
                ts = item.get("time") or 1726000000
                writer.writerow([tx_id, f_addr, t_addr, amt, ts, chain])

        if not self.is_engine_ready():
            raise FileNotFoundError(f"C++ Graph Engine binary not found at {self.exe_path}")

        cmd = [
            self.exe_path,
            tx_csv_path,
            "--source", clean_addr,
            "--json", json_out_path,
            "--max-depth", str(max_hops),
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=self.engine_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        graph_data: Dict[str, Any] = {}
        if os.path.exists(json_out_path):
            try:
                with open(json_out_path, "r", encoding="utf-8") as f:
                    graph_data = json.load(f)
            except Exception as e:
                graph_data = {"error": f"Failed to parse graph JSON: {e}"}
        else:
            graph_data = {
                "error": "Graph engine did not produce JSON output",
                "stdout": stdout.decode("utf-8", errors="replace"),
                "stderr": stderr.decode("utf-8", errors="replace"),
            }

        active_nodes = graph_data.get("nodes", [])
        vasp_targets = []

        for node in active_nodes:
            addr = node.get("address", "").strip()
            depth = node.get("depth", 0)

            if depth == 0 or addr.lower() == clean_addr.lower():
                node["type"] = "SUSPECT"
                node["label"] = f"Suspect Wallet ({chain})"
                continue

            display_str, v_info = await self.resolver.resolve(addr, chain)

            if v_info and v_info.get("name"):
                v_name = v_info["name"].upper()
                v_country = v_info.get("country", "International")
                v_email = v_info.get("compliance_email", "compliance desk")
                v_portal = v_info.get("compliance_portal", "Direct Notice Desk")

                node["type"] = "VASP"
                node["label"] = f"{v_name} ({v_country})"
                node["vasp_info"] = v_info

                vasp_targets.append({
                    "hop": depth,
                    "address": addr,
                    "vasp_name": v_name,
                    "jurisdiction": v_country,
                    "asset": chain,
                    "acc_score": 1.0 if "VERIFIED" in (display_str or "") else 0.85,
                    "paes_score": max(0.60, 1.0 - (depth * 0.1)),
                    "compliance_email": v_email,
                    "compliance_portal": v_portal,
                    "statutory_order": f"Serve Section 91 CrPC / Section 94 BNSS Notice to {v_email} to freeze KYC and funds.",
                })
            else:
                node["type"] = "INTERMEDIARY"
                node["label"] = f"Intermediary Hop {depth}"

        response = {
            "status": "SUCCESS",
            "chain": chain,
            "suspect_address": clean_addr,
            "engine": "TransactionGraphBackend (C++ CSR Graph + Microsecond BFS with Lazy Attribution)",
            "graph": graph_data,
            "vasp_targets": vasp_targets,
            "audit_ledger": ledger,
            "total_hops_traced": max([n.get("depth", 0) for n in active_nodes], default=0),
            "total_nodes_in_path": len(active_nodes),
            "total_transfers": len(ledger),
        }

        for p in [tx_csv_path, json_out_path]:
            try:
                if os.path.exists(p):
                    os.remove(p)
            except Exception:
                pass

        return response

    async def generate_graph_from_suspect(
        self,
        suspect_address: str,
        coin_type: Optional[str] = None,
        max_hops: int = 15,
        date_range_str: Optional[str] = None,
        tx_hash: Optional[str] = None,
        amount: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        High-Performance Workflow:
        1. Fast Ingestion: Extract raw on-chain transaction flows until terminal VASP or max hops.
        2. C++ Graph Build: C++ CSR Graph builds & traverses in microseconds.
        3. Post-Traversal Classification: Only resolve VASP identities for active nodes.
        """
        clean_addr = suspect_address.strip()
        chain = (coin_type or auto_detect_chain(clean_addr)).upper().strip()
        fetcher = get_chain_fetcher(chain)

        tracer = FundFlowTreeTracer(fetcher=fetcher, chain=chain, max_hops=max_hops)
        root, inflows, outflows = await tracer.trace_tree(
            suspect_address=clean_addr,
            clean_tx_hash=tx_hash.strip().lower() if tx_hash else None,
            amount=amount,
        )

        return await self.run_cpp_engine_on_ledger(
            clean_addr=clean_addr,
            chain=chain,
            ledger=tracer.ledger,
            max_hops=max_hops,
        )


bridge = GraphEngineBridge()


async def main():
    if len(sys.argv) < 2:
        print("Usage: python -m analyzer.graph_bridge <suspect_address> [coin_type]")
        sys.exit(1)

    addr = sys.argv[1]
    coin = sys.argv[2] if len(sys.argv) > 2 else None

    print(f"[*] Initializing C++ Graph Engine & Live Blockchain Tracer for {addr}...")
    res = await bridge.generate_graph_from_suspect(addr, coin_type=coin)
    print("\n====================================================================")
    print("       C++ TRANSACTION GRAPH & ATTRIBUTION RESULT (FRONTEND DTO)     ")
    print("====================================================================")
    print(json.dumps(res, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
