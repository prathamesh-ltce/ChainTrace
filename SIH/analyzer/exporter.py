"""
Exporter utilities for block and transaction forensics.
"""

import json
from typing import List, Union
from analyzer.models import NormalizedBlock, BatchResult


def export_to_json_file(file_path: str, data: Union[NormalizedBlock, BatchResult, List[NormalizedBlock]], indent: int = 2):
    with open(file_path, "w", encoding="utf-8") as f:
        if isinstance(data, (NormalizedBlock, BatchResult)):
            f.write(data.model_dump_json(indent=indent))
        elif isinstance(data, list):
            json.dump([b.model_dump() for b in data], f, indent=indent)
        else:
            json.dump(data, f, indent=indent)
