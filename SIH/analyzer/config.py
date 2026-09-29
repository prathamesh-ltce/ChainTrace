"""
Decentralized Public Node RPC Configuration.
Zero API keys, zero rate-limit accounts, 100% public decentralized endpoints.
"""

from typing import Dict, List

PUBLIC_RPC_NODES: Dict[str, List[str]] = {
    "ETH": [
        "https://eth.merkle.io",
        "https://ethereum-rpc.publicnode.com",
        "https://1rpc.io/eth",
    ],
    "BTC": [
        "https://blockstream.info/api",
        "https://mempool.emzy.de/api",
        "https://mempool.space/api",
    ],
    "TRON": [
        "https://api.trongrid.io",
        "https://api.shasta.trongrid.io",
    ],
    "BNB": [
        "https://bsc-dataseed.binance.org",
        "https://bsc-rpc.publicnode.com",
        "https://bsc-dataseed1.defibit.io",
    ],
    "MATIC": [
        "https://polygon-bor-rpc.publicnode.com",
        "https://1rpc.io/matic",
    ],
    "SOL": [
        "https://api.mainnet-beta.solana.com",
    ],
}

DEFAULT_TIMEOUT_SECONDS = 6.0
DEFAULT_MAX_RETRIES = 3
DEFAULT_CONCURRENT_WORKERS = 10
