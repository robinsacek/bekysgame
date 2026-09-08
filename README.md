# Blob Island

A small, see-through rainbow jelly on a tropical island. An unhurried physics playground with googly eyes, soft-body wobble, shallow water, and floating toys. No scores, timers, or losing.

## Play

The GitHub Pages destination is **https://robinsacek.github.io/bekysgame/**.

The complete game is also contained in [index.html](index.html). Open that file directly on a laptop, or serve it from any static HTTPS host for iPad Safari. Playing needs no installation, CDN, account, backend, or additional assets. The hosted document needs an initial connection; it does not install an offline service worker.

- Grab the jelly or a toy with a finger, mouse, or pen. Move it and let go to throw it.
- Use two fingers to stretch the jelly. It does not tear.
- Touch or stir the shallow water to make ripples. The ball, raft, coconut, and bottle can all be picked up.
- The toolbar controls sound, pause, reset, and full screen where supported. Sound begins muted and is unlocked by a user gesture.
- Arrow keys move the jelly. Space pauses, R resets, and M toggles sound.

Landscape and portrait layouts are supported. Rotation preserves the scene's positions and releases active grabs. Use a current version of Safari, Chrome, Edge, or Firefox; iPadOS can open the Pages URL in Safari or add it to the Home Screen.

## Physics

Matter.js drives fixed-step gravity, collisions, friction, inertia, elastic constraints, and touch springs. The jelly is a constrained soft-body mesh. Submerged-body buoyancy and water drag make objects settle at the surface. The water surface has damped traveling waves. These are playful 2D approximations, not a full fluid solver.

All scenery, object artwork, and sound are generated locally. There is no analytics, tracking, or saved personal data. Dependency license notices are retained inside the standalone HTML.

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

Browser checks capture screenshots and results in the ignored `test-results/` directory. They cover desktop, wide desktop, native Chromium multi-touch, iPad-sized WebKit in both orientations, phone sizing, dark appearance, rotation during a grab, canvas pixels, pause/reset, and sound capability handling. Physics tests cover settling, sustained dragging, two-finger stretching, buoyancy, and narrow worlds.

Windows Playwright WebKit has no Web Audio API and cannot navigate local files while its offline emulation is enabled. Its tests therefore block external asset requests and assert the disabled-audio fallback; Chromium tests run disconnected and verify sound unlock. These are browser-engine/emulation checks, not a claim of testing physical iPad hardware.

## Publish

Enable **Settings > Pages > Source > GitHub Actions** for `robinsacek/bekysgame`. Push to `main`, or run **Deploy Blob Island** in Actions. The workflow installs pinned dependencies, runs the physics tests, builds the game, and publishes only `_site/index.html`. It does not publish the source tree, dependencies, or test artifacts.

For another static host, upload only the built HTML and name it `index.html`. All URLs and resources are self-contained, so a project subpath works without a base-path setting.