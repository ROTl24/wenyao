# 001 — Rebuild the three-coin ritual as a physical throw

- **Status**: DONE
- **Commit**: 248e9b0
- **Severity**: HIGH
- **Category**: Physicality, purpose, accessibility, missed opportunity
- **Estimated scope**: 8 files, one focused animation subsystem refactor

## Problem

The casting screen visually moves three coins, but the movement is a deterministic interpolation rather than a physical throw. The current code prescribes an arc, a synthetic landing oscillation, and final positions:

```tsx
// src/components/CoinScene.tsx:366 — current
const delay = index * 0.1;
const progress = phase === 'revealed' || reducedMotion
  ? 1
  : THREE.MathUtils.clamp((elapsed - delay) / 1.72, 0, 1);
const eased = 1 - Math.pow(1 - progress, 4);
const arc = reducedMotion ? 0 : Math.sin(progress * Math.PI) * (1.55 + index * 0.16);
const landing = progress < 0.72 || progress >= 1
  ? 0
  : Math.sin((progress - 0.72) * Math.PI * 11) * (1 - progress) * 0.28;
```

The UI independently declares the result revealed after a fixed delay, so visual completion and semantic completion can drift:

```tsx
// src/components/RitualScreen.tsx:34 — current
const revealTimer = window.setTimeout(() => {
  setSequence((value) => value.tossId === current.id && value.phase !== 'revealed'
    ? { ...value, phase: 'revealed' }
    : value);
}, isFirstLine ? 2680 : 2180);
```

There is no plate in the Three scene and the camera does not move closer after the coins stop. The final result therefore has the same visual scale and composition as the in-flight state.

## Target

Build a single, event-driven casting contract:

1. `gathering`: three coins are held in a compressed foreground arrangement.
2. `casting`: three dynamic Rapier rigid bodies receive seeded launch velocity and angular velocity toward the center of a shallow porcelain plate.
3. `settling`: the coins collide, roll, and lose energy inside the plate. This is still controlled by the physics world, not by authored position curves.
4. `revealed`: only after all three rigid bodies report sleep. Freeze the final physical composition, reveal the prescribed `faces`, and move the camera closer to enlarge the three results.

Use the domain's existing `current.faces` as the single source of truth. Physics controls motion and final positions but must not mutate the divination result. During flight, keep the face treatment worn/low-contrast; after sleep, reveal the prescribed face on the upward physical side with a brief rubbing/glint treatment. This avoids changing business results while keeping the landing physically simulated.

Add `@react-three/rapier@2.2.0`. It matches the repository's React 19, `@react-three/fiber` 9, and Three 0.185 versions.

Physics targets:

- fixed simulation timestep: `1 / 60`
- gravity: `[0, -8.8, 0]`
- coins: dynamic rigid bodies with CCD, cylinder colliders, `restitution={0.24}`, `friction={0.82}`, `linearDamping={0.38}`, `angularDamping={0.86}`
- plate: fixed body, one low floor collider plus a segmented circular rim; no scripted final coin coordinates
- settle event: all three bodies have slept; deduplicate repeated sleep callbacks per coin and per toss
- launch plan: derived from `visualSeed` so a saved/in-progress toss replays consistently; no `Math.random()` inside render/frame loops

Camera targets:

- casting view frames the throw origin and whole plate
- revealed view dollies toward the plate with `ease-in-out` behavior (`cubic-bezier(0.77, 0, 0.175, 1)` equivalent in the frame interpolation)
- camera movement duration: about `900ms`; this is explanatory/cinematic motion, not a frequent UI transition
- do not rearrange coins into a fake row after they settle; preserve actual physical positions and enlarge through the camera

Accessibility target:

- `prefers-reduced-motion: reduce` bypasses the throw and renders the three known results already resting in the plate
- preserve a short opacity/color reveal (up to `200ms ease`) but remove camera travel and object translation
- remove the clickable stage-as-skip contract from the normal path; the stage should not announce itself as a button if clicking no longer changes the physical sequence

## Repo conventions to follow

- The visual coin model, Qianlong textures, patina generation, and three distinct art profiles already live in `src/components/CoinScene.tsx`; preserve and reuse them rather than replacing them with generic cylinders.
- The casting workflow remains `home -> casting -> result`; only the animation phase contract inside `RitualScreen` changes.
- `src/lib/session.ts` remains the domain source for `faces`, `value`, and line meaning. Do not move physical state into the persisted session schema.
- Styling remains in `src/styles.css` and should continue the existing ink, cinnabar, bronze, and warm-paper palette.
- Existing button press feedback uses subtle scale (`.ritual-confirm:active { transform: scale(.98) }`); keep this interaction language.

## Steps

