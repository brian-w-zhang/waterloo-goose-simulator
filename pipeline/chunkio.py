"""WGC1 chunk format: magic, u32 header length, JSON header, 8-byte aligned typed arrays.

The browser decoder (src/world/decode.ts) and every validator read the same bytes.
Local frame: x = E - e0 (chunk west edge), z = n1 - N (chunk north edge), y = elevation - base.
"""
import json
import struct
from pathlib import Path

import numpy as np

MAGIC = b"WGC1"
DTYPES = {"f4": np.float32, "u1": np.uint8, "u2": np.uint16, "u4": np.uint32, "i1": np.int8, "i4": np.int32}


def write_chunk(path: Path, header: dict, arrays: dict):
    blobs, offset, table = [], 0, {}
    for name, a in arrays.items():
        a = np.ascontiguousarray(a)
        code = next(k for k, v in DTYPES.items() if v == a.dtype.type)
        table[name] = {"offset": offset, "dtype": code, "count": int(a.size)}
        b = a.tobytes()
        pad = (-len(b)) % 8
        blobs.append(b + b"\0" * pad)
        offset += len(b) + pad
    header = {**header, "arrays": table}
    hb = json.dumps(header, separators=(",", ":")).encode()
    hb += b" " * ((-(len(hb) + 8)) % 8)
    path.write_bytes(MAGIC + struct.pack("<I", len(hb)) + hb + b"".join(blobs))


def read_chunk(path: Path):
    data = Path(path).read_bytes()
    if data[:4] != MAGIC:
        raise ValueError(f"{path}: bad magic")
    (hl,) = struct.unpack("<I", data[4:8])
    header = json.loads(data[8:8 + hl])
    base = 8 + hl
    arrays = {}
    for name, d in header["arrays"].items():
        dt = DTYPES[d["dtype"]]
        arrays[name] = np.frombuffer(data, dtype=dt, count=d["count"], offset=base + d["offset"])
    return header, arrays
