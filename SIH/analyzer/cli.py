"""
Interactive CLI for Direct Blockchain Ingestion & Analysis.
Zero third-party API keys. Supports BTC, ETH, TRON, BNB, MATIC, SOL.
"""

import sys
import os
import time
import asyncio
import argparse
from typing import List
from datetime import datetime, timezone

if __package__ is None or __package__ == "":
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analyzer.chains import get_chain_fetcher
from analyzer.models import NormalizedBlock, BatchResult
from analyzer.exporter import export_to_json_file


async def fetch_range_concurrently(fetcher, start_block: int, end_block: int, max_concurrency: int = 10) -> BatchResult:
    total_count = end_block - start_block + 1
    semaphore = asyncio.Semaphore(max_concurrency)
    blocks: List[NormalizedBlock] = []

    start_time = time.time()

    async def worker(height: int):
        async with semaphore:
            try:
                blk = await fetcher.fetch_block_by_number(height)
                return blk
            except Exception as e:
                print(f"[WARN] Failed to fetch block {height}: {e}", file=sys.stderr)
                return None

    tasks = [worker(h) for h in range(start_block, end_block + 1)]
    results = await asyncio.gather(*tasks)

    for r in results:
        if r is not None:
            blocks.append(r)

    blocks.sort(key=lambda b: b.height)
    duration = time.time() - start_time
    dur_sec = duration if duration > 0 else 0.001

    total_txs = sum(b.tx_count for b in blocks)
    total_vol = sum(b.total_volume for b in blocks)
    total_fees = sum(b.total_fees for b in blocks)

    return BatchResult(
        chain=fetcher.chain_name,
        start_block=start_block,
        end_block=end_block,
        total_blocks=len(blocks),
        total_txs=total_txs,
        total_volume=round(total_vol, 6),
        total_fees=round(total_fees, 6),
        duration_seconds=round(duration, 3),
        blocks_per_sec=round(len(blocks) / dur_sec, 2),
        txs_per_sec=round(total_txs / dur_sec, 2),
        blocks=blocks,
    )


async def main_async():
    parser = argparse.ArgumentParser(
        description="Direct Multi-Chain Block Ingestion & Analyzer (Zero Third-Party API)"
    )
    parser.add_argument("--chain", type=str, default="ETH", help="Chain: BTC, ETH, TRON, BNB, MATIC, SOL")
    parser.add_argument("--block", type=str, default="latest", help="Block height or 'latest'")
    parser.add_argument("--range", type=str, default=None, help="Block range (e.g. 20000000-20000005)")
    parser.add_argument("--workers", type=int, default=10, help="Concurrent async workers (default 10)")
    parser.add_argument("--output", type=str, default=None, help="Output JSON filepath")
    parser.add_argument("--verbose", action="store_true", help="Print all transactions preview")
    args = parser.parse_args()

    chain = args.chain.upper().strip()
    fetcher = get_chain_fetcher(chain)

    print("=" * 75)
    print("  DIRECT MULTI-CHAIN BLOCK ANALYZER & INGESTION (ZERO THIRD-PARTY API)")
    print("=" * 75)
    print(f"[*] Target Blockchain    : {chain}")
    print(f"[*] Ingestion Mode       : Raw Public RPC / Decentralized Node Protocols")
    print(f"[*] Authentication       : None (No API Keys / No SaaS Accounts)")
    print("-" * 75)

    if args.range:
        parts = args.range.split("-")
        if len(parts) != 2:
            print(f"[ERROR] Invalid range format. Use start-end (e.g. 20000000-20000005)")
            return
        start_b, end_b = int(parts[0].strip()), int(parts[1].strip())
        print(f"[*] Initiating Concurrent Batch Ingestion: Blocks {start_b} to {end_b} ({end_b - start_b + 1} blocks)...")
        print(f"[*] Active Async Concurrency Workers: {args.workers}")

        batch = await fetch_range_concurrently(fetcher, start_b, end_b, args.workers)

        print("-" * 75)
        print(f"[SUCCESS] Concurrent Batch Ingestion Complete!")
        print(f"  - Total Blocks Fetched : {batch.total_blocks} / {end_b - start_b + 1}")
        print(f"  - Total Transactions   : {batch.total_txs}")
        print(f"  - Total Volume Moved   : {batch.total_volume} {chain}")
        print(f"  - Total Fees Paid      : {batch.total_fees} {chain}")
        print(f"  - Ingestion Time       : {batch.duration_seconds}s")
        print(f"  - Throughput           : {batch.blocks_per_sec} Blocks/sec ({batch.txs_per_sec} Txs/sec)")
        print("-" * 75)

        if args.output:
            export_to_json_file(args.output, batch)
            print(f"[*] Full forensics batch saved to: {args.output}")
        return

    # Single block fetch
    if args.block.lower() == "latest":
        print(f"[*] Querying latest block tip from public {chain} nodes...")
        target_height = await fetcher.fetch_latest_block_number()
        print(f"[*] Current Blockchain Tip: Block #{target_height}")
    else:
        target_height = int(args.block.strip())

    print(f"[*] Ingesting Block #{target_height} directly...")
    block = await fetcher.fetch_block_by_number(target_height)

    print("-" * 75)
    print(f"[+] Block #{block.height} [{block.chain}]")
    print(f"  - Block Hash     : {block.hash}")
    print(f"  - Parent Hash    : {block.parent_hash}")
    print(f"  - Timestamp      : {block.timestamp} ({datetime.fromtimestamp(block.timestamp, timezone.utc).isoformat()})")
    print(f"  - Total Txs      : {block.tx_count}")
    print(f"  - Block Volume   : {block.total_volume} {chain}")
    print(f"  - Total Fees     : {block.total_fees} {chain}")
    print(f"  - Latency        : {block.fetch_duration_ms} ms")
    print("-" * 75)

    preview_count = len(block.transactions) if args.verbose else min(5, len(block.transactions))
    if preview_count > 0:
        print(f"[*] First {preview_count} Transactions Preview:")
        for i in range(preview_count):
            tx = block.transactions[i]
            to_str = tx.to_address or ("[Contract Creation]" if tx.is_contract_creation else "N/A")
            from_str = tx.from_address or "N/A"
            print(f"  [{i+1:02d}] TxHash: {tx.tx_hash}")
            print(f"       From: {from_str} -> To: {to_str}")
            print(f"       Value: {tx.value} {chain} (Fee: {tx.fee} {chain})")
            if tx.method_id:
                print(f"       Method: {tx.method_id}")

    if args.output:
        export_to_json_file(args.output, block)
        print(f"[*] Saved block forensics data to: {args.output}")
    print("=" * 75)


def main():
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
