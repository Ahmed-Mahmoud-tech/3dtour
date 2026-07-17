# Prompt: Build "Speed Ramp Studio" — a Windows desktop app

Copy everything below this line into your AI coding tool.

---

Build a Windows desktop application called **Speed Ramp Studio** for baking speed
ramps into video files. The user loads a video, draws the speed wave they want on
an interactive curve editor, chooses the output frame rate and quality, previews
the result, and exports a new video file with the speed ramp permanently baked in
(the exported file plays the ramp at normal 1x in any player/browser — no runtime
speed logic).

## Tech stack

- **Electron + React + TypeScript** (single-window desktop app), packaged with
  electron-builder into a Windows installer/portable exe.
- **FFmpeg is the processing engine — not Python/OpenCV.** Decoding, the time
  warp, interpolation, stabilization, and encoding all happen inside a single
  FFmpeg filter graph per file: it is hardware-tuned, multi-threaded, handles
  8K, and never loads raw frames into app memory. A Python layer (OpenCV /
  MoviePy) would decode frames into RAM (an 8K frame is ~95 MB raw), be an
  order of magnitude slower, and reimplement what FFmpeg already does better.
  Bundle ffmpeg/ffprobe binaries with the app (or detect them on PATH / let the
  user browse to them in Settings). All processing runs in the main process via
  child_process, never blocking the UI.

## Core screen layout

1. **Drop zone / file list (left)** — drag & drop or browse for one or more video
   files. For each file show: filename, resolution, fps, duration, codec (read
   via ffprobe JSON output). Support batch: the same wave applies to every queued
   file on export.
2. **Wave editor (center, the heart of the app)** — an interactive canvas graph:
   - X axis = position in the clip, 0% → 100%.
   - Y axis = playback speed multiplier, from 0.25x to 16x. Use a logarithmic or
     piecewise scale so 1x sits comfortably and both slow-motion and high speeds
     are draggable with precision. Draw a bold horizontal reference line at 1x.
   - Keyframe points the user can **drag, add (double-click), and delete
     (right-click)**. First and last points are locked to x=0% and x=100% (y
     still draggable). Points in between are interpolated with **cosine (smooth)
     easing** into one continuous curve; draw the interpolated curve, not just
     segments.
   - A **global speed multiplier** slider/number input (0.25x–4x) that scales the
     whole wave visually in real time.
   - **Presets** dropdown: Constant 1x, Constant 2x, "Glide" (1x → 4x cruise →
     1x), "Whoosh" (1x → 10x → 1x), + Save/Load custom presets to JSON files.
   - Live readouts that update as the curve changes: **estimated output duration**
     (see math below) and estimated output frame count.
