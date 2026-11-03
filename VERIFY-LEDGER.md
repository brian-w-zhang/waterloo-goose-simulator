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
