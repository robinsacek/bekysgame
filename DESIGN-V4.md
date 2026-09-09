# Blob Island V4: Weather, Character, and Sound

## Combined Release Verification

**Version 4.0.0 combines the completed V4 update and issue #1 feeding extension. All 124 simulation tests, eight full responsive/input/audio/objective browser scenarios, and six long-running living-world cases pass. The user authorized committing all workspace changes, pushing and releasing on 2026-09-09.**

This record supersedes the historical checkpoint, ownership and outstanding-gate notes below. The separate V4-only checkpoint remains intact; the combined release is prepared from the main Blob Island workspace. Moving tides, additional named species and engine replacement remain excluded.

- The standalone game is 9,083,518 bytes with SHA-256 `48c62e63fc017f625dea757ae45b42e77000d51e0376570a0d272b01a358c446`. The full browser and living-world reports both identify these exact bytes.
- All 124 simulation tests pass, including real autonomous meals for every individual over 435 active seconds per map, fresh food identities, exclusive reservations, calm dwell, independent grips, invalid-offer controls, natural mouth motion and priority-aware satisfaction. Existing physics, objectives and audio tests pass.
- All eight browser cases pass, including 36 held/released meal scenarios, every requested food example, native multi-touch, rotation, small-phone reduced motion, original objective journeys, actual Chromium audio/cleanup and Windows WebKit's disabled-audio fallback.
- All six Chromium/WebKit living-world cases pass for more than seven active minutes each. They retain actual meal identities, natural mouth motion, larger hearts, smiles, normal/eating/satisfied/reverted captures, hunts, play, comic events and zero unearned objective progress.
- Local receipts are retained under the ignored `test-results/` directory as `issue-1-unit-tests.txt`, `issue-1-full-browser-results.json` and `issue-1-full-living-results.json`. Publication additionally verifies the Pages artifact and hosted behavior; previous partial receipts are not substituted for the combined build.
- Physical iPad testing, hardware frame-rate certification and physical-device listening remain unverified. Browser-engine and native-touch emulation are not claims of physical-device testing.

## Historical V4-Only Checkpoint

**Status: V4 M1-M6 is locally complete and validated in the isolated checkpoint: 113 simulation tests, all eight full browser scenarios, all six living-world cases, desktop/mobile visual and integrated-browser checks, and identical standalone/Pages builds. Final commit `8c0223c530e4a873a25ffbf46aec5bfadcc67405` is pushed on `checkpoint/v4-2026-09-09`. These results do not certify this shared checkout's concurrent feeding build. Combined feeding integration and hosted release remain outstanding; no deployment occurred. Moving tides, additional species, and engine replacement remain excluded.**

## Intent

V3 delivered a bounded living coast: autonomous residents, curved banks, depth-aware beach, objectives, and a comic scheduler. V4 does not add systems for their own sake. The following gaps were observed in the pre-M1 build; M1 addresses part of the audio gap:

1. Much of the **background vegetation is still**. Cached scenery has no time input; this does not include the live palm, forage animation, residents, or water.
2. Water coupling is **partial**: wave-sampled buoyancy and splash injection already work. Continuous wakes, shared environmental currents, and explicit orbital forces are candidates for improvement.
3. Same-species residents already differ in size, speed, appearance, phase, and activity history. Stable voice identity, explicit traits, bounded social memory, and location-based avoidance are missing; each species currently owns one gag.
4. Maps already differ physically and visually. Weather rhythms and synchronized soundscapes should build on those differences, not replace them with a claim that V3 maps are identical.
5. Sound uses **one source per event** (an oscillator or filtered noise). Material labels, camera-relative panning, offscreen culling, and a constant surf bed already exist; richer timbre, individual identity, and continuous distance attenuation do not.

Everything proposed stays inside the existing contract: no countdowns, no damage, no unlocks, no third-party assets, no network, single self-contained HTML, effects and music default-off, seeded determinism for anything the tests observe.

## Scope and Evidence

- **Observed baseline** below refers to the source at the start of this milestone, following f8ad8a6f8df9cae31a12bfae94df229a07e0d097. It is not a claim that later proposals are implemented.
- **Committed M1:** backward-compatible optional event context; representative wood/glass/shell impacts with speed- and mass-sensitive timbre; stable resident voice identity and state/gag contours through real grab, collision, encounter, and comic events; smooth camera-distance gain/filtering; an effects compressor; bounded priority admission and complete transient cleanup. Keep the existing eight-event cap, independent music, and quiet surf bed.
- **Not M1:** rolling/scraping loops, a full water-sound family, map reverb, underwater filtering, wind, physics changes, new art, personality-driven gameplay, expanded gags, new inhabitants, or musical-key changes.
- **Approval required:** moving tides or terrace flooding, additional species, and major engine changes. Matter.js, Canvas 2D, shallow beach depth, existing objectives, and the visual identity remain fixed.
- Numeric values in Parts A-E are **initial artistic tuning hypotheses**, unless explicitly identified as observed source constants. They are neither measurements of nature nor verified performance promises.

---

## Research References

Research informs original implementation. No third-party artwork, audio, or source is copied. The following pages were consulted on 2026-09-09:

