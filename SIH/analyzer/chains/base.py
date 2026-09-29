"""
Base Abstract Chain Fetcher.
"""

from abc import ABC, abstractmethod
from typing import Optional, List
from analyzer.models import NormalizedBlock, NormalizedTx
from analyzer.pool import NodePool


class BaseChainFetcher(ABC):
    def __init__(self, pool: NodePool):
        self.pool = pool

    @property
    @abstractmethod
    def chain_name(self) -> str:
        pass

    @abstractmethod
    async def fetch_latest_block_number(self) -> int:
        pass

    @abstractmethod
    async def fetch_block_by_number(self, block_number: int) -> NormalizedBlock:
        pass

    @abstractmethod
    async def fetch_address_transactions(self, address: str, limit: int = 50) -> List[NormalizedTx]:
        pass
