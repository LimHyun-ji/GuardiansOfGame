import type { Game, Staff, Task } from './game';
import { BACK_TOP, FRONT_H, GROUND_Y, H, LOWER_FLOOR, PLAT_Y, UPPER_FLOOR, W } from './level';
import { sprites } from './sprites';

const C = {
  sky: '#6888fc', skyBand: '#7c9cfc',
  back: '#1e1614', backUpper: '#2c1f1b', plank: '#3a2a23', beam: '#7c5038', beamTop: '#a8744c', beamDark: '#4a2e20',
  cable: '#0c0808', ladder: '#c89858', lamp: '#f8d878',
  hudBg: 'rgba(0,0,0,0.82)', hudLine: '#fcfcfc', hudText: '#fcfcfc', dim: '#a8a8a8',
  imm: '#3cbcfc', fun: '#f8b800', bad: '#f83800', good: '#58f898', violet: '#d8b8f8', pink: '#f878f8',
};

const KR = '"Do Hyeon", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const PX = '"Press Start 2P", monospace';

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string,
  align: CanvasTextAlign = 'left', outline = true, font = KR) {
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** 8비트 스타일 창: 검은 바탕 + 흰 테두리 */
function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, border = C.hudLine, bg = C.hudBg) {
  rect(ctx, x, y, w, h, bg);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x) + 1.5, Math.round(y) + 1.5, Math.round(w) - 3, Math.round(h) - 3);
}

function taskLabel(t: Task) {
  if (t.kind === 'fill') return `블록 ${t.block!.id} · ${t.item === '1up' ? '1UP' : '동전'}`;
  if (t.kind === 'enemy') return '대기실 · 적 출근';
  return '발판 수리';
}
const TAG: Record<string, [string, string]> = {
  surprise: ['돌발!', '#f8b800'], director: ['감독 지시', C.violet], crash: ['크래시!', C.pink],
};

