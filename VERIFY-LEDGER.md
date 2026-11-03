# Verify ledger

One line per run, appended by `tools/verify/gate.py`; old lines are never edited.

| time (Toronto) | sha | backend | kind | gates | IoU median | height RMSE dev / holdout m | distance median err m | style std V | looks mean | regressions | run folder |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-03 02:35 | 77975de | none | fast | 35/37 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0235-77975de |
| 2026-11-03 02:36 | 4d86045 | none | fast | 35/37 | 1.000 | 0.61 / 0.61 | 0.03 | n/a | n/a | 0 | bench/results/verify/20261103-0236-4d86045 |
| 2026-11-03 03:12 | ed15111 | webgpu | full | 55/57 | 1.000 | 0.61 / 0.61 | 0.03 | 0.082 | 2.70 (dis 0.04) | 0 | bench/results/verify/20261103-0310-ed15111 |
