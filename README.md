# Blob Island

A small translucent rainbow character named **Blobby**, exploring three living tropical coastlines. A touch-friendly physics playground with elastic stretching, autonomous residents, deep water, optional objectives, and situational comedy. No countdown, damage, losing, or unlocks.

## Living Coastlines

- Each map is a bounded 3200 by 900 world, wider than a screen, with a real far shore, curved banks, uneven physical seabed, textured sand, reef gardens, and map-specific vegetation and lighting.
- Blobby's resting silhouette matches the logo. Two or three independent grips stretch, squeeze, and reshape its moderately translucent body. Releasing restores elasticity; it cannot tear.
- A broad foreground beach is usable space: Blobby, loose toys, and land residents can move into it, with depth-aware picking, collisions, ordering, and moving contact shadows. Airborne and floating bodies cast height- or water-relative shadows.
- Ten residents per area: two fish, a crab, tortoise, shorebird, jellyfish, shark, and octopus, plus a local pair of iguanas, starfish, or rabbits. Map-specific bird, fish, and marine variants have different markings, proportions, names, and movement profiles.
- Residents mix broad wandering with purposeful approaches to food, toys, habitats, neighbors, and Blobby. Longer journeys can finish without constant social interruption. Fish school; birds bank, flap, glide, and land; misplaced residents visibly react and return toward an appropriate habitat.
- Every species eats renewable food that can also be harvested and carried by the player. Residents approach, nibble, chew, gulp, peck or filter with species-specific mouth motion, then show a larger heart and a satisfied smile before returning to other activities.
- Residents play short games of tag, birds tease fish, and octopuses play peekaboo. A close jellyfish encounter can produce a brief comic tingle and retreat. Play respects grabs, recovery, and the picnic; there is no health loss, injury, or removal of residents.
- The shark occasionally stalks and lunges while nearby aquatic residents flee. Its animated jaw has a tapered mouth, gums, and small teeth. Nobody is injured or removed.
- Each character draws a fresh comic-event baseline of 1-7 active-play minutes. Greetings, play, shared meals, escapes, and habitat returns raise a decaying probability bonus and advance that deadline. A completed gag resets the bonus and draws a new baseline. Per-character and global cooldowns prevent repeated-trigger spam; held, recovering, or objective-busy residents defer their event.
- Gags include bubbles, hiccups, a claw dance, sneezing, yawning, an ink puff, a tongue flick, a rabbit binky, a starfish cartwheel, and an occasional physical bird dropping. Nearby residents can flee with an **Ewww!** reaction. Bubbles use crowd-aware placement and stay clear of the HUD.
- Four optional journal objectives: reach the far-shore lookout with Blobby, deliver two different shells to Pebble, arrange a coconut picnic for Moss and Skipper, and earn curious responses from three reef species with player-guided underwater Blobby. Camera travel and untouched items do not earn progress.
- Original tactile toys remain: shake the rooted palm or crash into it to release its three physical coconuts; move balls, rafts, bottles, crates, a hollow ring, shells, skipping stones, a suspended leaf swing, and Sunset Cove's hinged seesaw.
- Area state and journal progress last for the current session. Inactive maps freeze; switching back preserves identities and activity. Reset affects only the active area. Reload starts fresh.

## Three Habitats

- **Little Lagoon:** sheltered mangroves, a dock, calm water, floating timber, a seedpod, and a physically moored buoy. Mango and Fern explore the beach; a kingfisher and brightly marked reef fish watch and investigate the water.
- **Tide Pools:** wave-worn rock along connected shoreline terraces, wet crevices, pebble beds, more current, sinking conches, and floating pumice. Aster and Pearl graze along the uneven bottom; Piper the sandpiper, a patterned catshark, and a rock-colored octopus favor the rocky habitat. No scattered circular pools or artificial block obstacles.
- **Sunset Cove:** broad grass-covered dunes, warm low light, driftwood, a working seesaw, and three separately suspended chimes that sound when swung. Clover and Thistle graze and hop; Sail the pelican glides higher over silvery fish and a larger blacktip shark.

The physical layouts differ too: Lagoon has the broadest open-water basin, Tide Pools has stepped shallows and intermediate land coverage, and Sunset Cove has the widest dry beach and a smaller basin. Both bank positions are map-specific. Drawing, the overview, habitat limits, and collisions use the same floor profile.

