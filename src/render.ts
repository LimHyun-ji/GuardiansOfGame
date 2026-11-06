import type { Game, Task } from './game';
import {
  BACK_TOP, BLOCK_S, FRONT_H, GROUND_Y, H, LOWER_FLOOR, PLAT_Y, UPPER_FLOOR, W,
} from './level';

const C = {
  sky: '#9ad0d8', skyLow: '#c8e6dc', hill: '#6fb3a8', hillFar: '#87c2b6',
  ground: '#a85d3a', groundTop: '#e2a35c', groundDark: '#7c3f26',
  block: '#f08a4b', blockEdge: '#8a3a17', blockHit: '#7a6a60', platform: '#5aa469', platformDark: '#2f6a3d',
  player: '#f4f1e8', playerHat: '#3456c8', enemy: '#7b4fb0', enemyDark: '#4a2a72',
  bridge: '#c58a4a', bridgeBad: '#8d5a33',
  back: '#241d1a', backUpper: '#352a25', backWall: '#2d2420', beam: '#6e5340', beamDark: '#4d392c',
  ladder: '#b49463', door: '#4b6b8a', doorLit: '#7fb4e6', crateCoin: '#e7b93e', crate1up: '#59b36a',
  staff: '#4fa3e0', staffDark: '#2a6c9e', staffCap: '#f2c84b',
  hudBg: 'rgba(20,14,12,0.78)', hudText: '#f5ecd9', imm: '#5ec8f0', fun: '#ffb347', bad: '#ff6b6b', good: '#8dff9a',
  frame: 'rgba(255,255,255,0.85)', frameFill: 'rgba(255,255,255,0.07)',
};

const FONT = '"Do Hyeon", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', outline = true) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function taskLabel(t: Task) {
  if (t.kind === 'fill') return `블록 ${t.block!.id} · ${t.item === '1up' ? '1UP' : '동전'}`;
  if (t.kind === 'enemy') return '대기실 · 적 출근';
  return '발판 수리';
}

