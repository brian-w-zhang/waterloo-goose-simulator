# Verify ledger

One line per run, appended by `tools/verify/gate.py`; old lines are never edited.

| time (Toronto) | sha | backend | kind | gates | IoU median | height RMSE dev / holdout m | distance median err m | style std V | looks mean | regressions | run folder |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-03 02:35 | 77975de | none | fast | 35/37 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0235-77975de |
| 2026-11-03 02:36 | 4d86045 | none | fast | 35/37 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0236-4d86045 |
| 2026-11-03 03:12 | ed15111 | webgpu | full | 55/57 | 1.000 | 0.61 / 0.61 | 0.03 | 0.082 | 2.70 (dis 0.04) | 0 | bench/results/verify/20261103-0310-ed15111 |
| 2026-11-03 03:20 | d4e208d | none | fast | 35/37 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0320-d4e208d |
| 2026-11-03 03:33 | ef8ec1a | webgpu | full | 55/57 | 1.000 | 0.61 / 0.61 | 0.03 | 0.085 | 2.76 (dis 0.03) | 1 | bench/results/verify/20261103-0332-ef8ec1a |
| 2026-11-03 03:34 | ef8ec1a | webgpu | full | 55/57 | 1.000 | 0.61 / 0.61 | 0.03 | 0.085 | 2.76 (dis 0.03) | 0 | bench/results/verify/20261103-0332-ef8ec1a |
| 2026-11-03 03:35 | 29b24c1 | none | fast | 35/37 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0335-29b24c1 |
| 2026-11-03 03:42 | 0aada59 | webgl2 | full | 53/57 | 1.000 | 0.61 / 0.61 | 0.03 | 0.085 | n/a | 0 | bench/results/verify/20261103-0341-0aada59 |
| 2026-11-03 03:53 | 66a28f0 | none | fast | 35/37 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0353-66a28f0 |
| 2026-11-03 04:00 | 0e4f9b4 | webgpu | full | 55/57 | 1.000 | 0.61 / 0.61 | 0.03 | 0.083 | 2.76 (dis 0.03) | 0 | bench/results/verify/20261103-0358-0e4f9b4 |
| 2026-11-03 04:02 | 0f7ab5e | none | fast | 35/37 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0402-0f7ab5e |
| 2026-11-03 04:12 | bfa6872 | webgl2 | full | 55/57 | 1.000 | 0.61 / 0.61 | 0.03 | 0.084 | n/a | 0 | bench/results/verify/20261103-0411-bfa6872 |
| 2026-11-03 04:16 | 54843d7 | none | fast | 35/37 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0416-54843d7 |
| 2026-11-03 04:18 | ffbf926 | none | fast | 35/37 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0418-ffbf926 |
| 2026-11-03 04:25 | 3c0574f | none | fast | 35/37 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0425-3c0574f |
| 2026-11-03 04:29 | 528c480 | none | fast | 35/37 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0429-528c480 |
| 2026-11-03 04:35 | 58703a3 | none | fast | 38/40 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0435-58703a3 |
| 2026-11-03 04:44 | 6a2c4c8 | webgpu | full | 58/60 | 1.000 | 0.61 / 0.61 | 0.03 | 0.084 | n/a | 0 | bench/results/verify/20261103-0442-6a2c4c8 |
| 2026-11-03 04:44 | 6a2c4c8 | webgpu | full | 58/60 | 1.000 | 0.61 / 0.61 | 0.03 | 0.084 | 2.83 (dis 0.03) | 0 | bench/results/verify/20261103-0442-6a2c4c8 |
| 2026-11-03 04:47 | c82bd61 | none | fast | 38/40 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0447-c82bd61 |
| 2026-11-03 04:51 | 8f945de | none | fast | 38/40 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0451-8f945de |
| 2026-11-03 04:56 | 168c23d | webgpu | full | 58/60 | 1.000 | 0.61 / 0.61 | 0.03 | 0.085 | 2.81 (dis 0.03) | 0 | bench/results/verify/20261103-0453-168c23d |
| 2026-11-03 04:56 | 168c23d | webgl2 | full | 58/60 | 1.000 | 0.61 / 0.61 | 0.03 | 0.085 | n/a | 0 | bench/results/verify/20261103-0454-168c23d |
| 2026-11-03 05:23 | 4f8d8d3 | none | fast | 40/42 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0523-4f8d8d3 |
| 2026-11-03 05:40 | 25a87cf | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0540-25a87cf |
| 2026-11-03 05:49 | 87f5636 | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0549-87f5636 |
| 2026-11-03 05:52 | 5fd27ca | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0552-5fd27ca |
| 2026-11-03 05:58 | a393a2f | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0558-a393a2f |
| 2026-11-03 06:02 | 7edb322 | webgpu | full | 62/64 | 1.000 | 0.57 / 0.61 | 0.03 | 0.082 | 2.82 (dis 0.03) | 2 | bench/results/verify/20261103-0600-7edb322 |
| 2026-11-03 06:09 | 5874b96 | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0609-5874b96 |
| 2026-11-03 06:12 | 2d69ae1 | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0612-2d69ae1 |
| 2026-11-03 06:15 | f153b20 | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0615-f153b20 |
| 2026-11-03 06:18 | f4f3da1 | none | fast | 39/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 1 | bench/results/verify/20261103-0618-f4f3da1 |
| 2026-11-03 06:19 | 845a381 | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0618-845a381 |
| 2026-11-03 06:22 | 03a22e7 | webgl2 | full | 62/64 | 1.000 | 0.57 / 0.61 | 0.03 | 0.082 | n/a | 0 | bench/results/verify/20261103-0620-03a22e7 |
| 2026-11-03 06:24 | 4960136 | webgpu | full | 62/64 | 1.000 | 0.57 / 0.61 | 0.03 | 0.082 | 2.83 (dis 0.03) | 0 | bench/results/verify/20261103-0622-4960136 |
| 2026-11-03 06:26 | 4960136 | webgl2 | full | 62/64 | 1.000 | 0.57 / 0.61 | 0.03 | 0.082 | n/a | 1 | bench/results/verify/20261103-0624-4960136-webgl |
| 2026-11-03 06:28 | 4960136 | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0628-4960136 |
| 2026-11-03 06:32 | 666acfb | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0632-666acfb |
| 2026-11-03 06:38 | bf1ec4f | webgpu | full | 62/64 | 1.000 | 0.57 / 0.61 | 0.03 | 0.082 | 2.84 (dis 0.03) | 0 | bench/results/verify/20261103-0636-bf1ec4f |
| 2026-11-03 06:42 | 96221e7 | webgpu | full | 62/64 | 1.000 | 0.57 / 0.61 | 0.03 | 0.082 | 2.85 (dis 0.03) | 0 | bench/results/verify/20261103-0640-96221e7 |
| 2026-11-03 06:47 | 2b24f26 | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0647-2b24f26 |
| 2026-11-03 06:49 | 173109d | webgl2 | full | 62/64 | 1.000 | 0.57 / 0.61 | 0.03 | 0.082 | n/a | 0 | bench/results/verify/20261103-0647-173109d-webgl |
| 2026-11-03 06:51 | 173109d | webgpu | full | 62/64 | 1.000 | 0.57 / 0.61 | 0.03 | 0.082 | 2.85 (dis 0.03) | 0 | bench/results/verify/20261103-0649-173109d |
| 2026-11-03 06:56 | f6dc663 | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0656-f6dc663 |
| 2026-11-03 06:58 | 6906763 | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0657-6906763 |
| 2026-11-03 06:58 | ee844c2 | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0658-ee844c2 |
| 2026-11-03 07:12 | 4318bfd | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0712-4318bfd |
| 2026-11-03 07:13 | 4b343d5 | none | fast | 40/42 | 1.000 | 0.57 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0712-4b343d5 |
| 2026-11-03 07:16 | 4b343d5 | none | fast | 40/42 | 1.000 | 0.53 / 0.61 | 0.03 | n/a | n/a | 1 | bench/results/verify/20261103-0715-4b343d5+dirty |
| 2026-11-03 07:16 | 4b343d5 | none | fast | 40/42 | 1.000 | 0.53 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0716-4b343d5+dirty |
| 2026-11-03 07:20 | 34b2406 | webgpu | full | 62/64 | 1.000 | 0.53 / 0.61 | 0.03 | 0.082 | 2.85 (dis 0.03) | 0 | bench/results/verify/20261103-0716-34b2406 |
| 2026-11-03 07:21 | 34b2406 | webgl2 | full | 62/64 | 1.000 | 0.53 / 0.61 | 0.03 | 0.082 | n/a | 0 | bench/results/verify/20261103-0717-34b2406-webgl |
| 2026-11-03 07:29 | 3086e1a | none | fast | 40/42 | 1.000 | 0.53 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0729-3086e1a |
| 2026-11-03 07:32 | 63b8199 | none | fast | 40/42 | 1.000 | 0.53 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0732-63b8199 |
| 2026-11-03 07:34 | 63b8199 | none | fast | 40/42 | 1.000 | 0.53 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0734-63b8199+dirty |
| 2026-11-03 07:46 | f6151ae | none | fast | 40/42 | 1.000 | 0.53 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0746-f6151ae+dirty |
| 2026-11-03 07:52 | aa79309 | webgpu | full | 62/64 | 1.000 | 0.53 / 0.61 | 0.03 | 0.082 | 2.85 (dis 0.03) | 0 | bench/results/verify/20261103-0749-aa79309 |
| 2026-11-03 07:54 | aa79309 | webgl2 | full | 62/64 | 1.000 | 0.53 / 0.61 | 0.03 | 0.082 | n/a | 0 | bench/results/verify/20261103-0750-aa79309-webgl |
| 2026-11-03 08:04 | 40d1f71 | none | fast | 40/42 | 1.000 | 0.53 / 0.61 | 0.03 | n/a | n/a | 1 | bench/results/verify/20261103-0803-40d1f71+dirty |
| 2026-11-03 08:11 | f9ce7f3 | webgpu | full | 62/64 | 1.000 | 0.53 / 0.61 | 0.03 | 0.082 | 2.85 (dis 0.03) | 1 | bench/results/verify/20261103-0808-f9ce7f3 |
| 2026-11-03 08:13 | f9ce7f3 | webgl2 | full | 62/64 | 1.000 | 0.53 / 0.61 | 0.03 | 0.082 | n/a | 0 | bench/results/verify/20261103-0808-f9ce7f3-webgl |
| 2026-11-03 08:50 | 49fac97 | webgpu | full | 62/64 | 1.000 | 0.53 / 0.61 | 0.03 | 0.082 | 2.85 (dis 0.03) | 0 | bench/results/verify/20261103-0847-49fac97 |
| 2026-11-03 08:52 | 49fac97 | webgl2 | full | 62/64 | 1.000 | 0.53 / 0.61 | 0.03 | 0.082 | n/a | 0 | bench/results/verify/20261103-0847-49fac97-webgl |
| 2026-11-03 09:04 | d4cfb3c | none | fast | 40/42 | 1.000 | 0.53 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0904-d4cfb3c+dirty |
| 2026-11-03 09:09 | ff69352 | webgpu | full | 62/64 | 1.000 | 0.53 / 0.61 | 0.03 | 0.082 | 2.85 (dis 0.03) | 0 | bench/results/verify/20261103-0905-ff69352 |
| 2026-11-03 09:11 | ff69352 | webgl2 | full | 62/64 | 1.000 | 0.53 / 0.61 | 0.03 | 0.082 | n/a | 0 | bench/results/verify/20261103-0906-ff69352-webgl |
| 2026-11-03 09:19 | ff69352 | none | fast | 40/42 | 1.000 | 0.53 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0919-ff69352+dirty |
