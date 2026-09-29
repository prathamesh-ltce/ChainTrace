"""
Cross-Chain Bridge & Chain-Hopping Forensic Tracer.
Automatically cracks cross-chain bridge hops (Across Protocol, Stargate/LayerZero, Wormhole).
Discovers the exact destination chain, fill TxHash, and recipient without third-party API keys.
"""

import httpx
from typing import Optional, Dict, Any

CHAIN_INFO: Dict[int, Dict[str, str]] = {
    1: {"name": "Ethereum Mainnet", "symbol": "ETH"},
    10: {"name": "Optimism", "symbol": "OPTIMISM"},
    56: {"name": "BNB Chain", "symbol": "BNB"},
    137: {"name": "Polygon", "symbol": "MATIC"},
    8453: {"name": "Base", "symbol": "BASE"},
    42161: {"name": "Arbitrum One", "symbol": "ARBITRUM"},
    4663: {"name": "Robinhood Chain", "symbol": "ROBINHOOD"},
    43114: {"name": "Avalanche C-Chain", "symbol": "AVAX"},
    324: {"name": "zkSync Era", "symbol": "ETH"},
    59144: {"name": "Linea", "symbol": "ETH"},
    534352: {"name": "Scroll", "symbol": "ETH"},
}


async def _fetch_deposit_metadata(tx_hash: str, origin_chain: str = "eth") -> Dict[str, Any]:
    """Inspects deposit tx on Blockscout to extract destination recipient and token amount."""
    meta: Dict[str, Any] = {}
    sub = "eth" if origin_chain.lower() in ("eth", "ethereum") else origin_chain.lower()
    url = f"https://{sub}.blockscout.com/api/v2/transactions/{tx_hash}"
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200:
                data = resp.json()
                from_d = data.get("from") or {}
                if isinstance(from_d, dict):
                    meta["sender"] = from_d.get("hash")
                val_s = data.get("value", "0")
                if val_s:
                    try:
                        meta["deposit_value"] = float(val_s) / 1e18
                    except Exception:
                        pass
                decoded = data.get("decoded_input") or {}
                for p in decoded.get("parameters", []):
                    pname = (p.get("name") or "").lower()
                    if pname in ("recipient", "to", "receiver", "destinationaddress"):
                        meta["recipient"] = p.get("value")
                    elif pname in ("outputamount", "amount", "inputamount"):
                        try:
                            meta["output_amount"] = float(p.get("value", 0)) / 1e18
                        except Exception:
                            pass
    except Exception:
        pass
    return meta


async def trace_cross_chain_bridge_hop(tx_hash: str, origin_chain: str = "ETH") -> Optional[Dict[str, Any]]:
    """
    Given an on-chain deposit transaction hash to a DeFi Bridge,
    queries public decentralized relayer networks and explorers to extract:
    - protocol name
    - destination chain name & symbol
    - destination recipient address
    - destination fill transaction hash
    - bridged amount
    """
    clean_tx = tx_hash.strip().lower()

    # 1. Check Across Protocol Relayer Network
    try:
        url = f"https://across.to/api/deposit/status?depositTxHash={clean_tx}"
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200:
                data = resp.json()
                dest_id = data.get("destinationChainId")
                fill_tx = data.get("fillTx") or data.get("fillTxnRef")
                if dest_id or fill_tx:
                    c_info = CHAIN_INFO.get(dest_id, {"name": f"EVM Chain {dest_id}", "symbol": "ETH"})
                    meta = await _fetch_deposit_metadata(clean_tx, origin_chain)
                    recipient = meta.get("recipient") or meta.get("sender")
                    amount = meta.get("output_amount") or meta.get("deposit_value") or 0.0

                    return {
                        "protocol": "Across Protocol",
                        "status": (data.get("status") or "FILLED").upper(),
                        "origin_chain": origin_chain.upper(),
                        "origin_tx_hash": clean_tx,
                        "origin_chain_id": data.get("originChainId", 1),
                        "destination_chain_id": dest_id,
                        "destination_chain_name": c_info["name"],
                        "destination_symbol": c_info["symbol"],
                        "fill_tx_hash": fill_tx,
                        "recipient": recipient,
                        "amount": amount,
                        "deposit_id": data.get("depositId"),
                    }
    except Exception:
        pass

    # 2. Check Wormhole Scan Network
    try:
        url = f"https://api.wormholescan.io/api/v1/operations?txHash={clean_tx}"
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200:
                data = resp.json()
                ops = data.get("operations", [])
                if ops:
                    op = ops[0]
                    target_chain = op.get("targetChain", {}).get("chainId")
                    target_tx = op.get("targetTx", {}).get("txHash")
                    meta = await _fetch_deposit_metadata(clean_tx, origin_chain)
                    c_info = CHAIN_INFO.get(target_chain, {"name": f"Wormhole Chain {target_chain}", "symbol": "ETH"})
                    return {
                        "protocol": "Wormhole Bridge",
                        "status": "DELIVERED",
                        "origin_chain": origin_chain.upper(),
                        "origin_tx_hash": clean_tx,
                        "destination_chain_id": target_chain,
                        "destination_chain_name": c_info["name"],
                        "destination_symbol": c_info["symbol"],
                        "fill_tx_hash": target_tx,
                        "recipient": meta.get("recipient") or meta.get("sender"),
                        "amount": meta.get("output_amount") or meta.get("deposit_value") or 0.0,
                    }
    except Exception:
        pass

    # 3. Check LayerZero / Stargate Scan
    try:
        url = f"https://api-mainnet.layerzero-scan.com/tx/{clean_tx}"
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200:
                data = resp.json()
                messages = data.get("messages", [])
                if messages:
                    msg = messages[0]
                    dst_chain = msg.get("dstChainId")
                    dst_tx = msg.get("dstTxHash")
                    meta = await _fetch_deposit_metadata(clean_tx, origin_chain)
                    c_info = CHAIN_INFO.get(dst_chain, {"name": f"LayerZero Chain {dst_chain}", "symbol": "ETH"})
                    return {
                        "protocol": "Stargate (LayerZero)",
                        "status": msg.get("status", "DELIVERED").upper(),
                        "origin_chain": origin_chain.upper(),
                        "origin_tx_hash": clean_tx,
                        "destination_chain_id": dst_chain,
                        "destination_chain_name": c_info["name"],
                        "destination_symbol": c_info["symbol"],
                        "fill_tx_hash": dst_tx,
                        "recipient": meta.get("recipient") or meta.get("sender"),
                        "amount": meta.get("output_amount") or meta.get("deposit_value") or 0.0,
                    }
    except Exception:
        pass

    return None
