# Blob Island V4: Weather, Character, and Sound

**Status: research and design only. No implementation, no source changes.**

## Intent

V3 delivered a bounded living coast: autonomous residents, curved banks, depth-aware beach, objectives, and a comic scheduler. V4 does not add systems for their own sake. It closes five specific gaps the current build measurably has:

1. The world looks **still**. Cached scenery has no time input, so nothing sways.
2. The world's **water is decorative to the physics**. Waves do not push floating objects, and objects do not disturb the water.
3. Every animal of a species behaves and sounds **identically**, and owns exactly **one** gag.
4. Maps differ mostly by **numbers**, not by atmosphere or event.
5. Sound is **one oscillator per event**, with no material realism, distance, space, or ambience.

Everything proposed stays inside the existing contract: no countdowns, no damage, no unlocks, no third-party assets, no network, single self-contained HTML, effects and music default-off, seeded determinism for anything the tests observe.

---

## Research References

Research informs original implementation. No third-party artwork, audio, or source is copied.

- Craig Reynolds, [Steering Behaviors for Autonomous Characters](https://www.red3d.com/cwr/steer/) — already used for arrival/wander/separation. V4 extends to full **separation + alignment + cohesion** flocking and to lazy soaring circles.
- Nikolaas Tinbergen, *The Study of Instinct* (1951) — the hierarchical model of instinct and **displacement activity**: when two drives conflict or a drive is blocked, an animal performs an irrelevant third action (preening, scratching, pecking at nothing). This is the ethological name for exactly the behaviour the user is asking for, and it gives a principled trigger for small random gags instead of a pure timer.
- Frank Thomas and Ollie Johnston, *The Illusion of Life* (1981) — **anticipation, follow-through, overlapping action, secondary action, staging**. Applied to gag readability: every set-piece gag gets a wind-up frame, an action, and a reaction, and no two gags stage on top of each other.
- Will Wright's motive/need model as popularised by *The Sims* — decaying needs bias action selection. Used to supply the missing **fatigue** and to vary long sessions without a day/night cycle.
- Andy Farnell, *Designing Sound* (MIT Press, 2010) — procedural audio. Two specific models are adopted: **modal synthesis** for material impacts (a bank of exponentially decaying resonances excited by a contact burst), and the **bubble model** for water (a decaying sine with a rising frequency sweep; a splash is a cloud of bubbles plus a noise transient).
- Kevin Karplus and Alex Strong, "Digital Synthesis of Plucked-String and Drum Timbres", *Computer Music Journal* 7(2), 1983 — cheap plucked/struck resonance. Candidate for the shell chimes and the hollow ring.
- MDN, [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — `ConvolverNode` for procedurally generated per-map impulse responses, `DynamicsCompressorNode` for a mix bus, `BiquadFilterNode` for distance-dependent air absorption and an underwater filter.
- Franz Josef Gerstner's trochoidal wave solution (1802), as used for ocean surfaces in graphics — a height field alone gives symmetric sine crests; adding a horizontal displacement term sharpens crests and broadens troughs. The correct minimal upgrade for a side-on 2D sea.
- Ken Perlin, "An Image Synthesizer", *SIGGRAPH* 1985 — value/gradient noise for a coherent wind field shared by visuals, physics, and audio.
- Aerial perspective (atmospheric attenuation) as a classical depth cue: distant objects lose contrast and shift toward the sky/horizon colour. The cheapest large realism gain available in a 2D canvas scene.

---

## Findings: What the Current Build Actually Does

Measured by reading the source, not by assumption.

**Scenery is frozen.** [src/map-art.js](src/map-art.js) and [src/terrain-art.js](src/terrain-art.js) take no `time` argument and are rendered once into an offscreen background cached at `Math.min(scale, 1.25)` in [src/scene.js](src/scene.js#L85). Mangroves, dune grass, rock texture, and distant scenery therefore never move. Only [src/forage-art.js](src/forage-art.js#L5) animates, because forage patches are drawn live.

**No parallax.** The cached background is a single world-width strip blitted at the camera offset, so the far horizon scrolls at exactly the same rate as the sand under Blobby's feet.

**Water is one-way.** [src/physics.js](src/physics.js#L406) runs a spring chain — `velocity += -offset * 0.024 + (left + right - 2 * offset) * 0.14`, `velocity *= 0.957`, `offset` clamped to ±18. Splashes inject into it, but the wave field applies **no force back** to floating bodies, and moving bodies generate **no wake**. Buoyancy is a static Archimedes term (`-mass * 0.001 / density * fraction`) sampled once for circles and five times for rectangles, with linear drag `0.00022 / 0.00026` and a flat 4 % angular damping.

**Current is creature-only.** `ecology.current` (0.0 / 0.20 / 0.065 in [src/maps.js](src/maps.js)) appears in exactly one place, [src/wildlife.js](src/wildlife.js#L525), as a steering bias on swimmers. A floating bottle in Tide Pools does not drift. The README's "stronger current" is therefore true of the animals and not of the water.

**One gag per species.** [src/antics.js](src/antics.js#L3) is a flat `species -> string` map of 11 entries. Mango and Fern are both lizards, so both own `tongue-flick` and nothing else. Every gag lasts 2500 ms, only one may run globally per 1800 ms, and each character redraws a 1–7 minute baseline afterwards.

**Species-level identity only.** Residents differ by `speed`, `width`, `height`, `home`, `appearance`, and a random `phase` ([src/wildlife.js](src/wildlife.js#L71)). There is no temperament, no fatigue, no memory, no per-pair relationship, and no learned avoidance — all reactions are pure time-based cooldowns (`socialAt`, `threatAt`, `playAt`, 15 s per-pair in [src/encounters.js](src/encounters.js)).

**Maps are numeric variants.** All three share `ground ≈ 0.70`, the same ten-role roster, the same objectives, the same drawing routines, the same weather (none), the same wave constants, the same music, and the same sound palette. `rocks: []` on all three. Genuine differences are coast percentages, `warmth` (0 / 0.04 / 0.30), seabed `relief`/`phase` (34/0.4, 46/1.8, 38/3.1 in [src/coast.js](src/coast.js#L5)), palm size, toy list, and one `feature` each.

**Audio is 18 one-shot voices.** [src/audio.js](src/audio.js#L126) is a single oscillator (or one band-passed noise burst) per event, from a 17-entry palette plus 4 noise cases. Panning is `±0.8` with **no distance attenuation**. There is no reverb, no compressor, no submerged filter, no doppler. Ambience is one constant white-noise bed at gain 0.035. Voices are per-species, so Fin and Pip are byte-identical. The polyphony cap is 8 and excess events are silently dropped. Impact speed changes gain only — never timbre, never pitch. There are no footsteps, wingbeats, rolls, scrapes, swash, wind, eating, or breathing sounds at all.

**Sizes for cost estimation.** `wildlife.js` 616, `physics.js` 466, `scene.js` 401, `creature-art.js` 325, `game.js` 290, `sprites.js` 214, `encounters.js` 192, `map-art.js` 176, `audio.js` 171, `antics.js` 130, `maps.js` 68, `depth-space.js` 14, `shadows.js` 11.

---

## Part A — Visual Realism

### A1. Parallax and aerial perspective

Split the single cached background into three strips with independent scroll factors: **far** (sky, horizon, distant headlands) at 0.25, **mid** (treeline, far bank, distant rock) at 0.55, **near** (beach, vegetation, banks) at 1.00. Composite a horizon-coloured veil over far and mid with alpha 0.22 and 0.09, tinted by `map.warmth`, so distance reads as lost contrast rather than as smaller shapes.

Memory: three strips at 3200 world units and cache scale 1.25 is roughly 1.6× the current background budget. Cap total offscreen area and drop the far strip to 0.75 cache scale, where its low contrast hides the softness.

### A2. Wind as one shared field

A single scalar per frame, `wind(t) = base + gust`, where `base` is per-map and `gust` is two summed low-frequency noise octaves. Publish it on the island so **visuals, physics, and audio read the same number**. Consumers: palm fronds, dune and sea grass, mangrove leaves, seagrass underwater (phase-lagged and attenuated), bird drift, swing and chime excitation, ripple amplitude, and the ambience filter. This single value fixes the frozen-scenery problem at low cost, because vegetation only needs to move to a shared phase.

Vegetation must therefore move from the cached strip into a lightweight animated pass, or the cached strip must store stems separately from a per-frame sway transform. Prefer the second: cache the trunk/mass, redraw only the sway-affected tips.

### A3. Water surface

- **Trochoidal crests.** Keep the spring chain as the height field, then apply a shared horizontal skew `x -= amplitude * sin(k * x + phase) * steepness` in `surfaceAt` and in the drawing path, so crests sharpen and troughs broaden. Drawing and collision must consume the identical function — this is already the project's rule for banks and seabed.
- **Swash and wet sand.** Maintain a per-x shoreline array. Each frame, the local wave height determines the run-up limit; foam is drawn as a stippled band between the still line and the run-up limit, with a lag so it visibly retreats. Wet sand darkens by 0.18 and dries back over about 4 s. This is the single strongest "real beach" cue available.
- **Refraction of submerged content.** When drawing anything below the surface, offset it horizontally by `A * sin(k * y + ωt) * immersion` and tint it toward the deep-water colour with depth. Cheap per-sprite, and it makes the water read as a medium rather than a blue fill.
- **Caustics.** Replace the 28 hand-placed ellipses in [src/scene.js](src/scene.js#L291) with a two-layer sinusoidal interference field clipped to the water polygon, brightest on the seabed and near the surface, faded in mid-water. Add three or four slow additive light shafts aligned to the sun azimuth.
- **Sun glitter.** A specular sparkle line on wave crests along the sun's azimuth, densest where the surface normal faces the sun. Reads immediately as a lit sea, especially at Sunset Cove.

### A4. Light, shadow, and grading

Derive a **sun azimuth and elevation from `map.warmth`** and use it everywhere instead of the current hardcoded rightward shadow offset in [src/shadows.js](src/shadows.js#L1). Shadows then lengthen and swing per map — long and raking at Sunset Cove, short and high at Little Lagoon.

Upgrade contact shadows from one hard ellipse to two: a wide low-alpha penumbra whose radius grows with elevation, plus a tighter darker core whose alpha falls faster. Add a final per-map colour-grade pass (a single low-alpha overlay plus a slight saturation shift) so foreground creatures inherit the map's light instead of staying neutral under a warm sky.

Add a rim-light term on creatures and Blobby, sampled from the sun azimuth, at alpha ~0.12.

### A5. Blobby

Blobby is the character; it deserves the most expensive effect in the scene.

- **True refraction.** The background is already an offscreen image. Clip to the blob silhouette, redraw the background strip inside it scaled ~1.06 about the blob centre and offset by the local surface normal, then composite the existing rainbow gradient over it at reduced alpha. Blobby stops being a coloured shape sitting on the world and starts transmitting it.
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

Three additions to [src/physics.js](src/physics.js), all small:

1. **Orbital wave force.** For each submerged body, add a vertical force from the local wave vertical velocity plus a small horizontal Stokes drift, both scaled by immersion and attenuated with depth below the surface. Rafts, bottles, pumice, and the buoy then genuinely bob and creep with the swell instead of floating on a flat line.
2. **Wake injection.** `wave.velocity += k * horizontalSpeed * immersion` at the body's wave index, spread over ±1 neighbours. Every swimming animal and every thrown object then makes its own ripples, and the existing splash path becomes a special case rather than the only coupling.
3. **Current field.** Make `ecology.current` real: `current(x, y) = ecology.current * surfaceProfile(depth) * gust(t)`, applied as a force to submerged props and Blobby, strongest near the surface, near zero at the seabed, faster in the channel between the banks. Tide Pools then *feels* like Tide Pools.

Also: sample **circle buoyancy at three points instead of one** and apply each at its sample point, so a half-submerged log develops a righting moment and floats level.

### B2. Materials and contact

- **Velocity-dependent restitution**, `e = e0 / (1 + c * |v|)`, so nothing bounces unrealistically off a fast impact.
- **Rolling resistance** on round bodies proportional to angular velocity while in contact, so a ball on sand eventually stops.
- **Wet/dry substrate.** The shoreline wetness array from A3 also raises friction from 0.72 to ~0.80 on wet sand. Free, since the array already exists for drawing.
- **Trails, not deformation.** Footprints, drag marks, and Blobby's slide marks are drawn into a decaying per-x overlay and are **not** collidable. This gives the appearance of sand memory without destabilising the static terrain mesh.

### B3. Tide

A slow sinusoid on the water level, roughly ±9 world units over a ~7-minute period, sourced from `surfaceAt` so drawing, collision, habitat bounds, forage patches, and landmarks all agree. It gives the world a sense of elapsed time without a day/night cycle, and at Tide Pools it visibly exposes and floods the lowest terrace.

**Risk to flag before building:** the tide moves the shoreline, which touches habitat containment, the shell nook, the picnic clearing, and the reef objective. Amplitude must be small, must be clamped so no objective landmark can ever be submerged or stranded, and the objective negative controls must be re-run at both tide extremes.

### B4. Blobby's soft body

[src/blobby-shape.js](src/blobby-shape.js) plus the 84-constraint network in [src/physics.js](src/physics.js#L94) is already good. Three refinements:

- A **surface-tension term** along the ring tangent proportional to local curvature, so extreme stretching stays smooth instead of faceted.
- A **volume-damping term** to stop the pressure model pumping when squeezed and released rapidly.
- **Cheap self-collision** between non-adjacent ring particles closer than half their rest distance, so a hard fold cannot pass through itself.

### B5. Needs, memory, and personality

This is what makes animals read as individuals rather than as state machines.

- **Personality vector** per named character, seeded from its id and stored beside its other data: `{ bold, curious, tidy, greedy, clumsy, chatty, vain }` in [0, 1]. It scales startle threshold, approach distance, rest duration, gait amplitude, gag weights, and voice pitch. Mango and Fern stop being clones.
- **Needs**: `hunger`, `energy`, `social`, `curiosity`, each decaying and replenished by the corresponding activity. Action selection biases toward the highest unmet need. The existing hard priority ladder (held → threat → recovery → objective) stays on top and unchanged. This finally supplies **fatigue**: a resident that has just fled or played is slower and rests longer.
- **Pair affinity**: a per-pair scalar raised by play, greetings, and shared meals, lowered by frights. It drives who initiates, how close they approach, and greeting frequency. Fin and Pip develop a visibly closer bond than Fin and a passing bird.
- **Startle memory**: a decaying "avoid this spot" marker for ~30 s after a fright, so a character does not immediately walk back into whatever scared it. Learned avoidance, cheaply.
- **Attention**: characters track the nearest moving thing with eyes, eye stalks, or ears, and shy characters freeze when Blobby is held still nearby. Being noticed is a strong life cue.

### B6. Locomotion and flocking

- Full Reynolds **separation, alignment, cohesion** for fish so more than two can form a school with real formation, replacing the current hardcoded two-fish pairing.
- Lazy soaring circles for birds, coupled to the wind field.
- Gait detail: crab leg-phase offsets and a true sidle, tortoise diagonal-sequence walk, rabbit hop with an anticipation crouch and landing squash, lizard lateral undulation, bird landing flare with a tail fan. Every jump and hop gets an anticipation frame — this is the Thomas and Johnston principle applied where the current build jumps instantly.

---

## Part C — Comic Behaviour: From 11 Gags to a Repertoire

### C1. Two tiers instead of one

The current single tier (2500 ms, globally spaced 1800 ms, once per character per minute or more) is correctly tuned to avoid spam, but it means very little happens. Split it:

**Fidgets** — 400–900 ms, ambient, no global lock, per-character cooldown ~12 s. Ethologically these are **displacement activities** in Tinbergen's sense, and they fire on drive conflict rather than on a timer: hungry but blocked, wants to greet but startled, wants to rest but crowded. Examples: preening, scratching, shaking off, shell-polishing, sand-digging, ear-flick, eye-stalk swivel, stretch, sniff, yawn, shiver, tail-flick, wing-settle, fin-fan, bubble-blip.

**Moments** — the existing 2500 ms set pieces, globally spaced, keeping the current baseline/bonus/decay scheduler in [src/antics.js](src/antics.js#L26) unchanged.

Fidgets carry most of the perceived randomness and liveliness; moments stay rare enough to stay funny.

### C2. Per-character repertoire

Replace `MOMENTS: species -> string` with `REPERTOIRE: species -> gagId[]` of 4–6 entries, plus 2–3 **signature gags owned by a named individual**. Target roughly 40–48 distinct gags across the cast.

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

Each map should differ across five axes, not one. Today it differs on numbers.

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
- **Tide Pools:** short chop, low damping, plus a **set wave every ~40 s** that floods the lowest terrace, refills the pools, and makes residents scramble. Highest current.
- **Sunset Cove:** long-period swell, moderate amplitude, wide swash on a steep berm.

### D3. Shoreline and vegetation art

Real per-map drawing routines rather than shared routines with a tint: mangrove prop-root arches with collision pockets at the Lagoon; basalt columns with hexagonal jointing and tide-height-keyed barnacle and algae bands at Tide Pools; a steep berm with wind ripple marks in the sand and a bending dune-grass line at Sunset Cove.

### D4. A signature event per map

Each map gets one thing that happens **only there**, so returning to a map is rewarded:

- **Lagoon:** a school of bait fish flashes past; the mangrove drops floating seedpods.
- **Tide Pools:** the set wave (D2), with its own audible approach.
- **Sunset Cove:** the light drops, fireflies appear, a gust runs the chimes, and a distant flight of birds crosses the horizon.

### D5. Roster and toys

Give each map one **map-only species** so rosters are not structurally identical — a mudskipper at the Lagoon, an urchin or limpet at Tide Pools, a ghost crab at Sunset Cove — and at least two kind-unique toys per map beyond the current lists.

Objectives stay the same four everywhere, but landmark art, thought pictograms, and the completion flourish become map-specific.

---

## Part E — Audio

The largest single quality gain available, and it needs no assets.

### E1. Mix bus

Insert a `DynamicsCompressorNode` before the destination. Raise polyphony from 8 to 16 with **priority-based stealing** (steal the oldest and quietest; never steal an achievement or a voice) instead of the current silent drop, which is what makes busy moments sound broken. Add a sidechain duck on ambience when a voice or achievement plays.

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

Replace the single `splash` with a family, per Farnell:

- **Droplet** — a short sine with a rising frequency sweep (the bubble model). Individually convincing, and a splash is a cloud of these.
- **Entry** — noise transient plus a bubble cloud whose density scales with impact energy.
- **Spray sheet** — for fast, shallow entries; pairs with the visual spray from A6.
- **Swash** — shoreline wash driven by the actual run-up array from A3, so the beach is audible and synchronised to what is drawn.
- **Submerged filter** — when Blobby is underwater, lowpass the whole effects bus to roughly 700 Hz and raise the reverb send. About ten lines, and it transforms the underwater objective.

Drive the surf bed's amplitude and brightness from the **real wave energy in the physics chain** rather than the current constant 0.035 gain, so a big splash is audibly heard in the sea itself.

### E5. Space

- **Distance attenuation** — `gain ∝ 1 / (1 + distance / d0)`, plus a lowpass whose cutoff falls with distance (air absorption). Currently there is none; a far-off event is as loud as a near one.
- **Reverb** — a `ConvolverNode` per map with a **procedurally generated impulse**: decaying noise shaped by a per-map filter. Lagoon short and damp (~0.6 s, mangrove-close); Tide Pools brighter with distinct early rock reflections (~1.1 s); Sunset Cove a long soft open-dune tail (~1.8 s). No assets, ~15 lines.
- Wet/dry send per family: voices and impacts wetter, UI feedback dry.

### E6. Voices: per character, not per species

Layer a **timbre offset** on top of each species template, derived from the character's size and personality:

- `pitch` — semitone offset, roughly `f ∝ size^(−0.4)`, so Mango is lower than Fern and Sail lower than Piper.
- `formant` — filter centre, giving each individual a vowel colour.
- `rasp` — noise blend into the tone.
- `wobble` — vibrato depth and rate.
- `phrase` — one to three syllables with a per-character contour.

Then add **prosody by behaviour**, which is entirely missing today — the same animal currently sounds identical whether delighted or terrified:

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

Every one of these is currently silent: footsteps and scuttles keyed to gait phase and substrate (sand, rock, dock wood), wingbeats scaled by wing lift, fish and shark tail swishes, the jellyfish pulse, the octopus jet, the rabbit hop thump, the tortoise shell scrape, crab claw clicks, grass rustle by depth, eating and nibbling, sniffing, breathing, the two-part sneeze (inhale then burst), hiccups, the binky thump and squeak, the cartwheel whoosh, the ink-puff bubbly rush, the dropping splat, the shark's jaw clack plus water displacement, and the rescue bubble's glassy shimmer.

Every new sound reuses the existing idle-suppression discipline: per-kind cooldowns, distance gating, and no sound from autonomous collisions between residents.

### E9. Musical coherence

Pin all pitched non-voice sounds — chime, bell, achievement, journal — to a per-map pentatonic set so the shell chimes and the completion chime never clash with the bundled "Carefree" recording. **Open item:** the recording's key must be measured before choosing roots; do not assume it.

---

## Constraints and Budgets

- **Self-contained.** Everything above is procedural. No new binary assets, no CDN, no network. The 9 MB bundle grows only by source.
- **Performance.** Target 60 fps desktop, 30+ fps tablet. The expensive items are Blobby's refraction (one clipped background redraw), three parallax strips (~1.6× background memory), caustics, and 16-voice audio. Each needs a measured frame-time budget and a documented degradation path — drop refraction first, then caustics, then the far parallax strip.
- **Determinism.** Anything a test observes — gag selection, fidget triggers, personality vectors, weather events, map events — must draw from the seeded `wildlife.random()`. Audio dither and particle jitter may stay unseeded because tests do not assert on them.
- **Audio support matrix unchanged.** Windows Playwright WebKit exposes no Web Audio API, so every audio assertion remains a Chromium check with an explicit WebKit disabled-fallback assertion. This is an engine/emulation check, not physical iPad testing.
- **Defaults unchanged.** Effects and music start off and require a user gesture. Pausing, hiding, and blurring still suspend everything.
- **No regression to the V3 contract.** No countdowns, damage, unlocks, persistence, tracking, or removal of residents.

---

## Acceptance Checks

Each area needs positive checks **and** negative controls, following the V3 convention.

**Visual**
- Parallax: far, mid, and near strips move at measurably different rates for the same camera delta; the near strip still matches world coordinates exactly.
- Wind: one shared scalar; vegetation, bird drift, chime excitation, and ambience gain all read the same frame value. With wind forced to zero, all four are static.
- Water: `surfaceAt` and the drawn surface agree at every sampled x under trochoidal skew. Swash run-up, foam extent, and the wet-sand array agree with the same wave field. Wet sand dries within the stated window.
- Shadows follow the per-map sun azimuth; Sunset Cove shadows are measurably longer and differently angled than Lagoon shadows.
- Blobby's refraction never leaks outside the silhouette and degrades cleanly when disabled.

**Physics**
- A floating raft measurably rises and falls with the swell and drifts with the current; with `ecology.current = 0` it does not drift. Lagoon (0.0) and Tide Pools (0.20) produce measurably different drift for identical props.
- A moving body generates wake in the wave chain; a stationary body does not.
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
- Each map has at least one species and two toy kinds the others do not.
- Tide Pools' set wave arrives on schedule, floods the lowest terrace, and produces a resident reaction.

**Audio**
- Impact timbre changes with speed and mass, not only gain: two impacts of equal gain but different speed produce different spectra.
- Rolling and scraping produce continuous sound that stops when motion stops.
- Distance attenuation and air absorption are measurable across the world width.
- The submerged filter engages and releases with Blobby's immersion.
- Every character's voice is distinguishable from its same-species partner; every listed behaviour sound fires at least once in a long run.
- Voice stealing never drops an achievement; the mix never clips under a worst-case burst.
- WebKit still reports the disabled-audio fallback and never claims playback.

**Regression**
- All existing simulation tests, all eight responsive/input scenarios, all six long-running living-world cases, integrated-browser desktop and mobile inspection, exact standalone/Pages byte identity, and hosted verification after an authorised push.

---

## Implementation Order

Ordered so that each stage is independently shippable and testable, and so the shared primitives land before their consumers.

1. **Shared primitives.** Wind field, sun azimuth, per-x shoreline wetness/run-up array, seeded personality vectors. Small, and four later stages depend on them.
2. **Audio foundation.** Mix bus, compressor, 16-voice priority stealing, distance attenuation, per-map convolution reverb, submerged filter. Highest quality-per-line in the project.
3. **Modal materials and contact sounds.** Material bank, speed/mass mapping, rolling and scraping, the water sound family, wave-energy-driven surf bed.
4. **Two-way water physics.** Orbital force, wake injection, current field, three-point circle buoyancy. Then the tide, behind its own flag until the objective controls pass at both extremes.
5. **Visual water and light.** Trochoidal crests, swash and wet sand, refraction of submerged content, caustics, glitter, sun-driven shadows, per-map grading.
6. **Parallax and animated vegetation.** Three strips, aerial perspective, sway driven by the stage-1 wind field.
7. **Behaviour depth.** Needs and fatigue, pair affinity, startle memory, attention, flocking, gait detail and anticipation.
8. **Comic repertoire.** Fidget tier, per-character repertoire and signatures, staging and escalation, per-character voice offsets and behavioural prosody.
9. **Map identity.** Per-map wave spectra, sky treatments, ambience beds, shoreline art, map-only species and toys, signature events.
10. **Blobby polish.** Refraction, subsurface scattering, surface tension, self-collision, fidget set.
11. **Full regression, integrated-browser iteration, documentation, deployment, hosted verification.**

Stages 2 and 3 are recommended first regardless of what else is taken, because sound is currently the furthest behind and the cheapest to fix.

---

## Open Questions for the User

1. **Scope.** All eleven stages, or a first slice? The strongest small slice is stages 1–3 plus 5 — sound and water — which changes the felt quality of the game more than anything else on the list.
2. **Tide.** It is the only proposal that can disturb existing objectives. Include it, or defer it?
3. **Gag count.** The target of 40–48 gags is roughly 4× the current set and is the bulk of the art and animation work. Is that the right ambition, or should signatures be limited to the six named pairs?
4. **New species.** Adding one map-only species per map is the clearest way to differentiate rosters, but it is three new characters with art, behaviour, voice, and tests. Worth it?
5. **Music key.** E9 needs the bundled recording's key measured before pentatonic roots are chosen. Acceptable to measure it, or keep the chimes key-neutral?
