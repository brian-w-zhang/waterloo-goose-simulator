"""Far level of detail: one file with an 8 m terrain (ground class per node) and simple building
extrusions for every chunk, so the client can fill the view beyond the full-detail chunks."""
import numpy as np
import shapely
from shapely.geometry import box

from ..chunkio import write_chunk
from ..config import CAMPUS, WORLD
from ..coords import BASE_ELEV
from . import ground

FAR_STRIDE = 4          # 2 m nodes -> 8 m
FAR_SIMPLIFY_M = 1.5


def build(hf, gcls, bl, bci, bcj, chunk_frame):
    C = CAMPUS["chunk"]
    S = C["size_m"]
    npc = int(S / CAMPUS["terrain"]["cell_m"])
    n = npc // FAR_STRIDE + 1
    heights, classes, ring_xz, ring_count, chunks = [], [], [], [], []
    for j in range(C["rows"]):
        for i in range(C["cols"]):
            e0, n1 = chunk_frame(i, j)
            r0 = (C["rows"] - 1 - j) * npc
            c0 = i * npc
            h = hf[r0:r0 + npc + 1:FAR_STRIDE, c0:c0 + npc + 1:FAR_STRIDE] - BASE_ELEV
            heights.append(h.astype(np.float32).ravel())
            xs = e0 + np.arange(n) * S / (n - 1)
            ys = n1 - np.arange(n) * S / (n - 1)
            ee, nn = np.meshgrid(xs, ys)
            pts = shapely.points(ee.ravel(), nn.ravel())
            cls = np.full(n * n, 255, np.uint8)  # 255 = grass
            cbox = box(e0, n1 - S, e0 + S, n1)
            for k, name in reversed(list(enumerate(ground.CLASSES))):
                g = gcls.get(name)
                if g is None:
                    continue
                g = g.intersection(cbox)
                if g.is_empty:
                    continue
                shapely.prepare(g)
                cls[shapely.contains(g, pts)] = k
            classes.append(cls)
            info = []
            for bi in np.nonzero((bci == i) & (bcj == j))[0]:
                b = bl[bi]
                fp = b["footprint"].simplify(FAR_SIMPLIFY_M, preserve_topology=True)
                if fp.is_empty or fp.geom_type != "Polygon":
                    continue
                c = np.asarray(fp.exterior.coords)[:-1]
                ring_xz.append(np.c_[c[:, 0] - e0, n1 - c[:, 1]])
                ring_count.append(len(c))
                top = max((hh for _, hh in b["parts"] if hh is not None), default=b["p90"])
                info.append([round(b["base"] - BASE_ELEV, 2), round(b["ground"] - BASE_ELEV + b["p90"], 2),
                             round(b["ground"] - BASE_ELEV + top, 2), b["style"]])
            chunks.append({"i": i, "j": j, "e0": e0, "n1": n1, "buildings": info})
    header = {"version": 1, "n": n, "size": S, "chunks": chunks, "classes": ground.CLASSES}
    arrays = {"far_h": np.concatenate(heights), "far_cls": np.concatenate(classes),
              "ring_xz": np.vstack(ring_xz).astype(np.float32).ravel(),
              "ring_count": np.array(ring_count, dtype=np.uint32)}
    write_chunk(WORLD / "far.wgc", header, arrays)
    return (WORLD / "far.wgc").stat().st_size
