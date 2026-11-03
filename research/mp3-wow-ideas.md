# SE 390 MP3: "wow first" inspiration list and project angles

Research memo for Brian, Nov 2 2026. 39 numbered plus 16 shorter verified viral or award-winning demos (Aug 2 to Nov 2, 2026), grouped by domain, each with 1 to 3 ways to spin it as an Advanced Technology project. Then 11 fleshed-out project ideas with milestones. Deliberately NOT ranked: you judge. Nothing was sent or posted.

How this was checked (Nov 2, 2026, about 10:10 to 10:40 PM Toronto time):
- HN: Algolia API, all Show HN posts with 150+ points created since Aug 2, 2026, plus all stories with 900+ points, plus keyword searches. Every HN item below was re-fetched from the Algolia items API (points and title as of tonight) and its target page or GitHub README was fetched to confirm the description.
- X: built-in X search, then every post re-fetched by id for current likes, reposts and views. Numbers are as of tonight.
- Devpost: Hack the North 2026 museum and gallery, HackMIT 2026 gallery, Cal Hacks 13 search. Devpost pages fetched.
- Filtered out: AI agent tooling, anything whose core is training a model on collected data, and the 8 ideas already rejected (flight recorder, crowd sim, Arena, OSC 7501, Forkspace, provenance memory, Effect Ledger, Game Boy to Wasm recompiler).
- Not verified: YouTube and Reddit view counts (not checked this turn); r/programming and Shadertoy were not searched. Cal Hacks 13 had no visually striking winner I could confirm, so none is listed.

Engagement note: several X posts have small like counts but large view counts, or the reverse. I list exactly what the API returned. The @teichopsic post shows 0 likes with 27,332 views, which looks odd but is what X returned.

---

## Part 1. Inspiration list (55 items) with Advanced Technology spins

### Graphics / GPU

1. **Spark Radix, WebGPU Gaussian splat renderer on three.js** by @sparkjsdev. 749 likes, 93 reposts, 59,486 views (Oct 29). https://x.com/sparkjsdev/status/2115852543708536881
   - Spin: "Splats you can touch". Make a phone-scanned room physically interactive: extract a signed distance field from splats on the GPU, couple it to rigid bodies and fluid. Benchmark: mesh extraction (SuGaR or 2DGS style) plus a standard physics engine, on fps, collision error, and setup time.
   - Spin: streaming LOD splats for a whole campus in a browser tab on a phone. Benchmark: Spark Radix and PlayCanvas SuperSplat at equal memory budget, on fps and PSNR.

2. **"Render your street as a platformer"**: minutes of iPhone footage turned into a Gaussian splat you run and jump on, by @teichopsic. 0 likes, 0 reposts, 27,332 views as returned by X (Nov 1). https://x.com/teichopsic/status/2116849673793143052
   - Spin: automatic "gameification" of any scan: walkable surface detection, nav mesh and collision from splats with no manual meshing. Benchmark: hand-built collision mesh, nav mesh coverage, character clipping rate.

3. **Custom spectral path tracer on WebGPU with denoiser**, running in the browser, by @aecyydesign. 777 likes, 36 reposts, 23,740 views (Oct 20). https://x.com/aecyydesign/status/2112623654530138136
   - Spin: a spectral path tracer that renders "physics you cannot see": dispersion, thin-film, and relativistic Doppler, all in-browser. Benchmark: Mitsuba 3 reference images (error vs time), WebGL path tracers.

4. **Liquid-shape web tool with WebGL2 path tracer and OIDN denoiser on WebGPU**, by @aecyydesign. 398 likes, 13 reposts, 18,155 views (Oct 26). https://x.com/aecyydesign/status/2114825374961897939
   - Spin: path-traced real-time fluid (simulate and render the same frame budget in browser). Benchmark: offline Blender Cycles render of the same sim, quality per millisecond.

5. **Splat water: 700,000 flat Gaussian discs on WebGPU**, by @martin_casado. 81 likes, 6 reposts, 5,773 views (Oct 13). https://x.com/martin_casado/status/2110156981269127501
   - Spin: Gaussians as the simulation particles AND the renderer (one representation for SPH or MPM and display). Benchmark: particle sim plus screen-space fluid renderer, fps at equal particle count.