1. Add `@react-three/rapier@2.2.0` to `package.json` and regenerate only the corresponding lockfile state with `npm.cmd install @react-three/rapier@2.2.0`.
2. Update `index.html` CSP so `script-src` allows `'wasm-unsafe-eval'` in addition to `'self'`. This permission is required for Rapier's WebAssembly initialization in Chromium; do not add ordinary `'unsafe-eval'`.
3. Remove the root `StrictMode` wrapper from `src/main.tsx`. React's development double-mount triggers React Three Fiber 9's delayed Canvas cleanup and `forceContextLoss()` against the remounted canvas; render `<App />` directly so the development runtime matches the production lifecycle. Do not add context-restoration or timing workarounds.
4. Refactor `src/components/CoinScene.tsx`:
   - extend the phase type to include `settling` if the implementation needs a visible semantic distinction;
   - accept `visualSeed` and `onSettled` props;
   - retain the current Qianlong coin geometry/material helpers;
   - replace authored position/rotation interpolation with Rapier `Physics`, `RigidBody`, and explicit colliders;
   - add a visually modeled shallow porcelain/ink plate with a matching fixed collision boundary;
   - generate deterministic launch transforms/velocities from `visualSeed`;
   - report settle exactly once when all three coin bodies sleep;
   - determine each coin's upward local face at sleep and reveal the prescribed result face on that side;
   - add a camera rig that moves closer only in `revealed` and preserves actual final coin positions;
   - render a static plate/result composition for reduced motion.
5. Refactor `src/components/RitualScreen.tsx`:
   - remove the fixed `revealTimer` as the source of truth;
   - transition from `gathering` to `casting` after the short preparatory beat only;
   - transition to `revealed` from `CoinScene.onSettled` for the current toss id;
   - pass `current.visualSeed` to the scene;
   - update copy to describe throwing into the plate, rolling/settling, then result inspection;
   - convert the stage from a skip button to a semantic section/figure;
   - keep the confirm action disabled until the physical settle event.
6. Refactor only the ritual/coin block of `src/styles.css`:
   - replace decorative ink-field dominance with a restrained stage vignette that frames the physical plate;
   - add the result-stage emphasis and copy transitions using transform/opacity only;
   - preserve desktop and mobile information hierarchy;
   - update reduced-motion rules for the ritual so feedback remains while travel is removed.
7. Update `src/components/RitualScreen.test.tsx` to assert the event contract:
   - gathering advances to casting;
   - advancing timers alone never reveals the result;
   - invoking the mocked scene's `onSettled` reveals and enables confirmation;
   - a stale toss callback cannot reveal a new toss;
   - reduced-motion starts revealed.
8. If a small pure helper is extracted for seeded launch values, add a focused unit test asserting determinism and three distinct launch vectors. Do not snapshot Three scene internals.

## Boundaries

- Do NOT change divination probabilities, `CoinFace`, `Toss`, `prepareToss`, `confirmCurrentToss`, or plate-building semantics.
- Do NOT derive persisted results from frame timing or browser performance.
- Do NOT add a compatibility path that keeps the old timeout reveal.
- Do NOT add a watchdog/fallback reveal without user approval.
- Do NOT touch result-analysis, Electron AI, persistence, history, or settings files.
- Do NOT broaden the CSP beyond `'wasm-unsafe-eval'`; ordinary JavaScript eval must remain disallowed.
- Do NOT add WebGL context-restoration handlers or delayed remount workarounds; the canvas must have one clean lifecycle.
- Do NOT discard the existing Qianlong textures, patina art direction, or unrelated user changes in `styles.css`.
- If `@react-three/rapier@2.2.0` cannot install against the current dependency graph, stop and report the exact peer conflict instead of substituting another physics library.

## Verification

- **Mechanical**:
  - `npm.cmd run typecheck`
  - `npm.cmd run test:unit -- src/components/RitualScreen.test.tsx`
  - `npm.cmd test`
  - `npm.cmd run build:renderer`
  - All commands must exit 0. If full tests expose pre-existing unrelated failures, separate them with evidence; do not broaden scope.
- **Feel check**: start the actual renderer on a verified free port and use Playwright to complete at least the home-to-first-toss path.
  - Desktop: verify the three coins visibly rise, rotate independently, collide with the plate, roll/bounce, and stop at non-scripted positions.
  - Verify the confirmation button stays disabled while any coin is moving.
  - After all three stop, verify the camera moves closer and all three `字/背` results are legible without rearranging their final positions.
  - Complete a confirmation and verify the next toss resets the entire physical world without stale settle events.
  - Mobile viewport near `390x844`: verify the plate, result labels, progress, and confirmation action do not overlap or overflow.
  - Browser console: no React warnings, WebGL errors, Rapier initialization errors, or asset-load failures.
  - Emulate `prefers-reduced-motion: reduce`: no throw/camera travel; static results are immediately clear and confirmation is enabled.
- **Done when**: semantic reveal is driven by physical sleep, not a timer; the plate and camera result reveal are visible in a real browser; domain results remain unchanged; tests, typecheck, and renderer build pass.
