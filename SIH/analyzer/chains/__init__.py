"""
Chain Fetchers Factory.
Supports BTC, ETH, TRON, BNB, MATIC, SOL.
"""

from typing import Optional, List
from analyzer.pool import NodePool
from analyzer.chains.base import BaseChainFetcher
from analyzer.chains.btc import BTCChainFetcher
from analyzer.chains.eth import EVMChainFetcher
from analyzer.chains.tron import TRONChainFetcher
from analyzer.chains.solana import SolanaChainFetcher


def get_chain_fetcher(chain: str, custom_urls: Optional[List[str]] = None) -> BaseChainFetcher:
    c = chain.upper().strip()
    pool = NodePool(c, custom_urls)

    if c == "BTC":
        return BTCChainFetcher(pool)
    elif c == "ETH":
        return EVMChainFetcher(pool, native_currency="ETH")
    elif c == "BNB":
        return EVMChainFetcher(pool, native_currency="BNB")
    elif c == "MATIC" or c == "POL":
        return EVMChainFetcher(pool, native_currency="MATIC")
    elif c in ("TRON", "TRX"):
        return TRONChainFetcher(pool)
    elif c in ("SOL", "SOLANA"):
        return SolanaChainFetcher(pool)
    elif c in ("ARBITRUM", "ARB"):
        return EVMChainFetcher(pool, native_currency="ETH")
    elif c == "BASE":
        return EVMChainFetcher(pool, native_currency="ETH")
    elif c in ("OPTIMISM", "OP"):
        return EVMChainFetcher(pool, native_currency="ETH")
    else:
        raise ValueError(f"Unsupported blockchain: {chain}. Available: BTC, ETH, TRON, BNB, MATIC, SOL, ARBITRUM, BASE, OPTIMISM")
