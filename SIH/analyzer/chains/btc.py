"""
Direct Bitcoin (BTC) Block & UTXO Fetcher.
Zero third-party API keys. Uses raw public node endpoints.
"""

import time
import httpx
from typing import Dict, Any, List
from analyzer.chains.base import BaseChainFetcher
from analyzer.models import NormalizedBlock, NormalizedTx, UTXOInput, UTXOOutput
from analyzer.pool import NodePool


class BTCChainFetcher(BaseChainFetcher):
    @property
    def chain_name(self) -> str:
        return "BTC"

    async def fetch_latest_block_number(self) -> int:
        for _ in range(len(self.pool.nodes)):
            node_url = await self.pool.get_next_node()
            endpoint = f"{node_url.rstrip('/')}/blocks/tip/height"
            start = time.time()
            try:
                async with httpx.AsyncClient(timeout=3.5) as client:
                    resp = await client.get(endpoint, headers={"User-Agent": "Mozilla/5.0"})
                    if resp.status_code == 200:
                        self.pool.report_success(node_url, (time.time() - start) * 1000)
                        return int(resp.text.strip())
            except Exception:
                pass
            self.pool.report_failure(node_url)

        raise RuntimeError("Failed to fetch latest BTC block height.")

    async def fetch_block_by_number(self, block_number: int) -> NormalizedBlock:
        start_time = time.time()

        for _ in range(len(self.pool.nodes)):
            node_url = await self.pool.get_next_node()
            base = node_url.rstrip("/")
            req_start = time.time()
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    # 1. Get block hash
                    hash_resp = await client.get(f"{base}/block-height/{block_number}", headers={"User-Agent": "Mozilla/5.0"})
                    if hash_resp.status_code != 200:
                        continue
                    block_hash = hash_resp.text.strip()

                    # 2. Get block header
                    blk_resp = await client.get(f"{base}/block/{block_hash}", headers={"User-Agent": "Mozilla/5.0"})
                    if blk_resp.status_code != 200:
                        continue
                    blk_data = blk_resp.json()

                    # 3. Get transactions (first 25 txs for low-latency retrieval)
                    txs_resp = await client.get(f"{base}/block/{block_hash}/txs", headers={"User-Agent": "Mozilla/5.0"})
                    txs_data = txs_resp.json() if txs_resp.status_code == 200 else []

                    self.pool.report_success(node_url, (time.time() - req_start) * 1000)
                    return self._parse_block(blk_data, txs_data, int((time.time() - start_time) * 1000))
            except Exception:
                pass
            self.pool.report_failure(node_url)

        raise RuntimeError(f"Failed to fetch BTC block {block_number} from public nodes.")

    def _parse_block(self, header: Dict[str, Any], txs: List[Dict[str, Any]], duration_ms: int) -> NormalizedBlock:
        height = header.get("height", 0)
        timestamp = header.get("timestamp", 0)
        size_bytes = header.get("size", 0)
        tx_count = header.get("tx_count", len(txs))

        norm_txs = []
        total_vol = 0.0
        total_fees = 0.0

        for i, tx in enumerate(txs):
            inputs = []
            primary_sender = None
            for vin in tx.get("vin", []):
                prevout = vin.get("prevout")
                addr = None
                val_btc = 0.0
                if prevout:
                    addr = prevout.get("scriptpubkey_address")
                    val_btc = prevout.get("value", 0) / 1e8
                if not primary_sender and addr:
                    primary_sender = addr
                inputs.append(UTXOInput(
                    txid=vin.get("txid", ""),
                    vout=vin.get("vout", 0),
                    address=addr,
                    value=val_btc,
                    script_sig=vin.get("scriptsig"),
                    sequence=vin.get("sequence"),
                ))

            outputs = []
            tx_vol = 0.0
            primary_receiver = None
            for vout_idx, vout in enumerate(tx.get("vout", [])):
                val_btc = vout.get("value", 0) / 1e8
                tx_vol += val_btc
                addr = vout.get("scriptpubkey_address")
                if not primary_receiver and addr:
                    primary_receiver = addr
                outputs.append(UTXOOutput(
                    index=vout_idx,
                    address=addr,
                    value=val_btc,
                    script_pub_key=vout.get("scriptpubkey"),
                ))

            fee_btc = tx.get("fee", 0) / 1e8
            total_fees += fee_btc
            total_vol += tx_vol

            norm_tx = NormalizedTx(
                tx_hash=tx.get("txid", ""),
                index_in_block=i,
                chain="BTC",
                block_number=height,
                timestamp=timestamp,
                from_address=primary_sender,
                to_address=primary_receiver,
                value=round(tx_vol, 8),
                value_raw=f"{int(tx_vol * 1e8)} sats",
                fee=round(fee_btc, 8),
                inputs=inputs,
                outputs=outputs,
            )
            norm_txs.append(norm_tx)

        return NormalizedBlock(
            chain="BTC",
            height=height,
            hash=header.get("id", ""),
            parent_hash=header.get("previousblockhash"),
            timestamp=timestamp,
            tx_count=tx_count,
            total_volume=round(total_vol, 6),
            total_fees=round(total_fees, 6),
            size_bytes=size_bytes,
            fetch_duration_ms=duration_ms,
            transactions=norm_txs,
        )

    async def fetch_address_transactions(self, address: str, limit: int = 50) -> List[NormalizedTx]:
        clean_addr = address.strip()
        for _ in range(len(self.pool.nodes)):
            node_url = await self.pool.get_next_node()
            endpoint = f"{node_url.rstrip('/')}/address/{clean_addr}/txs"
            try:
                async with httpx.AsyncClient(timeout=3.5) as client:
                    resp = await client.get(endpoint, headers={"User-Agent": "Mozilla/5.0"})
                    if resp.status_code == 200:
                        raw_txs = resp.json()
                        norm_list = []
                        for i, tx in enumerate(raw_txs[:limit]):
                            # Analyze inputs
                            in_val = 0.0
                            is_sender = False
                            other_senders = []
                            for vin in tx.get("vin", []):
                                p = vin.get("prevout")
                                if p:
                                    a = p.get("scriptpubkey_address")
                                    v = p.get("value", 0) / 1e8
                                    if a == clean_addr:
                                        is_sender = True
                                        in_val += v
                                    elif a:
                                        other_senders.append(a)

                            # Analyze outputs
                            out_val = 0.0
                            is_receiver = False
                            other_receivers = []
                            for vout in tx.get("vout", []):
                                a = vout.get("scriptpubkey_address")
                                v = vout.get("value", 0) / 1e8
                                if a == clean_addr:
                                    is_receiver = True
                                    out_val += v
                                elif a:
                                    other_receivers.append(a)

                            status = tx.get("status", {})
                            ts = status.get("block_time", int(time.time()))
                            height = status.get("block_height", 0)
                            fee_btc = tx.get("fee", 0) / 1e8

                            # Net flow direction for the target wallet
                            if is_sender:
                                # Target wallet sent funds
                                primary_to = other_receivers[0] if other_receivers else (clean_addr if is_receiver else "Unknown")
                                val = in_val - (out_val if is_receiver else 0.0) - fee_btc
                                if val <= 0:
                                    val = in_val
                                from_a = clean_addr
                                to_a = primary_to
                            elif is_receiver:
                                # Target wallet received funds
                                primary_from = other_senders[0] if other_senders else "Coinbase/External"
                                val = out_val
                                from_a = primary_from
                                to_a = clean_addr
                            else:
                                val = 0.0
                                from_a = other_senders[0] if other_senders else "Unknown"
                                to_a = other_receivers[0] if other_receivers else "Unknown"

                            # Real-Time Algorithmic Mixer / CoinJoin Detection (Boltzmann Equal-Output Heuristic)
                            raw_vouts = tx.get("vout", [])
                            raw_vins = tx.get("vin", [])
                            out_values = [v.get("value", 0) for v in raw_vouts if v.get("value", 0) > 0]
                            is_coinjoin = False
                            coinjoin_info = None

                            if len(raw_vins) >= 3 and len(out_values) >= 3:
                                from collections import Counter
                                val_counts = Counter(out_values)
                                most_common_val, count = val_counts.most_common(1)[0]
                                if count >= 3 and most_common_val > 546:
                                    is_coinjoin = True
                                    coinjoin_info = {
                                        "type": "COINJOIN_MIXER",
                                        "identical_outputs_count": count,
                                        "denomination_sats": most_common_val,
                                        "denomination_btc": most_common_val / 1e8,
                                        "total_inputs": len(raw_vins),
                                        "total_outputs": len(raw_vouts),
                                        "heuristic": "Boltzmann Equal-Output Anonymity Pool (Wasabi/Whirlpool/Tumbler Pattern)",
                                    }

                            norm_tx = NormalizedTx(
                                tx_hash=tx.get("txid", ""),
                                index_in_block=i,
                                chain="BTC",
                                block_number=height,
                                timestamp=ts,
                                from_address=from_a,
                                to_address=to_a,
                                value=round(max(val, 0.0), 8),
                                value_raw=f"{int(max(val, 0.0) * 1e8)} sats",
                                fee=round(fee_btc, 8),
                                is_coinjoin=is_coinjoin,
                                coinjoin_details=coinjoin_info,
                            )
                            norm_list.append(norm_tx)
                        return norm_list
            except Exception:
                pass
            self.pool.report_failure(node_url)

        return []
