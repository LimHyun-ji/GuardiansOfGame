// 횡스크롤부 스테이지 1 — 앞무대/뒷무대가 같은 월드 좌표를 공유한다.

export const W = 640;
export const H = 360;

// 앞무대 (위쪽 60%)
export const FRONT_H = 216;
export const GROUND_Y = 184; // 지면 윗면
export const BLOCK_S = 16;
export const BLOCK_Y = 136; // 일반 아이템 블록 윗면
export const PLAT_Y = 128; // 샛길 발판 윗면
export const HIDDEN_Y = 80; // 샛길 숨은 블록 윗면

// 뒷무대 (아래쪽 40%)
export const BACK_TOP = 216;
export const UPPER_FLOOR = 264; // 2층 통로 바닥 (카메라에 비치는 층)
export const LOWER_FLOOR = 346; // 1층 통로 바닥 (안전 지대)

// 튜닝 값
export const PLAYER_SPEED = 55; // px/s
export const TASK_LEAD = 6; // 블록 도착 몇 초 전에 업무 카드를 띄울지
export const PLAYER_SKILL = 0.8; // 적 밟기 성공률
export const PLAYER_CURIOSITY = 0.15; // 샛길로 빠질 확률
export const STAGE_GOAL_X = 9400;

export type Item = 'coin' | '1up';

export interface Block {
  id: number;
  x: number;
  y: number;
  hidden: boolean; // 샛길 숨은 블록
  branch?: Branch;
  content: Item | null;
  hit: boolean;
  tasked: boolean;
}

export interface Bridge {
  dur: number; // 내구도 0~100, 50 미만이면 밟는 순간 무너짐
  collapsed: boolean;
  tasked: boolean;
}

export interface Pit {
  x: number;
  w: number;
  bridge?: Bridge;
}

export interface Door {
  x: number;
  scripted: boolean; // 대본에 적힌 적 출현 지점 (문은 2층 = 카메라 층에 있다)
  used: boolean;
  tasked: boolean;
}

export interface Branch {
  x: number;
  w: number;
  decided: boolean;
  detour: boolean;
  entered: boolean;
  block?: Block;
}

export type PropKind = 'bush' | 'cloud' | 'brick' | 'plant';

/** 위장 소품 자리: 여기서 위장하면 완벽, 아무 데서나 하면 '어색한 상자' */
export interface PropSpot {
  x: number;
  floor: 'upper' | 'lower';
  kind: PropKind;
}

export interface Crate {
  x: number;
  kind: Item;
}

export interface Level {
  goalX: number;
  pits: Pit[];
  blocks: Block[];
  doors: Door[];
  branches: Branch[];
  ladders: number[];
  crates: Crate[];
  props: PropSpot[];
}

export function buildLevel(): Level {
  const pits: Pit[] = [
    { x: 1450, w: 32 },
    { x: 3150, w: 64, bridge: { dur: 25, collapsed: false, tasked: false } },
    { x: 4300, w: 32 },
    { x: 5750, w: 32 },
    { x: 6650, w: 64, bridge: { dur: 20, collapsed: false, tasked: false } },
    { x: 8000, w: 32 },
  ];
  const branches: Branch[] = [2150, 5050, 8350].map((x) => ({
    x,
    w: 192,
    decided: false,
    detour: false,
    entered: false,
  }));

  const blocked = (x: number, pad: number) =>
    pits.some((p) => x > p.x - pad && x < p.x + p.w + pad) ||
    branches.some((b) => x > b.x - pad && x < b.x + b.w + pad);

  const blocks: Block[] = [];
  let id = 1;
  for (let x = 520; x < STAGE_GOAL_X - 200; x += 300) {
    if (blocked(x, 90)) continue;
    blocks.push({ id: id++, x, y: BLOCK_Y, hidden: false, content: null, hit: false, tasked: false });
  }
  for (const br of branches) {
    const b: Block = {
      id: id++,
      x: br.x + 88,
      y: HIDDEN_Y,
      hidden: true,
      branch: br,
      content: null,
      hit: false,
      tasked: false,
    };
    br.block = b;
    blocks.push(b);
  }

  const doors: Door[] = [];
  let n = 0;
  for (let x = 820; x < STAGE_GOAL_X - 300; x += 600) {
    let dx = x;
    // 블록 바로 아래/구덩이 근처를 피해 살짝 민다
    while (blocked(dx, 70) || blocks.some((b) => Math.abs(b.x - dx) < 40)) dx += 40;
    doors.push({ x: dx, scripted: n % 2 === 0, used: false, tasked: false });
    n++;
  }

  const ladders: number[] = [];
  for (let x = 100; x < STAGE_GOAL_X + 640; x += 320) ladders.push(x);

  const crates: Crate[] = [];
  for (let x = 40; x < STAGE_GOAL_X + 640; x += 480) {
    crates.push({ x, kind: 'coin' }, { x: x + 26, kind: '1up' });
  }

  const props: PropSpot[] = [];
  const kinds: PropKind[] = ['bush', 'cloud', 'brick'];
  for (let x = 60; x < STAGE_GOAL_X + 640; x += 76) {
    props.push({ x, floor: 'upper', kind: kinds[Math.floor(x / 456) % 3] });
  }
  for (let x = 170; x < STAGE_GOAL_X + 640; x += 240) props.push({ x, floor: 'lower', kind: 'plant' });

  return { goalX: STAGE_GOAL_X, pits, blocks, doors, branches, ladders, crates, props };
}