All areas retain the four optional objectives and shared essentials, but differ in terrain, usable beach depth, current, rest and flight behavior, resident variants, and physical discoveries. Decorative distant scenery and rock crevices are not additional collision platforms; Tide Pools' usable terraces are part of the shared shoreline geometry.

## Feeding

- Pull grass tufts for tortoises and rabbits, and carrots from Sunset Cove's dunes for Clover and Thistle.
- Catch a small fly swarm for Mango, Fern, or Piper. Each swarm is one draggable food portion; the iguanas use a tongue-catching action.
- Pluck underwater seaweed for fish and starfish. Fish also nibble collectible plankton clouds; jellyfish pulse and filter those clouds.
- Gather strand scraps for Pebble or edible reef shellfish for octopuses and starfish. The journal's delivery shells are separate, inedible toys.
- Catch unnamed bait fish for sharks and the Lagoon/Cove birds. Bait fish are renewable food, never one of the ten named residents.

Hold compatible food calmly near an unheld resident's face at the same beach depth and in its suitable habitat, or release it nearby. A meal needs a continuous short bite, not a fast pass. Held animals, fright, recovery and objective visits retain priority. A completed meal updates hunger, produces one larger heart for about two active seconds, and a happier face for about five; distress overrides that expression immediately. Both player-assisted and autonomous meals use the same rules.

Sources visibly deplete and regrow, normally 16-32 active seconds after their portion is eaten or recycled. Each source owns at most one active portion and each map at most 24 food bodies. Abandoned portions recycle after a minute; stranded portions recycle after eight seconds. Held food stays under player control. Consuming held food releases only its own grips and never turns that gesture into a pan. Pause, hidden pages and inactive maps freeze feeding and reaction timers; reset clears the current map. Feeding alone never completes a journal objective.

## Version 4: Weather, Character, and Sound

- Shared seeded wind moves foliage and grass, influences unobstructed bird flight and suspended toys, and shapes quiet map ambience. Sun direction controls layered contact shadows and subtle highlights. Three bounded parallax layers separate sky, distant scenery, and the playable coast.
- Existing wave-sampled buoyancy now has shared depth-dependent current, symmetric movement wakes, and sheltered Lagoon, choppy Pools, and long-period Sunset swell. Shoreline foam, drying wet sand, fading drag marks, and bounded impact particles share the physical surface. Water level stays fixed.
- Residents have stable individual traits, bounded energy/needs, decaying pair affinity, thirty-second fright-location memory, and attention cues. Ordinary movement and rests reflect fatigue; held input, recovery, and objective visits retain priority. Fish align and cohere as well as separate, and rabbit hops have an anticipation crouch.
- Every species has four contextual comic options, with eight additional named signatures and a six-action Blobby repertoire. A three-draw non-repetition history, anticipation before action, spatial staging, and non-recursive witness reactions keep comedy readable. Short fidgets require drive conflict and have their own bounded cooldowns.
- Little Lagoon has a seedpod-drift and fish-flash rhythm; Tide Pools has a non-flooding chop/spray set; Sunset Cove has fireflies, a chime gust, and distant birds. These are decorative environmental events, not new catchable residents or additional colliders. Existing inhabitants and physical toys remain.
- Material impacts use mass- and speed-dependent resonance; rolling/scraping loops require real player-handled contacts and stop at rest. Splash bubbles, individual/state-shaped voices, quiet gait/feeding sounds, camera-distance mixing, short procedural map reverbs, and an underwater effects filter remain separate from music. Both controls start off, and pause/inactivity interrupts sound ownership correctly.
- Blobby transmits a small pre-character scene capture inside its silhouette where the rendering budget allows, with a wet sheen and drips. Refraction is disabled on small/wide or reduced-motion views; all fallback paths retain the rainbow character. This is a stylized approximation, not a physical optical or fluid solver.

The prioritized scope and verification record are in [DESIGN-V4.md](DESIGN-V4.md). Moving tides, additional species, engine replacement, and experimental soft-mesh self-collision remain deferred. The live canvas is capped at two million pixels; scenery caches stay below 4.5 million and refraction scratch below 512 by 512. Version 4.0.0 combines the weather, character and sound update with renewable feeding and natural eating expressions. Desktop/tablet frame-rate targets still require representative physical-device measurements; browser emulation is not a hardware certification.