3. **Output settings (right panel)**:
   - Output FPS: 30 / 60 / custom number.
   - Smoothing mode (radio):
     - **Motion blur (fast)** — frame-blending shutter blur, quick to render.
     - **Optical flow (best, slow)** — motion-compensated frame synthesis;
       label it clearly with "several times slower to export".
     - **None** — nearest-frame only.
   - Motion blur strength (2–16 samples, default 8), only enabled in blur mode.
   - **Stabilization (on/off toggle, default OFF)** — reduces camera shake.
     See the stabilization section below for the exact two-pass chain and the
     360°-footage caveat that must be shown in the UI.
   - **Resolution**: Keep original / 4K (3840) / 1080p / custom width. Must
     accept **8K sources (7680×3840)** — scaling uses
     `scale='min(TARGET,iw)':-2:flags=lanczos` so smaller videos are never
     upscaled.
   - **Codec**: H.264 (max compatibility — required if the file will play in
     browsers) or H.265/HEVC (~40% smaller at equal quality, needs modern
     players). Tooltip explains the trade-off.
   - **Quality** — three modes the user picks from, all fully controllable:
     - **Visually lossless (max compression, recommended)**: CRF 18 for H.264 /
       CRF 20 for H.265, preset `slow`. This is the honest "smallest file with
       no visible quality loss" point — explain in a tooltip that lossless-at-
       max-compression is a trade-off and CRF 18/slow is where differences stop
       being visible to the eye.
     - **Balanced**: CRF 23 / preset medium.
     - **Custom**: CRF slider 14–30 + preset dropdown (ultrafast→veryslow),
       with a live hint of what the setting means ("lower CRF = better quality,
       bigger file; slower preset = same quality, smaller file, longer export").
   - Checkbox "strip audio" (default ON — speed-ramped audio is rarely wanted;
     if OFF, drop audio anyway when mode ≠ None and explain why in a tooltip,
     or pitch-correct with atempo chains only for constant-speed ramps).
   - Output folder + filename suffix (default `_ramped`).
4. **Preview** — a "Preview" button renders a fast low-resolution proxy (scale to
   640px wide, CRF 30, ultrafast preset, same wave/fps settings) of the current
   file and plays it in an HTML5 `<video>` element in the app. Show render
   progress. Preview must never overwrite anything; use a temp folder.
5. **Export** — processes the queue with a progress bar per file (parse FFmpeg's
   `-progress pipe:1` output: out_time_us / total estimated duration). Allow
   cancel. On finish show the output size and a button to open the folder.
   Run at most 2 FFmpeg jobs in parallel (4K encodes are RAM-heavy; a crashed
   job at frame 0 usually means out-of-memory — surface that hint in the error).

## The math (implement exactly this)

The wave is a function `rate(p)` where `p ∈ [0,1]` is position in the source clip,
built from the keyframes with cosine interpolation:

```
rate(p): find surrounding keyframes a, b;  t = (p - a.x) / (b.x - a.x)
         s = 0.5 - 0.5*cos(π*t);           return a.y + (b.y - a.y)*s
```

(multiply the result by the global speed multiplier; clamp to ≥ 0.25).

**Time warp**: output time is the integral `t_out(t_in) = ∫ dt/rate`. Integrate
numerically with the midpoint rule over **N = 64** equal pieces of the source
duration, producing arrays `tIn[0..N]`, `tOut[0..N]`. Estimated output duration =
`tOut[N]` — this powers the live readout: `outputDuration = duration × Σ(1/rate)`.

Convert that mapping into a **piecewise-linear FFmpeg `setpts` expression** built
as nested `if(lt(T,...))` terms:

```
expr = "tOut[N] + (T - tIn[N]) / rate(1)"
for i = N-1 down to 0:
    slope = (tOut[i+1] - tOut[i]) / (tIn[i+1] - tIn[i])
    expr = "if(lt(T," + tIn[i+1] + ")," + tOut[i] + "+(T-" + tIn[i] + ")*" + slope + "," + expr + ")"
filter: setpts='(expr)/TB'      // single quotes protect the commas
```

Format all numbers with 6 decimal places.

## The FFmpeg filter chains (proven recipes — use them verbatim)

Let `OUT` = output fps, `B` = blur samples.

- **None**: `setpts='(expr)/TB', fps=OUT`
- **Motion blur**: oversample the warped timeline, average aligned windows, keep
  one blended frame per output interval (windows aligned to output frames —
  a trailing `fps` filter would pick straddling windows and ghost):

  ```
  setpts='(expr)/TB', fps=OUT*B, tmix=frames=B, select='not(mod(n+1,B))', setpts=N/(OUT*TB)
  ```

- **Optical flow**: synthesize true in-between frames BEFORE the warp so the
  timeline always has at least one real position per output frame (kills
  repeated frames at slow rates and blend shimmer at odd rates), then apply the
  blur chain on top:

  ```
  minterpolate=fps=OUT:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=none, setpts='(expr)/TB', fps=OUT*B, tmix=frames=B, select='not(mod(n+1,B))', setpts=N/(OUT*TB)
  ```

  `scd=none` is required: continuous footage has no scene cuts and fast sections
  must be interpolated, not treated as cuts.

- **Encode**: H.264 `-c:v libx264 -crf <CRF> -preset <preset> -pix_fmt yuv420p -movflags +faststart`, or H.265 `-c:v libx265 -crf <CRF> -preset <preset> -pix_fmt yuv420p -tag:v hvc1 -movflags +faststart` (+ `-an` when stripping audio). Scaling (when a target resolution is chosen) goes FIRST in the chain: `scale='min(TARGET,iw)':-2:flags=lanczos`. Write to a temp file, rename on success.

## Stabilization (the on/off "fix shaking" mode)

Use FFmpeg's **vidstab** two-pass workflow (much better than the one-pass
`deshake` filter). When the toggle is ON, each export becomes two FFmpeg runs:

1. **Analyze pass** (fast, no encode):
   `-vf vidstabdetect=shakiness=6:accuracy=15:result=<temp>.trf -f null -`
2. **Transform pass** — prepend to the normal filter chain, BEFORE scaling and
   the speed warp:
   `vidstabtransform=input=<temp>.trf:smoothing=30:zoom=2:interpol=bicubic, unsharp=5:5:0.8:3:3:0.4`

Expose one simple "Strength" slider (Low/Medium/High → smoothing 15/30/45) next
to the toggle. Show the analyze pass as its own progress stage. Delete the .trf
temp file afterwards.

**Required UI caveats** (short inline hints, not hidden docs):
- Stabilization crops/zooms slightly (~2%) to hide the moving edges.
- **360°/equirectangular footage warning**: if the video's aspect ratio is
  exactly 2:1 (e.g. 7680×3840, 3840×1920), show: "This looks like a 360° video.
  Standard stabilization bends the horizon of equirectangular footage — prefer
  your camera app's own stabilization (e.g. FlowState) and keep this OFF."
  Let the user override, but warn.
- Stabilization + optical flow together is the slowest combination; show a
  combined time-cost indicator (●○○ / ●●○ / ●●● next to each option).

## Built-in guidance (show as inline hints, not buried docs)

- Rates **below 1x judder** unless optical flow is on — in blur/none mode, tint
  the sub-1x region of the wave editor red and show "slow motion will stutter
  without Optical Flow".
- In **Motion blur mode with a 30fps source and 60fps output**, steady speeds
  blend uniformly only when speed/2 is a whole number (2x, 4x, 6x, 8x); odd
  speeds shimmer (alternating sharp/blurred frames). Show a subtle hint when a
  long flat section of the curve sits at a non-conforming speed. Optical flow
  mode removes this restriction entirely.
- Very high speeds read as steps: warn above ~8x at 60fps output.

## Quality bar

- The app must handle **8K (7680×3840) and 4K equirectangular clips**, including
  HEVC camera masters at 60+ Mbps. For 8K inputs: process with at most ONE
  parallel job, warn when free RAM is low (optical flow on 8K is very
  memory-hungry), and suggest the 4K output preset when the source is 8K.
- UI stays responsive during renders; all FFmpeg output logged to a collapsible
  log panel for debugging.
- Errors are human-readable: missing ffmpeg, unreadable input, disk full,
  out-of-memory (exit at frame 0), each with a suggested fix.
- Dark theme, clean modern look; the wave editor is the visual centerpiece.

Deliver the complete project with build instructions (`npm install`,
`npm run dev`, `npm run dist`) and a short README explaining the wave editor.
