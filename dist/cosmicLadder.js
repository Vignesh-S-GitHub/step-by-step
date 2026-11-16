import { normalizeGoldenSteps, stepsPerZone, zoneIndex, zones, moveRocket } from './model.mjs';

const threeUrl = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.1/three.module.min.js';
const spacing = .49;
const palettes = {
  amethyst: ['#130825', '#582183', '#c47aff', '#edc7ff'],
  lagoon: ['#051b26', '#18606e', '#5dded6', '#cff9f0'],
  dusk: ['#241123', '#783448', '#ff9774', '#ffe1bc'],
  orbit: ['#070f27', '#294b8b', '#8fb8ff', '#def0ff'],
};
const scenicSkies = ['#703964', '#4d70ae', '#3059a4', '#252251', '#333154', '#633656', '#582d7e', '#243269', '#682e90'];
const clamp = (value, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, value));
const smooth = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const fract = (n) => n - Math.floor(n);
const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
const mix = (a, b, t) => a + (b - a) * t;
let threePromise;
let webGLUnavailable = false;

function noise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), u = smooth(x - i), v = smooth(y - j);
  return mix(mix(hash(i, j), hash(i + 1, j), u), mix(hash(i, j + 1), hash(i + 1, j + 1), u), v);
}

function fbm(x, y) {
  return .54 * noise(x, y) + .27 * noise(x * 2.12 + 4, y * 2.12) + .13 * noise(x * 4.3, y * 4.3 + 8) + .06 * noise(x * 9, y * 9);
}

// Small deterministic texture canvases survive route changes, while each GPU copy is disposable.
const textureSources = new Map();
function textureCanvas(name) {
  if (textureSources.has(name)) return textureSources.get(name);
  const canvas = document.createElement('canvas');
  const planet = ['earth', 'clouds', 'moon', 'gas', 'sun'].includes(name);
  canvas.width = planet ? 256 : 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const image = ctx.createImageData(width, height);
  const craters = Array.from({ length: 21 }, (_, i) => [hash(i, 3), hash(i, 8), .014 + hash(i, 4) ** 2 * .071]);
  // Broad, irregular landmasses on an equirectangular ocean map.
  const continents = [[.23,.31,.12,.17],[.34,.59,.076,.22],[.6,.35,.17,.15],[.56,.55,.087,.21],[.73,.3,.18,.15],[.84,.67,.077,.084],[.42,.17,.05,.09]];
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const u = i / (width - 1), v = j / (height - 1);
    const n = fbm(u * 13, v * 9), detail = noise(u * 53, v * 37);
    let red, green, blue, alpha = 255;
    if (name === 'earth') {
      const continent = Math.max(...continents.map(([x, y, rx, ry]) => 1 - Math.hypot((u - x) / rx, (v - y) / ry)));
      const edge = continent + (n - .53) * 1.25 + (detail - .5) * .15;
      const polar = smooth((Math.abs(v - .5) - .40 + n * .08) * 19);
      const dry = smooth((.22 - Math.abs(v - .39)) * 7) * smooth((n - .48) * 8);
      [red, green, blue] = edge > .015
        ? [42 + dry * 116 + n * 32, 84 + n * 65 + dry * 30, 56 + n * 28 + dry * 8]
        : [12 + n * 22, 40 + n * 55 + (edge > -.04 ? 26 : 0), 90 + n * 76];
      [red, green, blue] = [mix(red, 210, polar), mix(green, 230, polar), mix(blue, 239, polar)];
    } else if (name === 'clouds') {
      [red, green, blue] = [204, 228, 248];
      alpha = 175 * smooth((fbm(u * 14 + n * 4, v * 24) - .46) * 3.5);
    } else if (name === 'moon') {
      let value = 109 + n * 67 + detail * 17;
      for (const [x, y, radius] of craters) {
        const delta = Math.abs(u - x);
        const d = Math.hypot(Math.min(delta, 1 - delta) * 1.7 / radius, (v - y) / radius);
        if (d < 1.48) value += -36 * (1 - smooth(d)) + 29 * Math.exp(-((d - .94) ** 2) * 43);
      }
      [red, green, blue] = [value * .98, value, value * 1.09];
    } else if (name === 'gas') {
      const bands = .52 + .27 * Math.sin(v * 41 + n * 4) + .15 * Math.sin(v * 93 + n * 6);
      const storm = Math.max(0, 1 - Math.hypot((u - .67) / .09, (v - .61) / .064));
      [red, green, blue] = [123 + bands * 103 + storm * 21, 80 + bands * 112, 78 + bands * 92 - storm * 20];
    } else if (name === 'sun') {
      [red, green, blue] = [250, 92 + n * 129, 45 + n * 77 + detail * 16];
    } else {
      const x = u * 2 - 1, y = v * 2 - 1;
      const size = Math.hypot(x, y);
      [red, green, blue] = [255, 255, 255];
      if (name === 'glow') alpha = 255 * Math.exp(-size * size * 5.5) * (1 - smooth(size));
      else if (name === 'confetti') {
        const rotatedX = (x + y) * .707, rotatedY = (x - y) * .707;
        alpha = (1 - smooth((Math.max(Math.abs(rotatedX) * 1.1, Math.abs(rotatedY) * 2.15) - .66) * 10)) * 255;
      }
      else {
        const density = fbm(u * 6 + n * 2.5, v * 7 + n * 1.2);
        const spiral = .44 + .56 * Math.sin(Math.atan2(y, x) * 2 - size * 10 + n * 1.6) ** 4;
        const shape = name === 'spiral' ? spiral : 1;
        alpha = 199 * shape * smooth((density - .24) * 2.35) * (1 - smooth(size));
      }
    }
    const index = (i + j * width) * 4;
    image.data[index] = red;
    image.data[index + 1] = green;
    image.data[index + 2] = blue;
    image.data[index + 3] = alpha;
  }
  ctx.putImageData(image, 0, 0);
  textureSources.set(name, canvas);
  return canvas;
}

function previewZone() {
  const zone = Number(new URLSearchParams(location.search).get('zone'));
  return Number.isInteger(zone) && zone >= 1 && zone <= zones.length ? zone - 1 : null;
}