## Play

The GitHub Pages destination is **https://robinsacek.github.io/bekysgame/**.

The complete game is also contained in [index.html](index.html), approximately 9 MB including the full music recording. Open that file directly on a laptop, or serve it from any static HTTPS host for iPad Safari. Playing needs no installation, CDN, account, backend, or additional assets. The hosted document needs an initial connection; it does not install an offline service worker.

- Grab Blobby, a loose object, or a resident with a finger, mouse, or pen. Move it and let go to throw it.
- Drag directly from a visible food source to harvest a portion. Offer it calmly near a compatible resident, or release it nearby; residents also feed themselves without help.
- Use two or three fingers to reshape Blobby. A single grip can carry Blobby or a loose object down across the foreground beach; lifting brings it back toward the main contact plane.
- Drag empty scenery to pan, use the coast overview or journal location pins, or carry an object near the screen edge to travel. Find Blobby returns the camera.
- Stir water for ripples. Throw a stone quickly at a shallow angle to skip it; a slow drop sinks. Put weight on one side of the seesaw or pull the swing.
- The journal's four objectives are optional. Its location pins locate the lookout, shell corner, picnic clearing, and reef garden. Hold Blobby calmly near different underwater species to make friends.
- Use the area selector to visit each map. The reset button restores only the current area, including its coconuts.
- The toolbar controls music, sound effects, pause, reset, and full screen where supported. Both audio controls start off and are unlocked by a user gesture.
- Pausing, hiding the page, or leaving it suspends audio. Switching areas does not restart the music. Muting effects does not mute music.
- Arrow keys move Blobby. F finds Blobby, Space pauses, R resets the current area, and M toggles effects.

Landscape and portrait layouts are supported. Rotation preserves the scene's positions and releases active grabs. Use a current version of Safari, Chrome, Edge, or Firefox; iPadOS can open the Pages URL in Safari or add it to the Home Screen.

## Physics

Matter.js drives fixed-step gravity, collisions, friction, inertia, elastic constraints, and touch springs. Blobby is a 24-point soft mesh with area-supporting pressure. Multiple grips soften the links; release smoothly restores spring strength. The palm is a compound collidable trunk with an anchored root and detachable fruit. The hollow ring, hinged seesaw, swing, banks, and uneven seabed have physical geometry.

Buoyancy and drag depend on immersion. Misplaced residents react immediately and aim for the nearest suitable water or shore instead of a distant spawn. Fish flop, octopuses crawl, birds take off, and land residents paddle and climb reachable edges. Open nearby routes are checked for return within twelve active seconds. A visible rescue bubble remains a continuous-motion fallback after at least six seconds and measured lack of progress. Soft-bodied marine recovery includes a playful wash-back assist; it is not a claim that jellyfish can walk on land. The water has damped traveling waves. Wildlife uses seeded steering and prioritized states, not a network AI or a biological simulator.

This is a stylized **2D physics world with shallow 2.5D beach depth**, not full 3D or a fluid solver. Depth collision bands keep separate foreground objects from blocking distant ones while retaining terrain contact. Foreground depth transitions back toward zero at the water's edge. Background vegetation and distant scenery are decorative even when animated; the listed physical toys and residents are interactive.

Bird navigation retains collision-clear waypoints instead of repeatedly choosing a new escape direction. If movable clutter closes a route, a bird can gently push it aside while fixed obstacles remain solid. A bird enclosed by Blobby's soft mesh can briefly slip out; small swimmers enclosed by the float ring can pass through its open center in depth. These narrowly scoped escape states restore normal collisions when clear and never teleport bodies.

All scenery, object artwork, and sound effects are generated locally. Music is bundled as an embedded recording. There is no analytics, tracking, or saved personal data. Dependency and music notices are retained inside the standalone HTML.

## Music

"Carefree" by Kevin MacLeod (incompetech.com), licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). [Original track and license statement](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037).

The recording is included unedited, played quietly, and repeated at the end. The game displays the artist credit and license link. See [assets/MUSIC-LICENSE.md](assets/MUSIC-LICENSE.md) for attribution and the source. Music and effects require Web Audio; music additionally requires MP3 support. Unsupported controls are disabled rather than pretending to play.

