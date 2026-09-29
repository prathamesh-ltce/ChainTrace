"""
Unified Block and Transaction Data Models across all supported blockchains.
"""

from typing import List, Optional, Any, Dict
from datetime import datetime, timezone
import json

try:
    from pydantic import BaseModel, Field
except ModuleNotFoundError:
    class _FieldDefault:
        def __init__(self, default_factory):
            self.default_factory = default_factory

    def Field(default_factory):
        return _FieldDefault(default_factory)

    class BaseModel:
        def __init__(self, **data):
            for name, default in self.__class__.__dict__.items():
                if name.startswith("_") or callable(default):
                    continue
                if isinstance(default, _FieldDefault):
                    value = default.default_factory()
                else:
                    value = default
                setattr(self, name, data.pop(name, value))

            for name in getattr(self.__class__, "__annotations__", {}):
                if name in data:
                    setattr(self, name, data.pop(name))

            if data:
                for name, value in data.items():
                    setattr(self, name, value)

        def model_dump(self):
            def convert(value):
                if hasattr(value, "model_dump"):
                    return value.model_dump()
                if isinstance(value, list):
                    return [convert(item) for item in value]
                if isinstance(value, dict):
                    return {key: convert(item) for key, item in value.items()}
                return value

            return {key: convert(value) for key, value in self.__dict__.items()}

        def model_dump_json(self, indent=None):
            return json.dumps(self.model_dump(), indent=indent)


class UTXOInput(BaseModel):
    txid: str
    vout: int
    address: Optional[str] = None
    value: float = 0.0  # in native coin (BTC)
    script_sig: Optional[str] = None
    sequence: Optional[int] = None


class UTXOOutput(BaseModel):
    index: int
    address: Optional[str] = None
    value: float = 0.0  # in native coin (BTC)
    script_pub_key: Optional[str] = None


class NormalizedTx(BaseModel):
    tx_hash: str
    index_in_block: int
    chain: str
    block_number: int
    timestamp: int
    from_address: Optional[str] = None
    to_address: Optional[str] = None
    value: float = 0.0  # In native coin (BTC, ETH, TRX, BNB, MATIC, SOL)
    value_raw: Optional[str] = None
    fee: float = 0.0
    gas_used: Optional[int] = None
    gas_price: Optional[str] = None
    is_contract_creation: bool = False
    method_id: Optional[str] = None
    input_data: Optional[str] = None
    inputs: List[UTXOInput] = Field(default_factory=list)
    outputs: List[UTXOOutput] = Field(default_factory=list)
    is_coinjoin: bool = False
    coinjoin_details: Optional[Dict[str, Any]] = None


class NormalizedBlock(BaseModel):
    chain: str
    height: int
    hash: str
    parent_hash: Optional[str] = None
    timestamp: int
    tx_count: int
    total_volume: float = 0.0
    total_fees: float = 0.0
    size_bytes: int = 0
    miner_or_validator: Optional[str] = None
    fetch_duration_ms: int = 0
    fetched_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    transactions: List[NormalizedTx] = Field(default_factory=list)


class BatchResult(BaseModel):
    chain: str
    start_block: int
    end_block: int
    total_blocks: int
    total_txs: int
    total_volume: float
    total_fees: float
    duration_seconds: float
    blocks_per_sec: float
    txs_per_sec: float
    blocks: List[NormalizedBlock] = Field(default_factory=list)
