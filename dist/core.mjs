import { prismArtwork } from './prism.mjs';

const shardPositions = [
  [250,124,26], [69,117,-24], [213,55,16], [107,48,-16],
  [278,92,29], [49,76,-29], [265,53,22], [65,43,-21],
  [197,28,13], [122,26,-15], [291,133,33], [34,132,-32],
];

function diamond(x, y, rotation, index) {
  return `<g transform="translate(${x} ${y}) rotate(${rotation})"><g data-arrival><g class="core-shard" style="--delay:${index * -320}ms"><path d="M0-15 8 0 0 12-8 0Z" fill="url(#shard-face)" stroke="var(--crystal-edge)" stroke-width=".7"/><path d="M0-15V12L-8 0Z" fill="var(--crystal-light)" opacity=".72"/><path d="M0-15 8 0 0 3-8 0Z" fill="var(--crystal-edge)" opacity=".38"/></g></g></g>`;
}

export function coreArtwork(charge, level, orientation) {
  const scale = (.64 + charge.ratio * .34).toFixed(3);
  return `<svg class="core-scene" data-evolution="${level % 8}" viewBox="0 0 320 208" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="core-aura"><stop stop-color="var(--crystal-base)" stop-opacity=".44"/><stop offset=".57" stop-color="var(--crystal-glow)" stop-opacity=".18"/><stop offset="1" stop-color="var(--crystal-glow)" stop-opacity="0"/></radialGradient>
      <linearGradient id="shard-face" x2="1" y2="1"><stop stop-color="var(--crystal-base)"/><stop offset="1" stop-color="var(--crystal-deep)"/></linearGradient>
      <radialGradient id="core-floor"><stop stop-color="var(--crystal-base)" stop-opacity=".45"/><stop offset="1" stop-color="var(--crystal-glow)" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="160" cy="103" rx="149" ry="99" fill="url(#core-aura)"/>
    <ellipse cx="160" cy="171" rx="123" ry="27" fill="url(#core-floor)" opacity=".54"/>
    <g fill="none" stroke="var(--crystal-edge)">
      <ellipse cx="160" cy="169" rx="99" ry="20" opacity=".26"/>
      <ellipse cx="160" cy="169" rx="74" ry="14" opacity=".32"/>
      <ellipse cx="160" cy="169" rx="48" ry="9" opacity=".23"/>
      <path d="M62 165c45-25 162-25 196 0" opacity=".11"/>
      <ellipse class="core-orbit" cx="160" cy="169" rx="99" ry="20" stroke="var(--crystal-edge)" stroke-width="1.6" stroke-dasharray="14 194"/>
      ${level >= 2 ? '<ellipse cx="160" cy="96" rx="88" ry="45" transform="rotate(-20 160 96)" stroke="var(--crystal-edge)" opacity=".32" stroke-dasharray="2 5"/>' : ''}
      ${level >= 4 ? '<ellipse cx="160" cy="96" rx="96" ry="50" transform="rotate(21 160 96)" stroke="var(--crystal-edge)" opacity=".25" stroke-dasharray="3 8"/>' : ''}
    </g>
    <g fill="var(--crystal-edge)" opacity=".52"><circle cx="50" cy="103" r="1.2"/><circle cx="85" cy="53" r="1.7"/><circle cx="219" cy="36" r="1.3"/><circle cx="270" cy="114" r="1.5"/><circle cx="235" cy="134" r="1"/><circle cx="109" cy="145" r="1.3"/><circle cx="190" cy="32" r="1"/><circle cx="68" cy="139" r="1.2"/></g>
    ${level >= 3 ? '<path d="m99 87 2 5 5 2-5 2-2 5-2-5-5-2 5-2zm122-9 2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--crystal-edge)" opacity=".76"/>' : ''}
    ${shardPositions.slice(0,charge.crystals).map(([x,y,turn],i)=>diamond(x,y,turn,i)).join('')}
    <g transform="translate(160 94)"><g class="core-bob"><g class="core-gem" data-scale="${scale}" style="transform:scale(${scale})">
      <g class="prism-mesh">${prismArtwork(orientation)}</g>
      ${level >= 5 ? '<ellipse class="core-crown" cx="0" cy="-75" rx="22" ry="5" fill="none" stroke="var(--crystal-edge)" stroke-opacity=".65" stroke-width="1.2"/>' : ''}
    </g></g></g>
    <g class="core-burst"><circle cx="160" cy="94" r="58" fill="none" stroke="var(--crystal-edge)" stroke-width="1.5"/><circle cx="160" cy="94" r="43" fill="none" stroke="var(--crystal-edge)" stroke-width=".8" stroke-dasharray="3 7"/></g>
  </svg>`;
}

export function animateCore(card, previous, charge) {
  if (!card || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const gem = card.querySelector('.core-gem');
  for (const animation of card.getAnimations({ subtree: true })) {
    if (animation instanceof CSSAnimation) continue;
    animation.cancel();
  }
  const final = Number(gem.dataset.scale);
  if (previous && charge) {
    card.querySelector('.charge-track span').animate([
      { transform: `scaleX(${previous.ratio})` },
      { transform: `scaleX(${charge.ratio})` },
    ], { duration: 460, easing: 'cubic-bezier(.16,1,.3,1)' });
  }
  const initial = previous == null ? final : .64 + previous.ratio * .34;
  gem.animate([
    { transform: `scale(${initial})` },
    { transform: `scale(${final * 1.12})`, offset: .55 },
    { transform: `scale(${final})` },
  ], { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)' });
  card.querySelector('.core-burst').animate([
    { opacity: .9, transform: 'scale(.52)' },
    { opacity: 0, transform: 'scale(1.45)' },
  ], { duration: 630, easing: 'ease-out' });
  const newest = card.querySelectorAll('[data-arrival]');
  const arriving = newest[newest.length - 1];
  if (arriving && charge?.crystals > previous?.crystals) {
    arriving.animate([
      { opacity: 0, transform: 'translate(0,-19px) scale(.2)' },
      { opacity: 1, transform: 'translate(0,0) scale(1)' },
    ], { duration: 540, easing: 'cubic-bezier(.16,1,.3,1)' });
  }
}
