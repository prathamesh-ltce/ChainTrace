"""
Decentralized Public Node Pool with Failover and Latency Tracking.
"""

import time
import asyncio
from typing import List, Optional
from analyzer.config import PUBLIC_RPC_NODES, DEFAULT_TIMEOUT_SECONDS


class NodeStatus:
    def __init__(self, url: str):
        self.url = url
        self.healthy = True
        self.latency_ms = 0.0
        self.failures = 0
        self.last_checked = 0.0


class NodePool:
    def __init__(self, chain: str, custom_urls: Optional[List[str]] = None):
        self.chain = chain.upper()
        urls = custom_urls or PUBLIC_RPC_NODES.get(self.chain, [])
        if not urls:
            raise ValueError(f"Unsupported chain or empty nodes list: {self.chain}")
        self.nodes = [NodeStatus(u) for u in urls]
        self._cursor = 0
        self._lock = asyncio.Lock()

    async def get_next_node(self) -> str:
        async with self._lock:
            n = len(self.nodes)
            for i in range(n):
                idx = (self._cursor + i) % n
                if self.nodes[idx].healthy:
                    self._cursor = (idx + 1) % n
                    return self.nodes[idx].url
            # If all are marked unhealthy, fallback to first node
            self._cursor = (self._cursor + 1) % n
            return self.nodes[0].url

    def report_failure(self, url: str):
        for node in self.nodes:
            if node.url == url:
                node.failures += 1
                if node.failures >= 3:
                    node.healthy = False
                break

    def report_success(self, url: str, latency_ms: float):
        for node in self.nodes:
            if node.url == url:
                node.failures = 0
                node.healthy = True
                node.latency_ms = latency_ms
                node.last_checked = time.time()
                break
