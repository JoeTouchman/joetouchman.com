/* The 3D hand in the "Try it" demo.

   assets/models/hand.glb is my Blender model of the real hand: every finger
   segment is its own object with its origin on the hinge pin, and the file
   holds two poses, fully open (first keyframe) and fully closed (last
   keyframe). Each finger is blended between those two poses by its curl value,
   so the joint limits are the ones posed on the real geometry.

   Loaded on demand by hand-demo.js. If anything here fails, the demo keeps
   using its 2D drawing. */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const MODEL_URL = new URL("../assets/models/hand.glb", import.meta.url).href;

const LED_COLOR = 0x2f7dff;      // the power button's ring: blue, like the real one
const PRINT_WHITE = 0xece8e1;    // hand, fingers and back arm
const PRINT_SILVER = 0x6f7178;   // forearm and stand (silver filament)
const FRONT_YAW = -Math.PI / 2;  // turn the model so the palm and the power button face the viewer

const FINGER_INDEX = { Thumb: 0, Index: 1, Middle: 2, Ring: 3, Pinky: 4 };

function haloTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  // a soft band that peaks on the ring and is clear in the middle, so only the
  // ring glows and the metal cap inside it stays metal
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.36, "rgba(255,255,255,0)");
  grad.addColorStop(0.48, "rgba(255,255,255,.75)");
  grad.addColorStop(0.62, "rgba(255,255,255,.16)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export async function createHand3D(container) {
  // Load the model first, so a failed download never leaves an empty canvas behind.
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;

  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(2.5, 3, 4);
  const rimRed = new THREE.DirectionalLight(0xe5243b, 2.6);
  rimRed.position.set(-4, 1.5, -3);
  const rimViolet = new THREE.DirectionalLight(0x7a4bff, 2.0);
  rimViolet.position.set(4, 2, -3.5);
  scene.add(key, rimRed, rimViolet);

  // ---- materials (the file carries none; the look is set here)
  const white = new THREE.MeshStandardMaterial({ color: PRINT_WHITE, roughness: 0.62 });
  const silver = new THREE.MeshStandardMaterial({ color: PRINT_SILVER, metalness: 0.55, roughness: 0.48 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd5d8dc, metalness: 1, roughness: 0.3 });
  const ledColor = new THREE.Color(LED_COLOR);
  const led = new THREE.MeshBasicMaterial({ color: ledColor.clone(), toneMapped: false });

  const root = gltf.scene;
  let ledNode = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === "ButtonLED") { o.material = led; ledNode = o; }
    else if (o.name === "Button") o.material = metal;
    else if (o.name === "ForeArm") o.material = silver;
    else o.material = white;
  });

  // ---- the two poses: first and last keyframe of every rotation track
  const joints = [];
  for (const clip of gltf.animations) {
    for (const track of clip.tracks) {
      if (!track.name.endsWith(".quaternion")) continue;
      const name = track.name.slice(0, -".quaternion".length);
      const node = root.getObjectByName(name);
      const finger = FINGER_INDEX[name.replace(/\d+$/, "")];
      if (!node || finger === undefined) continue;
      const v = track.values;
      joints.push({
        node,
        finger,
        open: new THREE.Quaternion().fromArray(v, 0),
        closed: new THREE.Quaternion().fromArray(v, v.length - 4),
      });
    }
  }
  if (!joints.length) throw new Error("hand.glb has no finger poses");

  // ---- the ring's glow
  let halo = null, ledLight = null;
  if (ledNode) {
    // The ring lies flat in the button's face (its local XZ plane, facing -Y) at a
    // radius of about 0.072. The halo is a flat patch in that same plane, sized so
    // the bright band of its texture sits on the ring.
    halo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.3),
      new THREE.MeshBasicMaterial({
        map: haloTexture(), color: LED_COLOR, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
      })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, -0.112, 0);
    ledLight = new THREE.PointLight(LED_COLOR, 0.3, 0.7, 2);
    ledLight.position.set(0, -0.22, 0);
    ledNode.add(halo, ledLight);
  }

  // ---- centre the model on a pivot and fit the camera to it
  const pivot = new THREE.Group();
  pivot.add(root);
  scene.add(pivot);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  root.position.sub(box.getCenter(new THREE.Vector3()));
  pivot.rotation.y = FRONT_YAW;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const radius = Math.max(size.y, Math.hypot(size.x, size.z)) / 2;
  function fitCamera() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const fit = Math.min(vFov, 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect));
    const dist = (radius * 1.03) / Math.sin(fit / 2);
    const dir = camera.position.lengthSq() ? camera.position.clone().normalize() : new THREE.Vector3(0, 0.16, 1).normalize();
    camera.position.copy(dir.multiplyScalar(dist));
    camera.updateProjectionMatrix();
  }

  const canvas = renderer.domElement;
  canvas.className = "gl";
  canvas.setAttribute("aria-label", "A 3D model of the robotic hand that copies your finger positions. Drag to rotate.");
  container.appendChild(canvas);
  fitCamera();

  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.8;
  controls.minPolarAngle = 0.95;
  controls.maxPolarAngle = 1.95;
  canvas.style.touchAction = "pan-y";   // on phones a vertical swipe still scrolls the page
  let dragging = false, lastTouched = -1e9;
  controls.addEventListener("start", () => { dragging = true; });
  controls.addEventListener("end", () => { dragging = false; lastTouched = performance.now(); });

  new ResizeObserver(fitCamera).observe(container);

  let sway = 0;
  /* curls: five numbers 0..1 (thumb to pinky). tracking: a real hand is being followed.
     live: the camera is on. time: seconds. */
  function update(curls, tracking, live, time) {
    for (const j of joints) j.node.quaternion.slerpQuaternions(j.open, j.closed, curls[j.finger]);

    // ring: pulses while waiting, solid once a hand is tracked (like the real button)
    const k = tracking ? 1 : 0.5 + 0.35 * Math.sin(time * 3);
    led.color.copy(ledColor).multiplyScalar(0.4 + 0.6 * k);
    if (halo) { halo.material.opacity = 0.15 + 0.6 * k; ledLight.intensity = 0.3 * k; }

    // a slow turn while idle; face forward when the camera is on or after someone drags it
    const idle = !live && !dragging && performance.now() - lastTouched > 6000;
    sway += ((idle ? 1 : 0) - sway) * 0.03;
    pivot.rotation.y = FRONT_YAW + Math.sin(time * 0.45) * 0.38 * sway;

    controls.update();
    renderer.render(scene, camera);
  }

  return { update };
}