// Both renderers share touch, mouse and keyboard handling and the same movement bounds.
function bindFlightControls(stage, options, { draw, turn, hitRocket, pulse, center }) {
  let drag;
  let position = { x: 0, y: 0 };

  function move(dx, dy) {
    const { width, height } = stage.getBoundingClientRect();
    position = moveRocket(position, dx, dy, width, height);
    turn(dx, dy);
    draw();
  }

  stage.addEventListener('pointerdown', (event) => {
    if (drag || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    stage.setPointerCapture(event.pointerId);
  }, options);

  stage.addEventListener('pointermove', (event) => {
    if (event.pointerId !== drag?.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    Object.assign(drag, { x: event.clientX, y: event.clientY, moved: true });
    stage.classList.add('is-dragging');
    move(dx, dy);
  }, options);

  function finish(event) {
    if (event.pointerId !== drag?.id) return;
    if (!drag.moved && event.type === 'pointerup' && hitRocket(event)) pulse();
    drag = undefined;
    stage.classList.remove('is-dragging');
    draw();
  }

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(type, finish, options);
  stage.addEventListener('click', (event) => { if (event.detail === 0) pulse(); }, options);
  stage.addEventListener('keydown', (event) => {
    const directions = { ArrowLeft: [-14, 0], ArrowRight: [14, 0], ArrowUp: [0, -9], ArrowDown: [0, 9] };
    if (event.key === 'Home') {
      position = { x: 0, y: 0 };
      center();
      draw();
    } else if (Object.hasOwn(directions, event.key)) {
      move(...directions[event.key]);
    } else return;
    event.preventDefault();
  }, options);

  return { get dragging() { return Boolean(drag); }, get position() { return position; } };
}

export function mount(container) {
  let total = 0;
  let golden = [];
  let view;
  let pending;
  let closed = false;
  const debug = previewZone();
  const stage = container.querySelector('.ladder-stage');
  const labels = container.querySelectorAll('[data-ladder-label]');
  const sceneCount = () => debug === null ? total : debug * stepsPerZone + total % stepsPerZone;
  function updateLabels() {
    const zone = zones[zoneIndex(total)];
    for (const node of labels) {
      const zoneLabel = node.dataset.ladderLabel;
      const sceneZone = zones[zoneIndex(sceneCount())];
      node.hidden = zoneLabel === 'zone' ? !sceneZone.name : false;
      node.textContent = zoneLabel === 'zone' ? [sceneZone.name, sceneZone.distance].filter(Boolean).join(' · ')
        : total.toLocaleString() + (total === 1 ? ' step' : ' steps');
    }
    container.dataset.zone = String(zoneIndex(sceneCount()));
    stage.setAttribute('aria-label', 'Cosmic Flight, ' + (debug === null ? zone.name : zones[debug].name || '') + ' ' + total + ' steps. Drag or use arrow keys to move. Press Home to center or Enter to pulse.');
  }
  updateLabels();
  threePromise ??= import(threeUrl).catch((error) => { threePromise = undefined; throw error; });
  function startView(THREE) {
    if (closed) return;
    try {
      if (THREE && !webGLUnavailable) view = createView(THREE, stage);
    } catch {
      webGLUnavailable = true;
    }
    if (!view) {
      view = createCanvasFallback(stage);
    }
    const count = sceneCount();
    const visibleGold = debug === null ? golden : pending?.golden ? [count] : [];
    view.sync(pending?.previous ?? count, visibleGold, false);
    if (pending) view.sync(count, visibleGold, true, pending.warp);
    pending = undefined;
    stage.classList.add('ladder-live');
    stage.removeAttribute('aria-disabled');
  }
  threePromise.then(startView, () => startView(null)).catch(() => {
    // The static card is the last fallback when a browser supplies no canvas context.
  });

  return {
    setProgress(totalSessions, goldenSteps = []) {
      const count = Math.max(0, Math.floor(Number(totalSessions) || 0));
      const steps = normalizeGoldenSteps(goldenSteps, count);
      if (count === total && steps.length === golden.length && steps.every((step, index) => step === golden[index])) return;
      total = count;
      golden = steps;
      pending = undefined;
      updateLabels();
      view?.sync(sceneCount(), debug === null ? golden : [], false);
    },
    addStep(isGolden = false) {
      const previous = sceneCount();
      const previousZone = zoneIndex(previous);
      total += 1;
      if (isGolden) golden.push(total);
      updateLabels();
      const warp = previousZone !== zoneIndex(sceneCount());
      const canAnimate = sceneCount() === previous + 1;
      if (view) view.sync(sceneCount(), debug === null ? golden : isGolden ? [sceneCount()] : [], canAnimate, warp);
      else if (canAnimate) pending = { previous, golden: isGolden, warp };
      else pending = undefined;
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        navigator.vibrate?.(14);
        if (warp) {
          const caption = container.querySelector('[data-ladder-label="zone"]');
          caption.animate([{ opacity: 0 }, { opacity: 0, offset: .35 }, { opacity: 1 }], { duration: 850 });
        }
      }
    },
    destroy() {
      closed = true;
      view?.destroy();
    },
  };
}

function createView(T, stage) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(pointer: coarse)').matches;
  const lowPower = (navigator.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4;
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: !lowPower, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1.25 : mobile ? 1.65 : 2));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .86;
  stage.append(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(42, 1, .12, 104);
  scene.add(new T.HemisphereLight(0xd7dcff, 0x3c164d, 1.65));
  const key = new T.DirectionalLight(0xffd4b0, 2.2);
  key.position.set(-3, 9, 7);
  scene.add(key);

  const textures = new Map();
  function texture(name) {
    if (!textures.has(name)) {
      const map = new T.CanvasTexture(textureCanvas(name));
      map.colorSpace = T.SRGBColorSpace;
      textures.set(name, map);
    }
    return textures.get(name);
  }
  const orbGeometry = new T.SphereGeometry(1, lowPower ? 24 : 36, lowPower ? 16 : 24);
  function solid(color, roughness = .67) {
    return new T.MeshStandardMaterial({ color, roughness });
  }
  function globe(name, color, size, x, y, z, group) {
    const material = solid(color);
    material.map = name ? texture(name) : null;
    const sphere = new T.Mesh(orbGeometry, material);
    sphere.scale.setScalar(size);
    sphere.position.set(x, y, z);
    group.add(sphere);
    return sphere;
  }
  function glow(name, color, alpha, sx, sy, x, y, z, group, angle = 0) {
    const mat = new T.SpriteMaterial({ map: texture(name), color, opacity: alpha, depthWrite: false, rotation: angle, toneMapped: false });
    const sprite = new T.Sprite(mat);
    sprite.scale.set(sx, sy, 1);
    sprite.position.set(x, y, z);
    group.add(sprite);
    return sprite;
  }
  function earth(group, size, x, y, z) {
    const planet = globe('earth', 0xbadaff, size, x, y, z, group);
    planet.rotation.z = .19;
    const cloud = new T.Mesh(orbGeometry, new T.MeshStandardMaterial({
      map: texture('clouds'), color: 0xd6e5ff, transparent: true, opacity: .64, depthWrite: false,
    }));
    cloud.scale.setScalar(1.014);
    planet.add(cloud);
    const atmosphere = new T.Mesh(orbGeometry, new T.ShaderMaterial({
      transparent: true, side: T.BackSide, depthWrite: false,
      uniforms: { fade: { value: 1 }, tint: { value: new T.Color(0x679cff) } },
      vertexShader: 'varying vec3 normalView; varying vec3 eye; void main(){vec4 p=modelViewMatrix*vec4(position,1.); normalView=normalize(normalMatrix*normal); eye=normalize(-p.xyz); gl_Position=projectionMatrix*p;}',
      fragmentShader: 'varying vec3 normalView; varying vec3 eye; uniform vec3 tint; uniform float fade; void main(){float rim=pow(1.-abs(dot(normalize(normalView),normalize(eye))),2.7); gl_FragColor=vec4(tint, rim*.58*fade);}',
    }));
    atmosphere.scale.setScalar(1.045);
    planet.add(atmosphere);
    return planet;
  }

  const scenery = zones.map((_, index) => {
    const group = new T.Group();
    const rotating = [];
    scene.add(group);
    if (index === 0) {
      const island = new T.Mesh(new T.CylinderGeometry(3.9, 1.35, 1.24, 40), solid(0x30304f));
      island.position.set(0, -2.6, -1.2);
      group.add(island);
      const meadow = globe(null, 0x508b70, 1, 0, -2, -1.2, group);
      meadow.scale.set(4.04, .38, 3.93);
      for (let i = 0; i < 5; i++) {
        const hill = globe(null, [0x76a982, 0x556e81, 0x5da285][i % 3], 1, (i - 2) * 1.5, -1.93, -2.6 - .7 * hash(i, 5), group);
        hill.scale.set(1.4, .8 + hash(i, 6) * 1.2, 1.03);
      }
      const trunkShape = new T.CylinderGeometry(.052, .09, .72, 7);
      const trunk = solid(0x654052);
      const leaf = solid(0x4a9a73);
      for (let i = 0; i < (lowPower ? 7 : 11); i++) {
        const angle = hash(i, 20) * Math.PI * 2;
        const radius = 1.6 + hash(i, 22) * 1.85;
        const tree = new T.Mesh(trunkShape, trunk);
        tree.position.set(Math.cos(angle) * radius, -1.48, Math.sin(angle) * radius - 1.2);
        group.add(tree);
        const crown = new T.Mesh(orbGeometry, leaf);
        crown.position.copy(tree.position).y += .48;
        crown.scale.set(.29, .62 + hash(i, 31) * .24, .29);
        group.add(crown);
      }
      globe('sun', 0xffbd75, 1.06, -3.3, .05, -7, group).material.emissive.setHex(0xc24430);
      glow('glow', 0xff896c, .28, 9, 8, -3.3, .1, -7.6, group);
    } else if (index === 1) {
      for (let i = 0; i < 13; i++) {
        const side = i % 2 ? -1 : 1;
        glow('nebula', i % 3 ? 0xd9d7ff : 0xfebdd4, .22 + hash(i, 83) * .16, 4.2 + hash(i, 82) * 2.7, 1.3 + hash(i, 81), side * (1.4 + hash(i, 73) * 5.3), -3 + hash(i, 74) * 5, -3 - hash(i, 76) * 7, group, -.18 + hash(i, 24) * .33);
      }
    } else if (index === 2) {
      rotating.push(earth(group, 17, -1.5, -19, -11));
      glow('glow', 0x678cff, .19, 22, 4, -1.5, -2.1, -13, group);
    } else if (index === 3) {
      rotating.push(earth(group, 5.5, -2, -5.5, -7));
      const satellite = new T.Group();
      const body = new T.Mesh(new T.BoxGeometry(.48, .4, .42), solid(0xb3b5d6, .26));
      satellite.add(body);
      const panelShape = new T.BoxGeometry(.72, .36, .07);
      for (const direction of [-1, 1]) {
        const panel = new T.Mesh(panelShape, solid(0x3151ac, .33));
        panel.position.x = direction * .59;
        satellite.add(panel);
      }
      satellite.rotation.set(.27, .5, -.22);
      satellite.position.set(2.7, 1.2, -3.5);
      group.add(satellite);
      group.userData.satellite = satellite;
    } else if (index === 4) {
      rotating.push(globe('moon', 0xd3d7ec, 3.4, 1.6, -3.65, -5.1, group), earth(group, .95, -4.8, 2.2, -13));
    } else if (index === 5) {
      const sun = globe('sun', 0xffae5d, 1.65, -4.4, .55, -9, group);
      sun.material.emissiveMap = sun.material.map;
      sun.material.emissive.setHex(0xe57c3a);
      sun.material.emissiveIntensity = .8;
      glow('glow', 0xff9943, .31, 9, 9, -4.4, .55, -9.5, group);
      rotating.push(globe('gas', 0xffe2c4, 1.13, 2.85, 1.17, -6.6, group));
      rotating.push(globe('gas', 0xd7b6e4, .54, -.4, 2.25, -11, group));
      const saturn = globe('gas', 0xe7bc98, 1.5, 3.9, -2.05, -9.5, group);
      const ringColors = [0xdaab9e, 0xeecab3, 0xb292b2];
      for (let i = 0; i < 3; i++) {
        const ring = new T.Mesh(new T.RingGeometry(1.21 + i * .20, 1.37 + i * .20, 64), new T.MeshBasicMaterial({
          color: ringColors[i], side: T.DoubleSide, transparent: true, opacity: .69, depthWrite: false,
        }));
        ring.rotation.set(1.15, .05, .35);
        saturn.add(ring);
      }
    } else if (index === 6) {
      glow('nebula', 0x8570fc, .52, 23, 12, -1, .2, -18, group, -.36);
      glow('nebula', 0xd35bdb, .34, 16, 8, 3, -2.5, -16, group, .4);
      glow('spiral', 0xacb6ff, .86, 15, 6, 2, .05, -13.5, group, .29);
      glow('glow', 0xe9b5ff, .27, 4, 2.8, 2, .05, -13, group);
    } else if (index === 7) {
      for (let i = 0; i < 13; i++) {
        const size = 1.3 + hash(i, 13) * 3;
        glow('spiral', [0xd4a3ff, 0xaecbff, 0xfdba9f][i % 3], .62, size, size * .44, (hash(i, 51) - .5) * 26, (hash(i, 72) - .5) * 13, -13 - hash(i, 8) * 11, group, hash(i, 11) * Math.PI);
      }
    } else {
      glow('nebula', 0xa840fb, .69, 26, 15, 1, -.4, -17, group, -.22);
      glow('spiral', 0xffc671, .72, 18, 5.7, -1.3, -.45, -13, group, .4);
      glow('glow', 0xffc96a, .27, 5.4, 4.5, -1.3, -.45, -12.5, group);
    }
    const materials = new Map();
    group.traverse((node) => {
      const mat = node.material;
      if (mat && !materials.has(mat)) materials.set(mat, { alpha: mat.opacity, transparent: mat.transparent });
    });
    group.visible = false;
    return { group, rotating, materials, fade: -1 };
  });

  // Lathed ceramic hull, beveled fins, and a recessed porthole.
  const lathe = (profile) => new T.LatheGeometry(profile.map(([radius, y]) => new T.Vector2(radius, y)), lowPower ? 24 : 40);
  const actor = new T.Group();
  actor.name = "Rocket";
  const shell = new T.MeshStandardMaterial({ color: 0xe6dff2, roughness: .29, metalness: .32 });
  const livery = new T.MeshStandardMaterial({ color: 0x8b53de, roughness: .30, metalness: .34, emissive: 0x42197d, emissiveIntensity: .3 });
  const metal = new T.MeshStandardMaterial({ color: 0x635878, roughness: .30, metalness: .55 });
  function rocketPart(geometry, material, parent = actor) {
    const part = new T.Mesh(geometry, material);
    parent.add(part);
    return part;
  }
  rocketPart(lathe([[.31,-.79],[.41,-.68],[.49,-.43],[.53,-.12],[.54,.26],[.51,.55],[.44,.82],[.34,1.06],[.22,1.29],[.10,1.48],[0,1.58]]), shell);
  rocketPart(lathe([[.351,1.05],[.26,1.22],[.171,1.39],[.095,1.5],[0,1.59]]), livery);
  rocketPart(lathe([[.39,-.73],[.422,-.647],[.447,-.565],[.458,-.52]]), livery);
  rocketPart(lathe([[.32,-.76],[.28,-.96],[.30,-1.12],[.24,-1.13],[.21,-1.00]]), metal);
  const finShape = new T.Shape();
  finShape.moveTo(.41, -.21);
  finShape.quadraticCurveTo(.75, -.42, .92, -.91);
  finShape.quadraticCurveTo(.94, -1.03, .81, -1.02);
  finShape.lineTo(.43, -.86);
  finShape.closePath();
  const finGeometry = new T.ExtrudeGeometry(finShape, { depth: .08, bevelSize: .035, bevelThickness: .027, bevelSegments: 2, curveSegments: 9 });
  for (let i = 0; i < 3; i++) rocketPart(finGeometry, livery).rotation.y = i * Math.PI * 2 / 3;
  const window = new T.Group();
  window.position.set(0, .39, .47);
  actor.add(window);
  rocketPart(new T.TorusGeometry(.239, .047, 12, 38), metal, window);
  const glass = rocketPart(orbGeometry, new T.MeshStandardMaterial({ color: 0x224765, roughness: .17, metalness: .26, emissive: 0x245080, emissiveIntensity: .69 }), window);
  glass.scale.set(.207, .207, .092);
  const glint = rocketPart(orbGeometry, new T.MeshBasicMaterial({ color: 0xc3eafc }), window);
  glint.position.set(-.075, .073, .077);
  glint.scale.set(.063, .026, .012);
  glint.rotation.z = .53;

  const nozzle = new T.Group();
  nozzle.name = "Thruster";
  nozzle.position.y = -1.10;
  actor.add(nozzle);
  function exhaust(color, profile, opacity) {
    return rocketPart(lathe(profile), new T.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, toneMapped: false,
    }), nozzle);
  }
  const plume = exhaust(0xa74fff, [[0,-1.34],[.064,-1.05],[.14,-.77],[.22,-.48],[.24,-.20],[.19,0]], .54);
  const flame = exhaust(0xf8c5ff, [[0,-.87],[.067,-.62],[.13,-.38],[.17,-.11],[.144,.012]], .90);
  const exhaustGlow = glow('glow', 0xb178ff, .29, 1.6, 2.1, 0, -.53, 0, nozzle);
  const trail = Array.from({ length: 4 }, (_, i) => glow('glow', 0xef9cff, .13 - i * .022, .30 - i * .042, .34 - i * .046, 0, 0, 0, scene));
  scene.add(actor);
  const pulseMaterial = new T.MeshBasicMaterial({ color: 0xeac2ff, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide });
  const ring = new T.Mesh(new T.RingGeometry(.94, 1, 48), pulseMaterial);
  ring.rotation.x = Math.PI * -.5;
  scene.add(ring);

  function starLayer(count, depth, seed) {
    const positions = [], appearances = [], colors = [];
    const tint = [new T.Color(0xc9c8ff), new T.Color(0xb5ccff), new T.Color(0xffd2af), new T.Color(0xd6b5f5)];
    for (let i = 0; i < count; i++) {
      positions.push((hash(i, seed) - .5) * depth * 2.3, (hash(i, seed + 1) - .5) * depth * 1.3, -3 - hash(i, seed + 2) * depth);
      appearances.push(.9 + hash(i, seed + 3) ** 3 * 3.3, hash(i, seed + 4) * 6.28, .25 + hash(i, seed + 5) * .65);
      colors.push(...tint[i % tint.length].toArray());
    }
    const shape = new T.BufferGeometry();
    shape.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    shape.setAttribute('appearance', new T.Float32BufferAttribute(appearances, 3));
    shape.setAttribute('tint', new T.Float32BufferAttribute(colors, 3));
    const material = new T.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { time: { value: 0 }, density: { value: renderer.getPixelRatio() }, brightness: { value: seed === 3 ? .64 : .84 } },
      vertexShader: [
        'attribute vec3 appearance; attribute vec3 tint; uniform float time; uniform float density; varying vec4 shade;',
        'void main(){ vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p;',
        'gl_PointSize=clamp(appearance.x*clamp(25./max(-p.z,1.),.58,1.5)*density,1.,8.);',
        'shade=vec4(tint,appearance.z*(.77+.23*sin(time*1.55+appearance.y))); }',
      ].join(' '),
      fragmentShader: 'varying vec4 shade; uniform float brightness; void main(){float r=length(gl_PointCoord-.5); gl_FragColor=vec4(shade.rgb,shade.a*(1.-smoothstep(.10,.5,r))*brightness);}',
    });
    const layer = new T.Points(shape, material);
    layer.frustumCulled = false;
    scene.add(layer);
    return layer;
  }
  const stars = [starLayer(lowPower ? 260 : 530, 66, 3), starLayer(lowPower ? 78 : 140, 33, 5), starLayer(30, 17, 8)];

  const particleCount = lowPower ? 27 : 60;
  const particleData = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);
  const particlesShape = new T.BufferGeometry();
  particlesShape.setAttribute('position', new T.BufferAttribute(particleData, 3).setUsage(T.DynamicDrawUsage));
  particlesShape.setAttribute('color', new T.BufferAttribute(particleColors, 3));
  const particleMaterial = new T.PointsMaterial({
    size: .15, map: texture('glow'), vertexColors: true, transparent: true, depthWrite: false,
    blending: T.AdditiveBlending, opacity: 0, toneMapped: false,
  });
  const particles = new T.Points(particlesShape, particleMaterial);
  particles.frustumCulled = false;
  scene.add(particles);

  const shootingStar = glow('glow', 0xc6d7ff, .42, 2.3, .075, 0, 0, -15, scene, -.48);

  const scratch = new T.Vector3();
  const actorTo = new T.Vector3();
  const actorPoint = new T.Vector3();
  const cameraTarget = new T.Vector3();
  const cameraRight = new T.Vector3(), cameraUp = new T.Vector3();
  const sky = new T.Color(), horizon = new T.Color(), nextSky = new T.Color(), themeSky = new T.Color();
  const themeBase = new T.Color(), themeHighlight = new T.Color(), themeEdge = new T.Color();
  const paletteColors = scenicSkies.map((color) => new T.Color(color));
  let themeName, frame = 0, last = 0, elapsed = 0, seen = true, lost = false;
  let lastTop, lastHorizon;
  let total = 0, followed = 0, goldenSet = new Set(), jumping, pulsing;
  let angle = .63, targetAngle = angle, tilt = .23, targetTilt = tilt;

  const warmPlume = new T.Color(0xff933f);
  const warmFlame = new T.Color(0xffe7a5);

  function updateTheme() {
    const theme = document.documentElement.dataset.theme;
    if (theme === themeName) return;
    themeName = theme;
    const [base, high, highlight, edge] = Object.hasOwn(palettes, theme) ? palettes[theme] : palettes.amethyst;
    themeBase.set(base); themeSky.set(high); themeHighlight.set(highlight); themeEdge.set(edge);
    livery.color.copy(themeHighlight).multiplyScalar(.58);
    livery.emissive.copy(themeSky);
    shell.color.setHex(0xdeddec).lerp(themeEdge, .24);
    exhaustGlow.material.color.copy(themeHighlight);
    pulseMaterial.color.copy(themeEdge);
    for (const light of trail) light.material.color.copy(themeHighlight);
  }

  function updateScenery(progress) {
    // Scenery centers are spaced at triple the full height of a flight zone.
    const separation = stepsPerZone * spacing * 3;
    const current = zoneIndex(progress);
    const boundary = (current + 1) * stepsPerZone;
    const upper = current < zones.length - 1 && boundary - progress < 1.05;
    const blend = upper ? smooth((progress - boundary + 1.05) / 1.05) : 0;
    const lowerIndex = upper ? boundary / stepsPerZone - 1 : current;
    const sceneryPosition = lowerIndex + blend;
    for (const [index, item] of scenery.entries()) {
      const distance = index - sceneryPosition;
      const opacity = 1 - smooth(Math.abs(distance) * 1.66);
      item.group.visible = opacity > .015;
      if (!item.group.visible) continue;
      item.group.position.set(-Math.sin(angle) * .6, followed * spacing + distance * separation - (progress % stepsPerZone - 3) * .15, 0);
      if (Math.abs(item.fade - opacity) > .008) {
        item.fade = opacity;
        for (const [mat, original] of item.materials) {
          if (mat.uniforms?.fade) mat.uniforms.fade.value = opacity;
          else {
            mat.transparent = original.transparent || opacity < .995;
            mat.opacity = original.alpha * opacity;
          }
        }
      }
      for (const planet of item.rotating) planet.rotation.y = elapsed * .13;
      const satellite = item.group.userData.satellite;
      if (satellite) satellite.position.x = Math.sin(elapsed * .4) * 6;
    }
    nextSky.copy(paletteColors[lowerIndex]).lerp(paletteColors[Math.min(lowerIndex + 1, zones.length - 1)], blend);
    sky.copy(themeBase).lerp(nextSky, .18);
    horizon.copy(themeSky).lerp(nextSky, .51);
    const topColor = sky.getHexString(), horizonColor = horizon.getHexString();
    if (topColor !== lastTop) stage.style.setProperty('--ladder-top', '#' + (lastTop = topColor));
    if (horizonColor !== lastHorizon) stage.style.setProperty('--ladder-horizon', '#' + (lastHorizon = horizonColor));
  }

  function paintEffects() {
    const time = jumping ? (elapsed - jumping.at) / 1.13 : 2;
    const pulseAge = pulsing === undefined ? 2 : elapsed - pulsing;
    const pulse = Math.min(time, pulseAge);
    ring.visible = pulse < 1;
    ring.position.copy(actorTo);
    ring.position.y += .09;
    ring.scale.setScalar(.25 + pulse * 2.8);
    pulseMaterial.opacity = (1 - clamp(pulse)) * .53;
    particles.visible = time < 1;
    if (particles.visible) {
      const t = clamp(time);
      particleMaterial.opacity = (1 - t) * (jumping.golden ? .76 : .47);
      for (let i = 0; i < particleCount; i++) {
        const theta = hash(i, 302) * Math.PI * 2;
        const radial = t * (1.3 + hash(i, 304) * (jumping.golden ? 3.3 : 1.55));
        particleData.set([actorTo.x + Math.cos(theta) * radial, actorTo.y + .23 + t * (1.2 + hash(i, 306) * 4) - t * t * 2.55, actorTo.z + Math.sin(theta) * radial], i * 3);
      }
      particlesShape.attributes.position.needsUpdate = true;
    }
    if (jumping && time > 1.26) jumping = undefined;
  }

  function draw() {
    updateTheme();
    const time = jumping ? elapsed - jumping.at : 2;
    const pulseTime = pulsing === undefined ? 2 : elapsed - pulsing;
    const boost = Math.max(0, 1 - Math.min(time, pulseTime) / .92);
    const lift = time < .96 ? Math.sin(Math.PI * smooth(time / .96)) * .93 : 0;
    const bob = reduced.matches ? 0 : Math.sin(elapsed * 2.2) * .067;
    const radius = 8.8 + Math.min(1.1, Math.log1p(total) * .24);
    const nudge = time < .6 ? Math.sin(time / .6 * Math.PI) * .13 : 0;
    camera.position.set(Math.sin(angle) * radius, followed * spacing + tilt * radius + nudge, Math.cos(angle) * radius);
    cameraTarget.set(0, followed * spacing + .08, 0);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
    cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
    const screenHeight = 2 * radius * Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    const screenWidth = screenHeight * camera.aspect;
    const { x, y } = controls.position;
    actorTo.set(.16, followed * spacing + .37, .20)
      .addScaledVector(cameraRight, x * screenWidth)
      .addScaledVector(cameraUp, -y * screenHeight);
    actorPoint.copy(actorTo);
    actorPoint.x += .20 * lift;
    actorPoint.y += bob + lift;
    actor.position.copy(actorPoint);
    actor.rotation.y = angle * .56 + .29;
    actor.rotation.z = -.23 - boost * .17;
    const flicker = reduced.matches ? 0 : Math.sin(elapsed * 27) * .075 + Math.sin(elapsed * 43) * .025;
    nozzle.scale.set(1 + boost * .19, .56 + boost * 1.01 + flicker, 1 + boost * .19);
    const golden = jumping?.golden && time < 1.1;
    plume.material.color.copy(golden ? warmPlume : themeHighlight);
    flame.material.color.copy(golden ? warmFlame : themeEdge);
    exhaustGlow.material.opacity = .26 + boost * .26;
    for (const [i, light] of trail.entries()) {
      light.visible = !reduced.matches && boost > .1;
      light.position.set(actorPoint.x - .36 - i * .15, actorPoint.y - 1.9 - i * .30 - .13 * flicker, actorPoint.z);
    }
    if (!reduced.matches) paintEffects();
    else {
      ring.visible = particles.visible = false;
    }
    updateScenery(followed);
    for (const [index, dust] of stars.entries()) {
      dust.position.set(Math.sin(angle + elapsed * .03) * (index + .4), followed * spacing + tilt * (index + 1), 0);
      dust.material.uniforms.time.value = elapsed;
    }
    const shooting = elapsed % 17;
    shootingStar.visible = !reduced.matches && shooting > 13 && shooting < 14;
    shootingStar.position.set(-12 + (shooting - 13) * 23, followed * spacing + 7 - (shooting - 13) * 6, -15);
    renderer.render(scene, camera);
  }

  function tick(now) {
    frame = 0;
    const interval = reduced.matches ? 0 : lowPower || mobile ? 30 : 15;
    if (!last || now - last >= interval) {
      const dt = last ? Math.min(.065, (now - last) / 1000) : 0;
      last = now;
      if (!reduced.matches) {
        elapsed += dt;
        if (!controls.dragging) targetAngle += dt * .085;
        angle += (targetAngle - angle) * (1 - Math.exp(-dt * 7));
        tilt += (targetTilt - tilt) * (1 - Math.exp(-dt * 7));
        followed += (total - followed) * (1 - Math.exp(-dt * 4.15));
      } else {
        angle = targetAngle;
        tilt = targetTilt;
        followed = total;
      }
      draw();
    }
    if (!reduced.matches) start();
  }

  function start() {
    if (!frame && !document.hidden && seen && !lost) frame = requestAnimationFrame(tick);
  }

  function pause() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  }

  const resize = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.setViewOffset(width, height, -width * (width < 560 ? .17 : .16), 0, width, height);
    start();
  });
  resize.observe(stage);
  const observer = new IntersectionObserver(([entry]) => {
    seen = entry.isIntersecting;
    if (seen) start();
    else pause();
  });
  observer.observe(stage);

  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  document.addEventListener('visibilitychange', () => document.hidden ? pause() : start(), options);
  const appearance = new MutationObserver(start);
  appearance.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      jumping = undefined;
      pulsing = undefined;
    }
    start();
  }, options);
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    pause();
    stage.classList.remove('ladder-live');
    stage.setAttribute('aria-disabled', 'true');
  }, options);
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    lost = false;
    stage.classList.add('ladder-live');
    stage.removeAttribute('aria-disabled');
    start();
  }, options);
  const controls = bindFlightControls(stage, options, {
    draw: start,
    turn(dx, dy) {
      targetAngle -= dx * .006;
      targetTilt = clamp(targetTilt + dy * .002, -.26, .68);
    },
    hitRocket(event) {
      const rect = stage.getBoundingClientRect();
      scratch.copy(actor.position).project(camera);
      const x = rect.left + (scratch.x + 1) * rect.width / 2;
      const y = rect.top + (1 - scratch.y) * rect.height / 2;
      return Math.hypot(event.clientX - x, event.clientY - y) < 40;
    },
    pulse() {
      if (!reduced.matches) pulsing = elapsed;
      start();
    },
    center() {
      targetAngle = .63;
      targetTilt = .23;
    },
  });

  return {
    sync(count, golden, animate, warp = false) {
      total = count;
      goldenSet = new Set(golden);
      if (animate && !reduced.matches) {
        const goldenStep = goldenSet.has(total);
        jumping = { at: elapsed, golden: goldenStep };
        if (goldenStep) {
          stage.animate([{ boxShadow: 'inset 0 0 0 transparent' }, { boxShadow: 'inset 0 0 50px #ffae5970' }, { boxShadow: 'inset 0 0 0 transparent' }], { duration: 750 });
        }
        if (warp) {
          stage.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.35)', offset: .24 }, { filter: 'brightness(1)' }], { duration: 610 });
        }
        particleMaterial.map = texture(goldenStep ? 'confetti' : 'glow');
        const warm = new T.Color(0xffbe63);
        const rose = new T.Color(0xeec1ff);
        for (let i = 0; i < particleCount; i++) {
          const color = goldenStep ? (i % 3 ? warm : rose) : themeEdge;
          color.toArray(particleColors, i * 3);
        }
        particlesShape.attributes.color.needsUpdate = true;
      } else {
        jumping = undefined;
        followed = total;
      }
      start();
    },
    destroy() {
      pause();
      listeners.abort();
      observer.disconnect();
      resize.disconnect();
      appearance.disconnect();
      const geometries = new Set(), materials = new Set();
      scene.traverse((node) => {
        if (node.geometry) geometries.add(node.geometry);
        for (const material of [node.material].flat()) if (material) materials.add(material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures.values()) texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      stage.classList.remove('ladder-live');
    },
  };
}