6. **WebCUDA: .cu kernels compiled to WGSL** running FFT ocean, caustics and splats, by @SamGCoder. 37 likes, 5 reposts, 1,769 views (Oct 5). https://x.com/SamGCoder/status/2107093021506548120
   - Spin: a CUDA-subset to WGSL compiler that runs unmodified classic CUDA samples in a browser tab. Benchmark: native CUDA on the same GPU, percent of native throughput; correctness on the CUDA samples suite.

7. **Show HN: What if the speed of light was 5 km/h?** 633 points. https://news.ycombinator.com/item?id=49637385
   - Spin: a real-time special-relativistic renderer of a scanned real room (Terrell rotation, aberration, Doppler colour shift, searchlight effect) where you walk with a gamepad. Benchmark: analytical test scenes and MIT's "A Slower Speed of Light" (OpenRelativity), frame time and correctness.

8. **Show HN: Real-time Solar System with 526k asteroids and all tracked satellites** (JPL SBDB, CelesTrak SGP4, in the browser). 408 points. https://news.ycombinator.com/item?id=49898778
   - Spin: not just display, integrate: a WebGPU N-body integrator for every known asteroid with "what if" perturbations (add a planet, nudge an asteroid). Hard part is double-precision emulation on GPUs that only have f32. Benchmark: REBOUND and JPL Horizons position error over 100 years.

9. **Show HN: Galaxium, an experimental WebGPU space explorer** by the Stellarium Mobile maintainer. 137 points. https://news.ycombinator.com/item?id=49420524
   - Spin: seamless scale from 1 m to 1 billion light years in one tab (floating origin, log depth, procedural galaxy). Benchmark: Galaxium and SpaceEngine on fps and precision jitter at extreme zoom.

10. **Show HN: Warsaw in voxels**, interactive 3D city with time of day, weather, controllable pedestrians. 222 points. https://news.ycombinator.com/item?id=50339221
    - Spin: auto-voxelize Waterloo from open data (OSM plus elevation) with GPU global illumination. Benchmark: render quality and fps against rasterized three.js baseline.

11. **Triple-A Minesweeper**, absurd AAA production values on a classic game. 1,449 points. https://news.ycombinator.com/item?id=50022292
    - Spin: proof that "overkill" is a viral format. Pair it with a hard core, for example a real-time destructible physics engine for a trivial game. Benchmark: Rapier or Jolt on the same scenes.

12. **Orbis Engine** (Hack the North 2026 winner): any filmed video turned into a 4D splat world you can walk into on a Quest. https://devpost.com/software/temp-jcyltx
    - Spin: do the 4D reconstruction live from a single phone in a browser instead of a cloud GPU pipeline. Benchmark: their offline pipeline, latency and novel-view PSNR. Warning: this leans on pretrained models, so it is heavier risk.

### Impossible-place computing

13. **Show HN: A working Nintendo in ~1GB of Qwen weights (nesformer)**: an NES 6502 CPU compiled (not trained) into a stock Qwen3.5 checkpoint; Gated DeltaNet state is the machine's memory. 294 points; repo 278 stars. https://news.ycombinator.com/item?id=50306442
    - Spin: a general compiler from a bytecode VM (Lua or Wasm subset) into transformer weights, so "the LLM" runs any program bit-exactly. Benchmark: Qwenputer and nesformer instruction throughput, bit-exact pass rate on a test suite, weight size.
    - Spin: run the compiled model fully in-browser on WebGPU with custom kernels. Benchmark: transformers.js and WebLLM tokens per second on the same model.

14. **Show HN: I Turned DOOM into a Transformer (Doomformer)**: compiles integer neural nets into DOOM maps where voodoo dolls do the arithmetic; MNIST runs in-map. 132 points. https://news.ycombinator.com/item?id=50297697
    - Spin: a "compile anything to a weird substrate" toolchain with an optimizer (e.g., to Minecraft redstone, or to a spreadsheet). Benchmark: gate count and runtime vs hand-built versions.

15. **Show HN: A language model that lives in a boot sector (bootgpt)**: 512-byte asm MBR loads an 11.5 KB int8 model, 16-bit real mode, dreams a Linux boot log. 105 points. https://news.ycombinator.com/item?id=50315782 ; build thread by @krlntn, 13 likes, 6 reposts, 3,631 views: https://x.com/krlntn/status/2116514628457185757
    - Spin: the smallest useful model on bare metal (e.g., a speech-command or handwriting model on a $2 microcontroller with no runtime). Benchmark: TFLite Micro on size, latency, accuracy.

