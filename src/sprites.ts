// 8비트 스프라이트: 문자 지도 또는 절차적 도형 → 오프스크린 캔버스.
// 팔레트는 8비트 콘솔 느낌의 제한된 색만 쓴다.

export const PAL: Record<string, string> = {
  k: '#000000', w: '#fcfcfc', E: '#bcbcbc', e: '#7c7c7c',
  r: '#d82800', o: '#fc7460', y: '#f8b800', Y: '#fce0a8',
  b: '#0058f8', c: '#3cbcfc', B: '#0000bc',
  g: '#00a800', G: '#b8f818', d: '#005800',
  n: '#ac7c00', N: '#503000', u: '#c84c0c',
  s: '#fcd8a8', p: '#6844fc', P: '#d8b8f8', m: '#d800cc', M: '#f878f8',
};

type Canvas = HTMLCanvasElement;

function mk(w: number, h: number): [Canvas, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return [c, x];
}

export function fromMap(rows: string[], swap: Record<string, string> = {}): Canvas {
  const w = rows[0].length;
  const [c, x] = mk(w, rows.length);
  rows.forEach((row, yy) => {
    if (row.length !== w) throw new Error(`sprite row ${yy} width ${row.length} != ${w}`);
    for (let xx = 0; xx < w; xx++) {
      const ch = swap[row[xx]] ?? row[xx];
      if (ch === '.') continue;
      x.fillStyle = PAL[ch] ?? ch;
      x.fillRect(xx, yy, 1, 1);
    }
  });
  return c;
}

/** 투명 픽셀 중 채워진 픽셀과 맞닿은 곳을 검은 외곽선으로 */
function outline(c: Canvas, color = '#000000') {
  const x = c.getContext('2d')!;
  const img = x.getImageData(0, 0, c.width, c.height);
  const a = (i: number, j: number) => (i < 0 || j < 0 || i >= c.width || j >= c.height ? 0 : img.data[(j * c.width + i) * 4 + 3]);
  const pts: [number, number][] = [];
  for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) {
    if (a(i, j)) continue;
    if (a(i - 1, j) || a(i + 1, j) || a(i, j - 1) || a(i, j + 1)) pts.push([i, j]);
  }
  x.fillStyle = color;
  for (const [i, j] of pts) x.fillRect(i, j, 1, 1);
  return c;
}