## Develop

Node.js 20 or newer is needed only to edit or rebuild the game.

```sh
npm ci
npm test
npm run build
```

Edit the modules under [src](src), then rebuild. The build produces the single distributable [index.html](index.html).

```sh
npx playwright install chromium webkit
npm run test:browser
npm run test:living
```

Browser checks capture screenshots and results in the ignored `test-results/` directory. Eight scenarios cover desktop, wide desktop, native Chromium multi-touch, iPad-sized WebKit in both orientations, two phone sizes, reduced motion on the small phone, dark appearance, and rotation during a grab. They check quantified stretching, independent cancellation, palm impacts, map retention, camera travel, all four achievable objectives, music/effects independence, audio cleanup, layout, and nonblank animated canvas pixels. Feeding checks harvest every requested food example, exercise held and released meals, preserve a second native touch grip, and capture normal/eating/satisfied/reverted states with measured mouth movement and larger hearts.

Six additional living-world cases cover all three maps in Chromium and WebKit. Playwright's controlled clock advances actual animation frames through more than seven simulated minutes, without changing gameplay timers or exposing mutation controls. Real pointer input checks three-grip shaping, foreground travel and regrabbing, held expressions, unobstructed habitat returns, each species' voice where audio is available, every toy kind, and touch-responsive grass. Timelines retain autonomous consumption identities, mouth motion, heart/smile observations and staged screenshots, cross-species play, pursuit/fleeing, natural comic events, interaction-triggered early events, finite bounded residents, cleanup, and no unearned objective progress.

`npm test` discovers all simulation test files. Coverage includes elastic recovery, buoyancy, tree/toy geometry, idle-sound suppression, camera coordinates, shared floor/collision contours, substantial habitat journeys, depth picking, shadow projection, pose/bubble alignment, transition continuity, all objective positive/negative controls, and comic-event timing and attribution. See [DESIGN-V3.md](DESIGN-V3.md) for the design and research references.

For a focused audio/input run in PowerShell, set `$env:BLOB_FEATURES='audio'` before `npm run test:browser`, then remove that selector with `Remove-Item Env:BLOB_FEATURES`. This runs all eight viewport/input cases with Chromium PCM spectrum, audible gameplay, mixing, and native-node cleanup checks, plus WebKit's disabled fallback. It does not replace the full coast/objective journey or long-running living-world release tests. Audio measurements are retained in the ignored `test-results/` directory.

For focused feeding checks, set `$env:BLOB_FEATURES='feeding'`. Optional `$env:BLOB_CASES='desktop'` selects a viewport and `$env:BLOB_FEEDING_CASES='pools:pearl'` selects a map/resident; comma-separated values are supported. Run `npm run test:browser`, then remove those selectors before full regression checks. The normal browser matrix includes feeding automatically.

For stage visual inspection, set `$env:BLOB_FEATURES='visual'`, `$env:BLOB_STAGE='v4-final'`, and `$env:BLOB_CASES='desktop,phone'`, then run `npm run test:browser`. This captures every map at shore/reef and during its signature event, renders repertoire pose galleries, and checks parallax, refraction clipping, cache limits, fallback rendering, and frozen event state. Remove these three environment variables before a full regression run. Stage reports identify their scope and tested local HTML hash.

Windows Playwright WebKit has no Web Audio API, reports MP3 support without advancing playback, and cannot navigate local files while offline emulation is enabled. Its tests block external asset requests and assert the disabled-audio fallback. Chromium tests run disconnected and verify actual music playback and sound effects. These are browser-engine/emulation checks, not a claim of testing physical iPad hardware.

## Publish

The repository is configured with **Settings > Pages > Source > GitHub Actions**. Push to `main`, or run **Deploy Blob Island** in Actions. The workflow installs pinned dependencies, runs all simulation tests, builds the game, and publishes only `_site/index.html`. Browser matrices are release checks run before publication and against the hosted artifact. The site does not publish the source tree, dependencies, or test artifacts separately; the HTML includes the audio recording and its notices.

For another static host, upload only the built HTML and name it `index.html`. All URLs and resources are self-contained, so a project subpath works without a base-path setting.