// A lightweight projected scene for browsers without WebGL. It uses the same
// progress, artwork maps, themes and interaction targets as the main renderer.
function createCanvasFallback(stage) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  stage.append(canvas);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const options = { signal: events.signal };
  const dust = Array.from({ length: 115 }, (_, i) => [hash(i, 621), hash(i, 622), hash(i, 623), hash(i, 624)]);
  let width = 0, height = 0, frame = 0, last = 0, time = 0, visible = true;
  let count = 0, change, pulse, angle = .48;
  let rocketX = 0, rocketY = 0;

  function halo(x, y, radius, color, opacity) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, color);
    glow.addColorStop(1, color + '00');
    ctx.globalAlpha *= opacity;
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha /= opacity;
  }

  function planet(name, x, y, radius, rim, orbit = false) {
    halo(x, y, radius * 1.22, rim, .39);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    const map = textureCanvas(name);
    const drift = (time * 2 + radius * .43) % (radius * 2);
    ctx.drawImage(map, x - radius - drift, y - radius, radius * 2, radius * 2);
    ctx.drawImage(map, x + radius - drift, y - radius, radius * 2, radius * 2);
    if (name === 'earth') {
      ctx.globalAlpha *= .63;
      ctx.drawImage(textureCanvas('clouds'), x - radius, y - radius, radius * 2, radius * 2);
      ctx.globalAlpha /= .63;
    }
    const shade = ctx.createRadialGradient(x - radius * .46, y - radius * .55, radius * .16, x, y, radius * 1.17);
    shade.addColorStop(0, '#00000000');
    shade.addColorStop(1, '#040719e0');
    ctx.fillStyle = shade;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
    if (orbit) {
      ctx.strokeStyle = '#d5a687a8';
      for (let i = 0; i < 3; i++) {
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(x, y, radius * (1.35 + i * .19), radius * (.28 + i * .057), -.21, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function mist(name, color, x, y, w, h, opacity) {
    // Tint the cached noise map with a gradient fill beneath its wisps.
    halo(x + w / 2, y + h / 2, w * .45, color, opacity * .38);
    ctx.save();
    ctx.globalAlpha *= opacity;
    ctx.drawImage(textureCanvas(name), x, y, w, h);
    ctx.restore();
  }

  function drawScenery(zone, center, unit) {
    const y = height, parallax = Math.sin(angle) * unit * .12;
    const x = center - parallax;
    if (zone === 0) {
      halo(x - unit * .56, y * .55, unit * .78, '#ffa36b', .43);
      planet('sun', x - unit * .56, y * .57, unit * .21, '#fca263');
      const colors = ['#49394e', '#375b60', '#315048'];
      for (let j = 0; j < colors.length; j++) {
        ctx.fillStyle = colors[j];
        ctx.beginPath();
        ctx.moveTo(x - unit * 1.78, y);
        ctx.bezierCurveTo(x - unit * 1.06, y * (.49 + j * .08), x - unit * .81, y * (.66 + j * .06), x - unit * .35, y * .84);
        ctx.bezierCurveTo(x + unit * .66, y * (.45 + j * .10), x + unit * 1.06, y * .93, x + unit * 1.48, y);
        ctx.closePath();
        ctx.fill();
      }
      for (let i = 0; i < 7; i++) {
        const tx = x + (hash(i, 13) - .5) * unit * 2.13;
        const ty = y * (.87 + hash(i, 21) * .11);
        const size = unit * (.10 + hash(i, 23) * .06);
        ctx.fillStyle = '#25483f';
        ctx.beginPath();
        ctx.moveTo(tx, ty - size * 1.7);
        ctx.lineTo(tx + size * .52, ty);
        ctx.lineTo(tx - size * .52, ty);
        ctx.fill();
      }
    } else if (zone === 1) {
      for (let i = 0; i < 6; i++) mist('nebula', '#b7c6ff', x + (hash(i, 61) - .68) * width, y * hash(i, 62), unit * 1.3, unit * .45, .39);
    } else if (zone === 2) planet('earth', x, y * 2.25, unit * 1.96, '#4e89ff');
    else if (zone === 3) {
      planet('earth', x - unit * .38, y * 1.1, unit * .68, '#4e89ff');
      const sat = x + Math.sin(time * .36) * unit * .8;
      ctx.fillStyle = '#5a8acc';
      ctx.fillRect(sat - unit * .18, y * .35, unit * .36, unit * .05);
      ctx.fillStyle = '#c1bbdb';
      ctx.fillRect(sat - unit * .041, y * .32, unit * .082, unit * .11);
    } else if (zone === 4) {
      planet('moon', x + unit * .38, y * .96, unit * .63, '#aeb2dc');
      planet('earth', x - unit * .56, y * .25, unit * .14, '#5b8ce9');
    } else if (zone === 5) {
      planet('sun', x - unit * .89, y * .47, unit * .30, '#ff9b56');
      planet('gas', x + unit * .5, y * .26, unit * .19, '#d19893');
      planet('gas', x + unit * .60, y * .79, unit * .25, '#c79286', true);
    } else {
      for (let i = 0; i < (zone === 7 ? 9 : 3); i++) {
        const galaxyWidth = unit * (zone === 7 ? .32 + hash(i, 52) * .6 : 1.71);
        mist(i % 3 === 0 && zone !== 7 ? 'nebula' : 'spiral', zone === 8 && i % 2 ? '#ffab6f' : '#8c64ff',
          x + (hash(i, 53) - .78) * width * .8, y * (.06 + hash(i, 51) * .74),
          galaxyWidth, galaxyWidth * .46, .34);
      }
    }
  }

  function drawRocket(x, y, size, palette, boost, golden) {
    const main = golden ? '#ff9c4a' : palette[2];
    const light = golden ? '#ffe5a1' : palette[3];
    const yaw = Math.sin(angle);
    const flicker = reduced.matches ? 0 : Math.sin(time * 25) * 3.4 + Math.sin(time * 41) * 1.3;
    const length = 31 + boost * 36 + flicker;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(.24 + yaw * .08 + boost * .13);
    ctx.scale(size, size);

    halo(0, 43 + boost * 10, 30 + boost * 10, main, .36 + boost * .23);
    const exhaust = ctx.createLinearGradient(0, 35, 0, 35 + length);
    exhaust.addColorStop(0, light);
    exhaust.addColorStop(.27, main);
    exhaust.addColorStop(.78, main + '88');
    exhaust.addColorStop(1, main + '00');
    ctx.fillStyle = exhaust;
    ctx.beginPath();
    ctx.moveTo(-10, 34);
    ctx.bezierCurveTo(-15, 46, -5, 57 + length * .42, 0, 35 + length);
    ctx.bezierCurveTo(5, 57 + length * .42, 15, 46, 10, 34);
    ctx.fill();
    const core = ctx.createLinearGradient(0, 35, 0, 35 + length * .62);
    core.addColorStop(0, '#fff0dd');
    core.addColorStop(.43, light);
    core.addColorStop(1, light + '00');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(-6, 34);
    ctx.quadraticCurveTo(-7, 45, 0, 35 + length * .64);
    ctx.quadraticCurveTo(7, 45, 6, 34);
    ctx.fill();

    for (let i = 0; i < 5; i++) {
      const age = reduced.matches ? i / 6 : fract(time * (.72 + boost * .35) + i / 5);
      ctx.globalAlpha = (1 - age) * (.27 + boost * .29);
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc((hash(i, 18) - .5) * (10 + age * 20), 43 + age * length, 1.1 + (1 - age), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const fin = ctx.createLinearGradient(-28, 13, 24, 38);
    fin.addColorStop(0, palette[2]);
    fin.addColorStop(.56, palette[1]);
    fin.addColorStop(1, palette[2]);
    ctx.fillStyle = fin;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 14, 4);
      ctx.bezierCurveTo(side * 24, 12, side * (29 + yaw * 2), 27, side * (30 + yaw * 2), 38);
      ctx.quadraticCurveTo(side * 29, 43, side * 24, 39);
      ctx.lineTo(side * 12, 32);
      ctx.fill();
    }
    const bell = ctx.createLinearGradient(-12, 0, 14, 0);
    bell.addColorStop(0, '#302740');
    bell.addColorStop(.42, '#9285aa');
    bell.addColorStop(1, '#3a2b58');
    ctx.fillStyle = bell;
    ctx.beginPath();
    ctx.moveTo(-11, 27);
    ctx.lineTo(-12, 36);
    ctx.quadraticCurveTo(0, 41, 12, 36);
    ctx.lineTo(11, 27);
    ctx.fill();

    const ceramic = ctx.createLinearGradient(-20, 0, 20, 0);
    ceramic.addColorStop(0, '#9787af');
    ceramic.addColorStop(.28, '#d9cde8');
    ceramic.addColorStop(.47, '#f6eafb');
    ceramic.addColorStop(1, '#83739f');
    ctx.fillStyle = ceramic;
    ctx.beginPath();
    ctx.moveTo(0, -51);
    ctx.bezierCurveTo(-27, -28, -24, 17, -13, 31);
    ctx.quadraticCurveTo(0, 37, 13, 31);
    ctx.bezierCurveTo(24, 17, 27, -28, 0, -51);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.moveTo(-27, -57);
    ctx.lineTo(29, -57);
    ctx.lineTo(29, -30);
    ctx.quadraticCurveTo(0, -24, -28, -30);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-24, 23);
    ctx.quadraticCurveTo(0, 31, 24, 23);
    ctx.lineTo(24, 28);
    ctx.quadraticCurveTo(0, 36, -24, 28);
    ctx.fill();
    ctx.restore();

    const lensX = yaw * 5;
    const glass = ctx.createRadialGradient(lensX - 3, -15, 1, lensX, -10, 12);
    glass.addColorStop(0, '#a1ddef');
    glass.addColorStop(.52, '#385e90');
    glass.addColorStop(1, '#17203e');
    ctx.strokeStyle = '#675680';
    ctx.lineWidth = 2.4;
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.ellipse(lensX, -10, 10 - Math.abs(yaw) * 1.5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d6f5f9b0';
    ctx.beginPath();
    ctx.ellipse(lensX - 3.4, -13.4, 3.2, 1.2, -.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    if (!width || !height) return;
    const palette = palettes[document.documentElement.dataset.theme] ?? palettes.amethyst;
    ctx.clearRect(0, 0, width, height);
    const zone = zoneIndex(count);
    const center = width * (width < 560 ? .72 : .68);
    const unit = Math.min(height, width * .47);
    const age = change ? time - change.at : 2;
    const warp = change?.warp ? 1 - smooth(age / .68) : 0;
    stage.style.setProperty('--ladder-top', palette[0]);
    stage.style.setProperty('--ladder-horizon', scenicSkies[zone]);
    for (const [x, y, light, phase] of dust) {
      const drift = phase * 2.5 * Math.sin(angle);
      const twinkle = reduced.matches ? 1 : .78 + .22 * Math.sin(time * 1.9 + phase * 6.28);
      const sx = fract(x + drift * .008) * width;
      const sy = fract(y + phase * .019 * Math.sin(time * .3)) * height;
      ctx.fillStyle = light > .93 ? '#f3c4d7' : palette[3];
      ctx.globalAlpha = (.16 + light * .56) * twinkle;
      const size = light > .88 ? 1.65 : 1;
      ctx.fillRect(sx, sy, size, size);
    }
    ctx.globalAlpha = 1 - warp * .80;
    drawScenery(zone, center, unit);
    ctx.globalAlpha = 1;

    const boost = 1 - smooth(Math.min(age, pulse === undefined ? 2 : time - pulse) / .92);
    const { x, y } = controls.position;
    const toX = center + x * width + Math.sin(angle) * unit * .035;
    const toY = height * (.44 + y);
    const lift = age < 1 ? Math.sin(Math.PI * smooth(age)) * unit * .18 : 0;
    rocketX = toX + lift * .24;
    rocketY = toY - lift - Math.sin(time * 2.35) * unit * .02;
    drawRocket(rocketX, rocketY, unit * .0062, palette, boost, change?.golden && age < 1.1);
    const ring = Math.min(age, pulse === undefined ? 2 : time - pulse);
    if (ring < .8) {
      ctx.globalAlpha = (1 - ring / .8) * .68;
      ctx.strokeStyle = palette[3];
      ctx.beginPath();
      ctx.ellipse(toX, toY, unit * (.035 + ring * .24), unit * (.012 + ring * .063), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (change && age < .85) {
      ctx.globalAlpha = (1 - age / .85) * .7;
      ctx.fillStyle = change.golden ? '#ffd082' : palette[3];
      for (let i = 0; i < 17; i++) {
        const spread = age * (15 + hash(i, 100) * unit * .85);
        const direction = hash(i, 101) * 6.28;
        ctx.fillRect(toX + Math.cos(direction) * spread, toY + Math.sin(direction) * spread * .66, change.golden ? 2.5 : 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }
  }

  function start() {
    if (!document.hidden && visible && !frame) frame = requestAnimationFrame(tick);
  }
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0; last = 0;
  }
  function tick(now) {
    frame = 0;
    if (!last || now - last >= 30 || reduced.matches) {
      const delta = last ? Math.min((now - last) / 1000, .07) : 0;
      last = now;
      if (!reduced.matches) {
        time += delta;
        if (!controls.dragging) angle += delta * .09;
      }
      draw();
    }
    if (!reduced.matches) start();
  }
  const resize = new ResizeObserver(([entry]) => {
    width = entry.contentRect.width;
    height = entry.contentRect.height;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    start();
  });
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start(); else stop();
  });
  const appearance = new MutationObserver(start);
  resize.observe(stage);
  observer.observe(stage);
  appearance.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start(), options);
  reduced.addEventListener('change', () => { if (reduced.matches) { change = undefined; pulse = undefined; } start(); }, options);
  const controls = bindFlightControls(stage, options, {
    draw: start,
    turn(dx) { angle += dx * .010; },
    hitRocket(event) {
      const rect = stage.getBoundingClientRect();
      return Math.hypot(event.clientX - rect.left - rocketX, event.clientY - rect.top - rocketY) < 40;
    },
    pulse() {
      if (!reduced.matches) pulse = time;
      start();
    },
    center() { angle = .48; },
  });

  return {
    sync(next, golden, animate, warp) {
      count = next;
      change = animate && !reduced.matches ? { at: time, golden: golden.includes(count), warp } : undefined;
      start();
    },
    destroy() {
      stop();
      events.abort();
      resize.disconnect();
      observer.disconnect();
      appearance.disconnect();
      canvas.remove();
      stage.classList.remove('ladder-live');
    },
  };
}