function disc(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  x.fillStyle = color;
  for (let j = Math.floor(cy - r); j <= cy + r; j++) for (let i = Math.floor(cx - r); i <= cx + r; i++) {
    if ((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 <= r * r) x.fillRect(i, j, 1, 1);
  }
}

export function flipX(src: Canvas): Canvas {
  const [c, x] = mk(src.width, src.height);
  x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
  return c;
}

/** 카메라 프레임 안에서 '도트로 변환'되는 효과용: n픽셀 모자이크 */
export function mosaic(src: Canvas, n = 2): Canvas {
  const [small, sx] = mk(Math.ceil(src.width / n), Math.ceil(src.height / n));
  sx.drawImage(src, 0, 0, small.width, small.height);
  const [c, x] = mk(src.width, src.height);
  x.drawImage(small, 0, 0, small.width * n, small.height * n);
  return c;
}

// ─────────────────────────────── 앞무대 주인공 (오리지널: 파란 머리 + 빨간 머리띠)
const HERO_TOP = [
  '...kkkkk....',
  '..kbbbbbk...',
  '.kbbcbbbbk..',
  '.krrrrrrrkrk',
  '.kbsssskskk.',
  '.kbsssskssk.',
  '..kssssssk..',
  '...kkkkkk...',
  '..kwwrrwwk..',
  '.kswwrrwwsk.',
  '.kskwwwwksk.',
  '..kkbbbbkk..',
  '...kbbbbk...',
];
const HERO_RUN_A = [...HERO_TOP, '..kbbkkbbk..', '..kNNk.kNNk.', '..kkkk.kkkk.'];
const HERO_RUN_B = [...HERO_TOP, '...kbbbbk...', '...kNNNNk...', '...kkkkkk...'];
const HERO_JUMP = [...HERO_TOP.slice(0, 11), '.kkkbbbbkkk.', 'kNNkbbbbkNNk', 'kkk.kkkk.kkk', '............', '............'];

// ─────────────────────────────── 뒷무대 스태프 (노란 안전모 + 헤드셋)
const STAFF_TOP = [
  '..kkkkk...',
  '.kyyyyyk..',
  'kyyYyyyykk',
  'kkkkkkkkk.',
  '.ekssssk..',
  'ekssskssk.',
  '.kssssssk.',
  '..kksskk..',
  '..kbbbbk..',
  '.kbcbbcbk.',
  'ksbbbbbbsk',
  'ksbbyybbsk',
  '.kbbbbbbk.',
  '..kbbbbk..',
];
const STAFF_A = [...STAFF_TOP, '..kbkkbk..', '..kbk.kbk.', '.kNNk.kNNk', '.kkkk.kkkk'];
const STAFF_B = [...STAFF_TOP, '...kbbk...', '...kbbk...', '..kNNNNk..', '..kkkkkk..'];
const STAFF_CLIMB = [
  '..kkkkk...', '.kyyyyyk..', 'kyyyyyyyk.', 'kkkkkkkkk.', '.keeeeek..', 'kesssssek.',
  '.kssssssk.', 'sk.kkkk.ks', 'skkbbbbkks', '.kbcbbcbk.', '.kbbbbbbk.', '.kbbbbbbk.',
  '.kbbbbbbk.', '..kbbbbk..', '..kbkkbk..', '..kbk.kbk.', '.kNNk.kNNk', '.kkkk.kkkk',
];

// ─────────────────────────────── 아이템 아이콘
const COIN = ['..kkkk..', '.kyyyyk.', 'kyYYyyyk', 'kyYyknyk', 'kyYyknyk', 'kyyyknyk', '.kyynnk.', '..kkkk..'];
const HEART = ['.kk...kk.', 'kGGk.kggk', 'kGwGkgggk', 'kGGgggggk', '.kgggggk.', '..kgggk..', '...kgk...', '....k....'];

export interface StaffSet { a: Canvas; b: Canvas; climb: Canvas; aL: Canvas; bL: Canvas; mosA: Canvas; mosAL: Canvas }

function staffSet(swap: Record<string, string>): StaffSet {
  const a = fromMap(STAFF_A, swap), b = fromMap(STAFF_B, swap);
  return { a, b, climb: fromMap(STAFF_CLIMB, swap), aL: flipX(a), bL: flipX(b), mosA: mosaic(a), mosAL: mosaic(flipX(a)) };
}

function makeEnemy(frame: number): Canvas {
  const [c, x] = mk(16, 16);
  disc(x, 8, 9, 6.5, PAL.p);
  x.fillStyle = PAL.p; x.fillRect(2, 9, 12, 4);
  x.fillStyle = PAL.P; x.fillRect(4, 4, 2, 2); x.fillRect(3, 6, 1, 2);
  // 화난 눈썹 + 눈
  x.fillStyle = PAL.k; x.fillRect(4, 6, 3, 1); x.fillRect(9, 6, 3, 1);
  x.fillStyle = PAL.w; x.fillRect(4, 7, 2, 3); x.fillRect(9, 7, 2, 3);
  x.fillStyle = PAL.k; x.fillRect(4, 8, 1, 2); x.fillRect(9, 8, 1, 2);
  // 발
  x.fillStyle = PAL.N;
  if (frame === 0) { x.fillRect(2, 13, 4, 2); x.fillRect(10, 13, 4, 2); }
  else { x.fillRect(4, 13, 4, 2); x.fillRect(9, 13, 4, 2); }
  return outline(c);
}

function makeEnemyFlat(): Canvas {
  const [c, x] = mk(16, 16);
  x.fillStyle = PAL.p; x.fillRect(1, 12, 14, 3);
  x.fillStyle = PAL.k; x.fillRect(4, 13, 2, 1); x.fillRect(10, 13, 2, 1);
  return outline(c);
}

function makeBlock(used: boolean, shine: boolean): Canvas {
  const [c, x] = mk(16, 16);
  x.fillStyle = PAL.k; x.fillRect(0, 0, 16, 16);
  x.fillStyle = used ? PAL.n : PAL.y; x.fillRect(1, 1, 14, 14);
  if (!used) {
    x.fillStyle = PAL.Y; x.fillRect(1, 1, 14, 1); x.fillRect(1, 1, 1, 14);
    x.fillStyle = PAL.n; x.fillRect(1, 14, 14, 1); x.fillRect(14, 1, 1, 14);
    // 가운데 다이아몬드 표식
    x.fillStyle = PAL.k;
    x.fillRect(7, 4, 2, 1); x.fillRect(6, 5, 4, 1); x.fillRect(5, 6, 6, 4); x.fillRect(6, 10, 4, 1); x.fillRect(7, 11, 2, 1);
    x.fillStyle = shine ? PAL.w : PAL.o;
    x.fillRect(7, 5, 2, 1); x.fillRect(6, 6, 4, 4); x.fillRect(7, 10, 2, 1);
  }
  x.fillStyle = used ? PAL.N : PAL.k;
  for (const [i, j] of [[2, 2], [13, 2], [2, 13], [13, 13]]) x.fillRect(i, j, 1, 1);
  return c;
}

function makeGround(): Canvas {
  const [c, x] = mk(16, 16);
  x.fillStyle = PAL.u; x.fillRect(0, 0, 16, 16);
  x.fillStyle = PAL.g; x.fillRect(0, 0, 16, 4);
  x.fillStyle = PAL.G; for (let i = 0; i < 16; i += 4) x.fillRect(i + 1, 0, 2, 1);
  x.fillStyle = PAL.d; for (let i = 0; i < 16; i += 3) x.fillRect(i, 4, 2, 1);
  x.fillStyle = PAL.N;
  for (const [i, j] of [[3, 7], [10, 9], [6, 12], [13, 13], [1, 14], [8, 6]]) x.fillRect(i, j, 2, 1);
  return c;
}

function makeDirt(): Canvas {
  const [c, x] = mk(16, 16);
  x.fillStyle = PAL.u; x.fillRect(0, 0, 16, 16);
  x.fillStyle = PAL.N;
  for (const [i, j] of [[2, 3], [9, 1], [5, 8], [12, 6], [1, 12], [10, 13]]) x.fillRect(i, j, 2, 1);
  return c;
}

function makePlatform(): Canvas {
  const [c, x] = mk(16, 8);
  x.fillStyle = PAL.k; x.fillRect(0, 0, 16, 8);
  x.fillStyle = PAL.g; x.fillRect(0, 1, 16, 3);
  x.fillStyle = PAL.G; x.fillRect(1, 1, 3, 1); x.fillRect(9, 1, 3, 1);
  x.fillStyle = PAL.u; x.fillRect(0, 4, 16, 3);
  x.fillStyle = PAL.N; x.fillRect(4, 5, 2, 1); x.fillRect(11, 5, 2, 1);
  return c;
}

function makePlank(bad: boolean): Canvas {
  const [c, x] = mk(8, 6);
  x.fillStyle = PAL.k; x.fillRect(0, 0, 8, 6);
  x.fillStyle = bad ? PAL.N : PAL.u; x.fillRect(0, 1, 7, 4);
  x.fillStyle = bad ? PAL.k : PAL.o; x.fillRect(1, 1, bad ? 1 : 5, 1);
  if (bad) { x.fillStyle = PAL.k; x.fillRect(3, 2, 1, 3); }
  return c;
}

function makeCloud(w = 32, h = 16): Canvas {
  const [c, x] = mk(w + 2, h + 2);
  disc(x, 9, 11, 6, PAL.w); disc(x, 17, 8, 7.5, PAL.w); disc(x, 25, 11, 6, PAL.w);
  x.fillRect(9, 11, 16, 6);
  x.fillStyle = PAL.c; x.fillRect(8, 15, 18, 1);
  return outline(c);
}

function makeBush(): Canvas {
  const [c, x] = mk(22, 16);
  disc(x, 6, 10, 5, PAL.g); disc(x, 11, 7, 6, PAL.g); disc(x, 16, 10, 5, PAL.g);
  x.fillRect(4, 10, 14, 5);
  x.fillStyle = PAL.G; x.fillRect(9, 3, 2, 1); x.fillRect(5, 7, 1, 1); x.fillRect(15, 7, 1, 1);
  return outline(c);
}

function makeBrick(): Canvas {
  const [c, x] = mk(16, 16);
  x.fillStyle = PAL.k; x.fillRect(0, 0, 16, 16);
  x.fillStyle = PAL.u;
  for (let j = 0; j < 4; j++) {
    const off = j % 2 ? 4 : 0;
    for (let i = -8; i < 16; i += 8) x.fillRect(i + off + 1, j * 4 + 1, 7, 3);
  }
  x.fillStyle = PAL.o; for (let j = 0; j < 4; j++) x.fillRect(1 + (j % 2 ? 4 : 0), j * 4 + 1, 3, 1);
  return c;
}

function makePlant(): Canvas {
  const [c, x] = mk(16, 18);
  disc(x, 5, 6, 4, PAL.g); disc(x, 11, 5, 4, PAL.g); disc(x, 8, 3, 3.5, PAL.G);
  x.fillStyle = PAL.d; x.fillRect(7, 8, 2, 3);
  x.fillStyle = PAL.u; x.fillRect(3, 11, 10, 6);
  x.fillStyle = PAL.o; x.fillRect(2, 10, 12, 2);
  return outline(c);
}

function makeBox(): Canvas {
  const [c, x] = mk(16, 16);
  x.fillStyle = PAL.n; x.fillRect(1, 2, 14, 13);
  x.fillStyle = PAL.Y; x.fillRect(7, 2, 2, 5);
  x.fillStyle = PAL.N; x.fillRect(1, 2, 14, 1);
  // 눈구멍 (어색하다!)
  x.fillStyle = PAL.k; x.fillRect(4, 8, 2, 2); x.fillRect(10, 8, 2, 2);
  x.fillStyle = PAL.w; x.fillRect(4, 8, 1, 1); x.fillRect(10, 8, 1, 1);
  return outline(c);
}

function makeCrash(seed: number): Canvas {
  const [c, x] = mk(16, 20);
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  disc(x, 8, 10, 7, PAL.k);
  for (let i = 0; i < 26; i++) {
    x.fillStyle = [PAL.m, PAL.M, PAL.c, PAL.k][Math.floor(rnd() * 4)];
    x.fillRect(Math.floor(rnd() * 14) + 1, Math.floor(rnd() * 16) + 2, 2, 1);
  }
  x.fillStyle = PAL.r; x.fillRect(4, 8, 3, 2); x.fillRect(9, 8, 3, 2);
  x.fillStyle = PAL.w; x.fillRect(5, 13, 6, 1);
  return c;
}

function makeCrate(kind: 'coin' | '1up'): Canvas {
  const [c, x] = mk(20, 18);
  x.fillStyle = PAL.k; x.fillRect(0, 0, 20, 18);
  x.fillStyle = PAL.n; x.fillRect(1, 1, 18, 16);
  x.fillStyle = PAL.N; x.fillRect(1, 6, 18, 1); x.fillRect(1, 12, 18, 1);
  x.fillStyle = PAL.Y; x.fillRect(1, 1, 18, 1);
  x.drawImage(fromMap(kind === 'coin' ? COIN : HEART), kind === 'coin' ? 6 : 5, 5);
  return c;
}

function makeDoor(lit: boolean, used: boolean): Canvas {
  const [c, x] = mk(20, 30);
  x.fillStyle = PAL.k; x.fillRect(0, 0, 20, 30);
  x.fillStyle = used ? PAL.e : lit ? PAL.c : PAL.B; x.fillRect(2, 2, 16, 28);
  x.fillStyle = used ? PAL.E : lit ? PAL.w : PAL.b; x.fillRect(4, 4, 12, 8); x.fillRect(4, 15, 12, 12);
  x.fillStyle = PAL.y; x.fillRect(14, 16, 2, 2);
  // 별 표식 = 배우 대기실
  x.fillStyle = used ? PAL.e : PAL.y; x.fillRect(9, 6, 2, 4); x.fillRect(7, 7, 6, 2);
  return c;
}

function makeHill(r: number, color: string, shade: string): Canvas {
  const [c, x] = mk(r * 2 + 2, r + 2);
  disc(x, r + 1, r + 1, r, color);
  x.fillStyle = shade;
  for (let i = 0; i < 4; i++) x.fillRect(r - 6 + i * 5, r - 8 + (i % 2) * 6, 2, 3);
  return outline(c);
}

let cache: ReturnType<typeof build> | null = null;
function build() {
  const heroA = fromMap(HERO_RUN_A), heroB = fromMap(HERO_RUN_B), heroJ = fromMap(HERO_JUMP);
  return {
    hero: { a: heroA, b: heroB, jump: heroJ },
    enemy: [makeEnemy(0), makeEnemy(1)],
    enemyFlat: makeEnemyFlat(),
    block: makeBlock(false, false),
    blockShine: makeBlock(false, true),
    blockUsed: makeBlock(true, false),
    ground: makeGround(),
    dirt: makeDirt(),
    platform: makePlatform(),
    plank: makePlank(false),
    plankBad: makePlank(true),
    cloud: makeCloud(),
    hill: makeHill(40, PAL.g, PAL.d),
    hillSmall: makeHill(24, '#58d854', PAL.g),
    props: { bush: makeBush(), cloud: makeCloud(), brick: makeBrick(), plant: makePlant(), box: makeBox() },
    crash: [makeCrash(1), makeCrash(2), makeCrash(3)],
    crateCoin: makeCrate('coin'),
    crate1up: makeCrate('1up'),
    door: makeDoor(false, false), doorLit: makeDoor(true, false), doorUsed: makeDoor(false, true),
    coin: fromMap(COIN),
    heart: fromMap(HEART),
    staff: [staffSet({}), staffSet({ y: 'o', Y: 'w', b: 'g', c: 'G' })],
  };
}

export function sprites() {
  return (cache ??= build());
}