16. **Show HN: Make cursed fonts like Times New Bastard**: abuses OpenType ligatures, Python in Wasm client-side. 862 points. https://news.ycombinator.com/item?id=49823738
    - Spin: a compiler from a tiny language into OpenType GSUB/GPOS lookups so a font itself computes (a font that plays a game as you type). Benchmark: lookup count, HarfBuzz shaping time, prior font-games (I recall "Fontemon" but did not verify it this turn).

17. **Castlevania: Symphony of the Night on an ESP32-S3 at 60 fps** from the decompilation, by @DMonteroCrespo1. 4 likes, 0 reposts, 185 views (Oct 2). Low engagement, included for the technique. https://x.com/DMonteroCrespo1/status/2106128065139228800
    - Spin: a toolchain that takes a decomp and auto-fits it to a microcontroller memory map (overlay planning, asset streaming). Benchmark: hand ports on fps and RAM.

18. **Duke Nukem 3D's Build engine on an ESP32-P4**, bare ESP-IDF, 640x480 at about 20 fps, by @raoulhecky. 5 likes, 1 repost, 489 views (Aug 31). https://x.com/raoulhecky/status/2094341509847896283
    - Spin: same as above; also a measurable "how far can a $10 chip go" benchmark suite.

19. **Game Boy Color transformer ported to JS, 282 KB TinyStories model** running inside a ChatGPT visualization, by @maddiedreese. 15 likes, 1 repost, 3,382 views (Aug 8). https://x.com/maddiedreese/status/2086114954105827485
    - Spin: language model inference on a real 8-bit console (Game Boy cart). Benchmark: tokens per second vs this port and vs bootgpt.

### Audio / music / DSP

20. **Show HN: Eigendrum**, draw any shape and hear it as a drum: FEM on a triangle mesh (K phi = lambda M phi) plus Web Audio. 243 points. https://news.ycombinator.com/item?id=49246366
    - Spin: 3D version. Scan or draw any object, solve the 3D tetrahedral eigenproblem on WebGPU in under a second, then hit it with your hand via webcam. Benchmark: SciPy/ARPACK eigenvalues (accuracy), analytic plate and bar modes, recorded real objects.

21. **Show HN: High-quality duck audio synthesizer**: a live pond where every quack is synthesized and spatialized from where you stand. 180 points. https://news.ycombinator.com/item?id=50131006
    - Spin: fully procedural physical sound for a whole scene (no samples), with distance, occlusion and reverb computed live. Benchmark: Steam Audio or Resonance Audio on CPU cost and perceptual tests.

22. **Show HN: I trained a 125M model to autocomplete piano on-device** (about 108 notes/sec on an iPhone 15). 598 points. https://news.ycombinator.com/item?id=49373456
    - Spin (no training): a real-time "duet" engine that follows a live player's tempo and key with score following and a symbolic generator, latency under 20 ms. Benchmark: Magenta-style baselines on latency and beat alignment error. Avoid training your own model.

23. **Show HN: Guitoro, a virtual guitar you strum with your keyboard**. 573 points. https://news.ycombinator.com/item?id=50077020
    - Spin: physically modelled guitar (digital waveguide string plus body impulse) strummed by webcam hand tracking in the air. Benchmark: sample-based Guitoro on latency and memory, listener ABX test.

24. **Show HN: A techno machine in one HTML file, with verifiable renders** (RACK-02). 240 points. https://news.ycombinator.com/item?id=49419351
    - Spin: a sample-accurate deterministic DSP engine that renders bit-identically across browsers, proved by hashes. Benchmark: Tone.js determinism, CPU per voice.

25. **Show HN: OnKey**, shows where you sing off-key. 237 points. https://news.ycombinator.com/item?id=50195488
    - Spin: real-time polyphonic pitch tracking of a whole room (a choir or the class singing) on a laptop. Benchmark: CREPE or pYIN accuracy and latency on public test sets.

26. **Guitar amp and effects pedal on an ESP32-S3**, running full Neural Amp Modeler captures in real time with a TSX UI compiled to C++. 163 points; repo 288 stars. https://news.ycombinator.com/item?id=49852600
    - Spin: a compiler that takes any Web Audio graph and emits fixed-point firmware for a $10 chip. Benchmark: same graph in browser vs on chip, CPU headroom and output error.

