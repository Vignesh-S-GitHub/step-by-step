const sides = 6;
const vertices = [[0, -69, 0], [0, 68, 0]];
for (let i = 0; i < sides; i++) {
  const angle = 2 * Math.PI * i / sides;
  vertices.push([43 * Math.cos(angle), -9, 38 * Math.sin(angle)]);
}

const faces = Array.from({ length: sides }, (_, i) => {
  const ring = 2 + i;
  const next = 2 + (i + 1) % sides;
  return [[0, ring, next], [1, next, ring]];
}).flat();

export const initialOrientation = { yaw: 18, pitch: -9 };

const wrap = (angle) => ((angle % 360) + 360) % 360;

export function rotatePrism({ yaw, pitch }, dx, dy) {
  return {
    yaw: wrap(yaw + dx * .75),
    pitch: Math.min(65, Math.max(-65, pitch - dy * .75)),
  };
}

export function projectPrism({ yaw, pitch }) {
  const yAngle = wrap(yaw) * Math.PI / 180;
  const xAngle = pitch * Math.PI / 180;
  const sinY = Math.sin(yAngle);
  const cosY = Math.cos(yAngle);
  const sinX = Math.sin(xAngle);
  const cosX = Math.cos(xAngle);
  const rotated = vertices.map(([x, y, z]) => {
    const horizontal = x * cosY + z * sinY;
    const depth = z * cosY - x * sinY;
    return [horizontal, y * cosX - depth * sinX, y * sinX + depth * cosX];
  });
  return faces.map((face, index) => {
    const [a, b, c] = face.map((i) => rotated[i]);
    const [ux, uy, uz] = b.map((value, i) => value - a[i]);
    const [vx, vy, vz] = c.map((value, i) => value - a[i]);
    const normal = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const length = Math.hypot(...normal);
    const diffuse = Math.max(0, (normal[0] * -.43 - normal[1] * .56 + normal[2] * .71) / length);
    const points = [a, b, c].map(([x, y, z]) => {
      const perspective = 290 / (290 - z);
      return [x * perspective, y * perspective];
    });
    const light = .22 + diffuse * .73;
    const depth = (a[2] + b[2] + c[2]) / 3;
    const visible = normal[0] * -a[0] + normal[1] * -a[1] + normal[2] * (290 - a[2]) > 0;
    return { points, light, depth, index, visible };
  }).sort((a, b) => a.depth - b.depth);
}

function facePoints(points) {
  return points.map((point) => point.map((coordinate) => coordinate.toFixed(2)).join(',')).join(' ');
}

export function prismArtwork(orientation) {
  return projectPrism(orientation).filter(({ visible }) => visible).map(({ points, light, index }) => {
    const dark = index % 2 ? 17 : 4;
    const fill = Math.round(light * 69 + dark);
    return `<polygon points="${facePoints(points)}" fill="color-mix(in srgb,var(--crystal-light) ${fill}%,var(--crystal-deep))" />`;
  }).join('');
}

export function bindPrism(button, orientation) {
  const mesh = button.querySelector('.prism-mesh');
  let gesture;
  let suppressClick = false;

  function turn(dx, dy) {
    Object.assign(orientation, rotatePrism(orientation, dx, dy));
    mesh.innerHTML = prismArtwork(orientation);
  }

  button.addEventListener('pointerdown', (event) => {
    if (gesture || event.button !== 0) return;
    suppressClick = false;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove', (event) => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.dragged && Math.hypot(dx, dy) < 5) return;
    gesture.dragged = true;
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    button.classList.add('is-dragging');
    turn(dx, dy);
  });
  function end(event) {
    if (gesture?.id !== event.pointerId) return;
    suppressClick = gesture.dragged;
    gesture = undefined;
    button.classList.remove('is-dragging');
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(event, end);
  }
  button.addEventListener('click', (event) => {
    if (!suppressClick || event.detail === 0) return;
    event.stopPropagation();
    suppressClick = false;
  });
  button.addEventListener('keydown', (event) => {
    const keyMoves = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] };
    if (event.key === 'Home') {
      Object.assign(orientation, initialOrientation);
      mesh.innerHTML = prismArtwork(orientation);
    } else if (Object.hasOwn(keyMoves, event.key)) {
      turn(...keyMoves[event.key]);
    } else {
      return;
    }
    event.preventDefault();
  });
}
