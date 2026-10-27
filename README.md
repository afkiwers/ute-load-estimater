> [!WARNING]
> **Vibe-coded, for illustrative purposes only.** Ute Load Estimator was written largely with an AI assistant. Its
> results look reasonable, but they have not all been validated against real weighbridge measurements. Check every
> number yourself against your weighbridge dockets, vehicle placard, owner's manual and tow bar plate before you load
> or tow: don't base safety or compliance decisions on this tool alone.

# Ute Load Estimator

Plan and check the loading of a ute and the caravan it tows. Enter your weighbridge readings and the manufacturer limits, drag accessories and gear onto a 3D model, and see the axle, wheel, tow ball and combination loads update against every limit.

**[Open it in your browser](https://afkiwers.github.io/ute-load-estimater/)**, or **[download ute-load-estimator.html](https://github.com/afkiwers/ute-load-estimater/releases/latest/download/ute-load-estimator.html)** to use it offline ([release notes](https://github.com/afkiwers/ute-load-estimater/releases/latest))

## Use it

- **Online:** open [afkiwers.github.io/ute-load-estimater](https://afkiwers.github.io/ute-load-estimater/). It always runs the latest release.
- **Offline:** download [`ute-load-estimator.html` from the latest release](https://github.com/afkiwers/ute-load-estimater/releases/latest/download/ute-load-estimator.html) and double-click it. It opens in Chrome straight from disk: no web server, no install, no internet needed (only the update check in the About box goes online). The current development version is in the repo root ([`ute-load-estimator.html`](ute-load-estimator.html), "Download raw file").

Your setups are saved in the browser automatically. The online page and a downloaded file keep separate lists, so use **Export** to keep a backup file or move setups to another computer or between the two, and **Import** to load one.

## What it does

**Weighbridge readings (Ute tab).** Enter whatever you measured: the four wheels, the two axles and/or the total. Missing values are derived and shown in grey, and every redundant reading is cross-checked:

- FL + FR against the front axle, RL + RR against the rear axle, front + rear against the total (tolerance ±20 kg or ±2%, adjustable)
- left/right imbalance over 10%, an unusual front/rear split, a total lighter than the published kerb weight, implausible values

Until you have weighed, the published kerb weight is used with an assumed front/rear split, and the tool says so.

**Manufacturer limits.** GVM, GCM, front and rear axle, kerb, tare, payload, braked and unbraked towing, max tow ball download, tyre load index. Every check shows the value, the limit, the spare capacity and turns amber near (95%, adjustable) or red over the limit, in the results panel, the gauge strip and on the 3D labels.

**Items in 3D.** Drag items from the palette onto the ute or caravan (winch, bull bar, people, roof rack, rooftop tent, drawers, fridge, water, gas bottles, bikes, ...) or create your own with its exact weight. Items rest on the surface you drop them on and stack on each other; people snap to seats. Drag them around, or type an exact position. For the selected item the inspector shows its effect on each axle and **how much more weight would fit at that spot** before the first limit is reached.

Readings already include what was on the vehicle when you weighed it. Tick **Was on the vehicle when weighed** for those items (or use **Mark ticked items as weighed** right after weighing): they then only change the result when you move them or untick them, so nothing is counted twice.

**Towing.** Pick what you tow: a caravan, a boat on its trailer, an enclosed trailer or an open (box) trailer. Each type starts with typical dimensions and plate values (marked as placeholders), its own 3D model and its own items in the palette (boat, motor and fuel for a boat; motorbikes, mowers and other cargo for trailers). Trailer readings (weighbridge total, tow ball scale, optional axle group, front and rear axle, and side loads), compliance plate (entered top to bottom as printed: tare mass, coupling load at tare mass, GTM, ATM, TGALR; the load capacity is worked out), tyres (load rating in kg as on the plate, or the load index from the tyre) and geometry. Choose a single or tandem axle and enter each axle's distance from the tow ball centre. Items inside or on the caravan move the ball weight. Checks: towing capacity, the trailer's plated ATM against the towing capacity (flagged even when the trailer is loaded lighter), tow ball download, tow bar ratings, GCM, ATM, GTM, the axle group against the TGALR (each tandem axle against half of it), caravan tyres, ball weight share (8 to 12% guideline) and front axle unloading. An optional weight distribution hitch restores a chosen share of the front axle load.

**Also:** a version button in the top right corner opens an About box with the version, commit and build date, links, a button that copies them for bug reports, and a check for a newer release on GitHub. Several named setups (duplicate one to compare loading plans), undo/redo, x-ray view to place items inside the cab or caravan, paint colours, and a printable report (save as PDF from the print dialog).

## How the numbers are worked out

Distances are in mm, masses in kg. On the ute, `x` is measured rearward from the front axle centre; on the caravan, from the tow ball (coupling) centre. `y` is to the right of the centreline (driver side), `z` is height.

- **Ute.** A beam on two axles: a mass `m` at `x` puts `m·(L−x)/L` on the front and `m·x/L` on the rear axle (wheelbase `L`). Ahead of the front axle (a winch) it unloads the rear; behind the rear axle it unloads the front. Each axle shares its load between its wheels by lever over the track. A four-wheel vehicle is statically indeterminate side to side, so roll stiffness is ignored, as is usual for load planning.
- **Caravan.** A beam on the tow ball and the axle group: `ball = m·(a−x)/a`. For a single axle `a` is its distance from the tow ball; tandem axles are taken to share the load equally, so `a` is the average of their two distances. Weight behind the axles lifts the ball. Each axle starts from its weighbridge reading (or half the group if not weighed separately) and takes an equal share of any change after that.
- **Hitching.** The ball weight `B` sits `d` behind the rear axle: the rear axle gains `B·(L+d)/L` and the front axle loses `B·d/L`.
- **WDH.** The spring bars apply a couple `M` at the hitch. It moves `M/L` from the rear to the front axle and `M/a` onto the caravan axles. `M` is chosen so the front axle regains the selected share of the load hitching took off it.
- **Headroom.** "Room for N kg more here" is found by adding a 1 kg probe at the position and dividing each limit's spare capacity by how much the probe moved it.

This is a static estimate to plan with. Always confirm on a weighbridge before you travel.

## Vehicle preset

The default vehicle is the **GWM Cannon Alpha Vanta 3.0L diesel**. Published figures: GVM 3,495 kg, GCM 6,555 kg, kerb 2,550 kg, payload 945 kg, braked towing 3,500 kg, unbraked 750 kg, max tow ball download 350 kg, wheelbase 3,350 mm, length 5,445 mm, width 1,991 mm, height 1,924 mm.

Values not found in published sources are filled with typical figures and marked **placeholder** in the app until you change them or click the chip to mark them verified: max front axle (1,600 kg), max rear axle (2,100 kg), tare (2,432 kg), track, front overhang, tub dimensions, tyre load index, tow ball position. Check them against your vehicle's placard, owner's manual and tow bar plate. The caravan starts with example values for a 6 m tandem van.

## Develop

Needs Node 20 or newer.

```bash
npm install
npm run dev      # local dev server with hot reload
npm test         # unit tests for the load model
npm run build    # typecheck, then build ute-load-estimator.html
```

The build inlines everything (React, three.js, styles) into one HTML file so it runs from `file://`. It is written to `dist/index.html` and copied to `ute-load-estimator.html` at the repo root. CI checks that the committed file matches the source, so run `npm run build` and commit the result after changing the code.

To release, publish a release on GitHub (Releases, "Draft a new release", pick or create a tag, Publish). The Release workflow builds the file from the tagged commit, runs the tests, attaches `ute-load-estimator.html` to the release and publishes it to GitHub Pages; the download link and the online page above always serve the newest release. The online page is the `gh-pages` branch, which the workflow replaces on every release. One-time setup, after the first release that runs it: Settings, Pages, Source "Deploy from a branch", branch `gh-pages`, folder `/ (root)`.

Code map:

- `src/model/` load model (`calc.ts`), geometry, tyre tables, presets, trailer types (`trailers.ts`); no UI code. The towed vehicle is called `caravan` in the code and in saved setups whatever its type; `caravan.kind` says what it is.
- `src/state/` setups store (saved in the browser), UI state
- `src/three/` 3D scene, vehicle models, drag and drop
- `src/components/` panels, inspector, report