27. **Spatial audio: drop an MP3 and drag the sound around your head**, Web Audio in browser, by @gaborpribek. 43 likes, 7 reposts, 6,087 views (Aug 3). https://x.com/gaborpribek/status/2084293340548235670
    - Spin: see Concerto (item 28). Physical spatial audio in a real room using everyone's phones.

28. **Concerto** (Hack the North 2026 finalist): audience phones become a distributed orchestra; optical phone ID with extended Hamming codes, NTP-style clock sync, tested with 1,500 simulated clients. https://devpost.com/software/concerto-0wd9zs
    - Spin: replace camera localization with acoustic chirps (each phone hears the others), get sub-millisecond sync, then do wave field synthesis so a sound physically flies across the lecture hall. Benchmark: Concerto-style NTP sync error (their writeup says audible sync was unsolved), localization error in cm.

### Vision / gesture / AR

29. **Elemental Sandbox: cast VFX spells with your hands** (MediaPipe plus three.js), by @chirovisuals. 489 likes, 43 reposts, 23,499 views (Sep 14). https://x.com/chirovisuals/status/2099472364220096573
    - Spin: hand tracking driving a real physics sim (fire, smoke, water as GPU fluid) instead of canned VFX, at under 30 ms motion to photon. Benchmark: measured latency with high-speed phone camera, sim resolution at 60 fps.

30. **Webcam hand tracking with digital fabric physics**, 21 points per hand at 60 fps, TouchDesigner, by a builder reposted by @RoundtableSpace. 91 likes, 10 reposts, 49,594 views (Aug 22). https://x.com/RoundtableSpace/status/2091281838014709810
    - Spin: in-browser cloth and soft-body sim with hand collision on WebGPU (XPBD). Benchmark: TouchDesigner or Unity cloth, particles at 60 fps.

31. **Water orb you touch with your bare hands**, webcam 3D hand tracking splashing a WebGPU fluid sim, by @nao_1000ri. 14 likes, 1 repost, 770 views (Sep 29). https://x.com/nao_1000ri/status/2104845704997019793
    - Spin: same core as 29 and 30; listed as evidence that the format works even for small accounts.

32. **Show HN: Laser Graffiti**: projector plus webcam, draw on any wall with a laser pointer. 253 points. https://news.ycombinator.com/item?id=49489376
    - Spin: projector-camera "physics wall": laser pours fluid, real objects on the table become obstacles, all calibrated automatically. Benchmark: end-to-end latency and registration error vs Laser Graffiti style setup.

33. **Show HN: Point your camera at a landscape to learn about its geology** (Outcrop, geologic maps in AR, offline). 256 points. https://news.ycombinator.com/item?id=50290533
    - Spin: AR overlay that needs no GPS, aligning the horizon silhouette from the camera against a DEM render. Benchmark: phone compass plus GPS heading error, and PeakFinder.

### Simulation / physics

34. **Show HN: Flip Fluid on Flip Dots**: a FLIP fluid sim shown on an electromechanical flip-dot display, built for EMF 2026. 398 points. https://news.ycombinator.com/item?id=49854219
    - Spin: physical output of simulations (fluid you tilt, on a cheap LED matrix or e-ink), with a sim tuned to the display's refresh and latency. Benchmark: frame-to-dot latency, sim stability at tiny grid sizes.

35. **Realistic fishing simulator that runs entirely in the browser**, reposted by @alohaproxy. 1,810 likes, 88 reposts, 117,792 views (Oct 15). https://x.com/alohaproxy/status/2110574383400104152
    - Spin: proof that "photoreal sim in a tab" is viral. Hard version: two-way coupled water plus line plus fish physics on WebGPU. Benchmark: Unity or Unreal water plugins at equal fps.

36. **3D bath bomb builder with real-time fluid sim in the browser**, by @techartist_. 149 likes, 10 reposts, 6,304 views (Oct 16). https://x.com/techartist_/status/2111219143936790802
    - Spin: reaction-diffusion plus fluid (dissolving, fizzing, colour mixing) as a GPU multi-physics engine. Benchmark: offline Houdini sim of the same scene.

