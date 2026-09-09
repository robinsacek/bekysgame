# Blob Island: Living Coastlines

## Intent

Keep the tactile, silly rainbow jelly as the main character. Extend the physics playground into a small living place with discoverable relationships, not a score-driven platformer. Free play remains available immediately, with no countdowns, damage, combat, mandatory quests, or unlock walls.

## Research and Current-Game Findings

The published version was inspected in VS Code's integrated browser using Playwright before implementation. Its world spans exactly one viewport and has no camera, autonomous-creature model, or objective state. Mouse dragging and release remained stable. The current resize handler rebuilds physics to match the screen; that is the controlling boundary to change first.

- Craig Reynolds, [Steering Behaviors for Autonomous Characters](https://www.red3d.com/cwr/steer/): combine arrival, wandering, separation, and containment to make motion purposeful. Apply these ideas to a small local simulation, with explicit habitat bounds and capped speeds.
- Robert Nystrom, [State](https://gameprogrammingpatterns.com/state.html), Game Programming Patterns: represent mutually exclusive activities explicitly and keep transitions understandable. A few timed, prioritized states are sufficient here; a general planning engine is unnecessary.
- MDN, [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events): maintain individual pointer IDs, pointer capture, and cancellation. A moving camera must reproject held screen coordinates into world space every frame. A second finger on the jelly must remain a stretch gesture, not become camera zoom.

Research informs original implementation; no third-party game artwork or source is copied. Matter.js remains the physics engine, and the existing music license and attribution remain intact.

## World and Camera

- Each of the existing three areas has a fixed 3200 by 900 world, independent of device orientation. World bounds are real collision boundaries, framed as rocks or headlands rather than an endless ocean.
- A left palm grove opens into water and a far sandbar. The three areas retain distinct colors, terrain features, toys, and habitat landmarks.
- The jelly starts near the grove, with a useful mix of objects and wildlife visible. Additional interactions and a destination lie beyond the initial viewport.
- Horizontal camera only: soft follow with a dead zone, edge scrolling while holding an object, background drag to look around, keyboard movement, and a find-jelly control. A small overview strip shows the viewport and jelly and supports direct navigation.
- Camera movement never moves the physics world. Resizing only changes the visible extent and rendering buffers; it releases transient touches but preserves object, creature, and objective identities.
- Manual panning temporarily suppresses follow; grabbing the jelly or using find-jelly restores it. Two opposing edge touches do not fight for camera control.
- Cache scenery at a bounded resolution. Draw only visible or cheap dynamic elements and keep the fixed-step simulation independent of rendering.

## Creature Cast

Ten original illustrated characters per area, with seeded choices for reproducible tests. Their apparent free will is simulated local behavior, not sentience or a network AI service.

- Two reef fish swim, regroup, separate to avoid overlap, investigate gentle nearby water motion, and flee fast objects or a swooping bird. They remain in navigable water and recover if moved outside their habitat.
- A hermit crab explores the strand, investigates moved shells, and retreats briefly from a fast jelly. It greets the tortoise when they meet instead of walking straight through it.
- A tortoise wanders, rests, follows nearby player-delivered coconuts, and joins a picnic. It nudges light objects with a physical body and avoids deep water.
- A shorebird alternates perching, short flights, beach foraging, and watching the fish. It visits the tortoise at a picnic; fish react to its approach. No predation, distress penalties, or permanent disappearance.
- A translucent jellyfish alternates visible bell pulses and passive drifting, and responds to the jelly with a slow companion drift. It never stings.
- A reef shark, clearly larger than the other cast, patrols across water depths, investigates Blobby, and occasionally performs a cartoon stalk, lunge, and snap. Nearby residents flee; none are injured or removed.
- An octopus crawls near its rocky den, investigates moved shells, reaches toward nearby toys or the blob, and briefly hides when startled. Eight animated arms follow its movement and reach target.
- A map-specific pair: Mango and Fern the iguanas in Little Lagoon, Aster and Pearl the starfish in Tide Pools, and Clover and Thistle the rabbits in Sunset Cove, with different sizes, routines, voices, and comic events.

Priorities: held/recovery, immediate threat, nearby useful stimulus, social activity, then rest or wander. State durations and cooldowns prevent rapid switching. Small expressions or familiar pictorial intent cues communicate activity without paragraphs of instructions.

## Optional Objectives

Four journal entries per area, all available from the start:

1. **Far-shore wander:** move the jelly into the marked far-shore habitat and settle there. Panning the camera alone never completes it.
2. **Shell corner:** bring two distinct loose shells to the marked crab nook and release them. Require player-handled items and a brief settled dwell; the same shell cannot count twice.
3. **Coconut picnic:** move a coconut to the picnic spot, release it, and allow the tortoise and bird to visit. A simple delivery creates an observable creature-to-creature interaction.
4. **Friends beneath the waves:** guide Blobby underwater and receive curious or playful responses from three different reef species. Count actual nearby interactions after player input, not camera visits or repeated encounters with the same species.

Completion produces a small local flourish and a quiet chime if effects are enabled. The journal records completed entries without blocking play. Progress is per area and lasts for the current session. Reset restores only the active area; switching areas preserves progress and inhabitants. No persistent storage or account is required.

## Presentation and Controls

Preserve the existing Clawpilot UI tokens, icon buttons, typography, original Canvas illustration style, rainbow transparency, and touch target sizes. Add a compact journal toggle, a find-jelly button, and a small coast overview. Panels stay out of the main interaction band. A collapsed journal shows progress but does not cover wildlife or the jelly.

Reef, grove, picnic blanket, crab nook, and far-shore beacon are literal visible landmarks. Habitat vegetation, rock silhouettes, shallow-water details, and subtle depth layers distinguish places. Decorative fish from version 2 are replaced with actual simulated fish.

Music and effects stay optional, independent, and initially off. Avoid idle collision noise from autonomous creatures. Positional sound must be relative to the camera and attenuated outside the visible neighborhood.

## Acceptance Checks

- World dimensions and physics identities remain unchanged after rotation. Camera limits and coordinate round trips hold at both ends, at narrow and wide viewports, and during multi-touch dragging.
- Move the jelly beyond the original screen, reach the far shore, and return. Test background pan, minimap navigation, edge dragging, find-jelly, pointer cancellation, blur, pause, and area switching.
- Every species demonstrates autonomous state changes, stays inside its habitat/world, and responds to stimuli. Verify at least one fish-to-fish and one cross-species interaction using production behavior.
- Objective negative controls: camera-only travel, untouched props, one shell counted twice, and held delivery do not complete objectives. Actual deliveries and visits do complete them once, retain state across map changes, and clear on reset.
- Existing soft-body, buoyancy, tree-impact, toy geometry, audio, and offline requirements remain covered.
- Use integrated-browser Playwright hands-on checks plus automated Chromium/WebKit desktop, tablet, portrait, and small-phone checks. Verify nonblank moving pixels, creature and landmark visibility, no clipped controls, no runtime errors, and actual music playback where supported.
- Publish only after local checks pass. Verify the exact Pages deployment, HTTP 200 and HTML checksum, then exercise the hosted build. Restore the original GitHub CLI account afterward. Physical iPad testing remains a separate unavailable hardware check.

## Implementation Order

1. Fixed world and pure camera model with focused tests.
2. Habitat/landmark geometry and autonomous creature simulation with bounded tests.
3. Action-qualified objective model and completion tests.
4. Original creature art, expanded environments, camera input and navigation, journal, audio integration.
5. Integrated-browser iteration, full required regression checks, documentation, Pages deployment, and live verification.

## Refinement After Browser Review

The user requested richer environments and water, more physical gameplay, active randomized reactions to a nearby blob, and more realistic bird flight while trying the prototype.

- Calm proximity can trigger curiosity, following, a gentle nudge, or play; fast movement triggers a short retreat. Seeded choices and cooldowns prevent jitter. Physical nudges remain small and never override a held jelly.
- Ground residents investigate or nudge handled toys. Fish investigate a slow underwater blob; the octopus can gently move a loose shell; the shark's approach scatters fish without predation.
- Bird flight uses limited acceleration, broad turn waypoints, banking, gliding on cruise, more flapping on ascent, and slower final approaches with extended feet. It can briefly circle a nearby blob without abandoning picnic behavior.
- Add reusable skipping stones, an anchored leaf swing, and a small collidable dock. Fast shallow throws can skip stones; slow drops sink. Reuse the idle-sound protections.
- Give water a visible reef habitat with shaded rock arches, sea grass, sponges, soft caustics, depth bands, bubbles, and a sandy seabed. Use contact shadows and layered vegetation to make the shore more grounded while keeping the jelly easy to see.
- Test proximity reactions, marine containment, fish/shark responses, octopus object interaction, bounded bird acceleration and landing, skipping-stone behavior, and swing anchoring. All original objectives and negative controls remain required.

## Final User Refinements

- Name the main character **Blobby** and derive its moderately translucent rainbow resting silhouette from the logo. Keep squeezing, vertical pulls, three independent material grips, and elastic recovery.
- Raise expedition land and water by 162 world units; deepen the seabed to 864 and widen open swimming water toward a far bank at 86 percent of the fixed 3200-unit coast. Use the previously empty horizon for playable water.
- Blend movement using actual immersion and grounded state. Marine residents fall through air, then acquire swimming control gradually. Birds use limited acceleration, gliding, obstacle-clearing approaches, and a real landing dwell. Individual character voices are nearby, short, and cooldown-limited.
- Add a shallow 2.5D depth band for land inhabitants, reflected in scale, ordering, contact shadows, and pointer projection. Return toward the shared contact plane for object and Blobby interactions; keep core Matter.js manipulation 2D.
- Replace straight beach diagonals with sampled curved profiles shared by drawing and collision geometry. Make map behavior profiles distinct: sociable calm lagoon, cautious rocky pools with a stronger bounded current, and a broad sunset strand with longer rests and glides.
- Misplaced residents react playfully: fish flop, the octopus scrambles, the jellyfish wobbles, land animals paddle, and the bird shakes off water before taking flight. If a resident is stuck outside its habitat, a visible temporary rescue bubble uses smooth bounded steering to return it; no damage, disappearance, or hidden teleport.
- Add checks for recovery from land and water, continuous positions during rescue, curved-shore physics agreement, land-depth movement and picking, per-map behavior differences, and complete browser-playable objectives.

## Final Movement and Presentation Contract

- All foreground beach depth is usable by Blobby, loose props, and land residents. Projected picking, spring targets, draw order, shadows, and collision categories follow the same depth. Static ground remains solid in every depth band. Return smoothly to the water contact plane at the bank; anchored toys remain anchored.
- Wander targets span the usable habitat, mixed with destinations selected from food, toys, habitat features, and neighbors. Trip duration scales with distance, and ordinary greetings cannot repeatedly cancel long journeys. Social curiosity has cooldowns. Currents and separation are followed by smooth habitat containment rather than teleporting residents.
- Physics and scenery share sampled curved banks and 64 uneven seabed segments. Each map has its own sand-ridge profile; sinking toys settle on that profile. Marine spawning, local obstacle clearance, and den placement use the same floor.
- Use a common reference-size and pose transform for bodies and faces. Bird wings and feet blend across flight phases. Land gait and swimming motion use a continuous motion phase. A proportional, tapered shark jaw has shaded interior, gums, and small upper/lower teeth instead of a round black overlay.
- Every species uses a shared thought-bubble layout with recognizable pictograms, an Ewww caption, viewport/HUD clamping, and neighbor avoidance. Rescue bubbles and drying droplets use the actual character dimensions and position.
- Shadows are contact projections, not screen-fixed stripes: follow horizontal location, beach depth, terrain, elevation, and floating water contact. Elevated shadows soften and displace.

## Situational Comedy

Each resident and Blobby draws a fresh baseline between one and seven active-play minutes. Mutual encounters, object interest, a shared picnic, a fright, a shark snap, and returning to habitat feed the participants' comic scheduler. Frequent encounters accumulate a decaying chance bonus and shorten the deadline; successful rolls can trigger an early moment. Completion resets accumulated probability and draws a new baseline.

Per-character observation cooldowns, at least one minute between that character's gags, and a global spacing interval prevent crowd spam. Held, recovering, and objective-busy characters defer due moments. Paused and inactive maps freeze their clocks. Ewww reactions cannot recursively boost the same comic chain, and autonomous Blobby hops never count as player input.

Validate both the baseline range and contextual early triggers, reset/decay behavior, mutual attribution, holding protection, physical droppings and cleanup, and unearned-objective negative controls. Browser timelines run the real animation loop for more than seven simulated minutes in all three maps and both engines; do not substitute shortened production timers.

## Map Specialization and Prompt Recovery

- Little Lagoon uses mangrove roots and sheltered water, a dock, floating timber and seedpod, and a tethered buoy. Its kingfisher, reef fish, and local iguana pair have a calm, sociable profile.
- Tide Pools uses connected, wave-worn shoreline terraces and wet crevices, a stronger bounded current, conches that sink and pumice that floats. Its sandpiper, patterned fish, smaller catshark, rock octopus, and starfish pair have their own sizes and activity patterns. Scattered ellipse pools and trapezoid block colliders were removed after visual feedback; rocky texture follows the actual banks, and the open seabed remains traversable.
- Sunset Cove uses broad dunes, sea grass, longer resting and gliding, driftwood, a seesaw, and separately suspended shell chimes with physical and audible feedback. Its pelican, silvery fish, blacktip shark, and rabbit pair distinguish the cast.
- Recovery starts immediately after release. Select nearby water with enough clearance for the animal, not the center of the deep-water patrol box. Recognize terrain, docks, and props as support. Fish flop across dry support; octopuses crawl; birds gain height and take off; land residents paddle and climb an accessible dock edge before walking away.
- Keep unsupported flight and rescue assistance separate: only a reachable edge gets a climbing phase. Rescue is a clearly visible fallback after six seconds plus observed lack of progress. Preserve continuous positions, gravity in air, immersion blending, held-input priority, and rapid return on open nearby routes.
- Larger cast and toys must not strand objectives. Low contact with Blobby or a loose prop can trigger a depth detour, and the same near-ground condition must be used both to detect and apply it. Return to the shared contact plane for the picnic.

## Feeding and Play

- Every non-predator has replenishing food patches and an observed meal count, not only an activity label. Grass covers multiple beach depths; insects, shore scraps, plankton, algae, and shell beds provide species-specific destinations. The shark retains its bounded prey-pursuit routine without removing named residents.
- Food seeking yields to held input, habitat recovery, nearby player-guided Blobby, and the journal picnic. Birds choose clear feeding spots and return to a perch after a meal. Meal timers and patch replenishment prevent stationary feeding loops.
- Short cross-species tag, bird-fish play, octopus peekaboo, and harmless jellyfish tingles use the existing behavior priorities. Reactions can advance the comic-event baseline, but per-pair and global spacing prevent constant interruption. Grass responds to touch at its projected depth; toy grabs use material-appropriate sounds.
- Map geometry is explicit: Lagoon shore/toe/far-toe/far-shore at 29/40.5/88/93.5 percent; Tide Pools at 31.5/47/83.5/90.5 percent with stepped banks; Sunset Cove at 40.5/55.5/87/91.5 percent. Keep the overview and collision geometry consistent, and preserve usable dry space for the four objectives.

## Navigation Validation

- Bird paths use a bounded visibility graph around expanded obstacle bounds with retained waypoints. Overlapping starts first leave through an outward face. Path failure must not point straight through a solid seat; only movable clutter may be pushed aside by bounded physical input.
- A deep enclosure inside Blobby's collider ring gets a temporary soft-skin slip-out state. A small swimmer enclosed by the float ring gets a temporary depth passage through its center. Test continuous motion, intact bodies, and collision-group restoration after each escape; fixed geometry stays collidable.
- Picnic clearing is a continuous gentle physical action only while an unheld resident approaches blocked food. Never move player-held or anchored props. Keep delivered food, real shared visits, depth, and dwell requirements intact.
- Free-air acceleration excludes current and immediately preceding collision frames. Swing navigation checks actual solid-seat clearance and penetration, not one prescribed altitude. Browser animation uses direct RGB pixel changes between separated active frames, not identical deterministic reset images.
- Final gates include every simulation test, all eight responsive/input scenarios, all six long-running living-world cases, integrated-browser desktop/mobile inspection, exact standalone/Pages byte identity, and hosted verification after the authorized push.