export function render(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = Math.round(g.camX);
  const L = g.level;
  const t = g.t;
  const sx = (x: number) => Math.round(x - cam);

  // ═══════════ 앞무대
  const sky = ctx.createLinearGradient(0, 0, 0, FRONT_H);
  sky.addColorStop(0, C.sky);
  sky.addColorStop(1, C.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, FRONT_H);

  // 패럴랙스 언덕
  for (let i = -1; i < 6; i++) {
    const hx = i * 180 - ((cam * 0.3) % 180);
    ctx.fillStyle = C.hillFar;
    ctx.beginPath();
    ctx.ellipse(hx + 90, GROUND_Y + 6, 90, 50, 0, Math.PI, 0);
    ctx.fill();
  }
  for (let i = -1; i < 5; i++) {
    const hx = i * 260 - ((cam * 0.55) % 260);
    ctx.fillStyle = C.hill;
    ctx.beginPath();
    ctx.ellipse(hx + 60, GROUND_Y + 4, 70, 34, 0, Math.PI, 0);
    ctx.fill();
  }
  // 구름(배경 소품)
  for (let i = -1; i < 5; i++) {
    const cx = i * 220 - ((cam * 0.15) % 220) + 40;
    rect(ctx, cx, 52 + (i % 2) * 18, 40, 10, '#eef8f6');
    rect(ctx, cx + 8, 46 + (i % 2) * 18, 22, 8, '#eef8f6');
  }

  // 지면
  let gx = Math.floor(cam / 16) * 16;
  for (; gx < cam + W + 16; gx += 16) {
    const pit = L.pits.find((p) => gx + 8 > p.x && gx + 8 < p.x + p.w);
    if (pit) continue;
    rect(ctx, sx(gx), GROUND_Y, 16, FRONT_H - GROUND_Y, C.ground);
    rect(ctx, sx(gx), GROUND_Y, 16, 4, C.groundTop);
    rect(ctx, sx(gx) + 15, GROUND_Y + 4, 1, FRONT_H - GROUND_Y, C.groundDark);
  }
  // 다리
  for (const pit of L.pits) {
    if (!pit.bridge || pit.x + pit.w < cam || pit.x > cam + W) continue;
    const br = pit.bridge;
    if (br.collapsed) continue;
    for (let i = 0; i < pit.w; i += 8) {
      rect(ctx, sx(pit.x + i), GROUND_Y, 7, 6, br.dur < 50 ? C.bridgeBad : C.bridge);
    }
    if (br.dur < 50) {
      ctx.strokeStyle = '#3a1d0e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx(pit.x + 20), GROUND_Y);
      ctx.lineTo(sx(pit.x + 26), GROUND_Y + 6);
      ctx.moveTo(sx(pit.x + 44), GROUND_Y);
      ctx.lineTo(sx(pit.x + 40), GROUND_Y + 6);
      ctx.stroke();
    }
  }
  // 샛길 발판
  for (const br of L.branches) {
    if (br.x + br.w < cam || br.x > cam + W) continue;
    rect(ctx, sx(br.x), PLAT_Y, br.w, 8, C.platform);
    rect(ctx, sx(br.x), PLAT_Y + 6, br.w, 2, C.platformDark);
  }
  // 블록
  for (const b of L.blocks) {
    if (b.x + BLOCK_S < cam || b.x > cam + W) continue;
    if (b.hidden && !b.hit) {
      // 앞무대에서는 보이지 않지만 뒷무대 직원은 위치를 안다
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(sx(b.x) + 0.5, b.y + 0.5, BLOCK_S - 1, BLOCK_S - 1);
      ctx.setLineDash([]);
      continue;
    }
    rect(ctx, sx(b.x), b.y, BLOCK_S, BLOCK_S, b.hit ? C.blockHit : C.block);
    ctx.strokeStyle = C.blockEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx(b.x) + 0.5, b.y + 0.5, BLOCK_S - 1, BLOCK_S - 1);
    if (!b.hit) {
      rect(ctx, sx(b.x) + 6, b.y + 4, 4, 4, '#fff3d6');
      rect(ctx, sx(b.x) + 6, b.y + 10, 4, 2, '#fff3d6');
    }
    text(ctx, String(b.id), sx(b.x) + 8, b.y - 6, 9, '#2b1a10', 'center', false);
  }
  // 골
  if (L.goalX - cam < W + 20) {
    const fx = sx(L.goalX);
    rect(ctx, fx, GROUND_Y - 90, 3, 90, '#efefef');
    rect(ctx, fx + 3, GROUND_Y - 90, 22, 14, '#e6574a');
    text(ctx, 'GOAL', fx + 14, GROUND_Y - 100, 10, '#fff', 'center');
  }
  // 적 배우
  for (const e of g.enemies) {
    const ex = sx(e.x);
    if (e.popT > 0) {
      ctx.globalAlpha = 1 - e.popT / 0.35;
    }
    if (!e.alive) {
      rect(ctx, ex, e.y + e.h - 4, e.w, 4, C.enemyDark);
    } else {
      rect(ctx, ex + 1, e.y + 2, e.w - 2, e.h - 4, C.enemy);
      rect(ctx, ex, e.y + 5, e.w, e.h - 7, C.enemy);
      rect(ctx, ex + 3, e.y + 5, 3, 3, '#fff');
      rect(ctx, ex + 3, e.y + 6, 1, 2, '#000');
      rect(ctx, ex + 2, e.y + e.h - 2, 4, 2, C.enemyDark);
      rect(ctx, ex + e.w - 6, e.y + e.h - 2, 4, 2, C.enemyDark);
    }
    ctx.globalAlpha = 1;
  }
  // 플레이어 AI
  const p = g.player;
  if (!(p.state === 'dead' && Math.floor(t * 12) % 2 === 0)) {
    const px = sx(p.x);
    const py = Math.round(Math.min(p.y, FRONT_H - p.h));
    rect(ctx, px + 2, py, 8, 4, C.playerHat);
    rect(ctx, px + 1, py + 3, 10, 2, C.playerHat);
    rect(ctx, px + 2, py + 5, 8, 4, '#f6c9a0');
    rect(ctx, px + 7, py + 6, 1, 2, '#000');
    rect(ctx, px + 1, py + 9, 10, 5, C.player);
    const leg = p.onGround && p.vx > 0 ? Math.floor(t * 10) % 2 : 0;
    rect(ctx, px + 2 + leg, py + 14, 3, 2, '#333');
    rect(ctx, px + 7 - leg, py + 14, 3, 2, '#333');
    if (g.lookPhase !== 'none') text(ctx, g.lookPhase === 'warn' ? '…?' : '두리번', px + 6, py - 10, 11, '#ffd36b', 'center');
  }

  // ═══════════ 무대 경계
  rect(ctx, 0, BACK_TOP - 2, W, 4, '#120c0a');

  // ═══════════ 뒷무대
  rect(ctx, 0, BACK_TOP + 2, W, UPPER_FLOOR - BACK_TOP - 2, C.backUpper);
  rect(ctx, 0, UPPER_FLOOR, W, H - UPPER_FLOOR, C.back);
  // 벽 판자/케이블
  for (let x = Math.floor(cam / 40) * 40; x < cam + W + 40; x += 40) {
    rect(ctx, sx(x), UPPER_FLOOR + 6, 1, LOWER_FLOOR - UPPER_FLOOR - 6, C.backWall);
    rect(ctx, sx(x), BACK_TOP + 2, 1, UPPER_FLOOR - BACK_TOP - 2, '#2f2520');
  }
  ctx.strokeStyle = '#151010';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = Math.floor(cam / 120) * 120 - 120; x < cam + W + 120; x += 120) {
    ctx.moveTo(sx(x), UPPER_FLOOR + 12);
    ctx.quadraticCurveTo(sx(x + 60), UPPER_FLOOR + 26, sx(x + 120), UPPER_FLOOR + 12);
  }
  ctx.stroke();
  // 층 바닥
  rect(ctx, 0, UPPER_FLOOR, W, 6, C.beam);
  rect(ctx, 0, UPPER_FLOOR + 5, W, 1, C.beamDark);
  rect(ctx, 0, LOWER_FLOOR, W, H - LOWER_FLOOR, C.beam);
  rect(ctx, 0, LOWER_FLOOR, W, 2, '#8a6a52');
  text(ctx, '2층 통로 · 카메라 주의', 6, UPPER_FLOOR - 40, 9, 'rgba(245,236,217,0.35)', 'left', false);
  text(ctx, '1층 통로 · 안전', 6, LOWER_FLOOR - 66, 9, 'rgba(245,236,217,0.35)', 'left', false);

  // 사다리
  for (const lx of L.ladders) {
    if (lx < cam - 20 || lx > cam + W) continue;
    const x = sx(lx);
    rect(ctx, x, UPPER_FLOOR - 2, 2, LOWER_FLOOR - UPPER_FLOOR + 2, C.ladder);
    rect(ctx, x + 10, UPPER_FLOOR - 2, 2, LOWER_FLOOR - UPPER_FLOOR + 2, C.ladder);
    for (let y = UPPER_FLOOR + 4; y < LOWER_FLOOR; y += 9) rect(ctx, x, y, 12, 2, C.ladder);
  }
  // 창고 상자
  for (const c of L.crates) {
    if (c.x < cam - 30 || c.x > cam + W) continue;
    const x = sx(c.x);
    rect(ctx, x, LOWER_FLOOR - 18, 20, 18, c.kind === 'coin' ? C.crateCoin : C.crate1up);
    rect(ctx, x, LOWER_FLOOR - 18, 20, 3, 'rgba(0,0,0,0.25)');
    text(ctx, c.kind === 'coin' ? '동전' : '1UP', x + 10, LOWER_FLOOR - 8, 9, '#2b1a10', 'center', false);
  }
  // 대기실 문
  for (const d of L.doors) {
    if (d.x < cam - 30 || d.x > cam + W) continue;
    const x = sx(d.x);
    const task = g.tasks.find((tk) => tk.door === d);
    rect(ctx, x - 2, LOWER_FLOOR - 34, 24, 34, '#1a1412');
    rect(ctx, x, LOWER_FLOOR - 32, 20, 32, d.used ? '#3a3a3a' : task ? C.doorLit : C.door);
    rect(ctx, x + 15, LOWER_FLOOR - 17, 2, 3, '#e8d8a8');
    text(ctx, '대기실', x + 10, LOWER_FLOOR - 40, 9, d.used ? '#777' : '#cfe3ff', 'center', false);
  }
  // 블록 슬롯(2층 천장)
  for (const b of L.blocks) {
    if (b.x < cam - 20 || b.x > cam + W) continue;
    const x = sx(b.x);
    const col = b.hit ? '#555' : b.content ? C.good : '#ff9fb5';
    rect(ctx, x, BACK_TOP + 2, 16, 8, '#1a1412');
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, BACK_TOP + 2.5, 15, 7);
    if (b.content) rect(ctx, x + 5, BACK_TOP + 4, 6, 4, b.content === 'coin' ? C.crateCoin : C.crate1up);
    text(ctx, b.hidden ? `샛길 ${b.id}` : `슬롯 ${b.id}`, x + 8, BACK_TOP + 17, 8, col, 'center', false);
    rect(ctx, x + 7, BACK_TOP + 22, 2, UPPER_FLOOR - BACK_TOP - 22, 'rgba(255,255,255,0.06)');
  }
  // 발판 수리 지점
  for (const pit of L.pits) {
    const br = pit.bridge;
    if (!br || pit.x < cam - 80 || pit.x > cam + W) continue;
    const x = sx(pit.x + pit.w / 2);
    rect(ctx, x - 14, BACK_TOP + 2, 28, 10, br.collapsed ? '#333' : '#5d4a3a');
    rect(ctx, x - 2, BACK_TOP + 12, 4, UPPER_FLOOR - BACK_TOP - 12, '#5d4a3a');
    const dur = br.collapsed ? 0 : br.dur;
    rect(ctx, x - 13, BACK_TOP + 4, 26 * (dur / 100), 3, dur < 50 ? C.bad : C.good);
    text(ctx, br.collapsed ? '붕괴' : `발판 ${Math.round(dur)}%`, x, BACK_TOP + 18, 8, dur < 50 ? C.bad : C.good, 'center', false);
  }

  // 스태프
  const s = g.staff;
  {
    const x = sx(s.x);
    const y = Math.round(s.y);
    if (s.disguised) {
      // 덤불 위장
      ctx.fillStyle = '#4c9a4a';
      ctx.beginPath();
      ctx.arc(x + 2, y + 13, 6, 0, Math.PI * 2);
      ctx.arc(x + 9, y + 10, 7, 0, Math.PI * 2);
      ctx.arc(x + 14, y + 14, 5, 0, Math.PI * 2);
      ctx.fill();
      rect(ctx, x - 3, y + 16, 22, 2, '#2f6a2d');
      rect(ctx, x + 6, y + 8, 2, 2, '#fff'); // 눈만 빼꼼
    } else {
      const pixel = g.inFrame; // 카메라 안에서는 도트로 변환
      if (pixel) {
        for (let yy = 0; yy < s.h; yy += 3) for (let xx = 0; xx < s.w; xx += 3) {
          const col = yy < 4 ? C.staffCap : yy < 8 ? '#f6c9a0' : C.staff;
          rect(ctx, x + xx, y + yy, 3, 3, col);
        }
      } else {
        rect(ctx, x + 1, y, 8, 4, C.staffCap);
        rect(ctx, x + (s.facing > 0 ? 5 : -1), y + 2, 6, 2, C.staffCap);
        rect(ctx, x + 1, y + 4, 8, 4, '#f6c9a0');
        rect(ctx, x + (s.facing > 0 ? 6 : 3), y + 5, 1, 2, '#000');
        rect(ctx, x, y + 8, 10, 7, C.staff);
        rect(ctx, x + 3, y + 9, 4, 3, C.staffDark);
        const leg = s.onGround && Math.abs(s.vx) > 1 ? Math.floor(t * 12) % 2 : 0;
        rect(ctx, x + 1 + leg, y + 15, 3, 3, C.staffDark);
        rect(ctx, x + 6 - leg, y + 15, 3, 3, C.staffDark);
      }
      if (s.carry) {
        const by = y - 9 + Math.sin(t * 6) * 1.5;
        if (s.carry === 'coin') {
          ctx.fillStyle = C.crateCoin;
          ctx.beginPath(); ctx.arc(x + 5, by, 4, 0, Math.PI * 2); ctx.fill();
        } else {
          rect(ctx, x - 1, by - 4, 12, 8, C.crate1up);
          text(ctx, '1UP', x + 5, by, 6, '#10240f', 'center', false);
        }
      }
    }
    if (g.exposed) {
      text(ctx, '!', x + 5, y - 20, 16, Math.floor(t * 8) % 2 ? C.bad : '#fff', 'center');
    }
    if (g.suspicion > 0) {
      rect(ctx, x - 6, y - 30, 22, 4, 'rgba(0,0,0,0.6)');
      rect(ctx, x - 6, y - 30, 22 * (g.suspicion / 100), 4, C.bad);
    }
    if (s.work) {
      const k = s.work.t / s.work.need;
      ctx.strokeStyle = C.good;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + 5, y - 10, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
    }
  }

  // ═══════════ 플레이어 카메라 프레임
  const f = g.frame();
  const fx0 = Math.max(0, sx(f.x0));
  const fx1 = Math.min(W, sx(f.x1));
  ctx.fillStyle = g.lookPhase === 'look' ? 'rgba(255,90,90,0.10)' : C.frameFill;
  ctx.fillRect(fx0, 0, fx1 - fx0, f.y1);
  const warn = g.lookPhase === 'warn' && Math.floor(t * 8) % 2 === 0;
  ctx.strokeStyle = g.lookPhase === 'look' || warn ? C.bad : C.frame;
  ctx.lineWidth = 2;
  ctx.setLineDash(g.lookPhase === 'look' ? [] : [6, 4]);
  ctx.strokeRect(fx0 + 1, 1, fx1 - fx0 - 2, f.y1 - 2);
  ctx.setLineDash([]);
  // 모서리 마커
  const corner = (x: number, y: number, dx: number, dy: number) => {
    rect(ctx, x, y, 10 * dx || 3, 3, '#fff');
    rect(ctx, x, y, 3, 10 * dy || 3, '#fff');
  };
  if (g.lookPhase !== 'look') {
    corner(fx0, f.y1 - 3, 1, -1);
    corner(fx1 - 3, f.y1 - 3, -1, -1);
    text(ctx, '● REC  플레이어 카메라', fx0 + 6, f.y1 - 10, 9, '#ffdede', 'left');
  } else {
    text(ctx, '플레이어가 화면 전체를 둘러보는 중!', W / 2, H / 2 + 20, 14, C.bad, 'center');
  }

  // ═══════════ 목표 화살표 (가장 급한 업무)
  const sorted = [...g.tasks].sort((a, b) => a.x - b.x);
  const top = sorted[0];
  if (top) {
    let ax: number | null = null;
    let ay = 0;
    if (top.kind === 'fill') {
      if (s.carry) { ax = top.block!.x + 8; ay = UPPER_FLOOR - 26; }
      else {
        const want = top.item ?? 'coin';
        const crates = L.crates.filter((c) => c.kind === want && c.x > cam - 10 && c.x < cam + W - 20);
        crates.sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x));
        if (crates[0]) { ax = crates[0].x + 10; ay = LOWER_FLOOR - 30; }
      }
    } else if (top.kind === 'enemy') { ax = top.door!.x + 10; ay = LOWER_FLOOR - 52; }
    else { ax = top.pit!.x + top.pit!.w / 2; ay = UPPER_FLOOR - 26; }
    if (ax !== null) {
      const bob = Math.sin(t * 8) * 3;
      let axs = sx(ax);
      const off = axs > W - 10 ? 1 : axs < 10 ? -1 : 0;
      axs = Math.max(12, Math.min(W - 12, axs));
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      if (off === 0) {
        ctx.moveTo(axs - 6, ay - 8 + bob); ctx.lineTo(axs + 6, ay - 8 + bob); ctx.lineTo(axs, ay + bob); ctx.closePath();
      } else {
        ctx.moveTo(axs + off * 8, ay); ctx.lineTo(axs - off * 2, ay - 7); ctx.lineTo(axs - off * 2, ay + 7); ctx.closePath();
      }
      ctx.fill();
      ctx.strokeStyle = '#3a2a00';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // 떠오르는 텍스트
  for (const fl of g.floaters) {
    ctx.globalAlpha = Math.min(1, fl.t * 2);
    text(ctx, fl.text, sx(fl.x), fl.y, 10, fl.color, 'left');
  }
  ctx.globalAlpha = 1;

  drawHud(ctx, g, sorted);
}