37. **A 3D fruit fly on macOS driven by the real FlyWire connectome**: live spiking sim, 23,210 neuron positions flashing, brain-to-leg network. 383 points; repo 1,085 stars. https://news.ycombinator.com/item?id=49353221 . Related: @Zyvex_0x "drone with the brain of a fruit fly", 9 likes, 915 views: https://x.com/Zyvex_0x/status/2100236128628412920
    - Spin: the whole connectome (about 140k neurons, tens of millions of synapses) simulated in real time in a browser tab on WebGPU, with webcam vision as the fly's eyes. Benchmark: Brian2 or NEST on CPU, simulated seconds per wall second.

### Emulation / VMs / hardware

38. **Show HN: Esp32sim, run ESP32 firmware in the browser** (Rust; boots mask ROM, real bootloader, models displays, camera, WiFi). 212 points; repo 1,004 stars. https://news.ycombinator.com/item?id=50131189
    - Spin: a massively parallel emulator: thousands of console or microcontroller instances in one WebGPU compute dispatch ("10,000 Marios at once"). Benchmark: single-core CPU emulator instance-frames per second; NVIDIA's CuLE (Atari on CUDA) as prior art.

39. **Show HN: PS2 games statically recompiled to WebAssembly** (Gran Turismo 4, God of War II). 316 points; repo 1,378 stars. https://news.ycombinator.com/item?id=50052251
    - Note: very close to the rejected Game Boy recompiler. Only useful as a reference for technique.

Also seen, shorter:
- **KIANV StealthV**, a custom quad-core RISC-V Linux SoC in SystemVerilog on FPGA, rendering an X-Wing with no GPU, by @splinedrive. 88 likes, 7 reposts, 2,337 views. https://x.com/splinedrive/status/2110850595120611474 . Spin: a custom GPU core on FPGA that runs a WebGPU-like shader subset. Benchmark: softcore CPU rendering.
- **Show HN: Quake ported to safe Rust, playable in browser**. 241 points. https://news.ycombinator.com/item?id=50016312
- **Show HN: Our space game has a built-in RISC-V emulator that runs Linux**. 98 points. https://news.ycombinator.com/item?id=49931993
- **MartyPC, cycle-accurate early PC emulator in Rust**. 218 points. https://news.ycombinator.com/item?id=49405816

### Languages / compilers / databases

- **Show HN: Woxi, open-source Wolfram Language reimplementation in Rust** (CLI, Jupyter, Wasm). 314 points. https://news.ycombinator.com/item?id=49270040 . Spin: a symbolic math engine that runs in the browser with live, draggable equations. Benchmark: Mathematica and SymPy on a standard integration test suite. (Big scope; risky.)
- **27.5 KB language-agnostic WebGPU syntax highlighter** (Shu Ding, Vercel Labs). 121 points. https://news.ycombinator.com/item?id=49619464 . Spin: parsing or regex matching on the GPU at GB/s, e.g. grep a 10 GB log in a browser tab. Benchmark: ripgrep and Hyperscan.
- **Show HN: Redis City, explore one Redis instance as a 3D city**. 186 points. https://news.ycombinator.com/item?id=49676425 . Spin: a live 3D "x-ray" of a real database under load (B-tree pages, locks, WAL) driven by eBPF. Benchmark: overhead vs perf and pg_stat tools.

### Novel I/O / sensing

- **Show HN: Subvocal, talk to your computer without making noise** (YC F26 smart glasses, RF sees inside your mouth). 579 points, posted today. https://news.ycombinator.com/item?id=50340088 . Spin: needs training data, so only as inspiration. A no-training version is item below.
- **Various projects find hidden SDR capabilities in ESP32 microcontrollers** (ESPARGOS phased array of ESP32s for WiFi direction finding). 294 points. https://news.ycombinator.com/item?id=49922674 . Spin: a $40 array of ESP32s that sees through a wall (breathing, a waving hand) using WiFi channel state and classic array signal processing, no ML. Benchmark: ESPARGOS results and a commercial mmWave radar module.
- **Show HN: An e-ink frame that hears birds and draws them as 1800s illustrations** (local BirdNET, Raspberry Pi). 2,391 points, the top Show HN of the quarter; repo 3,974 stars. https://news.ycombinator.com/item?id=49711544 . Spin: the format (ambient sensing turned into beautiful physical output) is what went viral. Hard version: localize each bird call in 3D with a 4-mic array and draw the bird where it is. Benchmark: ODAS or pyroomacoustics DOA error.
- **AliExpress runs silent WebAudio fingerprinting that breaks Bluetooth multipoint**. 1,059 points. https://news.ycombinator.com/item?id=49372583 . Spin: data over sound between browsers (ultrasonic modem in Web Audio) with real error correction. Benchmark: ggwave and Chirp throughput and error rate.

