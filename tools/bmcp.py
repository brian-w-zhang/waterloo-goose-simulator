"""Talk to the live Blender MCP add-on (mcp-for-blender, localhost:9876) from the shell.

  python tools/bmcp.py run art/models/goose.py      # execute a script in the open Blender (art/blender on sys.path)
  python tools/bmcp.py code "print(len(bpy.data.objects))"
  python tools/bmcp.py shot OUT.png [max_size]      # viewport screenshot
  python tools/bmcp.py scene                        # scene summary

The same server the Claude Code "blender" MCP uses; this client only needs the add-on running.
The add-on's AI-generation and asset-store commands are never used (AI-USE.md: no generated meshes).
"""
import json
import socket
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def call(kind, **params):
    with socket.create_connection(("localhost", 9876), timeout=300) as s:
        s.sendall(json.dumps({"type": kind, "params": params}).encode())
        buf = b""
        while True:
            chunk = s.recv(1 << 16)
            if not chunk:
                break
            buf += chunk
            try:
                return json.loads(buf.decode())
            except ValueError:
                continue
    raise RuntimeError("no reply from Blender")


def run_file(path):
    code = (f"import sys\nsys.path.insert(0, {str(ROOT / 'art' / 'blender')!r})\n"
            f"__file__ = {str((ROOT / path).resolve())!r}\n" + (ROOT / path).read_text())
    return call("execute_code", code=code)


if __name__ == "__main__":
    cmd, *rest = sys.argv[1:]
    if cmd == "run":
        r = run_file(rest[0])
    elif cmd == "code":
        r = call("execute_code", code=rest[0])
    elif cmd == "shot":
        r = call("get_viewport_screenshot", filepath=str(Path(rest[0]).resolve()), max_size=int(rest[1]) if len(rest) > 1 else 1000)
    elif cmd == "scene":
        r = call("get_scene_info")
    else:
        sys.exit(__doc__)
    print(json.dumps(r, indent=1)[:4000])
