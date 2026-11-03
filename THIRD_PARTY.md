# Third-party code and data

## Libraries (npm, exact versions in package-lock.json)

| Package | Version | Licence | Why |
|---|---|---|---|
| next, react, react-dom | 16.4.4, 19.3.1 | MIT | App framework (Brian's choice over Vite, see NOTES.md) |
| three | 0.187.0 | MIT | WebGPU renderer with WebGL2 fallback, TSL materials |
| @dimforge/rapier3d-compat | 0.21.0 | Apache-2.0 | Physics and character controller |
| recast-navigation | 0.44.0 | MIT (Recast and Detour: zlib) | Navmesh |
| three-mesh-bvh | 0.9.18 | MIT | Camera occlusion and vision rays |
| vitest, @playwright/test, typescript, tsx | 5.1.0, 1.64.1, 5.9.3, 4.23.15 | MIT, Apache-2.0, Apache-2.0, MIT | Tests and tooling (not shipped) |

## Python (pipeline/requirements.txt)

shapely (BSD-3), pyproj (MIT), rasterio (BSD-3), numpy (BSD-3), scipy (BSD-3), pillow (MIT-CMU), opencv-python-headless (Apache-2.0), remotezip (MIT), mapbox-earcut (ISC), requests (Apache-2.0), pyyaml (MIT), pytest (MIT). Build-time only.

## Data

See the credits screen and `docs/plan/07-licences-and-prior-art.md` section 1: OpenStreetMap (ODbL 1.0), Ontario lidar (OGL Ontario), City of Waterloo vector layers (Waterloo Open Data User Licence), Region of Waterloo (Region Open Data Licence v2.0). City orthophotos are used for QA overlays only and are never shipped.

## Copied code

None so far.
