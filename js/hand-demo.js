/* "Try it" demo: your hand drives a drawing of the robot hand.

   The curl math is ported from the real project
   (github.com/JoeTouchman/JoebotHand, tracking/hand_tracking.html):
   MediaPipe gives 21 hand landmarks in 3D, each finger's curl is the sum of its
   joint bend angles, and that is mapped to 0..1 between an "open" and a
   "curled" angle and smoothed. On the real hand those five numbers go to the
   ESP32 over a WebSocket; here they move a 3D model of the hand instead
   (js/hand-3d.js), with a simple 2D drawing as the fallback.

   MediaPipe and its model (about 8 MB) are only downloaded after the visitor
   presses the button. Video is processed in the browser and never uploaded. */

const MP_VERSION = "1.0.1";
const MP_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const robotCanvas = document.getElementById("demoRobot");
const camCanvas = document.getElementById("demoCam");
const camBox = document.getElementById("demoCamBox");
const startBtn = document.getElementById("demoStart");
const stopBtn = document.getElementById("demoStop");
const statusEl = document.getElementById("demoStatus");
const barRows = [...document.querySelectorAll("#demoBars li")].map((li) => ({
  fill: li.querySelector("b"),
  out: li.querySelector("em"),
}));

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("is-err", isError);
}

// ---------------------------------------------------------------- curl math
// Raw-angle ranges in degrees for open -> curled (the project's defaults).
const CAL = [
  { min: 50, max: 190 }, // thumb: MCP + IP + across-palm
  { min: 25, max: 200 }, // index: MCP + PIP + DIP
  { min: 25, max: 200 },
  { min: 25, max: 200 },
  { min: 25, max: 200 },
];
const ALPHA = 0.35; // smoothing
const FINGER_JOINTS = [null, [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
const BONES = [
  [0, 1, 0], [1, 2, 0], [2, 3, 0], [3, 4, 0],
  [0, 5, -1], [5, 6, 1], [6, 7, 1], [7, 8, 1],
  [5, 9, -1], [9, 10, 2], [10, 11, 2], [11, 12, 2],
  [9, 13, -1], [13, 14, 3], [14, 15, 3], [15, 16, 3],
  [13, 17, -1], [0, 17, -1], [17, 18, 4], [18, 19, 4], [19, 20, 4],
]; // [from, to, finger index or -1 for palm]

const sub = (a, b) => [a.x - b.x, a.y - b.y, a.z - b.z];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const len = (u) => Math.hypot(u[0], u[1], u[2]);
const unit = (u) => { const n = len(u) || 1; return [u[0] / n, u[1] / n, u[2] / n]; };
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const removeAxis = (u, axis) => { const d = dot(u, axis); return [u[0] - axis[0] * d, u[1] - axis[1] * d, u[2] - axis[2] * d]; };
function angleDeg(u, v) {
  const n = len(u) * len(v);
  return n < 1e-12 ? 0 : (Math.acos(clamp(dot(u, v) / n, -1, 1)) * 180) / Math.PI;
}
const bend = (a, b, c) => angleDeg(sub(b, a), sub(c, b));

// World landmarks -> raw curl angle per finger, in degrees.
function fingerAngles(w) {
  const knuckles = unit(sub(w[5], w[17]));
  const out = [];
  // Thumb: two hinge bends plus how far it swings across the palm.
  out.push(bend(w[1], w[2], w[3]) + bend(w[2], w[3], w[4]) + angleDeg(sub(w[2], w[1]), knuckles));
  for (let f = 1; f < 5; f++) {
    const [mcp, pip, dip, tip] = FINGER_JOINTS[f];
    // Sideways spread is removed, so spreading your fingers doesn't read as curl.
    const mcpFlex = angleDeg(removeAxis(sub(w[mcp], w[0]), knuckles), removeAxis(sub(w[pip], w[mcp]), knuckles));
    out.push(mcpFlex + bend(w[mcp], w[pip], w[dip]) + bend(w[pip], w[dip], w[tip]));
  }
  return out;
}
const normalize = (angle, c) => clamp((angle - c.min) / (c.max - c.min), 0, 1);

// ------------------------------------------------------------- robot drawing
const rctx = robotCanvas.getContext("2d");
const BONE = [236, 232, 225];
const SHADE = [168, 162, 158];
const mix = (t) => `rgb(${BONE.map((c, i) => Math.round(c + (SHADE[i] - c) * t)).join(",")})`;
const rad = (d) => (d * Math.PI) / 180;

// Fingers as seen from the front, palm toward the viewer. Order matches the
// curl array: thumb, index, middle, ring, pinky.
const FINGERS = [
  null,
  { x: 327, y: 262, w: 36, seg: [58, 42, 32], splay: 7 },
  { x: 281, y: 254, w: 37, seg: [64, 46, 34], splay: 1 },
  { x: 235, y: 260, w: 36, seg: [58, 42, 32], splay: -5 },
  { x: 190, y: 272, w: 32, seg: [46, 33, 27], splay: -11 },
];

function capsule(x1, y1, x2, y2, w, color) {
  rctx.lineCap = "round";
  rctx.strokeStyle = "#0c0b0d";
  rctx.lineWidth = w + 6;
  rctx.beginPath(); rctx.moveTo(x1, y1); rctx.lineTo(x2, y2); rctx.stroke();
  rctx.strokeStyle = color;
  rctx.lineWidth = w;
  rctx.beginPath(); rctx.moveTo(x1, y1); rctx.lineTo(x2, y2); rctx.stroke();
}

function drawRobot(curls, connected, time) {
  const W = robotCanvas.width, H = robotCanvas.height;
  rctx.clearRect(0, 0, W, H);

  // forearm
  const body = rctx.createLinearGradient(168, 0, 352, 0);
  body.addColorStop(0, "#2c2931"); body.addColorStop(0.45, "#4a4551"); body.addColorStop(1, "#27242b");
  rctx.fillStyle = body;
  rctx.strokeStyle = "#5a5462";
  rctx.lineWidth = 2;
  rctx.beginPath();
  rctx.moveTo(208, 428); rctx.lineTo(312, 428); rctx.lineTo(352, 536); rctx.lineTo(168, 536);
  rctx.closePath(); rctx.fill(); rctx.stroke();
  rctx.beginPath(); rctx.ellipse(260, 536, 104, 16, 0, 0, Math.PI * 2);
  rctx.fillStyle = "#34303a"; rctx.fill(); rctx.stroke();
  // status ring: pulses while waiting, solid once a hand is tracked (like the real one)
  const pulse = connected ? 1 : 0.45 + 0.4 * Math.sin(time * 3);
  rctx.beginPath(); rctx.arc(260, 496, 11, 0, Math.PI * 2);
  rctx.strokeStyle = `rgba(47,125,255,${pulse})`;
  rctx.lineWidth = 4;
  rctx.shadowColor = "rgba(47,125,255,.9)"; rctx.shadowBlur = 16 * pulse;
  rctx.stroke();
  rctx.shadowBlur = 0;

  // wrist + palm
  capsule(260, 432, 260, 400, 78, mix(0.35));
  rctx.fillStyle = "#0c0b0d";
  rctx.beginPath(); rctx.roundRect(163, 247, 194, 170, 34); rctx.fill();
  rctx.fillStyle = mix(0.08);
  rctx.beginPath(); rctx.roundRect(166, 250, 188, 164, 31); rctx.fill();

  // four fingers: each joint adds to the bend, and the drawing is the front-on
  // projection, so a curling finger shortens and then folds over the palm
  for (let f = 4; f >= 1; f--) {
    const c = curls[f];
    const g = FINGERS[f];
    const bends = [c * 85, c * 95, c * 70];
    let a = 0, x = g.x, y = g.y;
    const sx = Math.sin(rad(g.splay));
    for (let s = 0; s < 3; s++) {
      a += bends[s];
      const proj = g.seg[s] * Math.cos(rad(a));
      const nx = x + proj * sx, ny = y - proj;
      const w = g.w - s * 2;
      capsule(x, y, nx, ny, w, mix(0.55 * Math.pow(Math.sin(rad(Math.min(a, 180))), 2) + s * 0.04));
      x = nx; y = ny;
    }
  }

  // thumb: swings from out to the side to across the palm
  const t = curls[0];
  let tx = 352, ty = 366;
  const dir = unit2(0.87 + (1 - 0.87) * t, -0.5 + 0.72 * t);
  const scales = [Math.cos(rad(t * 112)), Math.cos(rad(t * 150))];
  [56, 46].forEach((L, s) => {
    const nx = tx + dir[0] * L * scales[s], ny = ty + dir[1] * L * scales[s];
    capsule(tx, ty, nx, ny, 37 - s * 3, mix(0.5 * t + s * 0.05));
    tx = nx; ty = ny;
  });
}
function unit2(x, y) { const n = Math.hypot(x, y) || 1; return [x / n, y / n]; }

// Canvas roundRect is missing in a few older browsers.
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
  };
}