### Other

- **Show HN: Scroll through all 43,252,003,274,489,856,000 Rubik's Cube states**. 295 points. https://news.ycombinator.com/item?id=49251179 . Spin: bijective indexing of huge state spaces (every chess position, every Tetris board) with instant random access. Benchmark: known ranking and unranking algorithms.
- **TakeOne** (Hack the North 2026 overall finalist): AI robotic film studio, SO-101 arms on an RC truck, MuJoCo rehearsal, MediaPipe tracking. https://devpost.com/software/takeone-erqv3l . Spin: hardware heavy; only if a teammate wants robots.
- **Cybflight, a full autonomous drone flight stack in Rust on an STM32H743**, reposted by @Alacritic_Super. 242 likes, 28 reposts, 8,372 views. https://x.com/Alacritic_Super/status/2108422015015153901

---

## Part 2. Eleven project ideas in detail (unranked, in no particular order)

Each one: pitch, 30-second demo moment, hard core, baseline, why data is not the bottleneck, milestones, cheap outside mention, 5-week risk, and what inspired it. "Live in class" marks ones you can run in MC 1085 in front of everyone.

### A. "The model is the computer": compile a whole VM into transformer weights
- Pitch: An LLM checkpoint that nobody trained, which runs any Lua (or Wasm subset) program bit-exactly, in a browser tab.
- Demo: Type a program into what looks like a chat box. "The model" prints the right answer for fib(30), then runs a tiny game. Open the weights file: it is a stock architecture.
- Hard core: a compiler from VM semantics (fetch, decode, ALU, memory) to attention and MLP weights, using recurrent state as RAM; plus WebGPU inference kernels tuned for this sparse structure.
- Baseline: nesformer and Qwenputer (instruction throughput, weight size), native Lua (slowdown factor), tracr-style compilers. Bit-exact pass rate on the Lua test suite.
- Data: none. Weights are computed, not learned.
- Milestones: (1) compile a 4-instruction register machine into a tiny transformer, bit-exact on 10k random programs; (2) full bytecode for integer Lua subset; (3) memory via recurrent state, 64 KB; (4) WebGPU kernels, tokens/sec vs transformers.js; (5) compiler optimizer that prunes zero blocks, size vs nesformer.
- Outside mention: Show HN plus a reply from the nesformer or Qwenputer authors (dbreunig, divagr18).
- Risk: medium. The idea is proven by nesformer; going general is the new part.
- Inspired by: items 13, 14, 15.

### B. Splats you can touch: physics inside a phone-scanned room (live in class)
- Pitch: Scan the lecture hall with a phone for two minutes, then flood it with water and throw chairs, in a browser.
- Demo: The photoreal room on the projector. Click, and water pours down the aisle, pooling around the real desks.
- Hard core: GPU SDF extraction from millions of Gaussians, coupled MPM or position-based fluid with the splat scene, and relighting the splats under the fluid, all in WebGPU.
- Baseline: mesh extraction (2DGS or SuGaR) plus Rapier; measure setup time, collision error against a measured floor plan, and fps.
- Data: one phone video of the room. Training a splat is a standard tool step, not research.
- Milestones: (1) load and render a splat at 60 fps with Spark; (2) SDF from splats, error vs mesh; (3) rigid bodies colliding with the SDF; (4) 1M particle fluid at 30 fps; (5) fluid occlusion and caustics composited into splat render.
- Outside mention: post the clip on X tagging @sparkjsdev and World Labs.
- Risk: medium. Fluid plus splat compositing is the hard 20%.
- Inspired by: items 1, 2, 5, 12.

