# Blob Island

A small, see-through rainbow jelly exploring three tropical islands. An unhurried physics playground with silly elastic stretching, googly eyes, swaying coconut palms, shallow water, and physical toys. No scores, timers, or losing.

## Version 2

- An uneven, transparent rainbow soft body that elongates under two independent finger grips and wobbles back after release. Its eyes follow separate fingers when stretched.
- A rooted palm on each map. Grab its trunk or canopy to sway it, or crash the jelly into it to knock a coconut loose. All three hanging coconuts become real draggable, rolling, floating objects when released.
- Little Lagoon has a beach ball, bamboo raft, coconut, message bottle, hollow float ring, and crate. Tide Pools adds sinking shells and rocky underwater platforms. Sunset Cove adds a working seesaw and warmer lighting.
- Each area retains its own state during the session. Inactive areas freeze; switching back preserves toys and fallen coconuts. Refreshing the page starts fresh.
- Separate effects and music controls. Effects include elastic squeaks, grab/release tones, springy bounces, wooden taps, shell and glass chimes, splashes, palm rustles, and quiet surf. Settled floats do not generate repetitive impact sounds.

## Play

The GitHub Pages destination is **https://robinsacek.github.io/bekysgame/**.

The complete game is also contained in [index.html](index.html), approximately 8.5 MB including the full music recording. Open that file directly on a laptop, or serve it from any static HTTPS host for iPad Safari. Playing needs no installation, CDN, account, backend, or additional assets. The hosted document needs an initial connection; it does not install an offline service worker.

- Grab the jelly or a toy with a finger, mouse, or pen. Move it and let go to throw it.
- Use two fingers to stretch the jelly. It does not tear.
- Touch or stir the shallow water to make ripples. All loose objects can be picked up; a crate placed on one side tips the seesaw.
- Use the area selector to visit each map. The reset button restores only the current area, including its coconuts.
- The toolbar controls music, sound effects, pause, reset, and full screen where supported. Both audio controls start off and are unlocked by a user gesture.
- Pausing, hiding the page, or leaving it suspends audio. Switching areas does not restart the music. Muting effects does not mute music.
- Arrow keys move the jelly. Space pauses, R resets the current area, and M toggles sound effects.

Landscape and portrait layouts are supported. Rotation preserves the scene's positions and releases active grabs. Use a current version of Safari, Chrome, Edge, or Firefox; iPadOS can open the Pages URL in Safari or add it to the Home Screen.

## Physics

Matter.js drives fixed-step gravity, collisions, friction, inertia, elastic constraints, and touch springs. The jelly is a 24-point soft-body mesh with volume-supporting pressure. Multiple grips soften the links; releasing them smoothly restores spring strength. The palm is a compound collidable trunk with an anchored root, restoring spring, and detachable fruit. A hollow compound ring and hinged seesaw have physical rather than decorative geometry. Submerged-body buoyancy and water drag make objects settle at the surface. The water has damped traveling waves. These are deliberately playful 2D approximations, not a full fluid solver.

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
```

Browser checks capture screenshots and results in the ignored `test-results/` directory. Eight scenarios cover desktop, wide desktop, native Chromium multi-touch, iPad-sized WebKit in both orientations, two phone sizes, dark appearance, and rotation during a grab. They check visible two-finger elongation, independently cancelled grips, collisions with the palm, coconut drops, all maps, state retention, real music playback where supported, music/effects independence, pause/resume, sound-node cleanup, layout, and canvas pixels.

Thirteen physics tests cover settling, repeated throws, quantified stretching and recovery, buoyancy, narrow worlds, palm collisions and shaking, all maps, fallen-fruit identity across resizing, idle-sound suppression, the ring's open centre, and a weighted seesaw.

Windows Playwright WebKit has no Web Audio API, reports MP3 support without advancing playback, and cannot navigate local files while offline emulation is enabled. Its tests block external asset requests and assert the disabled-audio fallback. Chromium tests run disconnected and verify actual music playback and sound effects. These are browser-engine/emulation checks, not a claim of testing physical iPad hardware.

## Publish

The repository is configured with **Settings > Pages > Source > GitHub Actions**. Push to `main`, or run **Deploy Blob Island** in Actions. The workflow installs pinned dependencies, runs the physics tests, builds the game, and publishes only `_site/index.html`. It does not publish the source tree, dependencies, or test artifacts separately; the HTML includes the audio recording and its notices.

For another static host, upload only the built HTML and name it `index.html`. All URLs and resources are self-contained, so a project subpath works without a base-path setting.