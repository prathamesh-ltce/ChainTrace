"""
Direct Solana (SOL) Block & Slot Fetcher.
Zero third-party API keys. Uses raw public RPC endpoints.
"""

import time
import httpx
from typing import Dict, Any, List, Optional, Tuple
from analyzer.chains.base import BaseChainFetcher
from analyzer.models import NormalizedBlock, NormalizedTx
from analyzer.pool import NodePool


class SolanaChainFetcher(BaseChainFetcher):
    @property
    def chain_name(self) -> str:
        return "SOL"

    async def fetch_latest_block_number(self) -> int:
        payload = {"jsonrpc": "2.0", "id": 1, "method": "getSlot"}
        for _ in range(len(self.pool.nodes)):
            node_url = await self.pool.get_next_node()
            start = time.time()
            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    resp = await client.post(node_url, json=payload, headers={"User-Agent": "Mozilla/5.0"})
                    if resp.status_code == 200:
                        slot = resp.json().get("result")
                        if slot is not None:
                            self.pool.report_success(node_url, (time.time() - start) * 1000)
                            return int(slot)
            except Exception:
                pass
            self.pool.report_failure(node_url)

        raise RuntimeError("Failed to fetch latest Solana slot.")

    async def fetch_block_by_number(self, block_number: int) -> NormalizedBlock:
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBlock",
            "params": [
                block_number,
                {"encoding": "json", "transactionDetails": "signatures", "maxSupportedTransactionVersion": 0}
            ]
        }
        start_time = time.time()

        for _ in range(len(self.pool.nodes)):
            node_url = await self.pool.get_next_node()
            req_start = time.time()
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(node_url, json=payload, headers={"User-Agent": "Mozilla/5.0"})
                    if resp.status_code == 200:
                        data = resp.json()
                        result = data.get("result")
                        if result:
                            self.pool.report_success(node_url, (time.time() - req_start) * 1000)
                            return self._parse_block(block_number, result, int((time.time() - start_time) * 1000))
            except Exception:
                pass
            self.pool.report_failure(node_url)

        raise RuntimeError(f"Failed to fetch Solana block/slot {block_number} from public nodes.")

    def _parse_block(self, slot: int, raw: Dict[str, Any], duration_ms: int) -> NormalizedBlock:
        blockhash = raw.get("blockhash", "")
        prev_blockhash = raw.get("previousBlockhash", "")
        block_time = raw.get("blockTime", int(time.time()))
        signatures = raw.get("signatures", [])

        norm_txs = []
        for i, sig in enumerate(signatures[:50]):  # Sample first 50 tx signatures
            norm_txs.append(NormalizedTx(
                tx_hash=sig,
                index_in_block=i,
                chain="SOL",
                block_number=slot,
                timestamp=block_time,
                value=0.0,
            ))

        return NormalizedBlock(
            chain="SOL",
            height=slot,
            hash=blockhash,
            parent_hash=prev_blockhash,
            timestamp=block_time,
            tx_count=len(signatures),
            fetch_duration_ms=duration_ms,
            transactions=norm_txs,
        )

    async def fetch_address_transactions(self, address: str, limit: int = 50) -> List[NormalizedTx]:
        clean_addr = address.strip()
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getSignaturesForAddress",
            "params": [clean_addr, {"limit": limit}],
        }
        for _ in range(len(self.pool.nodes)):
            node_url = await self.pool.get_next_node()
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(node_url, json=payload, headers={"User-Agent": "Mozilla/5.0"})
                    if resp.status_code == 200:
                        items = resp.json().get("result", [])
                        norm_list = []
                        for i, itm in enumerate(items):
                            sig = itm.get("signature", "")
                            slot = itm.get("slot", 0)
                            block_time = itm.get("blockTime", int(time.time()))
                            norm_list.append(NormalizedTx(
                                tx_hash=sig,
                                index_in_block=i,
                                chain="SOL",
                                block_number=slot,
                                timestamp=block_time,
                                from_address=clean_addr,
                                value=0.0,
                            ))
                        return norm_list
            except Exception:
                pass
            self.pool.report_failure(node_url)

        return []