### C. The room is the speaker: phone-swarm wave field synthesis (live in class)
- Pitch: 80 phones in a lecture hall find each other by sound, sync to under a millisecond, and make a sound physically fly over the audience.
- Demo: Everyone opens a URL. A bee buzzes from the back left corner and you can hear it travel across the room to the front right.
- Hard core: acoustic chirp ranging between phones to self-localize (multilateration with outlier rejection), clock and audio-output latency calibration per device, wave field synthesis delays and gains, browser audio quirks.
- Baseline: Concerto's NTP-only sync and camera localization; measure sync error in microseconds with a reference mic, and localization error in cm against a tape measure.
- Data: none. Pure signal processing.
- Milestones: (1) 2 phones measure distance by chirp, error under 10 cm; (2) 10 phones localize themselves; (3) sync under 1 ms measured by a reference mic; (4) panning across a row; (5) 2D WFS source moving across 50+ phones; (6) load test with simulated clients.
- Outside mention: Concerto team (Hack the North 2026 finalists, reachable via Devpost), a post on X with the room video.
- Risk: medium to high. Phone audio latency varies a lot; calibration is the project.
- Inspired by: items 27, 28, 21.

### D. Strike anything: 3D modal sound of any object, played with your hands (live in class)
- Pitch: Point the webcam at any object, draw it or pick a mesh, and hear exactly how it would ring if struck, then play it in the air.
- Demo: Pick a wine glass mesh, swipe your finger in the air, it rings. Change it to steel, it rings brighter. Draw a weird shape, hear its unique chord.
- Hard core: tetrahedral meshing plus a sparse generalized eigensolver (LOBPCG) in WebGPU, modal synthesis with per-mode radiation, under one second from shape to sound.
- Baseline: SciPy ARPACK eigenvalues (accuracy), analytic plate and bar modes, recordings of real objects; Eigendrum (2D) for scope.
- Data: none. Physics.
- Milestones: (1) 2D FEM eigen in browser matching Eigendrum; (2) 3D tet FEM on CPU vs SciPy; (3) WebGPU LOBPCG, time to first sound; (4) modal synth with hand-tracked strike velocity; (5) comparison with recordings of 5 real objects.
- Outside mention: Eigendrum author on HN, a computational acoustics researcher on X.
- Risk: low to medium. Well-defined math, clear benchmarks.
- Inspired by: items 20, 21, 23.

### E. Physics wall: projector plus webcam turns any wall into a sandbox (live in class)
- Pitch: Draw on the classroom wall with a laser pointer and fluid pours out; hold up your hand and the water flows around your shadow.
- Demo: Laser draws a cup outline on the whiteboard, liquid fills it, a student's arm blocks the projector light and the fluid splashes off it.
- Hard core: automatic projector-camera calibration (structured light), shadow and object segmentation, GPU FLIP fluid, and end-to-end latency budgeting.
- Baseline: Laser Graffiti style setup; measure photon-to-photon latency with a phone slow-mo, registration error in mm, sim resolution at 60 fps.
- Data: none.
- Milestones: (1) structured-light calibration under 30 s; (2) laser dot tracking at 120 Hz; (3) GPU FLIP fluid on projected canvas; (4) shadow as obstacle; (5) latency under 50 ms measured.
- Outside mention: Laser Graffiti author (consti) and mitxela (flip dots).
- Risk: low. Cheap hardware, many fallbacks.
- Inspired by: items 32, 34, 29.

### F. Slow light, real room: relativistic rendering of a scanned place
- Pitch: Walk through E7 as if the speed of light were walking speed.
- Demo: Gamepad forward: the hallway bends, colours shift blue ahead and red behind, the room brightens in front. Stop and it relaxes.
- Hard core: special-relativistic ray tracing with retarded time over a splat or mesh scene, spectral Doppler, aberration and searchlight in a WebGPU spectral renderer.
- Baseline: MIT OpenRelativity, analytic test cases (Terrell rotation of a sphere, aberration angles), frame time.
- Data: one scan, or open 3D models.
- Milestones: (1) relativistic raycaster on analytic spheres, validated; (2) spectral Doppler; (3) mesh scene at 60 fps; (4) splat scene; (5) user walks with a gamepad in class.
- Outside mention: the "5 km/h" author (dmitrybrant) on HN, a physics prof at Waterloo.
- Risk: medium. Correct retarded time on splats is the unknown.
- Inspired by: items 3, 7.