- Craig Reynolds, [Steering Behaviors for Autonomous Characters](https://www.red3d.com/cwr/steer/): explicitly lists flocking as separation, alignment, and cohesion. This supports a later schooling experiment, not replacing existing navigation or importing its implementation.
- MDN, [DynamicsCompressorNode](https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode): compression reduces loud signal portions; it is not a hard limiter or proof that every mix cannot clip. M1 needs conservative gain staging and rendered peak measurements.
- MDN, [BiquadFilterNode](https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode): documented lowpass/bandpass frequency and Q controls support the proposed timbre shaping. Distance absorption and material values below are stylized design choices, not acoustically calibrated models.
- MDN, [BiquadFilterNode.Q](https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode/Q): lowpass/highpass Q is in decibels, while bandpass Q is a positive bandwidth factor. M1 uses -6 dB on distance lowpasses to avoid a resonance that could brighten distant events; rendered spectra caught that distinction.
- MDN, [AudioScheduledSourceNode.stop](https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode/stop): a later stop replaces a scheduled stop and an already-stopped source is unaffected. M1 still needs idempotent ownership/disconnection of every source, filter, gain, and panner, including interrupted multi-source effects.
- MDN, [ConvolverNode](https://developer.mozilla.org/en-US/docs/Web/API/ConvolverNode): convolution uses an impulse-response buffer and optional normalization. Procedural map responses remain a later experiment, including tail disposal and map-switch crossfades.
- Mark Finch, [Effective Water Simulation from Physical Models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models), GPU Gems: Gerstner waves move sample positions horizontally; they are not a simple height lookup. Steepness must be bounded to avoid loops. Its GPU cost claims do not transfer to this Canvas game.

The earlier named-book claims about instinct, animation, needs, modal/bubble synthesis, Karplus-Strong, and Perlin noise were not validated against those primary texts here. They are not retained as implementation authority. Anticipation/reaction, conflict-triggered fidgets, sums of damped resonances, and coherent wind remain explicitly proposed techniques; no biological fidelity or physical acoustic accuracy is claimed.

---

## Findings: What the Current Build Actually Does

Observed by reading the owning source; not runtime performance measurements.

**Background vegetation is cached.** [src/map-art.js](src/map-art.js) and [src/terrain-art.js](src/terrain-art.js) take no time argument and are rendered into an offscreen background at `Math.min(scale, 1.25)` in [src/scene.js](src/scene.js). That background is static between scene rebuilds. Live forage, the physical palm, residents, and the water are separate; saying nothing moves was incorrect.

**No parallax.** The cached background is a single world-width strip blitted at the camera offset, so the far horizon scrolls at exactly the same rate as the sand under Blobby's feet.

**Water already has bidirectional event coupling.** [src/physics.js](src/physics.js) interpolates live spring offsets in `surfaceAt`; both circular immersion and the five rectangle force samples use it. Buoyancy therefore responds to waves. Entry/exit splashes inject energy into five neighboring wave samples. The fixed-step chain uses restoring/coupling coefficients 0.024/0.14, velocity retention 0.957, and offsets clamped to +/-18. Drag coefficients are 0.00022/0.00026; angular velocity is multiplied by `1 - 0.04 * submerged`, not a flat 4 percent. These are game-unit constants. Continuous horizontal wakes and explicit orbital/current forces on props remain absent.

**Configured current is creature-only.** `ecology.current` (Lagoon 0.0, Pools 0.20, Sunset 0.065) becomes an oscillating swimmer steering bias, `profile.current * sin(time / 5500 + resident.phase)`, in [src/wildlife.js](src/wildlife.js). There is no equivalent configured-current force on a bottle; incidental motion from waves, collisions, or initial velocity can still occur. The README's current description must not imply a shared water-flow field.

**One gag per species plus Blobby.** [src/antics.js](src/antics.js) maps ten species and Blobby to eleven gags. Mango and Fern both use `tongue-flick`. The resident antic marker lasts 2500 ms, with effect-specific lifetimes (Blobby's hiccup is 1300 ms; dropping cleanup is separately bounded). Starts are globally spaced 1800 ms, so some overlap is already possible. Baselines redraw at 1-7 active minutes and per-character eligibility is at least one minute; contextual bonuses can advance the baseline after eligibility.

**Individual state already exists.** Residents differ by size, speed, appearance, home, seeded phase, targets, feeding, interaction, recovery, and comic history in [src/wildlife.js](src/wildlife.js). There are cooldowns and retained state, not a memory-free machine. Explicit temperament, energy/fatigue, lasting pair affinity, and location-based startle avoidance would be new additions.

**Maps already have distinct geometry, cast, and interaction.** [src/maps.js](src/maps.js), [src/coast.js](src/coast.js), and [src/map-art.js](src/map-art.js) define smooth versus terraced banks, uneven seabeds, mangrove/basalt/dune art branches, different beach depth, caution/rest/glide/speed profiles, resident names and proportions, and map-local iguana/starfish/rabbit pairs. Lagoon has timber, seedpod, and a moored buoy; Pools has sinking conches and floating pumice; Sunset has driftwood, a seesaw, and suspended chimes. Empty `rocks` arrays do not mean no rocky art or terraced collision geometry. Warmth values are 0/0.04/0.30; seabed relief/phase is 34/0.4, 46/1.8, 38/3.1. The expedition subtracts 0.18 of world height from configured ground/water and uses bottom `0.96 * height`, so raw `ground ~0.70` is not the playable beach height. Objectives, baseline wave constants, music, and effect palette are shared; weather and recurring map events are new candidates.

**Audio baseline: 21 explicit one-shot kinds, not 18.** [src/audio.js](src/audio.js) has 17 tonal palette entries and four separate filtered-noise cases (`splash`, `rustle`, `voice-shark`, `voice-tortoise`), with an eight-event simultaneous cap. Unknown kinds fall back to `grab`. The ten species have templates, but no stable per-individual voice parameters; tonal playback already varies randomly by 0.96-1.04, so same-species recordings are not byte-identical. Impacts use material-labeled templates, but strength changes their gain, not their modal spectrum. `stretch` already changes pitch with strength, and splash duration changes with strength. The constant surf bed has gain 0.035 before the effects gain of 0.55. There is no compressor, reverb, continuous distance attenuation, or submerged filter. [src/game.js](src/game.js) already computes camera-relative pan and culls queued events outside normalized viewport coordinates -0.15 to 1.15; the panner clamps to +/-0.8. Culling is not continuous attenuation. Continuous rolling, scraping, and wave-driven swash remain additions, not repairs to absent event routing.

**Cost is not source line count.** The earlier line-count estimate was stale and cannot establish runtime cost. Record compiled bytes, render-buffer area, frame-time distributions, and actual audio node/source counts when the relevant milestone is implemented.

---

## Part A — Visual Realism

### A1. Parallax and aerial perspective

Split the single cached background into three strips with independent scroll factors: **far** (sky, horizon, distant headlands) at 0.25, **mid** (treeline, far bank, distant rock) at 0.55, **near** (beach, vegetation, banks) at 1.00. Composite a horizon-coloured veil over far and mid with alpha 0.22 and 0.09, tinted by `map.warmth`, so distance reads as lost contrast rather than as smaller shapes.

Unverified cost: three full-sized strips at the same resolution would triple the single-strip pixel area, not cost 1.6 times as much. Crop layer heights, bound total offscreen pixels, and consider a 0.75 far-layer scale. Measure actual dimensions and frame time before choosing the allocation.

### A2. Wind as one shared field

A single scalar per frame, `wind(t) = base + gust`, where `base` is per-map and `gust` is two summed low-frequency noise octaves. Publish it on the island so **visuals, physics, and audio read the same number**. Consumers: palm fronds, dune and sea grass, mangrove leaves, seagrass underwater (phase-lagged and attenuated), bird drift, swing and chime excitation, ripple amplitude, and the ambience filter. This single value fixes the frozen-scenery problem at low cost, because vegetation only needs to move to a shared phase.

Vegetation must therefore move from the cached strip into a lightweight animated pass, or the cached strip must store stems separately from a per-frame sway transform. Prefer the second: cache the trunk/mass, redraw only the sway-affected tips.

### A3. Water surface

- **Crest shaping candidate.** Keep the spring chain first. A Gerstner-style extension requires a monotone parameter-to-world-x mapping and inversion/interpolation for `surfaceAt(worldX)`; simply subtracting a sine from x in two places is not enough. Bound steepness to prevent loops, preserve shoreline anchors, and prove identical drawing/immersion samples before adopting it. A shared height-only artistic profile is the lower-risk alternative.
- **Swash and wet sand.** Maintain a per-x shoreline array. Each frame, the local wave height determines the run-up limit; foam is drawn as a stippled band between the still line and the run-up limit, with a lag so it visibly retreats. Wet sand darkens by 0.18 and dries back over about 4 s. This is the single strongest "real beach" cue available.
- **Refraction of submerged content.** When drawing anything below the surface, offset it horizontally by `A * sin(k * y + ωt) * immersion` and tint it toward the deep-water colour with depth. Cheap per-sprite, and it makes the water read as a medium rather than a blue fill.
- **Caustics candidate.** Compare the existing stylized caustics in [src/scene.js](src/scene.js) with a bounded two-layer interference pattern clipped to water. This is an artistic lighting approximation, not ray-traced caustics. Light shafts remain optional after profiling.
- **Sun glitter.** A specular sparkle line on wave crests along the sun's azimuth, densest where the surface normal faces the sun. Reads immediately as a lit sea, especially at Sunset Cove.

### A4. Light, shadow, and grading

Derive a **sun azimuth and elevation from `map.warmth`** and use it everywhere instead of the current hardcoded rightward shadow offset in [src/shadows.js](src/shadows.js#L1). Shadows then lengthen and swing per map — long and raking at Sunset Cove, short and high at Little Lagoon.

Upgrade contact shadows from one hard ellipse to two: a wide low-alpha penumbra whose radius grows with elevation, plus a tighter darker core whose alpha falls faster. Add a final per-map colour-grade pass (a single low-alpha overlay plus a slight saturation shift) so foreground creatures inherit the map's light instead of staying neutral under a warm sky.

Add a rim-light term on creatures and Blobby, sampled from the sun azimuth, at alpha ~0.12.

### A5. Blobby

Blobby is the character; it deserves the most expensive effect in the scene.

- **Refraction approximation.** Clip and warp a pre-Blobby scene capture within its silhouette, then overlay the rainbow fill. A background-only redraw misses live water, toys, and residents, so it is not true scene refraction. Start disabled until the capture cost and occlusion order are verified; ~1.06 magnification is only a tuning suggestion.
- **Subsurface scattering approximation.** Brighten a thin band inside the silhouette (thin geometry transmits more light) and add a back-light term sampled from the colour behind the blob.
- **Wet sheen and drips.** Reuse the existing `wetness` term for a specular streak and occasional drip when leaving water.

### A6. Particles and secondary detail

Currently only splash droplets and a few gag effects exist. Add, all pooled and budget-capped:

- Sand puffs on land impacts, scaled by impact energy and substrate.
- Directional spray sheets on fast water entry, separate from the existing droplets.
- Wake foam behind fast swimmers and behind Blobby at the surface.
- Airborne motes: pollen and dust catching the light at Sunset Cove, midges over the Lagoon water, spray haze at Tide Pools.
- Per-individual art variation: small seeded jitter in hue, size, and marking placement so Fin and Pip are visually distinct even though they share a species drawing routine.

---

## Part B — Physics and Behaviour Realism

### B1. Two-way water coupling

Later additions to [src/physics.js](src/physics.js), with stability work rather than an assumed small cost:

1. **Orbital-force experiment.** Existing buoyancy already causes bobbing. Compare an additional depth-attenuated surface-velocity force against that baseline to avoid double-counting wave response. Leave Stokes drift out of the first experiment so the zero-current control has an unambiguous meaning.
2. **Continuous wakes.** Inject bounded energy from motion relative to water, with frame-step normalization, symmetric displacement, and a rest threshold. Compare against existing splash injection, and test long-run energy decay to catch positive feedback between wakes and bobbing.
3. **Shared current field.** Replace the swimmer-only oscillation with one sampled flow consumed by swimmers, props, and Blobby. Apply capped drag toward the local flow, not unbounded acceleration. Held grips retain priority; force-free controls must isolate current from waves and collisions.

Do not prescribe three-point circular buoyancy as a log fix. Circles already use a circular-segment immersion approximation; logs/rafts are rectangles and already apply five buoyancy forces off-center. A rotationally symmetric circle has no preferred level angle. Add a tilted rectangular-log control before changing buoyancy sampling.

### B2. Materials and contact

- **Velocity-dependent restitution**, `e = e0 / (1 + c * |v|)`, so nothing bounces unrealistically off a fast impact.
- **Rolling resistance** on round bodies proportional to angular velocity while in contact, so a ball on sand eventually stops.
- **Wet/dry substrate candidate.** A3 could supply moisture to contacts; the current terrain friction is 0.72. A value such as 0.80 is an uncalibrated tuning proposal, not a universal physical law. Visual wetness alone is lower risk; contact changes require objective delivery and settled-body checks.
- **Trails, not deformation.** Footprints, drag marks, and Blobby's slide marks are drawn into a decaying per-x overlay and are **not** collidable. This gives the appearance of sand memory without destabilising the static terrain mesh.

### B3. Tide (deferred; explicit approval required)

A slow sinusoid on the water level, roughly ±9 world units over a ~7-minute period, sourced from `surfaceAt` so drawing, collision, habitat bounds, forage patches, and landmarks all agree. It gives the world a sense of elapsed time without a day/night cycle, and at Tide Pools it visibly exposes and floods the lowest terrace.

**Risk to flag before building:** the tide moves the shoreline, which touches habitat containment, the shell nook, the picnic clearing, and the reef objective. Amplitude must be small, must be clamped so no objective landmark can ever be submerged or stranded, and the objective negative controls must be re-run at both tide extremes.

### B4. Blobby's soft body (later experiment, not M1)

[src/blobby-shape.js](src/blobby-shape.js) plus the 24-point, 84-constraint network in [src/physics.js](src/physics.js) supplies the current silhouette. Three candidate refinements:

- A **surface-tension term** along the ring tangent proportional to local curvature, so extreme stretching stays smooth instead of faceted.
- A **volume-damping term** to stop the pressure model pumping when squeezed and released rapidly.
- **Fold resistance candidate:** local repulsion between non-adjacent particles may reduce folds, but does not by itself prevent segment crossings. Require an explicit hard-fold intersection check before claiming self-collision, and retain existing grip/volume behavior.

### B5. Needs, memory, and personality

This is what makes animals read as individuals rather than as state machines.

- **Personality vector** per named character, seeded from its id and stored beside its other data: `{ bold, curious, tidy, greedy, clumsy, chatty, vain }` in [0, 1]. It scales startle threshold, approach distance, rest duration, gait amplitude, gag weights, and voice pitch. Mango and Fern stop being clones.
- **Needs**: `hunger`, `energy`, `social`, `curiosity`, each decaying and replenished by the corresponding activity. Action selection biases toward the highest unmet need. Preserve existing held-input, recovery, threat, and objective control paths above new motives; do not assume or introduce a new ordering among them. Proposed **fatigue** makes a resident slower after fleeing or play and lengthens rest, with bounded recovery so it cannot become stuck.
- **Pair affinity**: a per-pair scalar raised by play, greetings, and shared meals, lowered by frights. It drives who initiates, how close they approach, and greeting frequency. Fin and Pip develop a visibly closer bond than Fin and a passing bird.
- **Startle memory**: a decaying "avoid this spot" marker for ~30 s after a fright, so a character does not immediately walk back into whatever scared it. Learned avoidance, cheaply.
- **Attention**: characters track the nearest moving thing with eyes, eye stalks, or ears, and shy characters freeze when Blobby is held still nearby. Being noticed is a strong life cue.

### B6. Locomotion and flocking

- Full Reynolds **separation, alignment, cohesion** for fish so more than two can form a school with real formation, replacing the current hardcoded two-fish pairing.
- Lazy soaring circles for birds, coupled to the wind field.
- Gait candidates: crab leg-phase offsets and sidling, a staged tortoise walk, rabbit anticipation crouch and landing squash, lizard lateral undulation, and a bird landing flare. Anticipation must not delay held input, emergency recovery, or navigation. These are original animation proposals, not verified biological gait claims.

---

## Part C — Comic Behaviour: From 11 Gags to a Repertoire

### C1. Two tiers instead of one

The current single tier (2500 ms, globally spaced 1800 ms, once per character per minute or more) is correctly tuned to avoid spam, but it means very little happens. Split it:

**Fidgets** — proposed 400-900 ms, with a per-character cooldown around 12 s and a small visible-area cap. Use observable drive conflict (hungry but blocked, greeting interrupted, rest crowded) plus eligibility, not a timer alone. This is a game design heuristic, not a validated animal model. Examples: preening, scratching, shell-polishing, ear-flick, stretch, sniff, yawn, tail-flick, wing-settle, fin-fan, bubble-blip.

**Moments** — the existing 2500 ms set pieces, globally spaced, keeping the current baseline/bonus/decay scheduler in [src/antics.js](src/antics.js#L26) unchanged.

Fidgets carry most of the perceived randomness and liveliness; moments stay rare enough to stay funny.

### C2. Per-character repertoire

Eventually replace `MOMENTS: species -> string` with contextual repertoires. Start with two alternate actions and one individual signature for one existing named pair, validate readability and non-repetition, then expand to at least four suitable actions per species. The earlier 40-48 total and 2-3 signatures per individual are stretch candidates, not committed counts or mutually consistent estimates.

Selection is weighted by, in order: current state and medium (a fish cannot claw-dance), personality vector, recent history (no repeat within a character's last three draws), and the triggering context. Selection must use the seeded `wildlife.random()` so tests stay deterministic.

Illustrative signatures, to make the intent concrete: Mango sunbathes and puffs a throat fan; Fern, younger and faster, startles at her own tail. Clover thumps a warning; Thistle over-commits a binky and lands sideways. Aster slowly cartwheels; Pearl gets stuck upside down and rights herself. Fin blows a ring; Pip tries and fails. Skipper, Piper, and Sail each get a different landing pratfall.

### C3. Staging and escalation

- **Anticipation → action → reaction.** Every moment gets a wind-up, and any witness within range gets a scripted short reaction (the existing `Ewww!` is the prototype and generalises to `startle`, `laugh`, `copy`, `ignore`).
- **Rule of three.** A gag repeated by the same character within a window escalates on the third occurrence. Chains cap at two links and cannot re-boost their own source — the existing V3 anti-recursion rule extends unchanged.
- **Staging.** Two moments may not run in overlapping screen space; the loser defers. This is why the global 1800 ms spacing exists, and it should become spatial as well as temporal.

### C4. Blobby

Blobby currently owns one gag. Give it a fidget set that respects the "autonomous hops never count as player input" rule: wobble-settle, colour-shimmer, sneeze-jiggle, blow a bubble underwater, an accidental roll on a slope, and a delighted squish when a resident approaches.

---

## Part D — Map Identity

Extend the maps across physical interactions, environmental rhythms, inhabitants, visuals, and soundscapes. V3 already differentiates bank geometry, toys, cast variants, and habitat art; the following are additive candidates.

### D1. Weather and atmosphere

| | Little Lagoon | Tide Pools | Sunset Cove |
|---|---|---|---|
| Air | Still, humid morning | Brisk, broken cloud | Warm golden hour |
| Wind base | 0.15, rare gusts | 0.55, frequent gusts | 0.30, long soft gusts |
| Sky | Clear, soft cumulus low on the horizon | Layered stratus with breaks, **moving cloud shadows sweeping the beach** | Banded gradient, sun near horizon, lit cloud undersides, glitter path on the water |
| Air particles | Midges over the water, low mist at the far bank | Spray haze off the rocks | Pollen and dust motes, fireflies as light drops |
| Shadows | Short, high sun, soft | Intermittent under cloud | Long, raking, warm |

### D2. Water character

Per-map wave-chain constants, currently shared:

- **Lagoon:** low amplitude, long period, heavy damping — glassy and sheltered. Tannin tint, high surface reflectivity.
- **Tide Pools:** short chop and the strongest shared current. A roughly 40 s set-wave rhythm is a later candidate; terrace flooding and resident scrambling are deferred with moving tides until explicitly approved and objective/recovery controls pass.
- **Sunset Cove:** long-period swell, moderate amplitude, wide swash on a steep berm.

### D3. Shoreline and vegetation art

Refine the existing mangrove/basalt/dune branches: animated prop-root leaves at Lagoon, jointed basalt and fixed-waterline algae bands at Pools, and wind ripples plus bending dune-grass tips at Sunset. Collision pockets and tide-keyed art are separate higher-risk candidates, not implied by decorative detail.

### D4. A signature event per map

Each map gets one thing that happens **only there**, so returning to a map is rewarded:

- **Lagoon:** a school of bait fish flashes past; the mangrove drops floating seedpods.
- **Tide Pools:** a bounded chop/spray rhythm with an audible approach; the flooding set wave remains approval-gated (D2).
- **Sunset Cove:** the light drops, fireflies appear, a gust runs the chimes, and a distant flight of birds crosses the horizon.

### D5. Roster and toys

Preserve the existing map-local iguana, starfish, and rabbit pairs and kind-unique discoveries. Additional mudskipper/urchin/ghost-crab species are deferred pending explicit approval. First make existing variants and toys more individual through context, sound, and behavior; new toy kinds must justify their art, collision, recovery, and objective-test cost.

Objectives stay the same four everywhere, but landmark art, thought pictograms, and the completion flourish become map-specific.

---

## Part E — Audio

The first prioritized quality experiment. Effects remain procedural; comparative quality and cost must be demonstrated, not assumed.

### E1. Mix bus

M1 inserts a compressor on the effects path, leaving music independent, and keeps the **eight-event cap** (an event may own several sources). Reserve capacity for an achievement and admit higher-priority sounds by retiring a quiet/old lower-priority non-voice event. Do not steal a resident voice or achievement; if all eligible slots are protected, reject the incoming event explicitly instead of growing a queue. Bound sources per event, disconnect every node on completion/interruption, and clear cooldown state across map/reset transitions. A 16-event cap and ambience ducking are later candidates after measured burst and lifecycle tests.

### E2. Modal impact synthesis

Replace the fixed `[start, end, duration, waveform]` palette in [src/audio.js](src/audio.js#L145) with a material bank. Each material is 3–5 resonant modes `(frequencyRatio, gain, decay)` plus an excitation noise burst shaped by contact hardness:

| Material | Character |
|---|---|
| Wood | Few low modes, fast decay, soft transient |
| Glass | High inharmonic modes, long decay, bright transient |
| Shell | Mid modes, bright click, medium decay |
| Stone / conch | Dense, very short, hard transient |
| Pumice | Damped, dull, noise-dominated |
| Sand | No modes; filtered noise only |
| Rope / canvas | Broadband thump, no ring |
| Chime | Long, near-harmonic modes (Karplus–Strong is an alternative here) |

Then map physics to timbre, which the current build never does:

- **Impact speed → excitation brightness** (lowpass cutoff) and mode decay, not just gain.
- **Mass → fundamental**, roughly `f ∝ mass^(−1/3)`, so the same material bank makes a big crate thud and a small shell click.

### E3. Contact types

Impacts are only a third of contact sound. Add:

- **Rolling** — continuous filtered noise whose centre frequency and gain track angular velocity and substrate. A ball rolling on sand currently makes no sound at all.
- **Scraping/sliding** — band-limited noise driven by tangential velocity.
- **Resting/settling** — a short low tail as a body comes to rest.

### E4. Water

Later replace the single `splash` with a family of stylized procedural sounds:

- **Droplet** — a short sine with a rising frequency sweep (the bubble model). Individually convincing, and a splash is a cloud of these.
- **Entry** — noise transient plus a bubble cloud whose density scales with impact energy.
- **Spray sheet** — for fast, shallow entries; pairs with the visual spray from A6.
- **Swash** — shoreline wash driven by the actual run-up array from A3, so the beach is audible and synchronised to what is drawn.
- **Submerged filter candidate** — when Blobby is underwater, smoothly lowpass effects toward roughly 700 Hz; keep music independent. Add hysteresis near the surface and restore the filter on map/reset. Any reverb send depends on E5. Cost and perceptual benefit remain unmeasured.

Drive the surf bed's amplitude and brightness from the **real wave energy in the physics chain** rather than the current constant 0.035 gain, so a big splash is audibly heard in the sea itself.

### E5. Space

- **Distance attenuation** — proposed `gain ∝ 1 / (1 + distance / d0)`, plus a lowpass whose cutoff falls with distance (an artistic air-absorption approximation). Preserve existing camera-relative panning and offscreen culling. Among admitted events the baseline has no continuous attenuation; events outside the visible neighborhood are already silent.
- **Reverb candidate** — procedurally generated impulses, with short damp Lagoon, brighter Pools, and sparse open Sunset responses. Earlier 0.6/1.1/1.8 s durations are audition targets, not measured acoustics; a long reverberant open beach may sound wrong. Budget convolution, crossfade, normalization, and tail cleanup before choosing values. No line-count cost promise.
- Wet/dry send per family: voices and impacts wetter, UI feedback dry.

### E6. Voices: per character, not per species

Layer a **timbre offset** on top of each species template, derived from the character's size and personality:

- `pitch` — semitone offset, roughly `f ∝ size^(−0.4)`, so Mango is lower than Fern and Sail lower than Piper.
- `formant` — filter centre, giving each individual a vowel colour.
- `rasp` — noise blend into the tone.
- `wobble` — vibrato depth and rate.
- `phrase` — one to three syllables with a per-character contour.

Extend M1's held/curious/content/playful and selected gag contours into the following proposed **behavior prosody** palette. The baseline had no explicit state-to-contour mapping, although random pitch variation already existed:

| State | Contour |
|---|---|
| Curious | Rising, soft |
| Startled | Short, loud, sharp attack |
| Content | Falling, quiet |
| Playful | Two syllables, up–down |
| Calling | Long, repeated twice |

### E7. Ambience per map

Layered, crossfaded on map change, all procedural, all coupled to the shared wind field from A2:

- **Lagoon:** sparse insect and frog chirps, gentle leaf rustle, a distant kingfisher, near-still water.
- **Tide Pools:** wind through rock, high-frequency spray hiss, an occasional gull, and an audible approach for the set wave.
- **Sunset Cove:** warm wind through dune grass, crickets, long-period distant surf, chimes excited by gusts.

### E8. Behaviour sounds that do not exist yet

Existing gags already emit a species voice (or Blobby's grab tone), and touched forage already emits rustle/splash. They lack dedicated action timbres. Candidate additions are gait-keyed steps/scuttles, wingbeats, tail swishes, pulse/jet sounds, hop/shell/claw contacts, feeding, sniffing, breathing, a two-part sneeze, hiccups, cartwheel/ink/splat/snap effects, and a rescue shimmer. Add them in small measured families, not all at once; a long-run requirement applies only to implemented actions.

Every new sound reuses the existing idle-suppression discipline: per-kind cooldowns, distance gating, and no sound from autonomous collisions between residents.

### E9. Musical coherence

Defer retuning the bundled recording or pitched feedback. Keep M1's existing chime/achievement pitches and use short, inharmonic material resonances. Any later pentatonic scheme requires measuring the unedited recording and auditioning the result; choosing a scale alone cannot guarantee consonance. No key is assumed here.

---

## Constraints and Budgets

- **Self-contained.** Everything above is procedural. No new binary assets, no CDN, no network. The 9 MB bundle grows only by source.
- **Performance targets, not achieved claims.** Aim for 60 fps desktop and 30+ fps tablet; record p50/p95 frame time, scenario duration, viewport, engine, and hardware before judging a milestone. Measure offscreen pixel area and peak live audio sources. Refraction, caustics, and extra parallax layers each need a disable path. M1 retains eight events and caps each at four sources; raising that budget is a separate decision.
- **Determinism.** Gameplay choices remain on the seeded gameplay stream and freeze with inactive simulation time. Do not consume extra gameplay random draws merely to vary audio. M1's sound identity is a deterministic hash of character id plus size; audio noise remains unseeded in play but has a controlled source in spectral tests. Later personality/weather streams must preserve reproducibility and avoid changing unrelated decision sequences.
- **Audio support matrix unchanged.** Windows Playwright WebKit exposes no Web Audio API, so every audio assertion remains a Chromium check with an explicit WebKit disabled-fallback assertion. This is an engine/emulation check, not physical iPad testing.
- **Defaults unchanged.** Effects and music start off and require a user gesture. Pause, hide, and blur must suspend both audio and simulation; M1 closes the baseline blur gap, where only input was released.
- **No regression to the V3 contract.** No countdowns, damage, unlocks, persistence, tracking, or removal of residents.

---

## Acceptance Checks

M1 gates are below. The subsequent area checks are acceptance targets for their owning future milestones, not claims of completion or requirements to implement them now.

**M1: contextual interaction audio**
- Legacy `play(kind, strength, pan)` and `queueSound(kind, strength, x)` callers still work; optional context carries primitive material, mass, speed, character id/size, and behavior values through production events, without body references or gameplay random draws.
- Wood/glass/shell produce measurably different normalized spectra. At equal event gain, faster impacts change brightness and larger same-material bodies lower resonance frequency. Validate rendered PCM in Chromium, not only parameter/event counts.
- Real prop grabs/collisions and resident grabs/encounters/gags reach the improved renderer. Same-species partners have stable distinct pitch/filter values; the same identity has different held/curious/startled or gag contours.
- Camera-relative pan and the existing offscreen window are preserved. Identical admitted events get monotonically quieter/darker with horizontal world distance from camera center; legacy callers with no distance retain neutral gain.
- Never exceed eight events or four sources per event. An achievement can enter a full ordinary-effect burst; protected-only saturation is explicitly rejected. Burst output is finite, nonzero, and below full scale in the measured cases, including music; do not infer a universal clipping guarantee from the compressor.
- Natural completion, steal, mute, pause, blur/hide, map switch, and reset leave no live transient nodes. Repeated cleanup is safe; returning resumes only enabled audio, without replaying stale transients. Muted effects produce silent PCM while independently enabled music continues.
- `npm test` and `npm run build` pass. Exercise the touched workflow in Chromium through real mouse/touch gestures and measured audio output, and retain the Windows WebKit disabled fallback. No hardware-iPad claim; no publication in this milestone.

**Visual**
- Parallax: far, mid, and near strips move at measurably different rates for the same camera delta; the near strip still matches world coordinates exactly.
- Wind: one shared scalar; vegetation, bird drift, chime excitation, and ambience read the same frame value. With wind zero, the wind-driven contribution is zero; birds can still self-propel, chimes can be touched, and waves can be disturbed.
- Water: `surfaceAt` and the drawn surface agree at every sampled x under trochoidal skew. Swash run-up, foam extent, and the wet-sand array agree with the same wave field. Wet sand dries within the stated window.
- Shadows follow the per-map sun azimuth; Sunset Cove shadows are measurably longer and differently angled than Lagoon shadows.
- Blobby's refraction never leaks outside the silhouette and degrades cleanly when disabled.

**Physics**
- Retain existing wave-driven buoyancy. Compare identical isolated props with current enabled/disabled under identical terrain/wave input; only the current-driven drift should vanish, not incidental wave or collision motion. Compare configured Lagoon/Pools flow in a shared fixture rather than confounding it with different coast geometry.
- A body moving relative to water generates bounded wake energy; an initially stationary body in still water does not. Splash injection still works and long-run coupled energy remains bounded.
- A half-submerged log rotates toward level from a tilted release.
- Tide: objective landmarks remain reachable and un-submerged at both extremes, and all four objective negative controls still fail at both extremes.
- Blobby cannot self-intersect under a hard fold; volume oscillation decays.

**Behaviour and comedy**
- Every species draws from a repertoire of at least four gags; over a long run, each character performs at least three distinct gags.
- Mango and Fern, Aster and Pearl, Clover and Thistle, and Fin and Pip each produce measurably different gag distributions, approach distances, and voice pitches.
- Fidgets fire on drive conflict, not only on timers: with conflict suppressed, fidget rate drops measurably.
- Fatigue: a resident that has just fled moves slower and rests longer than a rested one.
- Affinity rises with play and greetings and falls with frights; startle memory keeps a character away from a fright location for the stated window.
- Global and per-character spacing still hold; no two moments overlap in screen space; chains cap at two links; `Ewww!` still cannot re-boost its own chain.
- Autonomous Blobby hops still do not count as player input, and no gag earns objective progress.

**Maps**
- Each map's wave spectrum, wind base, sky treatment, reverb impulse, ambience layers, and signature event are distinguishable by automated measurement, not only by eye.
- Preserve existing map-local pairs and distinctive toys. New-species/toy checks apply only after approval and implementation.
- A map rhythm is seeded, freezes on pause/inactive maps, and has synchronized visual/audio evidence. Flooding-set-wave checks remain deferred with tides.

**Audio**
- Impact timbre changes with speed and mass, not only gain: two impacts of equal gain but different speed produce different spectra.
- Rolling and scraping produce continuous sound that stops when motion stops.
- Distance attenuation and air absorption are measurable across the world width.
- The submerged filter engages and releases with Blobby's immersion.
- Every implemented individual voice is distinguishable from its same-species partner; every implemented behavior sound fires in a relevant controlled/long-run case, with idle negative controls.
- Reserve achievement headroom and do not steal protected voices; verify the documented saturated-protected rejection case. Render the defined worst-case burst and bound measured peaks, without claiming arbitrary inputs can never clip.
- WebKit still reports the disabled-audio fallback and never claims playback.

**Regression**
- All existing simulation tests, all eight responsive/input scenarios, all six long-running living-world cases, integrated-browser desktop and mobile inspection, exact standalone/Pages byte identity, and hosted verification after an authorised push.

---

## Prioritized Roadmap

1. **M1, contextual interaction audio (this session).** Event context -> material/individual/behavior synthesis -> bounded spatial mix and lifecycle -> production unit/PCM/gameplay checks. No dependency on new weather, traits, or physics. Risks: voice/source multiplication, stale nodes, same-species suppression, abrupt silence, gesture races. Use existing callers, cooldowns, and real events; pass the M1 gates above.
2. **M2, quiet environmental audio.** Depends on M1 ownership and event context. Add immersion smoothing and wave-energy-driven surf, then a small rolling/scrape family from verified contacts. Optional short per-map reverb comes last. Risks: contact chatter, endless loops, large tails, music masking. Check motion-stop silence, repeated map cleanup, dry/wet transitions, and independent music.
3. **M3, coherent environmental grounding.** Shared seeded wind and explicit per-map sun direction before their consumers: animated vegetation tips, matching shadows/rim light, bounded swash/wet-sand/contact particles. Depends on the unchanged surface/floor ownership. Risks: art/collision disagreement, particle overdraw, hidden landmarks. Check matching surface samples, zero-wind contributions, drying, sun-direction consistency, and frame-time/pixel budgets.
4. **M4, consistent water forces.** Depends on baseline buoyancy controls and M3's shared field. Add shared flow and bounded relative-motion wakes separately, retaining rectangle sampling; evaluate orbital forces only against existing bobbing. Risks: positive energy feedback, held-input interference, habitat/landmark reachability. Re-run objective positives/negatives, recovery, finite long runs, and isolated no-current/no-wake controls. No moving tide.
5. **M5, individual behavior and comedy.** Bounded traits/energy and one avoidance marker per resident; at most one affinity value per resident pair, all session-only with capped decay windows. Keep held/threat/recovery/objective priorities above new motives. Start one pair's contextual fidgets, alternate gags, signatures, anticipation/reaction, and history suppression before cast expansion. Dependencies: existing movement/foraging/comedy and M1 identity context. Risks: stuck priorities, repetitive noise, staging conflicts, altered seeded draws. Prove fatigue recovery, capped memory expiry, no repeat in eligible recent history, spatial staging, two-link chain cap, and no autonomous objective progress. Expand locomotion/flocking only with existing navigation controls intact.
6. **M6, map rhythms and polish.** Build on existing toys, inhabitants, and M2-M5 fields: calm mangrove motion, brisk Pools chop, warm Sunset gust/chime rhythms, distinctive quiet soundscapes. Measure each map's synchronized event, not only parameter differences. Parallax, enhanced caustics, and Blobby's refraction/mesh changes are separately profiled optional experiments with disable paths; they do not block the coherent grounding milestone.

Before any future release, run all simulation tests, all eight responsive/input cases, all six living-world cases, integrated desktop/mobile inspection, build/Pages artifact identity, and hosted verification **after separate publication authorization**. The prior migration and historical releases are not repeated as M1 prerequisites.

---

## Decisions and Next Ownership

The user authorized continuing the complete finalized M2-M6 roadmap on 2026-09-09, with visual testing at each stage. Preserve the eight-event budget, existing music pitches, Matter.js/Canvas identity, objectives, input priority, and bounded seeded state. Moving tides, additional species, engine replacement, and publication remain outside that finalized scope.

The coding assistant owns local M1-M6 implementation and verification, including the full responsive/objective and living-world browser matrices. The next concrete action is to complete those local gates and bind their results to the final standalone artifact. The user owns any later commit/push/deploy authorization. This document remains the roadmap and execution record; no additional planning or handoff files are needed.

## Historical M1 Verification (2026-09-09)

- Implemented event context in [src/sound-context.js](src/sound-context.js), production collision/encounter/gag producers, and camera routing. [src/audio.js](src/audio.js) now renders three material modes plus a short excitation burst, deterministic size/id voice offsets, behavior contours, a two-part sneeze, distance gain/filtering, an effects compressor, and seven ordinary slots plus reserved achievement capacity within the eight-event cap. The surf bed is reduced from 0.035 to 0.006 before the effects bus to keep interactions audible, including at wide-view camera distances.
- **83/83 simulation tests passed**, including seven new production audio/context tests and the existing objective positives/negative controls, navigation, recovery, multi-grip, idle-sound, and seeded behavior tests. The standalone build passed at approximately 8818.7 KiB; bundled music and dependency/license notices are preserved.
- **8/8 focused audio/input browser scenarios passed**: desktop, wide desktop, native Chromium multi-touch tablet, both WebKit tablet orientations, two phone sizes, and dark WebKit. The slice includes rotation/cancellation and nonblank moving pixels. Chromium ran file-offline and measured actual PCM; Windows WebKit retained disabled audio/music controls. No physical iPad was tested.
- [tools/audio-browser.cjs](tools/audio-browser.cjs) exercises real prop/resident grabs, natural completion, pause, blur/focus, visibility, map switch, reset, effects mute with music continuing, and offline rendering of production synthesis. The browser-only probe is not bundled. Evidence: [test-results/audio-desktop.json](test-results/audio-desktop.json), [test-results/audio-rendered.json](test-results/audio-rendered.json), and [test-results/browser-results.json](test-results/browser-results.json).
- Controlled PCM: wood/glass/shell spectral centroids approximately 271/1353/787 Hz; equal-gain slow/fast glass 1187/1575 Hz; an eightfold wood mass increase lowers the dominant mode from 258 to 129 Hz. Fin/Pip dominant voice frequencies were 624/711 Hz; repeating Fin's input produced identical PCM. Far glass RMS was about 30 percent of near glass, with centroid reduced to 1221 Hz. These are bounded test measurements, not acoustical calibration.
- The defined nine-request burst with bundled music admitted all requests by retiring one lower-priority effect: peak eight events, fourteen simultaneous sources, peak sample magnitude about 0.082 (full scale 1), and zero remaining transient voices. Protected-only saturation is rejected by the unit test. Effects-only muted PCM was exactly zero; music-only playback had nonzero output and zero effects output. No universal clipping or hardware-performance claim is made.
- **Remaining:** M2-M6, physical-device listening/performance, the full coast/objective browser journey and six long-running living-world release cases, and separately authorized publication/hosted verification. Those release suites were not substituted by the focused eight-case run or rerun as historical migration checks.

## M2-M6 Execution (2026-09-09)

These implementation facts supersede the earlier proposal where values differ. Optional ideas in Parts A-E are not all acceptance commitments; retained exclusions are listed explicitly below.

- **M2 implemented:** 0.68/0.38 immersion hysteresis, smoothly automated effects-only 700 Hz underwater lowpass, wave-energy surf, two bounded real-contact rolling/scraping loops, four-source splash clouds, and short seeded map reverbs (0.28/0.46/0.18 seconds for Lagoon/Pools/Sunset). Old tails disconnect on interruption. Effects/music remain independent and default-off. Focused unit and Chromium PCM checks passed; desktop/phone visual evidence is retained in [test-results/m2-browser-results.json](test-results/m2-browser-results.json) and [test-results/m2-audio-rendered.json](test-results/m2-audio-rendered.json).
- **M3 implemented:** independently seeded coherent wind, explicit map sun directions/elevations, four-second wet-sand drying and lagged foam, five-second contact marks, at most 48 short-lived sand particles, animated foliage/grass tips, layered shadows, small submerged distortion, and restrained grading. Environment consumers use active island time. [test-results/m3-browser-results.json](test-results/m3-browser-results.json) records all-map desktop/phone inspection; source tests prove field determinism, drying, particle limits, and shadow direction.
- **M4 implemented:** depth-attenuated current shared by swimmer steering and prop/Blobby drag, bounded symmetric relative-motion wakes, map-specific low-amplitude swell, contact spin damping, velocity-dependent prop restitution, and moisture adjustment relative to each body's original friction. Held input receives no new current/wake force; protected bird routes bypass wind bias. No tide or extra orbital-force approximation was needed: the existing five-sample raft buoyancy passes leveling and swell-following tests. Isolated current/no-current tests and objective/recovery controls passed. [test-results/m4-browser-results.json](test-results/m4-browser-results.json) retains visual checks.
- **M5 implemented:** seven stable id-derived traits, bounded needs/energy, ordinary-speed/rest modifiers, named-pair affinity with three-minute decay/expiry, one thirty-second fright marker per resident, gaze cues, bounded schooling alignment/cohesion, hop anticipation, phase-limited gait/feeding sounds, four gags per species, eight named signatures, and six Blobby options. Selection uses gameplay-seeded draws after the first compatibility gag, with no repeats in the last three selections and history capped at twelve. Moments anticipate 350 ms before physical/sound action; start-spacing, spatial deferral, one-generation non-recursive witnesses, and conflict-only fidgets preserve protected input/objective behavior. [test-results/m5-browser-results.json](test-results/m5-browser-results.json) and nine pose-gallery images cover all-map staged art. No full biological planner or learned navigation was introduced.
- **M6 implemented:** deterministic seedpod/fish-flash, non-flooding chop/spray, and firefly/chime/distant-bird rhythms; distinct quiet soundscapes and sky treatments; map-specific completion flourishes; three parallax factors 0.25/0.55/1.0; interference caustics and sun glitter; capped scene-capture refraction plus Blobby sheen/drips. Foliage fronds are cached and their pixels counted. The rendering probe measured 4,954 changed silhouette pixels and zero outside leakage, exact parallax offsets within numerical precision, 4,243,207 scenery pixels, and 8,372 scratch pixels in its fixture. Fallback was nonblank. [test-results/m6-rendering.json](test-results/m6-rendering.json) retains the measurements; event screenshots prove each map's rhythm with zero objective progress and exact pause/inactive-map retention.
- **Performance and degradation:** measured headless render/frame timings have varied substantially and did not establish 60 fps desktop or 30+ fps physical tablet performance. An actual wide-canvas input timeout was repaired by capping the live backing canvas at two million pixels and disabling wide-view refraction, without loosening its original timeout. Refraction also disables on small or reduced-motion views. Caustics/parallax have tested code-level disable paths. Hardware performance and listening remain explicit follow-up measurements, not a claimed PASS.
- **Deliberately not implemented:** moving tides/terrace flooding, additional species, new engine, recording/key retuning, 16-event polyphony, Gerstner coordinate inversion, explicit orbital/Stokes forces, full soft-body self-collision/volume-damping redesign, and every speculative behavior sound in E8. Existing physical toys and ten-resident maps remain; event seedpods/distant birds are decorative, not new interactive bodies. These are the finalized roadmap's deferred or optional candidates, not hidden work marked complete.
- **Regression repairs retained:** wind no longer biases picnic/escape routing; dry material friction is preserved instead of replaced; atmosphere is limited to living-coast mode so legacy isolated physics remains silent at rest; held voice feedback has a separate short cooldown from autonomous calls. Browser measurements now capture palm angle/drop in the same held frame and flush deferred WebKit canvas drawing before `getImageData`, rather than reducing thresholds or claiming false playback.
- **Final gates:** all 109 simulation tests passed before the final held-voice regression test was added; that focused fourteen-test audio suite passes. Full eight-scenario browser and six-case living-world verification are still in progress and must pass before this local delivery is declared done. Publication and hosted verification remain unauthorized.

## Restart Checkpoint (2026-09-09)

**Resumed after the machine restart on 2026-09-09.** All edits remain local and uncommitted in `C:\Git\Blob-Island`; do not repeat migration, old-folder cleanup, or historical release checks. The checkpoint below records both the pause boundary and new verified progress.

- **Goal/acceptance:** finish the authorized M1-M6 scope with per-stage visual evidence, all simulation tests, the full eight-case responsive/input/audio/objective matrix, and all six long-running living-world cases passing against the same final standalone bytes. Preserve the existing game contract and the exclusions above. No commit, push, or deployment without separate authorization.
- **Verified:** M2-M6 have focused tests and desktop/phone stage captures as recorded above. A full 109-test simulation run passed before the last three regression tests were added. The fourteen-test audio suite and the subsequent 31-test comedy/objective/audio slice passed. Individual full desktop, wide-desktop, WebKit-landscape, and native-touch-tablet browser runs passed at intermediate revisions, but the full eight-case matrix has NOT passed on the latest artifact. The six-case living run has NOT passed.
- **Recent rendering fixes:** the live canvas is capped at two million pixels, coarse-pointer devices use at most CSS-pixel resolution, and sustained slow active frames disable refraction first and then caustics. These preserve world/input coordinates. The native-touch tablet's complete workflow passed after the coarse-pointer cap. Performance targets are still not certified.
- **Latest failure:** the full living-world run stopped in Chromium/Lagoon's recovery/expression check. Lumi landed on a floating raft at roughly x=1968, y=456, with water at y=490.5, and was still `returning`/`washed-back` with zero immersion after eight seconds. This was actual failed recovery, not an expression-only failure. Evidence is in [test-results/living-chromium-lagoon-failure.json](test-results/living-chromium-lagoon-failure.json) and its PNG.
- **Recovery edit now unit-verified:** [src/wildlife.js](src/wildlife.js) retains a `waterExit` support id and side for a resident on a raft/log/driftwood, uses that support's moving outer edge as its water-entry target, and clears the retained state when held or back in habitat. All seven tests in [src/transitions.test.js](src/transitions.test.js) passed after restart, including the original eight-second deadline, continuous motion, stable exit side, and relaxed expression. The complete `npm test` run passed **112/112** and `npm run build` rebuilt [index.html](index.html) at approximately 8855.4 KiB with this fix.
- **Living-world progress:** Chromium/Lagoon passed its actual input/recovery sequence and 436,383 ms natural timeline against standalone SHA-256 `df4189b752e6a3c9916445609fdb9c58f3f5d5a37b965de671b34691e52c1141`. Its complete receipt is retained in [test-results/v4-living-chromium-lagoon.json](test-results/v4-living-chromium-lagoon.json). Chromium/Pools has reported a passing 435-second case; Chromium/Sunset is running in the same invocation. Earlier recovery-failure files are retained with the `pre-raft-fix-` prefix under `test-results/`.
- **Next action and owner:** the coding assistant verifies the completed Pools/Sunset receipt against the same artifact, then runs the three WebKit living-world cases and the full eight-scenario responsive/input/audio/objective matrix. Keep the passing Lagoon receipt instead of rerunning unchanged evidence.
- **Forward path:** after the targeted living case passes, complete all six living cases and all eight full browser scenarios. Finish current-artifact desktop/mobile visual and integrated-browser checks, verify local build/evidence byte identity, update this document with actual results, and leave changes uncommitted. Full matrices are still outstanding; prior stage/partial receipts do not substitute for them.
- **Execution custody:** terminals have sometimes reopened in `C:\Tools\pm-copilot`, so set the explicit workspace or use absolute script paths. One-shot commands are synchronous; await real exit/results and preserve failed evidence. Historical or partial `browser-results.json` receipts are not proof of the latest build. No test was started for the pending raft fix at pause.

### Concurrent-Edit Boundary

- While the Pools/Sunset living invocation was running, changes not made by this validation workstream appeared in [src/foraging.js](src/foraging.js) and [tools/browser-test.cjs](tools/browser-test.cjs), including draggable feeding and an `exerciseFeeding` path. The standalone document also changed: its integrated-browser `window.__blobIsland.snapshot()` threw `Cannot read properties of undefined (reading 'snapshot')`. The preview was navigated away to stop it. No concurrent edits were reverted or repaired.
- The user's feeding/positive-reaction request was filed as [issue #1](https://github.com/robinsacek/bekysgame/issues/1), explicitly issue-only. This validation workstream did not implement it. Its implementation now appearing in the shared workspace needs coordination with the owner of those concurrent edits; it is not covered by the earlier 112-test or `df4189...` artifact evidence.
- **Remaining gap:** a stable agreed source/artifact for the final V4 gates, plus the outstanding complete WebKit living and eight-scenario responsive matrices. The already-running test may finish against its loaded artifact; retain its source hash and do not relabel its receipt as proof of newer bytes.
- **Next action/owner:** the owner of the concurrent feeding work finishes or pauses those edits and produces a stable standalone build with a working snapshot. The coding assistant then checks Git status and artifact hash, retains the current living receipt, and validates the agreed build. A working snapshot and explicitly identified artifact hash unblock the remaining tests; any new feeding implementation remains separately owned and must not be silently repaired under the issue-only request.
- **Forward path:** preserve the completed original-artifact receipts, agree on the stable build, run the required simulation/build and complete living/responsive/visual gates for that build, then update this record with actual results. No commit, push, or deployment is authorized. Do not claim the current combined workspace is verified from the earlier artifact's passing results.

## Historical Commit/Release Restart Checkpoint (2026-09-09)

**Paused again at the user's request for a machine restart. This section supersedes the older next-action and authorization notes above.** Do not resume commands until the user returns.

- **Goal/acceptance:** the user requested committing and pushing current V4 work, then a handoff to finish the concurrent feeding session, reconcile both workstreams, validate the combined result, and release. Commit/push is now authorized for a checkpoint. Do not deploy an unfinished mixed build: [the Pages workflow](.github/workflows/pages.yml) automatically deploys pushes to `main`; the chosen checkpoint branch avoids that trigger.
- **Git state at pause:** `C:\Git\Blob-Island` remains on `main`, with all original V4 and concurrent feeding changes present and unstaged. A separate worktree, `C:\Git\Blob-Island-v4-checkpoint`, is on local branch `checkpoint/v4-2026-09-09`. Both HEADs are still `f8ad8a6f8df9cae31a12bfae94df229a07e0d097`. Both indexes are empty. **No implementation commit or push has happened.** No validation command owned by this workstream is still running.
- **Isolation:** 29 candidate V4 files were copied into the checkpoint worktree; feeding-only files/tests were not copied. Its `node_modules` is a junction to the shared installation. The shared checkout was not switched, staged, restored, or rewritten; only this existing design document is being updated with handoff information.
- **Separation completed only in the isolated copy:** removed the concurrent feeding pose/harvest additions from `src/creature-pose.js`, `src/character-details.js`, and `src/forage-art.js`; removed the feeding-only import/snapshot fields from `src/wildlife.js`. Existing V4 gaze, fidgets, comic poses, and wind artwork were retained. The resulting fourteen pose/comedy tests passed. The earlier thirty-test isolated candidate check also passed before these removals, but does not establish that separation is complete.
- **Remaining gap:** the isolated copy still contains feeding additions in other overlapping files and is NOT yet a coherent V4-only checkpoint. Its `index.html` is the parent commit's artifact, not a rebuild of these candidate sources. Do not commit or push this partial copy yet. No new feature work is required in this checkpoint preparation.
- **Next action and owner:** after checking both worktrees for subsequent changes, the coding assistant finishes removal of only feeding-specific hunks in the isolated worktree's `src/foraging.js`, `src/creature-art.js`, `src/scene.js`, `src/game.js`, `src/physics.js`, `src/wildlife.js`, and `tools/browser-test.cjs`. Preserve all V4 code, especially the raft-exit fix and gesture/quality guards. The shared feeding implementation remains owned by its concurrent session and must not be reverted. Run the relevant focused tests immediately after each coherent extraction change.
- **Checkpoint success evidence:** the isolated V4 source runs the full expected 112-test suite and build, with no unresolved feeding imports or test hooks. Compare its built HTML with the original V4 hash `df4189b752e6a3c9916445609fdb9c58f3f5d5a37b965de671b34691e52c1141`. An exact match permits reuse of that artifact's browser evidence; any mismatch must be explained and freshly verified, never relabeled as identical.
- **Completed original-artifact evidence:** all three Chromium living cases passed after the raft fix: Lagoon 436,383 ms, Pools 435,050 ms, Sunset 435,050 ms. Receipts are retained in the shared checkout's ignored `test-results/v4-living-chromium-lagoon.json` and `test-results/v4-living-chromium-pools-sunset.json`, both for the hash above. These do not prove the concurrently rebuilt feeding artifact. The complete current-artifact eight-scenario matrix and all three WebKit living cases remain outstanding.
- **Shortest forward path:** finish and verify the isolated V4 checkpoint; commit explicit V4 paths on `checkpoint/v4-2026-09-09`; push that branch without force and verify its remote commit; leave shared `main` and its dirty worktree intact. After the feeding session finishes, its owner preserves/commits its final work on a non-deploying branch. The reconciliation owner then compares both branches against the shared parent, preserves both intended behaviors in overlapping files, rebuilds instead of merging generated HTML by hand, and runs full simulation, eight responsive/input/audio/objective scenarios, six living cases, and desktop/mobile visual inspection on one identified combined artifact. Only then merge/push the reconciled release to `main`, verify Pages artifact identity and hosted behavior, and record the result.
- **Coordination/stop conditions:** do not merge a dirty shared checkout, force-push, use blanket staging, or let either checkpoint overwrite the other session's files. If the concurrent session has already committed or changed branches by restart, retain its state and adjust integration from the actual commits instead of replaying stale instructions. The user explicitly paused before the checkpoint could be finished; do not mistake branch creation or partial tests for the requested commit/push deliverable.

## Active Checkpoint Handoff (2026-09-09)

**Supersedes the historical paused notes above. V4 local acceptance is complete.** The isolated `C:\Git\Blob-Island-v4-checkpoint` build passes **113/113** simulation tests, all **eight** full responsive/input/audio/objective scenarios, all **six** Chromium/WebKit living-world cases (at least 435 seconds per case), all-map desktop/mobile visual checks, and real integrated-browser controls. A fresh local Pages build exactly matches the standalone HTML: **9,068,314 bytes**, SHA-256 `9e479b6ef5ccfbbdea12f7a0b826022029fd3783728fed55b48495933b420cd4`. This identifies V4 only, NOT the concurrent feeding build in the shared root.

**Committed and pushed:** [8c0223c530e4a873a25ffbf46aec5bfadcc67405](https://github.com/robinsacek/bekysgame/commit/8c0223c530e4a873a25ffbf46aec5bfadcc67405) on `checkpoint/v4-2026-09-09`, following the earlier `2c63323` checkpoint. The remote ref and upstream match; the isolated worktree is clean. Shared `main` remains at `f8ad8a6f8df9cae31a12bfae94df229a07e0d097` with an empty index and its concurrent source preserved. No Pages deployment was triggered. The [committed design handoff](https://github.com/robinsacek/bekysgame/blob/8c0223c530e4a873a25ffbf46aec5bfadcc67405/DESIGN-V4.md) contains full evidence, fixes, integration owners, success gates, and stop conditions. This pinned status is intentionally left as an unstaged documentation update in the shared checkout.

**Local evidence and preview:** [test-results/v4-validated-8c0223c/index.html](test-results/v4-validated-8c0223c/index.html) is an exact playable copy. The adjacent [validation manifest](test-results/v4-validated-8c0223c/test-results/v4-final-validation.json) identifies all eight browser cases, all six living cases, source hashes, and receipt hashes; its companion receipts, publication verification, and final screenshots were copied and byte-verified. Original failures remain in the isolated worktree's ignored `test-results/`. These archives are not tracked branch content; use the committed test tools when receipts are unavailable. Browser emulation does not certify physical-device performance or listening.

**Next owner/action:** the concurrent feeding session finishes and commits/pushes its preserved work on a non-deploying branch. The reconciliation owner then fetches both actual tips, compares their common-base changes (the feeding branch may already contain V4), and combines them in a clean worktree. Never overwrite the combined source with V4-only files, blanket-resolve conflicts, or merge generated HTML by hand. Preserve trait/priority/raft-recovery behavior, consumed-food pointer cleanup, combined face/bubble rendering, and sound budgets. Also carry over the final clearing-bounded picnic targets and regression, bounded adaptive backing-resolution fallback, and grip-offset-aware coast delivery with retained arrival observations from `8c0223c`. No game or test timeouts/objective criteria were loosened.

**Remaining gap and release acceptance:** only the separate feeding reconciliation, combined-build validation, and hosted release remain in the software delivery path. Rebuild the combined source; pass all simulation tests (113 V4 tests plus feeding coverage), all eight full responsive/input/audio/objective cases, all six living-world cases, feeding positives/negative controls, and desktop/mobile visual and integrated inspection on one identified HTML hash. V4's passing isolated receipts do not certify new combined bytes. After these gates pass, merge/push the reconciled release to `main` and verify Pages commit/byte identity plus hosted behavior. `main` auto-deploys; do not push an unfinished mixed build. Stop and coordinate if either owner is still writing integration inputs or a source/receipt hash differs.
