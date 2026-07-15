# Animation plans

| Number | Title | Severity | Status |
| --- | --- | --- | --- |
| 001 | Rebuild the three-coin ritual as a physical throw | HIGH | DONE |

## Recommended execution order

1. Execute plan 001 as one atomic refactor because the physics scene, settle event, ritual state machine, and tests share one contract.

## Dependencies

- Plan 001 has no predecessor.
- Do not split the timer removal from the physics settle callback; either side alone would leave an invalid reveal contract.