function gauge(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, v: number, color: string) {
  text(ctx, label, x, y + 4, 11, C.hudText, 'left', false);
  rect(ctx, x + 40, y, 92, 9, 'rgba(0,0,0,0.5)');
  rect(ctx, x + 41, y + 1, 90 * (v / 100), 7, v < 25 ? C.bad : color);
  text(ctx, String(Math.round(v)), x + 136, y + 4, 10, C.hudText, 'left', false);
}

function drawHud(ctx: CanvasRenderingContext2D, g: Game, sorted: Task[]) {
  // 게이지
  rect(ctx, 4, 4, 164, 32, C.hudBg);
  gauge(ctx, 10, 8, '몰입도', g.immersion, C.imm);
  gauge(ctx, 10, 22, '재미도', g.fun, C.fun);

  // 업무 카드 (최대 3장)
  const cards = sorted.slice(0, 3);
  cards.forEach((tk, i) => {
    const x = 176 + i * 116;
    const eta = Math.max(0, (tk.x - (g.player.x + g.player.w / 2)) / 55);
    const urgent = eta < 2.5;
    rect(ctx, x, 4, 112, 32, urgent && Math.floor(g.t * 6) % 2 ? 'rgba(120,20,20,0.9)' : C.hudBg);
    rect(ctx, x, 4, 3, 32, tk.kind === 'fill' ? C.crateCoin : tk.kind === 'enemy' ? '#c9a6ff' : C.good);
    text(ctx, taskLabel(tk), x + 8, 13, 11, C.hudText, 'left', false);
    text(ctx, tk.surprise ? '돌발!' : tk.director ? '감독 지시' : '대본', x + 8, 27, 9, tk.surprise || tk.director ? '#ffd36b' : '#b9ab95', 'left', false);
    text(ctx, `${eta.toFixed(1)}초`, x + 106, 27, 12, urgent ? C.bad : C.hudText, 'right', false);
  });
  if (sorted.length > 3) text(ctx, `+${sorted.length - 3}`, 176 + 3 * 116, 20, 11, C.hudText, 'left');

  // 시간 & 진행도
  const m = Math.floor(g.t / 60);
  const sec = Math.floor(g.t % 60).toString().padStart(2, '0');
  rect(ctx, W - 58, 4, 54, 18, C.hudBg);
  text(ctx, `${m}:${sec}`, W - 31, 13, 12, C.hudText, 'center', false);
  const prog = Math.min(1, g.player.x / g.level.goalX);
  rect(ctx, W - 58, 24, 54, 4, 'rgba(0,0,0,0.5)');
  rect(ctx, W - 58, 24, 54 * prog, 4, C.good);

  // 토스트
  if (g.toast.t > 0) {
    ctx.globalAlpha = Math.min(1, g.toast.t * 2);
    ctx.font = `13px ${FONT}`;
    const w = ctx.measureText(g.toast.text).width + 20;
    rect(ctx, W / 2 - w / 2, 44, w, 20, C.hudBg);
    text(ctx, g.toast.text, W / 2, 54, 13, g.toast.color, 'center', false);
    ctx.globalAlpha = 1;
  }

  // 초보 힌트 (첫 업무 완료 전, 또는 노출 중)
  let hint = '';
  const s = g.staff;
  if (g.exposed) hint = '카메라에 찍히는 중! [위장] 버튼 또는 1층으로 내려가기';
  else if (g.firstTaskDoneAt < 0 && sorted[0]) {
    const tk = sorted[0];
    if (tk.kind === 'fill') {
      if (!s.carry) hint = s.floor === 'lower' ? '노란 상자 앞에서 [집기]' : '1층 창고로! (스틱 ↓ 사다리, 점프+↓ 내려가기)';
      else hint = s.floor === 'upper' ? `슬롯 ${tk.block!.id} 아래에서 [집기]로 넣기` : '2층으로! (사다리 ↑ 또는 [점프])';
    } else if (tk.kind === 'enemy') hint = '빛나는 대기실 문 앞에서 [작업] 길게 누르기';
    else hint = '2층 발판 지지대 아래에서 [작업] 길게 누르기';
  }
  if (hint) {
    ctx.font = `12px ${FONT}`;
    const w = ctx.measureText(hint).width + 16;
    rect(ctx, W / 2 - w / 2, FRONT_H - 26, w, 18, 'rgba(20,14,12,0.85)');
    text(ctx, hint, W / 2, FRONT_H - 17, 12, g.exposed ? C.bad : '#ffe066', 'center', false);
  }
}
