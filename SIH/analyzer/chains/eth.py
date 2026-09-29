"""
Direct EVM Block Fetcher (Ethereum, BNB Chain, Polygon MATIC).
Zero third-party API keys. Uses raw JSON-RPC 2.0.
"""

import asyncio
import time
import httpx
from typing import Dict, Any, Optional, List
from analyzer.chains.base import BaseChainFetcher
from analyzer.models import NormalizedBlock, NormalizedTx
from analyzer.pool import NodePool


class EVMChainFetcher(BaseChainFetcher):
    def __init__(self, pool: NodePool, native_currency: str = "ETH"):
        super().__init__(pool)
        self.currency = native_currency.upper()

    @property
    def chain_name(self) -> str:
        return self.pool.chain

    async def fetch_latest_block_number(self) -> int:
        payload = {"jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1}
        headers = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}

        for _ in range(len(self.pool.nodes)):
            node_url = await self.pool.get_next_node()
            start = time.time()
            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    resp = await client.post(node_url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        res_hex = data.get("result")
                        if res_hex:
                            self.pool.report_success(node_url, (time.time() - start) * 1000)
                            return int(res_hex, 16)
            except Exception:
                pass
            self.pool.report_failure(node_url)

        raise RuntimeError(f"Failed to fetch latest block number for {self.chain_name} across all nodes.")

    async def fetch_block_by_number(self, block_number: int) -> NormalizedBlock:
        hex_height = hex(block_number)
        payload = {"jsonrpc": "2.0", "method": "eth_getBlockByNumber", "params": [hex_height, True], "id": block_number}
        headers = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}

        start_time = time.time()

        for _ in range(len(self.pool.nodes)):
            node_url = await self.pool.get_next_node()
            req_start = time.time()
            try:
                async with httpx.AsyncClient(timeout=4.0) as client:
                    resp = await client.post(node_url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        result = data.get("result")
                        if result:
                            self.pool.report_success(node_url, (time.time() - req_start) * 1000)
                            return self._parse_block(result, int((time.time() - start_time) * 1000))
            except Exception:
                pass
            self.pool.report_failure(node_url)

        raise RuntimeError(f"Failed to fetch block {block_number} for {self.chain_name} from public nodes.")

    def _parse_block(self, raw: Dict[str, Any], duration_ms: int) -> NormalizedBlock:
        height = int(raw.get("number", "0x0"), 16)
        timestamp = int(raw.get("timestamp", "0x0"), 16)
        size_bytes = int(raw.get("size", "0x0"), 16)
        raw_txs = raw.get("transactions", [])

        norm_txs = []
        total_vol = 0.0
        total_fees = 0.0

        for i, tx in enumerate(raw_txs):
            val_int = int(tx.get("value", "0x0"), 16)
            val_coin = val_int / 1e18
            total_vol += val_coin

            gas_used = int(tx.get("gas", "0x0"), 16)
            gas_price_int = int(tx.get("gasPrice", "0x0"), 16)
            fee_coin = (gas_used * gas_price_int) / 1e18
            total_fees += fee_coin

            to_addr = tx.get("to")
            is_contract = False
            if not to_addr or to_addr == "":
                is_contract = True
                to_addr = None
            else:
                to_addr = to_addr.lower()

            input_data = tx.get("input", "")
            method_id = None
            if len(input_data) >= 10 and input_data != "0x":
                method_id = input_data[:10]

            idx_hex = tx.get("transactionIndex", hex(i))
            idx = int(idx_hex, 16) if idx_hex else i

            norm_tx = NormalizedTx(
                tx_hash=tx.get("hash", ""),
                index_in_block=idx,
                chain=self.chain_name,
                block_number=height,
                timestamp=timestamp,
                from_address=tx.get("from", "").lower(),
                to_address=to_addr,
                value=round(val_coin, 8),
                value_raw=str(val_int),
                fee=round(fee_coin, 8),
                gas_used=gas_used,
                gas_price=hex(gas_price_int),
                is_contract_creation=is_contract,
                method_id=method_id,
                input_data=input_data if len(input_data) <= 100 else input_data[:100] + "...",
            )
            norm_txs.append(norm_tx)

        return NormalizedBlock(
            chain=self.chain_name,
            height=height,
            hash=raw.get("hash", ""),
            parent_hash=raw.get("parentHash", ""),
            timestamp=timestamp,
            tx_count=len(norm_txs),
            total_volume=round(total_vol, 6),
            total_fees=round(total_fees, 6),
            size_bytes=size_bytes,
            miner_or_validator=raw.get("miner", "").lower(),
            fetch_duration_ms=duration_ms,
            transactions=norm_txs,
        )

    async def fetch_address_transactions(self, address: str, limit: int = 50) -> List[NormalizedTx]:
        clean_addr = address.strip().lower()
        subdomain = "eth"
        if self.chain_name == "BNB":
            subdomain = "bsc"
        elif self.chain_name == "MATIC" or self.chain_name == "POL":
            subdomain = "polygon"

        url = f"https://{subdomain}.blockscout.com/api/v2/addresses/{clean_addr}/transactions"
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code == 200:
                    items = resp.json().get("items", [])
                    target_items = items[:limit]

                    # Parallel lookup for token transfers on contract/zero-value transactions
                    async def enrich_item_transfers(item):
                        tx_h = item.get("hash")
                        v_str = item.get("value", "0")
                        v_val = float(v_str) / 1e18 if v_str else 0.0
                        t_types = str(item.get("transaction_types", []))
                        to_d = item.get("to") or {}
                        is_contract = to_d.get("is_contract", False) if isinstance(to_d, dict) else False

                        if v_val == 0.0 and (is_contract or "token_transfer" in t_types or "contract_call" in t_types):
                            try:
                                t_url = f"https://{subdomain}.blockscout.com/api/v2/transactions/{tx_h}"
                                t_resp = await client.get(t_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=6.0)
                                if t_resp.status_code == 200:
                                    t_data = t_resp.json()
                                    tts = t_data.get("token_transfers") or []
                                    if tts:
                                        item["_token_transfers"] = tts
                            except Exception:
                                pass
                        return item

                    await asyncio.gather(*(enrich_item_transfers(it) for it in target_items), return_exceptions=True)

                    norm_list = []
                    for i, t in enumerate(target_items):
                        from_data = t.get("from")
                        from_addr = from_data.get("hash", "").lower() if isinstance(from_data, dict) else ""

                        to_data = t.get("to")
                        to_addr = to_data.get("hash", "").lower() if isinstance(to_data, dict) else None

                        val_str = t.get("value", "0")
                        val_coin = float(val_str) / 1e18 if val_str else 0.0

                        fee_data = t.get("fee", {})
                        fee_val = fee_data.get("value", "0") if isinstance(fee_data, dict) else "0"
                        fee_coin = float(fee_val) / 1e18 if fee_val else 0.0

                        ts_str = t.get("timestamp")
                        ts = int(time.time())
                        if ts_str:
                            try:
                                from datetime import datetime, timezone
                                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                                ts = int(dt.timestamp())
                            except Exception:
                                pass

                        decoded = t.get("decoded_input")
                        method = t.get("method")
                        if not method and isinstance(decoded, dict):
                            method = decoded.get("method_call")

                        # Token Transfers Parsing (ERC-20 DEX Swaps & Bridges)
                        tts = t.get("_token_transfers") or []
                        swapped_weth = 0.0
                        swapped_stable = 0.0
                        swap_descriptions = []
                        detected_dex_name = None
                        is_dex_swap = False

                        for tt in tts:
                            t_from = (tt.get("from") or {}).get("name") or ""
                            t_to = (tt.get("to") or {}).get("name") or ""
                            sym = (tt.get("token") or {}).get("symbol") or "TOKEN"
                            dec = int((tt.get("token") or {}).get("decimals") or 18)
                            raw_v = int((tt.get("total") or {}).get("value") or 0)
                            amt = raw_v / (10 ** dec)
                            swap_descriptions.append(f"{amt:,.2f} {sym}")

                            combined_names = f"{t_from} {t_to}".lower()
                            if any(k in combined_names for k in ("uniswap", "sushi", "pancake", "curve", "balancer", "swap", "pair", "router", "pool", "vault")):
                                is_dex_swap = True
                                if "uniswap" in combined_names:
                                    detected_dex_name = "Uniswap V2 Liquidity Pool"
                                elif "sushi" in combined_names:
                                    detected_dex_name = "SushiSwap Liquidity Pool"
                                elif "curve" in combined_names:
                                    detected_dex_name = "Curve Finance Pool"
                                elif not detected_dex_name:
                                    detected_dex_name = "DeFi DEX Liquidity Pool"

                            if sym.upper() in ("WETH", "ETH"):
                                swapped_weth = amt
                            elif sym.upper() in ("USDT", "USDC", "DAI"):
                                swapped_stable = amt

                        if val_coin == 0.0:
                            if swapped_weth > 0:
                                val_coin = swapped_weth
                            elif swapped_stable > 0:
                                val_coin = swapped_stable / 2700.0 if self.chain_name == "ETH" else swapped_stable
                            elif swap_descriptions:
                                for tt in tts:
                                    dec = int((tt.get("token") or {}).get("decimals") or 18)
                                    raw_v = int((tt.get("total") or {}).get("value") or 0)
                                    if raw_v > 0:
                                        val_coin = raw_v / (10 ** dec)
                                        break

                        # Method B: EVM Smart Contract Mixer vs Cross-Chain Bridge Heuristic
                        is_to_contract = to_data.get("is_contract", False) if isinstance(to_data, dict) else False
                        is_mixer_tx = False
                        mixer_info = None

                        to_data_str = str(to_data or "").lower()
                        method_s = str(method or "").lower()
                        decoded_s = str(decoded or "").lower()

                        BRIDGE_KEYWORDS = ("bridge", "spokepool", "across", "stargate", "wormhole", "hop.exchange", "hopprotocol", "synapse", "cbridge", "anyswap", "multichain", "destinationchainid")
                        is_bridge = any(kw in to_data_str or kw in method_s or kw in decoded_s for kw in BRIDGE_KEYWORDS)

                        DEX_SWAP_KEYWORDS = ("swap", "uniswap", "router", "pancakeswap", "sushiswap", "curve", "1inch", "balancer", "kyber", "dex", "strategyexecutor")
                        if not is_dex_swap:
                            is_dex_swap = any(kw in to_data_str or kw in method_s or kw in decoded_s for kw in DEX_SWAP_KEYWORDS)

                        if is_bridge:
                            bridge_name = "Across Protocol" if "across" in to_data_str else "DeFi Cross-Chain Bridge"
                            mixer_info = {
                                "type": "DEFI_BRIDGE",
                                "name": bridge_name,
                                "contract": to_addr,
                                "method": method_s or "bridge_transfer",
                                "heuristic": "Cross-Chain Liquidity Pool / Relayer (Bridge Protocol)",
                            }
                        elif is_dex_swap:
                            dex_name = detected_dex_name or ("Uniswap DEX Router" if "uniswap" in to_data_str else "DeFi DEX Token Swapper")
                            tokens_desc = " -> ".join(swap_descriptions) if swap_descriptions else f"{val_coin:.6f} {self.chain_name}"
                            mixer_info = {
                                "type": "DEFI_SWAPPER",
                                "name": dex_name,
                                "contract": to_addr,
                                "method": method_s or "token_swap",
                                "tokens": tokens_desc,
                                "token_symbol": "WETH" if swapped_weth > 0 else self.chain_name,
                                "heuristic": "Automated Market Maker (AMM) / Decentralized Token Swapper",
                            }
                        elif is_to_contract:
                            FIXED_DENOMS = (0.1, 1.0, 10.0, 100.0)
                            matches_denom = any(abs(val_coin - d) < 1e-4 for d in FIXED_DENOMS)
                            is_tornado_method = ("deposit(bytes32" in method_s or "0xb214bb21" in str(t.get("input", "")) or "tornado" in to_data_str)
                            
                            if is_tornado_method or (matches_denom and "swap" not in method_s and "uniswap" not in to_data_str):
                                is_mixer_tx = True
                                mixer_info = {
                                    "type": "EVM_ZK_MIXER",
                                    "name": "Tornado Cash / Privacy Pool",
                                    "contract": to_addr,
                                    "denomination": val_coin,
                                    "method": method_s or "deposit",
                                    "heuristic": "Smart Contract Bytecode zk-SNARK Mixer Pattern (Tornado/PrivacyPools)",
                                }

                        norm_tx = NormalizedTx(
                            tx_hash=t.get("hash", ""),
                            index_in_block=i,
                            chain=self.chain_name,
                            block_number=t.get("block_number", 0),
                            timestamp=ts,
                            from_address=from_addr,
                            to_address=to_addr,
                            value=round(val_coin, 8),
                            value_raw=str(val_str),
                            fee=round(fee_coin, 8),
                            is_contract_creation=(to_addr is None),
                            method_id=str(method) if method else None,
                            is_coinjoin=is_mixer_tx or is_bridge or is_dex_swap,
                            coinjoin_details=mixer_info,
                        )
                        norm_list.append(norm_tx)
                    return norm_list
        except Exception:
            pass

        return []