export function render(ctx: CanvasRenderingContext2D, g: Game) {
  const S = sprites();
  const cam = Math.round(g.camX);
  const L = g.level;
  const t = g.t;
  const sx = (x: number) => Math.round(x - cam);
  const vis = (x: number, w = 40) => x + w > cam && x < cam + W;

  // ═══════════ 앞무대 (8비트 게임 화면)
  rect(ctx, 0, 0, W, FRONT_H, C.sky);
  for (let i = 0; i < 4; i++) rect(ctx, 0, 150 + i * 8, W, 2, C.skyBand);
  for (let i = -1; i < 5; i++) {
    const x = i * 200 - ((cam * 0.2) % 200) + 30;
    ctx.drawImage(S.cloud, Math.round(x), 30 + (i % 2) * 22);
  }
  for (let i = -1; i < 5; i++) {
    const x = i * 230 - ((cam * 0.5) % 230);
    ctx.drawImage(S.hill, Math.round(x), GROUND_Y - S.hill.height + 1);
    ctx.drawImage(S.hillSmall, Math.round(x + 120), GROUND_Y - S.hillSmall.height + 1);
  }
  for (let gx = Math.floor(cam / 16) * 16; gx < cam + W + 16; gx += 16) {
    if (L.pits.some((p) => gx + 8 > p.x && gx + 8 < p.x + p.w)) continue;
    ctx.drawImage(S.ground, sx(gx), GROUND_Y);
    ctx.drawImage(S.dirt, sx(gx), GROUND_Y + 16);
  }
  for (const pit of L.pits) {
    if (!pit.bridge || !vis(pit.x, pit.w) || pit.bridge.collapsed) continue;
    for (let i = 0; i < pit.w; i += 8) ctx.drawImage(pit.bridge.dur < 50 ? S.plankBad : S.plank, sx(pit.x + i), GROUND_Y);
  }
  for (const br of L.branches) {
    if (!vis(br.x, br.w)) continue;
    for (let i = 0; i < br.w; i += 16) ctx.drawImage(S.platform, sx(br.x + i), PLAT_Y);
  }
  const shine = Math.floor(t * 2) % 2 === 0;
  for (const b of L.blocks) {
    if (!vis(b.x, 16)) continue;
    if (b.hidden && !b.hit) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(sx(b.x) + 0.5, b.y + 0.5, 15, 15);
      ctx.setLineDash([]);
      continue;
    }
    ctx.drawImage(b.hit ? S.blockUsed : shine ? S.blockShine : S.block, sx(b.x), b.y);
    text(ctx, String(b.id), sx(b.x) + 8, b.y - 6, 6, '#fcfcfc', 'center', true, PX);
  }
  if (vis(L.goalX, 60)) {
    const fx = sx(L.goalX);
    ctx.drawImage(S.props.brick, fx - 4, GROUND_Y - 16); ctx.drawImage(S.props.brick, fx - 4, GROUND_Y - 32);
    ctx.drawImage(S.props.brick, fx + 36, GROUND_Y - 16); ctx.drawImage(S.props.brick, fx + 36, GROUND_Y - 32);
    box(ctx, fx - 6, GROUND_Y - 50, 60, 18, '#f8b800', '#d82800');
    text(ctx, 'GOAL', fx + 24, GROUND_Y - 41, 8, '#fcfcfc', 'center', false, PX);
  }
  for (const e of g.enemies) {
    if (e.popT > 0) ctx.globalAlpha = 1 - e.popT / 0.35;
    ctx.drawImage(e.alive ? S.enemy[Math.floor(t * 4) % 2] : S.enemyFlat, sx(e.x) - 1, e.y - 2);
    ctx.globalAlpha = 1;
  }
  const p = g.player;
  if (!(p.state === 'dead' && Math.floor(t * 12) % 2 === 0)) {
    const img = !p.onGround ? S.hero.jump : Math.abs(p.vx) > 0 ? (Math.floor(t * 10) % 2 ? S.hero.a : S.hero.b) : S.hero.a;
    const px = sx(p.x);
    const py = Math.round(Math.min(p.y, FRONT_H - p.h));
    ctx.save();
    if (p.vx < 0 || p.state === 'dead') {
      ctx.translate(px + (p.vx < 0 ? 12 : 0), py + (p.state === 'dead' ? 16 : 0));
      ctx.scale(p.vx < 0 ? -1 : 1, p.state === 'dead' ? -1 : 1);
      ctx.drawImage(img, 0, 0);
    } else ctx.drawImage(img, px, py);
    ctx.restore();
  }
  if (g.speedMul > 1) {
    for (let i = 0; i < 3; i++) rect(ctx, sx(p.x) - 10 - i * 6, p.y + 4 + i * 4, 6, 1, '#fcfcfc');
  }
  // 말풍선
  if (g.bubble.t > 0) {
    ctx.font = `11px ${KR}`;
    const w = Math.ceil(ctx.measureText(g.bubble.text).width) + 12;
    const bx = Math.max(4, Math.min(W - w - 4, sx(p.x) + 6 - w / 2));
    const by = Math.max(40, Math.min(p.y, FRONT_H - 16) - 30);
    rect(ctx, bx, by, w, 18, '#000');
    rect(ctx, bx + 1, by + 1, w - 2, 16, '#fcfcfc');
    rect(ctx, sx(p.x) + 4, by + 17, 4, 3, '#fcfcfc');
    rect(ctx, sx(p.x) + 3, by + 18, 1, 2, '#000');
    rect(ctx, sx(p.x) + 8, by + 18, 1, 2, '#000');
    text(ctx, g.bubble.text, bx + w / 2, by + 9, 11, '#000', 'center', false);
  }
  // 크래시 글리치
  if (g.glitchT > 0) {
    for (let i = 0; i < 8; i++) {
      const y = Math.floor(Math.random() * FRONT_H);
      rect(ctx, 0, y, W, 2 + Math.random() * 6, Math.random() < 0.5 ? 'rgba(216,0,204,0.45)' : 'rgba(60,188,252,0.45)');
    }
  }
  // 스캔라인
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < FRONT_H; y += 3) ctx.fillRect(0, y, W, 1);

  // ═══════════ 무대 경계
  rect(ctx, 0, BACK_TOP - 3, W, 5, '#000');
  for (let x = -(cam % 24); x < W; x += 24) rect(ctx, x, BACK_TOP - 2, 12, 2, '#f8b800');

  // ═══════════ 뒷무대
  rect(ctx, 0, BACK_TOP + 2, W, UPPER_FLOOR - BACK_TOP - 2, C.backUpper);
  rect(ctx, 0, UPPER_FLOOR, W, H - UPPER_FLOOR, C.back);
  for (let x = Math.floor(cam / 32) * 32; x < cam + W + 32; x += 32) {
    rect(ctx, sx(x), BACK_TOP + 2, 1, UPPER_FLOOR - BACK_TOP - 2, C.plank);
    rect(ctx, sx(x) + 16, UPPER_FLOOR + 6, 1, LOWER_FLOOR - UPPER_FLOOR - 6, '#271c18');
  }
  // 케이블 & 작업등
  ctx.strokeStyle = C.cable;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = Math.floor(cam / 128) * 128 - 128; x < cam + W + 128; x += 128) {
    ctx.moveTo(sx(x), UPPER_FLOOR + 10);
    ctx.quadraticCurveTo(sx(x + 64), UPPER_FLOOR + 26, sx(x + 128), UPPER_FLOOR + 10);
  }
  ctx.stroke();
  for (let x = Math.floor(cam / 256) * 256 + 200; x < cam + W + 256; x += 256) {
    rect(ctx, sx(x), UPPER_FLOOR + 6, 2, 8, '#555');
    rect(ctx, sx(x) - 3, UPPER_FLOOR + 14, 8, 3, C.lamp);
    ctx.fillStyle = 'rgba(248,216,120,0.06)';
    ctx.beginPath();
    ctx.moveTo(sx(x) - 3, UPPER_FLOOR + 17); ctx.lineTo(sx(x) + 5, UPPER_FLOOR + 17);
    ctx.lineTo(sx(x) + 40, LOWER_FLOOR); ctx.lineTo(sx(x) - 38, LOWER_FLOOR);
    ctx.fill();
  }
  // 소품 자리 (위장 포인트)
  for (const ps of L.props) {
    if (!vis(ps.x, 24)) continue;
    const img = S.props[ps.kind];
    const fy = ps.floor === 'upper' ? UPPER_FLOOR : LOWER_FLOOR;
    ctx.globalAlpha = 0.28;
    ctx.drawImage(img, sx(ps.x + 8 - img.width / 2), fy - img.height);
    ctx.globalAlpha = 1;
    rect(ctx, sx(ps.x) + 2, fy - 1, 12, 1, 'rgba(159,227,255,0.6)');
  }
  // 바닥
  for (const fy of [UPPER_FLOOR, LOWER_FLOOR]) {
    rect(ctx, 0, fy, W, fy === LOWER_FLOOR ? H - fy : 6, C.beam);
    rect(ctx, 0, fy, W, 1, C.beamTop);
    rect(ctx, 0, fy + 5, W, 1, C.beamDark);
    for (let x = Math.floor(cam / 32) * 32; x < cam + W + 32; x += 32) rect(ctx, sx(x) + 3, fy + 2, 2, 2, C.beamDark);
  }
  text(ctx, '2F  카메라 층', 6, BACK_TOP + 30, 8, 'rgba(252,252,252,0.3)', 'left', false);
  text(ctx, '1F  안전 통로', 6, UPPER_FLOOR + 32, 8, 'rgba(252,252,252,0.3)', 'left', false);

  for (const lx of L.ladders) {
    if (!vis(lx, 14)) continue;
    const x = sx(lx);
    rect(ctx, x, UPPER_FLOOR - 2, 2, LOWER_FLOOR - UPPER_FLOOR + 2, C.ladder);
    rect(ctx, x + 10, UPPER_FLOOR - 2, 2, LOWER_FLOOR - UPPER_FLOOR + 2, C.ladder);
    for (let y = UPPER_FLOOR + 4; y < LOWER_FLOOR; y += 8) rect(ctx, x, y, 12, 2, C.ladder);
  }
  for (const c of L.crates) {
    if (!vis(c.x, 22)) continue;
    ctx.drawImage(c.kind === 'coin' ? S.crateCoin : S.crate1up, sx(c.x), LOWER_FLOOR - 18);
  }
  for (const d of L.doors) {
    if (!vis(d.x, 22)) continue;
    const task = g.tasks.find((tk) => tk.door === d);
    const lit = !!task && Math.floor(t * 4) % 2 === 0;
    ctx.drawImage(d.used ? S.doorUsed : lit || task ? S.doorLit : S.door, sx(d.x), UPPER_FLOOR - 30);
    text(ctx, '대기실', sx(d.x) + 10, UPPER_FLOOR - 36, 8, d.used ? '#777' : '#cfe3ff', 'center', true);
  }
  for (const b of L.blocks) {
    if (!vis(b.x, 20)) continue;
    const x = sx(b.x);
    const col = b.hit ? '#555' : b.content ? C.good : '#f87898';
    rect(ctx, x, BACK_TOP + 2, 16, 9, '#000');
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, BACK_TOP + 2.5, 15, 8);
    if (b.content) ctx.drawImage(b.content === 'coin' ? S.coin : S.heart, x + 4, BACK_TOP + 2);
    text(ctx, b.hidden ? `샛길${b.id}` : `슬롯${b.id}`, x + 8, BACK_TOP + 17, 8, col, 'center', true);
  }
  for (const pit of L.pits) {
    const br = pit.bridge;
    if (!br || !vis(pit.x - 20, pit.w + 40)) continue;
    const x = sx(pit.x + pit.w / 2);
    rect(ctx, x - 14, BACK_TOP + 2, 28, 10, br.collapsed ? '#333' : '#000');
    rect(ctx, x - 2, BACK_TOP + 12, 4, UPPER_FLOOR - BACK_TOP - 12, '#5d4a3a');
    const dur = br.collapsed ? 0 : br.dur;
    rect(ctx, x - 12, BACK_TOP + 5, 24 * (dur / 100), 4, dur < 50 ? C.bad : C.good);
    text(ctx, br.collapsed ? '붕괴' : `발판 ${Math.round(dur)}%`, x, BACK_TOP + 19, 8, dur < 50 ? C.bad : C.good, 'center', true);
  }
  for (const it of g.items) {
    const img = it.kind === 'coin' ? S.coin : S.heart;
    ctx.drawImage(img, sx(it.x) - 4, Math.round(it.y) - img.height);
  }
  for (const s of g.staffs) drawStaff(ctx, g, s, sx);
  if (g.crash) {
    ctx.drawImage(S.crash[Math.floor(t * 12) % 3], sx(g.crash.x), Math.round(g.crash.y));
    text(ctx, '크래시', sx(g.crash.x) + 8, g.crash.y - 6, 9, C.pink, 'center');
  }

  // ═══════════ 플레이어 카메라 프레임
  const f = g.frame();
  const fx0 = Math.max(0, sx(f.x0));
  const fx1 = Math.min(W, sx(f.x1));
  ctx.fillStyle = g.lookPhase === 'look' ? 'rgba(248,56,0,0.10)' : 'rgba(252,252,252,0.06)';
  ctx.fillRect(fx0, 0, fx1 - fx0, f.y1);
  const warn = g.lookPhase === 'warn' && Math.floor(t * 8) % 2 === 0;
  ctx.strokeStyle = g.lookPhase === 'look' || warn ? C.bad : 'rgba(252,252,252,0.9)';
  ctx.lineWidth = 2;
  ctx.setLineDash(g.lookPhase === 'look' ? [] : [6, 4]);
  ctx.strokeRect(fx0 + 1, 1, fx1 - fx0 - 2, f.y1 - 2);
  ctx.setLineDash([]);
  if (g.lookPhase !== 'look') {
    rect(ctx, fx0, f.y1 - 3, 10, 3, '#fcfcfc'); rect(ctx, fx0, f.y1 - 10, 3, 10, '#fcfcfc');
    rect(ctx, fx1 - 10, f.y1 - 3, 10, 3, '#fcfcfc'); rect(ctx, fx1 - 3, f.y1 - 10, 3, 10, '#fcfcfc');
    if (Math.floor(t * 2) % 2 === 0) rect(ctx, fx0 + 6, f.y1 - 14, 5, 5, C.bad);
    text(ctx, 'REC', fx0 + 14, f.y1 - 11, 6, '#fcfcfc', 'left', true, PX);
  } else {
    text(ctx, '플레이어가 화면 전체를 둘러보는 중!', W / 2, H / 2 + 26, 14, C.bad, 'center');
  }

  // ═══════════ 목표 화살표 (가장 급한 업무)
  const sorted = [...g.tasks].sort((a, b) => a.x - b.x);
  const top = sorted[0];
  const s0 = g.staffs[0];
  if (top) {
    let ax: number | null = null;
    let ay = 0;
    if (top.kind === 'fill') {
      if (g.staffs.some((s) => s.carry) || g.items.length) { ax = top.block!.x + 8; ay = UPPER_FLOOR - 28; }
      else {
        const want = top.item ?? 'coin';
        const crates = L.crates.filter((c) => c.kind === want && c.x > cam - 10 && c.x < cam + W - 20);
        crates.sort((a, b) => Math.abs(a.x - s0.x) - Math.abs(b.x - s0.x));
        if (crates[0]) { ax = crates[0].x + 10; ay = LOWER_FLOOR - 26; }
      }
    } else if (top.kind === 'enemy') { ax = top.door!.x + 10; ay = UPPER_FLOOR - 42; }
    else { ax = top.pit!.x + top.pit!.w / 2; ay = UPPER_FLOOR - 28; }
    if (ax !== null) drawArrow(ctx, sx(ax), ay, t);
  }

  for (const fl of g.floaters) {
    ctx.globalAlpha = Math.min(1, fl.t * 2);
    text(ctx, fl.text, sx(fl.x), fl.y, fl.big ? 14 : 10, fl.color, 'left');
  }
  ctx.globalAlpha = 1;

  drawHud(ctx, g, sorted);

  if (g.flashT > 0) {
    ctx.fillStyle = `rgba(252,252,252,${g.flashT * 1.2})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const bob = Math.round(Math.sin(t * 8) * 2);
  const off = x > W - 10 ? 1 : x < 10 ? -1 : 0;
  const ax = Math.max(12, Math.min(W - 12, x));
  ctx.fillStyle = '#000';
  if (off === 0) {
    rect(ctx, ax - 6, y - 10 + bob, 13, 4, '#000');
    for (let i = 0; i < 6; i++) rect(ctx, ax - 5 + i, y - 9 + i + bob, 11 - i * 2, 1, '#f8b800');
  } else {
    for (let i = 0; i < 7; i++) rect(ctx, ax - off * i, y - i, 1, i * 2 + 1, '#f8b800');
  }
}

function drawStaff(ctx: CanvasRenderingContext2D, g: Game, s: Staff, sx: (x: number) => number) {
  const S = sprites();
  const set = S.staff[s.id];
  const x = sx(s.x);
  const y = Math.round(s.y);
  const t = g.t;
  if (s.disguised) {
    const img = S.props[s.prop];
    ctx.drawImage(img, x + 5 - Math.floor(img.width / 2), y + s.h - img.height);
    // 눈만 빼꼼
    if (Math.floor(t * 1.5) % 3 === 0) { rect(ctx, x + 2, y + s.h - img.height + 5, 2, 2, '#fcfcfc'); rect(ctx, x + 6, y + s.h - img.height + 5, 2, 2, '#fcfcfc'); }
    if (s.prop === 'box' && s.inFrame) text(ctx, '어색…', x - 4, y - 6, 9, '#f8b800', 'left');
  } else {
    let img: HTMLCanvasElement;
    if (s.climbing) img = set.climb;
    else if (s.inFrame) img = s.facing < 0 ? set.mosAL : set.mosA; // 카메라 안 = 도트 변환
    else {
      const walk = s.onGround && Math.abs(s.vx) > 1 && Math.floor(t * 12) % 2 === 1;
      img = s.facing < 0 ? (walk ? set.bL : set.aL) : walk ? set.b : set.a;
    }
    ctx.drawImage(img, x, y);
    if (s.carry) {
      const icon = s.carry === 'coin' ? S.coin : S.heart;
      ctx.drawImage(icon, x + 1, Math.round(y - 11 + Math.sin(t * 6) * 1.5));
    }
  }
  if (g.players > 1) text(ctx, s.id === 0 ? '1P' : '2P', x + 5, y - (s.carry ? 18 : 8), 6, s.id === 0 ? '#f8b800' : '#fc7460', 'center', true, PX);
  if (s.exposed && !s.disguised) text(ctx, '!', x + 5, y - 22, 14, Math.floor(t * 8) % 2 ? C.bad : '#fcfcfc', 'center', true, PX);
  if (s.id === 0 && g.suspicion > 0) {
    rect(ctx, x - 7, y - 32, 24, 5, '#000');
    rect(ctx, x - 6, y - 31, 22 * (g.suspicion / 100), 3, g.suspicion > 70 ? C.bad : '#f8b800');
  }
  if (s.work) {
    const k = s.work.t / s.work.need;
    rect(ctx, x - 5, y - 8, 20, 5, '#000');
    rect(ctx, x - 4, y - 7, 18 * k, 3, C.good);
  }
}

function gauge(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, v: number, color: string) {
  text(ctx, label, x, y + 4, 11, C.hudText, 'left', false);
  rect(ctx, x + 38, y, 88, 9, '#fcfcfc');
  rect(ctx, x + 39, y + 1, 86, 7, '#000');
  const w = Math.round(86 * (v / 100));
  for (let i = 0; i < w; i += 3) rect(ctx, x + 39 + i, y + 1, Math.min(2, w - i), 7, v < 25 ? C.bad : color);
  text(ctx, String(Math.round(v)).padStart(3, ' '), x + 130, y + 5, 7, C.hudText, 'left', false, PX);
}

function drawHud(ctx: CanvasRenderingContext2D, g: Game, sorted: Task[]) {
  box(ctx, 2, 2, 164, 34);
  gauge(ctx, 8, 7, '몰입도', g.immersion, C.imm);
  gauge(ctx, 8, 21, '재미도', g.fun, C.fun);

  sorted.slice(0, 3).forEach((tk, i) => {
    const x = 170 + i * 110;
    const eta = Math.max(0, g.eta(tk.x));
    const urgent = eta < 2.5;
    const blink = urgent && Math.floor(g.t * 6) % 2 === 0;
    box(ctx, x, 2, 106, 34, blink ? C.bad : C.hudLine, blink ? 'rgba(120,0,0,0.88)' : C.hudBg);
    const color = tk.kind === 'fill' ? '#f8b800' : tk.kind === 'enemy' ? C.violet : C.good;
    rect(ctx, x + 4, 6, 3, 26, color);
    text(ctx, taskLabel(tk), x + 11, 13, 11, C.hudText, 'left', false);
    const tag = tk.tag ? TAG[tk.tag] : ['대본', C.dim];
    text(ctx, tag[0], x + 11, 27, 9, tag[1], 'left', false);
    text(ctx, eta.toFixed(1), x + 100, 27, 8, urgent ? C.bad : C.hudText, 'right', false, PX);
  });
  if (sorted.length > 3) text(ctx, `+${sorted.length - 3}`, 170 + 3 * 110 - 2, 20, 7, C.hudText, 'left', true, PX);

  // 점수 · 시간 · 진행도
  box(ctx, W - 132, 2, 130, 34);
  const m = Math.floor(g.t / 60);
  const sec = Math.floor(g.t % 60).toString().padStart(2, '0');
  text(ctx, String(g.points).padStart(6, '0'), W - 126, 12, 8, '#fcfcfc', 'left', false, PX);
  text(ctx, `${m}:${sec}`, W - 8, 12, 8, '#f8b800', 'right', false, PX);
  const prog = Math.min(1, g.player.x / g.level.goalX);
  rect(ctx, W - 126, 20, 118, 4, '#333');
  rect(ctx, W - 126, 20, 118 * prog, 4, C.good);
  if (g.combo > 1) {
    text(ctx, `COMBO x${g.combo}`, W - 126, 30, 7, '#fc7460', 'left', false, PX);
    rect(ctx, W - 42, 28, 34 * (g.comboT / 5), 3, '#fc7460');
  } else {
    text(ctx, `LIFE ${Math.max(0, g.player.lives)}`, W - 126, 30, 7, C.dim, 'left', false, PX);
  }

  if (g.toast.t > 0) {
    ctx.globalAlpha = Math.min(1, g.toast.t * 2);
    ctx.font = `13px ${KR}`;
    const w = ctx.measureText(g.toast.text).width + 24;
    box(ctx, W / 2 - w / 2, 40, w, 22, g.toast.color);
    text(ctx, g.toast.text, W / 2, 51, 13, g.toast.color, 'center', false);
    ctx.globalAlpha = 1;
  }

  let hint = '';
  const s = g.staffs[0];
  const awkward = g.staffs.some((x) => x.disguised && x.prop === 'box' && x.inFrame);
  if (awkward) hint = '어색한 위장! 바닥의 하늘색 표시(소품 자리)에서 위장해야 완벽해요';
  else if (g.exposed) hint = '카메라에 찍히는 중! 소품 자리에서 [위장] 또는 1층으로';
  else if (g.firstTaskDoneAt < 0 && sorted[0]) {
    const tk = sorted[0];
    if (tk.kind === 'fill') {
      if (!s.carry) hint = s.floor === 'lower' ? '노란 상자 앞에서 [집기]' : '1층 창고로! (사다리에서 스틱 ↓)';
      else hint = s.floor === 'upper' ? `슬롯 ${tk.block!.id} 아래에서 [집기]로 넣기` : '2층으로! (사다리 ↑ 또는 [점프])';
    } else if (tk.kind === 'enemy') hint = '2층의 깜빡이는 대기실 문 앞에서 [작업] 길게 누르기';
    else hint = '2층 발판 지지대 아래에서 [작업] 길게 누르기';
  }
  if (hint) {
    ctx.font = `12px ${KR}`;
    const w = ctx.measureText(hint).width + 18;
    box(ctx, W / 2 - w / 2, FRONT_H - 30, w, 22, g.exposed || awkward ? C.bad : '#f8b800');
    text(ctx, hint, W / 2, FRONT_H - 19, 12, g.exposed || awkward ? '#fcbcb0' : '#f8d878', 'center', false);
  }
}