### G. Ten thousand consoles in one GPU dispatch
- Pitch: Run 10,000 NES games at once in a browser tab, all on the GPU, and watch a search algorithm beat Mario 1-1 in seconds.
- Demo: A wall of 10,000 tiny Mario screens, all moving, collapsing into the best run.
- Hard core: a 6502 plus PPU emulator in WGSL compute, coping with warp divergence (instruction-level batching), memory layout for thousands of states, plus a parallel search over inputs.
- Baseline: a single-thread CPU emulator (instance-frames per second), NVIDIA CuLE (Atari on CUDA) as prior art, correctness on standard 6502 test ROMs.
- Data: none (use homebrew ROMs to avoid copyright).
- Milestones: (1) 6502 core in WGSL passes test ROMs; (2) 1,000 instances; (3) PPU on GPU; (4) 10,000 instances, throughput vs CPU; (5) parallel input search clears a level.
- Outside mention: NESdev forum, CuLE authors.
- Risk: medium. Not the rejected recompiler: this is a GPU-parallel interpreter.
- Inspired by: items 38, 13, 39.

### H. A font that computes
- Pitch: A .ttf file that plays a game in any text box: type in Google Docs and a Snake game happens in the glyphs.
- Demo: Open Notes, select "Bastard Snake" font, press keys, the snake moves.
- Hard core: a compiler from a tiny language to OpenType GSUB/GPOS lookups (a weird Turing-ish machine), with an optimizer to fit shaper limits.
- Baseline: lookup count, shaping time in HarfBuzz, CoreText and DirectWrite; earlier font games (to be verified).
- Data: none.
- Milestones: (1) font that adds two numbers you type; (2) state machine compiler; (3) Snake; (4) cross-shaper test matrix; (5) optimizer that halves lookups.
- Outside mention: HarfBuzz maintainers, the Times New Bastard author.
- Risk: medium. Shaper limits differ by platform.
- Inspired by: items 16, 14.

### I. The whole fly brain in a tab
- Pitch: The full fruit fly connectome simulated live in your browser, seeing through your webcam.
- Demo: Wave your hand at the webcam; the 3D fly's brain lights up and it takes off.
- Hard core: sparse spiking simulation of about 140k neurons and tens of millions of synapses at real time on WebGPU (sparse matrix layout, event-driven updates), mapped to a physics body.
- Baseline: Brian2 and NEST on CPU, DesktopFly; simulated seconds per wall second, spike-train agreement with Brian2.
- Data: FlyWire is public; download once.
- Milestones: (1) LIF sim on CPU matching Brian2 on a subset; (2) full connectome on WebGPU; (3) faster than real time; (4) webcam motion into visual neurons; (5) motor output drives a 3D fly.
- Outside mention: DesktopFly author, FlyWire team.
- Risk: medium. GPU memory for the synapse table is the main constraint.
- Inspired by: item 37.

### J. See through the wall with $5 chips
- Pitch: Four ESP32s on a desk detect a person breathing behind a wall, using only WiFi.
- Demo: A student stands behind a whiteboard; a live chart shows their breathing and an arrow points where they are.
- Hard core: CSI extraction, phase sanitization across unsynchronized radios, MUSIC angle of arrival, breathing-rate estimation. All DSP, no ML.
- Baseline: ESPARGOS results, a $30 mmWave radar module as ground truth.
- Data: none to train; just calibration.
- Milestones: (1) CSI streaming from 1 ESP32; (2) phase sync across 4; (3) AoA of a WiFi source under 10 degrees error; (4) breathing rate vs a chest strap; (5) through-wall live demo.
- Outside mention: ESPARGOS authors, rtl-sdr.com.
- Risk: medium to high. RF is finicky; keep a line-of-sight fallback demo.
- Inspired by: ESP32 hidden SDR (Novel I/O list), Subvocal.

### K. Every asteroid, integrated live
- Pitch: Drop a second Jupiter into the real solar system and watch 1.4 million real asteroids respond, in your browser.
- Demo: The live solar system; click "add planet"; the asteroid belt visibly warps over simulated millennia in seconds.
- Hard core: WebGPU symplectic integrator with double-float emulation, Barnes-Hut or hierarchical force for perturbations, precision tests.
- Baseline: REBOUND and JPL Horizons position errors over 100 years, Space Now (display only).
- Data: JPL SBDB public catalogue.
- Milestones: (1) WHFast-style integrator on CPU vs REBOUND; (2) double-float on WebGPU; (3) 1M bodies at interactive rate; (4) perturbation mode; (5) error report vs Horizons.
- Outside mention: REBOUND maintainer (Hanno Rein, U of T, close by), Space Now author.
- Risk: low to medium.
- Inspired by: items 8, 9.
