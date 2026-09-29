"""
Direct TRON (TRX / TRC-20) Block Fetcher.
Zero third-party API keys. Uses raw public node endpoints.
"""

import time
import httpx
from typing import Dict, Any, List
from analyzer.chains.base import BaseChainFetcher
from analyzer.models import NormalizedBlock, NormalizedTx
from analyzer.pool import NodePool


class TRONChainFetcher(BaseChainFetcher):
    @property
    def chain_name(self) -> str:
        return "TRON"

    async def fetch_latest_block_number(self) -> int:
        for _ in range(len(self.pool.nodes)):
            node_url = await self.pool.get_next_node()
            endpoint = f"{node_url.rstrip('/')}/wallet/getnowblock"
            start = time.time()
            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    resp = await client.post(endpoint, headers={"User-Agent": "Mozilla/5.0"})
                    if resp.status_code == 200:
                        data = resp.json()
                        num = data.get("block_header", {}).get("raw_data", {}).get("number")
                        if num is not None:
                            self.pool.report_success(node_url, (time.time() - start) * 1000)
                            return int(num)
            except Exception:
                pass
            self.pool.report_failure(node_url)

        raise RuntimeError("Failed to fetch latest TRON block height.")

    async def fetch_block_by_number(self, block_number: int) -> NormalizedBlock:
        start_time = time.time()

        for _ in range(len(self.pool.nodes)):
            node_url = await self.pool.get_next_node()
            endpoint = f"{node_url.rstrip('/')}/wallet/getblockbynum"
            payload = {"num": block_number}
            req_start = time.time()
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(endpoint, json=payload, headers={"User-Agent": "Mozilla/5.0"})
                    if resp.status_code == 200:
                        data = resp.json()
                        if "block_header" in data:
                            self.pool.report_success(node_url, (time.time() - req_start) * 1000)
                            return self._parse_block(data, int((time.time() - start_time) * 1000))
            except Exception:
                pass
            self.pool.report_failure(node_url)

        raise RuntimeError(f"Failed to fetch TRON block {block_number} from public nodes.")

    def _parse_block(self, raw: Dict[str, Any], duration_ms: int) -> NormalizedBlock:
        header = raw.get("block_header", {}).get("raw_data", {})
        height = header.get("number", 0)
        timestamp = int(header.get("timestamp", 0) / 1000)  # ms to s
        block_id = raw.get("blockID", "")
        parent_id = header.get("parentHash", "")
        raw_txs = raw.get("transactions", [])

        norm_txs = []
        total_vol = 0.0

        for i, tx in enumerate(raw_txs):
            tx_id = tx.get("txID", "")
            contract = tx.get("raw_data", {}).get("contract", [{}])[0]
            val_data = contract.get("parameter", {}).get("value", {})
            contract_type = contract.get("type", "")

            amount_sun = val_data.get("amount", 0)
            amount_trx = amount_sun / 1e6
            total_vol += amount_trx

            owner_addr = val_data.get("owner_address", "")
            to_addr = val_data.get("to_address")

            norm_tx = NormalizedTx(
                tx_hash=tx_id,
                index_in_block=i,
                chain="TRON",
                block_number=height,
                timestamp=timestamp,
                from_address=owner_addr,
                to_address=to_addr,
                value=round(amount_trx, 6),
                value_raw=str(amount_sun),
                method_id=contract_type,
            )
            norm_txs.append(norm_tx)

        return NormalizedBlock(
            chain="TRON",
            height=height,
            hash=block_id,
            parent_hash=parent_id,
            timestamp=timestamp,
            tx_count=len(norm_txs),
            total_volume=round(total_vol, 6),
            fetch_duration_ms=duration_ms,
            transactions=norm_txs,
        )

    async def fetch_address_transactions(self, address: str, limit: int = 50) -> List[NormalizedTx]:
        clean_addr = address.strip()
        url = f"https://api.trongrid.io/v1/accounts/{clean_addr}/transactions?limit={limit}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code == 200:
                    data = resp.json().get("data", [])
                    norm_list = []
                    for i, t in enumerate(data[:limit]):
                        tx_id = t.get("txID", "")
                        raw_data = t.get("raw_data", {})
                        contract = raw_data.get("contract", [{}])[0]
                        val_data = contract.get("parameter", {}).get("value", {})
                        contract_type = contract.get("type", "")

                        amount_sun = val_data.get("amount", 0)
                        amount_trx = amount_sun / 1e6

                        owner_addr = val_data.get("owner_address", "")
                        to_addr = val_data.get("to_address")

                        # Timestamp
                        ts = int(raw_data.get("timestamp", time.time() * 1000) / 1000)

                        norm_tx = NormalizedTx(
                            tx_hash=tx_id,
                            index_in_block=i,
                            chain="TRON",
                            block_number=0,
                            timestamp=ts,
                            from_address=owner_addr,
                            to_address=to_addr,
                            value=round(amount_trx, 6),
                            value_raw=str(amount_sun),
                            method_id=contract_type,
                        )
                        norm_list.append(norm_tx)
                    return norm_list
        except Exception:
            pass

        return []