function showBars(curls) {
  curls.forEach((c, i) => {
    const pct = Math.round(c * 100);
    barRows[i].fill.style.width = pct + "%";
    barRows[i].out.textContent = pct + "%";
  });
}

// -------------------------------------------------------------------- state
let mode = "idle"; // idle | loading | live
let landmarker = null;
let stream = null;
let video = null;
let lastVideoTime = -1;
let handPresent = false;
let visible = true;
const smoothed = [null, null, null, null, null];
const shown = [0, 0, 0, 0, 0]; // what the drawing currently shows

// The startup wave the real hand plays when you press its button.
function idleCurls(time) {
  const out = [0, 0, 0, 0, 0];
  if (reduceMotion) return out;
  for (let i = 0; i < 5; i++) {
    const phase = (((time * 0.85 - (4 - i) * 0.16) % 3.4) + 3.4) % 3.4;
    out[i] = phase < 1 ? Math.pow(Math.sin(phase * Math.PI), 2) * 0.92 : 0;
  }
  return out;
}

const cctx = camCanvas.getContext("2d");
function drawCamera(image, curls) {
  const w = camCanvas.width, h = camCanvas.height;
  cctx.save();
  cctx.translate(w, 0);
  cctx.scale(-1, 1); // mirror
  cctx.drawImage(video, 0, 0, w, h);
  if (image) {
    cctx.lineWidth = 4;
    cctx.lineCap = "round";
    for (const [a, b, f] of BONES) {
      cctx.strokeStyle = f < 0 ? "rgba(255,255,255,.8)" : `hsl(${Math.round(140 - 140 * curls[f])} 85% 55%)`;
      cctx.beginPath();
      cctx.moveTo(image[a].x * w, image[a].y * h);
      cctx.lineTo(image[b].x * w, image[b].y * h);
      cctx.stroke();
    }
    cctx.fillStyle = "#fff";
    for (const p of image) { cctx.beginPath(); cctx.arc(p.x * w, p.y * h, 3.5, 0, Math.PI * 2); cctx.fill(); }
  }
  cctx.restore();
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!visible) return;
  const time = now / 1000;
  let target = idleCurls(time);

  if (mode === "live" && video && video.readyState >= 2) {
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      if (camCanvas.width !== video.videoWidth && video.videoWidth) {
        camCanvas.width = video.videoWidth;
        camCanvas.height = video.videoHeight;
      }
      const res = landmarker.detectForVideo(video, performance.now());
      const world = res.worldLandmarks && res.worldLandmarks[0];
      const image = res.landmarks && res.landmarks[0];
      const curls = [0, 0, 0, 0, 0];
      if (world && image) {
        fingerAngles(world).forEach((raw, i) => {
          smoothed[i] = !handPresent || smoothed[i] == null ? raw : ALPHA * raw + (1 - ALPHA) * smoothed[i];
          curls[i] = normalize(smoothed[i], CAL[i]);
        });
        if (!handPresent) setStatus("Tracking");
        handPresent = true;
        liveCurls = curls;
      } else {
        if (handPresent) setStatus("No hand detected");
        handPresent = false;
        liveCurls = [0, 0, 0, 0, 0];
      }
      drawCamera(image, curls);
    }
    target = liveCurls;
  }

  // ease the drawing toward the target, the way servos take a moment to get there
  for (let i = 0; i < 5; i++) shown[i] += (target[i] - shown[i]) * (mode === "live" ? 0.45 : 0.3);
  const tracking = mode === "live" && handPresent;
  if (hand3d) hand3d.update(shown, tracking, mode === "live", time);
  else drawRobot(shown, tracking, time);
  showBars(shown);
}
let liveCurls = [0, 0, 0, 0, 0];

