import json
import math

from pipeline.config import GROUND_TRUTH
from pipeline.coords import (TRANSFORMER_DESCRIPTION, lonlat_to_utm, true_azimuth_deg,
                             utm_to_world, world_to_utm)

GT = json.loads((GROUND_TRUTH / "ground_truth.json").read_text())
B = {b["id"]: b for b in GT["buildings"]}


def test_transformer_path_matches_ground_truth():
    assert "NAD83 to WGS 84 (1)" in TRANSFORMER_DESCRIPTION


def test_three_landmarks_project_to_their_utm_centroids():
    for bid in ("DC", "MC", "LIB"):
        c = B[bid]["centroid"]
        e, n = lonlat_to_utm(c["lon"], c["lat"])
        assert abs(e - c["utm_e"]) < 0.2 and abs(n - c["utm_n"]) < 0.2


def test_world_round_trip_and_north_is_minus_z():
    e, n = 537034.0, 4813396.7
    x, z = utm_to_world(e, n)
    assert z < 0  # DC is north of the origin
    e2, n2 = world_to_utm(x, z)
    assert abs(e2 - e) < 1e-9 and abs(n2 - n) < 1e-9


def test_dc_to_mc_azimuth_and_distance():
    dc, mc = B["DC"]["centroid"], B["MC"]["centroid"]
    az = true_azimuth_deg(dc["utm_e"], dc["utm_n"], mc["utm_e"], mc["utm_n"])
    d = math.hypot(mc["utm_e"] - dc["utm_e"], mc["utm_n"] - dc["utm_n"])
    assert abs(az - 248.7) < 0.1
    assert abs(d - 157.4) < 0.3
