import { normalizeGoldenSteps, stepsPerZone, zoneIndex, zones } from './model.mjs';

const threeUrl = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.1/three.module.min.js';
const spacing = .49;
const stepWindow = 20;
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
    stage.setAttribute('aria-label', 'Cosmic Ladder, ' + (debug === null ? zone.name : zones[debug].name || '') + ' ' + total + ' steps. Drag or use arrow keys to rotate. Press Enter to pulse.');
  }
  updateLabels();
  threePromise ??= import(threeUrl).catch((error) => { threePromise = undefined; throw error; });
  threePromise.then((THREE) => {
    if (closed) return;
    view = createView(THREE, stage);
    const count = sceneCount();
    const visibleGold = debug === null ? golden : pending?.golden ? [count] : [];
    view.sync(pending?.previous ?? count, visibleGold, false);
    if (pending) view.sync(count, visibleGold, true, pending.warp);
    pending = undefined;
    stage.classList.add('ladder-live');
    stage.removeAttribute('aria-disabled');
  }).catch(() => {
    // The card and progress readout remain available offline or without WebGL.
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

  // An extruded rounded shape keeps crisp highlights at any viewport size.
  const shape = new T.Shape();
  shape.moveTo(-.82, -.42); shape.lineTo(.82, -.42);
  shape.quadraticCurveTo(.98, -.42, .98, -.27); shape.lineTo(.98, .27);
  shape.quadraticCurveTo(.98, .42, .82, .42); shape.lineTo(-.82, .42);
  shape.quadraticCurveTo(-.98, .42, -.98, .27); shape.lineTo(-.98, -.27);
  shape.quadraticCurveTo(-.98, -.42, -.82, -.42);
  const geometry = new T.ExtrudeGeometry(shape, { depth: .14, bevelSize: .055, bevelThickness: .048, bevelSegments: 2, steps: 1, curveSegments: 3 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -.08, 0);
  const regular = new T.MeshStandardMaterial({ color: 0xbd7de4, roughness: .35, metalness: .30, emissive: 0x9d34d0, emissiveIntensity: .29 });
  const trim = new T.MeshStandardMaterial({ color: 0xe1a6ff, roughness: .33, emissive: 0xc265df, emissiveIntensity: .46 });
  const gold = new T.MeshStandardMaterial({ color: 0xffb353, roughness: .35, metalness: .22, emissive: 0xbe6b24, emissiveIntensity: .44 });
  const goldTrim = new T.MeshStandardMaterial({ color: 0xffd992, roughness: .34, emissive: 0xdf912b, emissiveIntensity: .55 });
  const steps = new T.InstancedMesh(geometry, [regular, trim], stepWindow);
  const goldSteps = new T.InstancedMesh(geometry, [gold, goldTrim], stepWindow);
  steps.frustumCulled = goldSteps.frustumCulled = false;
  scene.add(steps, goldSteps);

  const actor = new T.Group();
  const body = new T.Mesh(orbGeometry, new T.MeshStandardMaterial({ color: 0xf7d8ff, emissive: 0xd572e4, emissiveIntensity: .92, roughness: .29 }));
  body.scale.set(.18, .22, .18);
  actor.add(body);
  const actorGlow = glow('glow', 0xe58ffe, .62, 1.08, 1.08, 0, 0, 0, actor);
  scene.add(actor);
  const trail = Array.from({ length: 5 }, (_, index) => glow('glow', 0xe38bff, .13 - index * .019, .3 - index * .032, .3 - index * .032, 0, 0, 0, scene));
  const pulseMaterial = new T.MeshBasicMaterial({ color: 0xeac2ff, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide });
  const ring = new T.Mesh(new T.RingGeometry(.94, 1, 48), pulseMaterial);
  ring.rotation.x = Math.PI * -.5;
  scene.add(ring);
  const beamMaterial = new T.MeshBasicMaterial({ color: 0xffbd61, transparent: true, opacity: 0, depthWrite: false });
  const beam = new T.Mesh(new T.CylinderGeometry(.055, .20, 16, 12, 1, true), beamMaterial);
  scene.add(beam);

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

  const warpData = new Float32Array(27 * 6);
  const warpShape = new T.BufferGeometry();
  warpShape.setAttribute('position', new T.BufferAttribute(warpData, 3).setUsage(T.DynamicDrawUsage));
  const warpMaterial = new T.LineBasicMaterial({ color: 0xdeccff, transparent: true, depthWrite: false, opacity: 0 });
  const streaks = new T.LineSegments(warpShape, warpMaterial);
  streaks.frustumCulled = false;
  scene.add(streaks);
  const shootingStar = glow('glow', 0xc6d7ff, .42, 2.3, .075, 0, 0, -15, scene, -.48);

  const dummy = new T.Object3D();
  const scratch = new T.Vector3();
  const actorFrom = new T.Vector3();
  const actorTo = new T.Vector3();
  const actorPoint = new T.Vector3();
  const cameraTarget = new T.Vector3();
  const sky = new T.Color(), horizon = new T.Color(), nextSky = new T.Color(), themeSky = new T.Color();
  const themeBase = new T.Color(), themeHighlight = new T.Color(), themeEdge = new T.Color();
  const paletteColors = scenicSkies.map((color) => new T.Color(color));
  let themeName, frame = 0, last = 0, elapsed = 0, seen = true, lost = false;
  let lastDrop = NaN, lastTop, lastHorizon;
  let total = 0, followed = 0, goldenSet = new Set(), jumping, pulsing;
  let angle = .63, targetAngle = angle, tilt = .23, targetTilt = tilt, drag;

  function stepPoint(step, target) {
    const turn = step * .56;
    return target.set(Math.sin(turn) * 1.66, step * spacing, Math.cos(turn) * 1.66);
  }

  function paintSteps(drop = 0) {
    let normalIndex = 0, goldIndex = 0;
    for (let step = Math.max(0, total - stepWindow + 1); step <= total; step++) {
      const turn = step * .56;
      stepPoint(step, dummy.position);
      if (step === total) dummy.position.y += drop;
      dummy.rotation.y = turn;
      dummy.scale.setScalar(step === 0 ? 1.22 : 1);
      dummy.updateMatrix();
      if (goldenSet.has(step)) goldSteps.setMatrixAt(goldIndex++, dummy.matrix);
      else steps.setMatrixAt(normalIndex++, dummy.matrix);
    }
    steps.count = normalIndex;
    goldSteps.count = goldIndex;
    steps.instanceMatrix.needsUpdate = goldSteps.instanceMatrix.needsUpdate = true;
  }

  function updateTheme() {
    const theme = document.documentElement.dataset.theme;
    if (theme === themeName) return;
    themeName = theme;
    const [base, high, highlight, edge] = Object.hasOwn(palettes, theme) ? palettes[theme] : palettes.amethyst;
    themeBase.set(base); themeSky.set(high); themeHighlight.set(highlight); themeEdge.set(edge);
    regular.color.copy(themeHighlight).multiplyScalar(.75);
    regular.emissive.copy(themeSky);
    trim.color.copy(themeHighlight);
    trim.emissive.copy(themeHighlight).multiplyScalar(.55);
    body.color.copy(themeEdge);
    body.emissive.copy(themeHighlight);
    actorGlow.material.color.copy(themeHighlight);
    pulseMaterial.color.copy(themeEdge);
    for (const light of trail) light.material.color.copy(themeHighlight);
  }

  function updateScenery(progress) {
    // Scenery centers are spaced at triple the full height of a stair zone.
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
    beam.visible = jumping?.golden && time < 1.2;
    streaks.visible = jumping?.warp && time < .69;
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
    if (beam.visible) {
      beam.position.set(actorTo.x, actorTo.y + 8, actorTo.z);
      beamMaterial.opacity = Math.sin(clamp(time / 1.2) * Math.PI) * .32;
    }
    if (streaks.visible) {
      const t = time / .69;
      warpMaterial.opacity = Math.sin(t * Math.PI) * .63;
      for (let i = 0; i < warpData.length / 6; i++) {
        const x = (hash(i, 45) - .5) * 31, z = -4 - hash(i, 49) * 17;
        const y = followed * spacing + (hash(i, 47) - .5) * 17 - t * 9;
        warpData.set([x, y, z, x + .25, y + 1.7 + hash(i, 85) * 4.9, z], i * 6);
      }
      warpShape.attributes.position.needsUpdate = true;
    }
    if (jumping && time > 1.26) jumping = undefined;
  }

  function draw() {
    updateTheme();
    const time = jumping ? elapsed - jumping.at : 2;
    const hop = smooth(time / .62);
    stepPoint(total, actorTo); stepPoint(Math.max(0, total - 1), actorFrom);
    // A decaying spring offsets the new stair and a second arc carries the climber.
    const drop = time < .72 ? .68 * Math.exp(-time * 5.5) * Math.cos(time * 19) : 0;
    if (drop !== lastDrop) {
      paintSteps(drop);
      lastDrop = drop;
    }
    actorPoint.copy(actorFrom).lerp(actorTo, hop);
    actorPoint.y += .36 + (reduced.matches ? 0 : .085 * Math.sin(elapsed * 2.25) + Math.sin(hop * Math.PI) * .88);
    actor.position.copy(actorPoint);
    for (const [i, light] of trail.entries()) {
      light.visible = !reduced.matches && time < 1.18;
      const t = smooth(Math.max(0, time - (i + 1) * .044) / .62);
      light.position.copy(actorFrom).lerp(actorTo, t);
      light.position.y += .28 + Math.sin(t * Math.PI) * .85;
    }
    if (!reduced.matches) paintEffects();
    else {
      ring.visible = particles.visible = beam.visible = streaks.visible = false;
    }
    updateScenery(followed);
    for (const [index, dust] of stars.entries()) {
      dust.position.set(Math.sin(angle + elapsed * .03) * (index + .4), followed * spacing + tilt * (index + 1), 0);
      dust.material.uniforms.time.value = elapsed;
    }
    const shooting = elapsed % 17;
    shootingStar.visible = !reduced.matches && shooting > 13 && shooting < 14;
    shootingStar.position.set(-12 + (shooting - 13) * 23, followed * spacing + 7 - (shooting - 13) * 6, -15);
    const radius = 9.6 + Math.min(2.35, Math.log1p(total) * .52);
    const nudge = time < .6 ? Math.sin(time / .6 * Math.PI) * .13 : 0;
    camera.position.set(Math.sin(angle) * radius, followed * spacing + tilt * radius + nudge, Math.cos(angle) * radius);
    cameraTarget.set(0, followed * spacing - .86, 0);
    camera.lookAt(cameraTarget);
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
        if (!drag) targetAngle += dt * .085;
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
  stage.addEventListener('pointerdown', (event) => {
    if (drag || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    stage.setPointerCapture(event.pointerId);
  }, options);
  stage.addEventListener('pointermove', (event) => {
    if (event.pointerId !== drag?.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    targetAngle -= dx * .012;
    targetTilt = clamp(targetTilt + dy * .006, -.26, .68);
    Object.assign(drag, { x: event.clientX, y: event.clientY, moved: true });
    stage.classList.add('is-dragging');
    start();
  }, options);
  function endDrag(event) {
    if (event.pointerId !== drag?.id) return;
    if (!drag.moved && event.type === 'pointerup') {
      // Test the tap against the climber's projected center rather than the whole landscape.
      const rect = stage.getBoundingClientRect();
      scratch.copy(actor.position).project(camera);
      const x = rect.left + (scratch.x + 1) * rect.width / 2;
      const y = rect.top + (1 - scratch.y) * rect.height / 2;
      if (Math.hypot(event.clientX - x, event.clientY - y) < 38) pulse();
    }
    drag = undefined;
    stage.classList.remove('is-dragging');
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(type, endDrag, options);
  function pulse() {
    if (!reduced.matches) pulsing = elapsed;
    start();
  }
  stage.addEventListener('click', (event) => {
    if (event.detail === 0) pulse();
  }, options);
  stage.addEventListener('keydown', (event) => {
    const { key } = event;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(key)) return;
    if (key === 'Home') {
      targetAngle = .63;
      targetTilt = .23;
    } else {
      targetAngle += key === 'ArrowLeft' ? .24 : key === 'ArrowRight' ? -.24 : 0;
      targetTilt = clamp(targetTilt + (key === 'ArrowUp' ? .08 : key === 'ArrowDown' ? -.08 : 0), -.26, .68);
    }
    event.preventDefault();
    start();
  }, options);

  return {
    sync(count, golden, animate, warp = false) {
      total = count;
      goldenSet = new Set(golden);
      lastDrop = NaN;
      if (animate && !reduced.matches) {
        const goldenStep = goldenSet.has(total);
        jumping = { at: elapsed, golden: goldenStep, warp };
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
      steps.dispose();
      goldSteps.dispose();
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