async function createLandmarker() {
  const mp = await import(`${MP_CDN}/vision_bundle.mjs`);
  const fileset = await mp.FilesetResolver.forVisionTasks(`${MP_CDN}/wasm`);
  let lastError;
  for (const delegate of ["GPU", "CPU"]) {
    try {
      return await mp.HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    } catch (e) { lastError = e; }
  }
  throw lastError;
}

function stopCamera() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  video = null;
  handPresent = false;
  mode = "idle";
  camBox.hidden = true;
  stopBtn.hidden = true;
  startBtn.hidden = false;
  startBtn.disabled = false;
}

async function start() {
  if (mode !== "idle") return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("This browser can't open a camera here. The clips above show the real thing.", true);
    return;
  }
  mode = "loading";
  startBtn.disabled = true;
  setStatus("Waiting for camera permission…");
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch (e) {
    stopCamera();
    setStatus(e && e.name === "NotAllowedError"
      ? "Camera access was blocked. Allow it for this page and try again."
      : "Couldn't open a camera on this device.", true);
    return;
  }
  try {
    video = document.createElement("video");
    video.playsInline = true;
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    if (!landmarker) {
      setStatus("Loading the hand-tracking model (about 8 MB)…");
      landmarker = await createLandmarker();
    }
  } catch (e) {
    stopCamera();
    setStatus("The tracking model didn't load. Check your connection and try again.", true);
    return;
  }
  smoothed.fill(null);
  lastVideoTime = -1;
  camBox.hidden = false;
  startBtn.hidden = true;
  stopBtn.hidden = false;
  mode = "live";
  setStatus("No hand detected");
}

startBtn.addEventListener("click", start);
stopBtn.addEventListener("click", () => {
  stopCamera();
  setStatus("Camera off");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && mode === "live") { stopCamera(); setStatus("Camera off"); }
});

// ------------------------------------------------------------- 3D model
// The drawing above is what shows first. When the demo is about to scroll into
// view, the real 3D model (three.js + assets/models/hand.glb) is loaded and
// takes over. If that fails for any reason, the drawing simply stays.
let hand3d = null;
const view = document.getElementById("demoView");
const hint = document.getElementById("demoHint");
new IntersectionObserver(async (entries, observer) => {
  if (!entries[0].isIntersecting) return;
  observer.disconnect();
  try {
    const { createHand3D } = await import("./hand-3d.js");
    hand3d = await createHand3D(view);
    robotCanvas.hidden = true;
    if (hint) hint.hidden = false;
  } catch (e) {
    console.warn("3D hand unavailable, keeping the drawing:", e);
  }
}, { rootMargin: "700px" }).observe(view);

new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(view);
requestAnimationFrame(frame);
