import {
  BACK_TOP, Block, Branch, Bridge, buildLevel, Door, FRONT_H, GROUND_Y, Item, Level, LOWER_FLOOR, PLAT_Y,
  PLAYER_CURIOSITY, PLAYER_SKILL, PLAYER_SPEED, Pit, TASK_LEAD, UPPER_FLOOR, W, H,
} from './level';
import type { InputState } from './input';

export type TaskKind = 'fill' | 'enemy' | 'repair';

export interface Task {
  id: number;
  kind: TaskKind;
  x: number; // 플레이어 AI가 도착하는 지점 (기한)
  item?: Item;
  block?: Block;
  door?: Door;
  pit?: Pit;
  surprise?: boolean;
  director?: boolean;
}

export interface Enemy {
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
  judged: boolean;
  squashT: number;
  popT: number;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
}

export interface Frame {
  x0: number;
  x1: number;
  y1: number;
}

type Sfx = 'pick' | 'put' | 'work' | 'done' | 'coin' | 'empty' | 'alert' | 'stomp' | 'die' | 'caught' | 'disguise' | 'jump';

const P_GRAV = 900;
const S_GRAV = 1000;
const STAFF_SPEED = 130;

export class Game {
  level: Level = buildLevel();
  t = 0;
  camX = 0;
  state: 'play' | 'fail' | 'clear' = 'play';
  failReason = '';

  player = {
    x: 40, y: GROUND_Y - 16, w: 12, h: 16, vx: 0, vy: 0,
    onGround: true, state: 'run' as 'run' | 'dead' | 'win', deadT: 0, respawnX: 0, lives: 3,
  };

  staff = {
    x: 150, y: LOWER_FLOOR - 18, w: 10, h: 18, vx: 0, vy: 0,
    onGround: true, floor: 'lower' as 'lower' | 'upper' | null, climbing: false, ladderX: 0,
    dropT: 0, carry: null as Item | null, disguised: false, facing: 1,
    work: null as null | { obj: Door | Bridge; kind: 'door' | 'bridge'; t: number; need: number; door?: Door; pit?: Pit },
  };

  enemies: Enemy[] = [];
  tasks: Task[] = [];
  floaters: Floater[] = [];
  toast = { text: '', color: '#fff', t: 0 };

  immersion = 100;
  fun = 65;
  suspicion = 0;
  exposed = false;
  inFrame = false;

  // 통계
  caught = 0;
  dodges = 0;
  tasksDone = 0;
  tasksMissed = 0;
  deaths: number[] = [];
  firstTaskDoneAt = -1;
  private sumImm = 0;
  private sumFun = 0;
  private samples = 0;

  lookPhase: 'none' | 'warn' | 'look' = 'none';
  lookT = 0;
  nextLookAt = 24;
  private lastFunEvent = 0;
  private lastDirectorEnemy = -99;
  private last1up = -99;
  private taskSeq = 0;
  private wasHiddenInFrame = false;

  onSfx: (s: Sfx) => void = () => {};

  // ───────────────────────────── 메인 업데이트
  update(dt: number, inp: InputState) {
    if (this.state !== 'play') return;
    this.t += dt;
    this.updateLook(dt);
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.camX = Math.max(this.camX, Math.min(this.player.x - 180, this.level.goalX + 120 - W));
    this.updateStaff(dt, inp);
    this.updateDirector();
    this.updateTasks();
    this.updateExposure(dt);
    this.updateGauges(dt);
    for (const f of this.floaters) { f.t -= dt; f.y -= 18 * dt; }
    this.floaters = this.floaters.filter((f) => f.t > 0);
    if (this.toast.t > 0) this.toast.t -= dt;
  }

  // ───────────────────────────── 헬퍼
  float(x: number, y: number, text: string, color = '#fff') {
    this.floaters.push({ x, y, text, color, t: 1.3 });
  }
  say(text: string, color = '#fff') {
    this.toast = { text, color, t: 2.6 };
  }
  eta(x: number) {
    return (x - (this.player.x + this.player.w / 2)) / PLAYER_SPEED;
  }
  funEvent(delta: number) {
    this.fun = Math.max(0, Math.min(100, this.fun + delta));
    if (delta > 0) this.lastFunEvent = this.t;
  }
  frame(): Frame {
    if (this.lookPhase === 'look') return { x0: this.camX, x1: this.camX + W, y1: H };
    const p = this.player;
    return { x0: p.x - 60, x1: p.x + 150, y1: UPPER_FLOOR + 4 };
  }
  pitAt(cx: number) {
    return this.level.pits.find((p) => cx > p.x && cx < p.x + p.w);
  }
  groundAt(cx: number) {
    const pit = this.pitAt(cx);
    return !pit || (!!pit.bridge && !pit.bridge.collapsed);
  }

  // ───────────────────────────── 플레이어 AI
  private jump(v = 330) {
    this.player.vy = -v;
    this.player.onGround = false;
  }

  private aiDecide() {
    const p = this.player;
    const front = p.x + p.w;
    const cx = p.x + p.w / 2;
    const L = this.level;
    // 구덩이 (다리는 있다고 믿는다)
    for (const pit of L.pits) {
      if (pit.bridge) continue;
      if (cx >= pit.x - 6 && cx < pit.x) return this.jump(360);
    }
    // 샛길로 올라가기
    for (const br of L.branches) {
      if (!br.detour || br.entered) continue;
      const d = br.x - front;
      if (d >= 8 && d < 14 && p.y + p.h === GROUND_Y) { br.entered = true; return this.jump(); }
    }
    // 적 밟기 (실력 판정)
    for (const e of this.enemies) {
      if (!e.alive || e.judged) continue;
      const d = e.x - front;
      if (d >= 0 && d <= 40) {
        e.judged = true;
        if (Math.random() < PLAYER_SKILL) return this.jump();
        this.float(p.x, p.y - 6, '헛디딤!', '#ffd2d2');
      }
    }
    // 블록 치기
    for (const b of L.blocks) {
      if (b.hit) continue;
      if (b.hidden && !b.branch?.detour) continue;
      const dx = b.x + 8 - cx;
      const vert = p.y - (b.y + 16);
      if (dx >= -1 && dx <= 5 && vert > 0 && vert <= 40) return this.jump();
    }
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const L = this.level;
    if (p.state === 'win') return;
    if (p.state === 'dead') {
      p.deadT -= dt;
      if (p.deadT <= 0) {
        p.state = 'run';
        p.x = p.respawnX; p.y = GROUND_Y - p.h; p.vy = 0; p.onGround = true;
      }
      return;
    }
    const looking = this.lookPhase === 'look';
    p.vx = looking ? 0 : PLAYER_SPEED;
    if (p.onGround && !looking) this.aiDecide();

    const prevTop = p.y;
    const prevBottom = p.y + p.h;
    p.vy = Math.min(600, p.vy + P_GRAV * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.onGround = false;
    const cx = p.x + p.w / 2;

    // 머리로 블록 치기
    if (p.vy < 0) {
      for (const b of L.blocks) {
        if (p.x + 2 < b.x + 16 && p.x + p.w - 2 > b.x && prevTop >= b.y + 16 - 0.01 && p.y < b.y + 16) {
          if (b.hidden && !b.branch?.detour) continue;
          p.y = b.y + 16; p.vy = 0;
          this.hitBlock(b);
          break;
        }
      }
    }
    // 착지
    if (p.vy >= 0) {
      const bottom = p.y + p.h;
      let landY = Infinity;
      const consider = (top: number) => {
        if (prevBottom <= top + 0.5 && bottom >= top && top < landY) landY = top;
      };
      if (this.groundAt(cx)) consider(GROUND_Y);
      for (const br of L.branches) if (cx > br.x && cx < br.x + br.w) consider(PLAT_Y);
      for (const b of L.blocks) {
        if (b.hidden && !b.hit) continue;
        if (p.x + p.w > b.x + 2 && p.x < b.x + 14) consider(b.y);
      }
      if (landY < Infinity) { p.y = landY - p.h; p.vy = 0; p.onGround = true; }
    }
    // 다리 붕괴
    if (p.onGround && p.y + p.h === GROUND_Y) {
      const pit = this.pitAt(cx);
      if (pit?.bridge && !pit.bridge.collapsed && pit.bridge.dur < 50) {
        pit.bridge.collapsed = true;
        p.onGround = false;
        this.immersion -= 15;
        this.say('발판이 무너졌다! 몰입도 -15', '#ff8a8a');
        this.float(pit.x, GROUND_Y - 20, '와르르', '#ffb36b');
        this.onSfx('empty');
      }
    }
    // 낙사
    if (p.y > FRONT_H + 4) {
      const pit = this.pitAt(cx) ?? L.pits.find((q) => q.x < cx && q.x + q.w + 40 > cx);
      this.killPlayer(pit ? pit.x + pit.w + 6 : p.x + 40);
      return;
    }
    // 적과 충돌
    for (const e of this.enemies) {
      if (!e.alive || e.popT > 0) continue;
      if (p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y) {
        if (!p.onGround && p.vy > 0) {
          e.alive = false; e.squashT = 0.5;
          p.vy = -220;
          this.funEvent(9);
          this.float(e.x, e.y - 8, '재미 +9', '#ffd36b');
          this.onSfx('stomp');
        } else if (p.onGround) {
          e.alive = false; e.squashT = 0;
          this.killPlayer(p.x + 4);
          return;
        }
      }
    }
    if (p.x >= L.goalX) {
      p.state = 'win';
      this.finish('clear');
    }
  }

  private killPlayer(respawnX: number) {
    const p = this.player;
    p.state = 'dead';
    p.deadT = 1.2;
    p.respawnX = respawnX;
    p.lives--;
    this.deaths.push(this.t);
    this.funEvent(-12);
    this.float(p.x, Math.min(p.y, FRONT_H - 30), '으악! 재미 -12', '#ff8a8a');
    this.onSfx('die');
  }

  private hitBlock(b: Block) {
    b.hit = true;
    const task = this.tasks.find((t) => t.block === b);
    if (b.content === 'coin') {
      this.funEvent(4);
      this.float(b.x, b.y - 10, '동전! 재미 +4', '#ffe066');
      this.onSfx('coin');
    } else if (b.content === '1up') {
      this.funEvent(10);
      this.player.lives++;
      this.float(b.x - 4, b.y - 10, '1UP! 재미 +10', '#8dff9a');
      this.onSfx('coin');
    } else {
      this.immersion -= 8;
      this.funEvent(-2);
      this.float(b.x - 6, b.y - 10, '텅…', '#ff9a9a');
      this.say(`블록 ${b.id}이 비어 있었다! 몰입도 -8`, '#ff8a8a');
      this.onSfx('empty');
      if (task) this.missTask(task);
    }
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (e.popT > 0) { e.popT -= dt; continue; }
      if (e.alive) e.x -= 12 * dt;
      else e.squashT -= dt;
    }
    this.enemies = this.enemies.filter((e) => (e.alive || e.squashT > 0) && e.x > this.camX - 40);
  }

  // ───────────────────────────── 두리번 (카메라가 화면 전체를 훑는 이벤트)
  private updateLook(dt: number) {
    const p = this.player;
    if (this.lookPhase === 'none') {
      if (this.t >= this.nextLookAt && p.state === 'run' && p.onGround) {
        this.lookPhase = 'warn';
        this.lookT = 1.5;
        this.say('플레이어가 두리번거린다! 위장 준비!', '#ffd36b');
        this.onSfx('alert');
      }
    } else if (this.lookPhase === 'warn') {
      this.lookT -= dt;
      if (this.lookT <= 0) { this.lookPhase = 'look'; this.lookT = 2.6; }
    } else {
      this.lookT -= dt;
      if (this.lookT <= 0) {
        this.lookPhase = 'none';
        this.nextLookAt = this.t + 20 + Math.random() * 10;
      }
    }
  }

  // ───────────────────────────── 스태프 (유저)
  private onUpper() { return this.staff.floor === 'upper'; }
  private onLower() { return this.staff.floor === 'lower'; }

  private findWorkTarget() {
    const s = this.staff;
    const scx = s.x + s.w / 2;
    const L = this.level;
    if (this.onLower()) {
      for (const d of L.doors) {
        if (!d.used && Math.abs(scx - (d.x + 10)) < 16 && d.x > this.player.x + 40)
          return { obj: d, kind: 'door' as const, need: 0.8, door: d };
      }
    }
    if (this.onUpper()) {
      for (const pit of L.pits) {
        const br = pit.bridge;
        if (br && !br.collapsed && br.dur < 100 && Math.abs(scx - (pit.x + pit.w / 2)) < 28)
          return { obj: br, kind: 'bridge' as const, need: 1.2, pit };
      }
    }
    return null;
  }

  private completeWork(w: NonNullable<Game['staff']['work']>) {
    if (w.kind === 'door' && w.door) {
      const d = w.door;
      d.used = true;
      this.enemies.push({ x: d.x + 3, y: GROUND_Y - 14, w: 14, h: 14, alive: true, judged: false, squashT: 0, popT: 0.35 });
      this.float(d.x - 10, GROUND_Y - 34, '적 배우 출근!', '#c9a6ff');
      const task = this.tasks.find((t) => t.door === d);
      if (task) this.doneTask(task);
    } else if (w.kind === 'bridge' && w.pit?.bridge) {
      w.pit.bridge.dur = 100;
      this.float(w.pit.x, UPPER_FLOOR - 30, '수리 완료', '#8dff9a');
      const task = this.tasks.find((t) => t.pit === w.pit);
      if (task) this.doneTask(task);
    }
    this.onSfx('done');
  }

  private staffPick() {
    const s = this.staff;
    const scx = s.x + s.w / 2;
    const L = this.level;
    if (this.onLower()) {
      const c = L.crates.find((c) => Math.abs(scx - (c.x + 10)) < 13);
      if (c) {
        s.carry = c.kind;
        this.float(s.x - 6, s.y - 12, c.kind === 'coin' ? '동전 집음' : '1UP 집음', '#ffe066');
        this.onSfx('pick');
        return;
      }
    }
    if (this.onUpper() && s.carry) {
      const b = L.blocks.find((b) => !b.hit && !b.content && Math.abs(scx - (b.x + 8)) < 15);
      if (b) {
        b.content = s.carry;
        s.carry = null;
        this.float(b.x - 6, UPPER_FLOOR - 34, `블록 ${b.id} 채움`, '#8dff9a');
        this.onSfx('put');
        const task = this.tasks.find((t) => t.block === b);
        if (task) this.doneTask(task);
        return;
      }
    }
    if (s.carry) {
      s.carry = null;
      this.float(s.x - 4, s.y - 12, '내려놓음', '#ccc');
    }
  }

  private updateStaff(dt: number, inp: InputState) {
    const s = this.staff;
    const L = this.level;
    const wantsMove = Math.abs(inp.ax) > 0.35 || Math.abs(inp.ay) > 0.6;

    if (inp.disguise) {
      if (s.disguised) s.disguised = false;
      else if (s.onGround && !s.climbing) { s.disguised = true; s.work = null; this.onSfx('disguise'); }
    } else if (s.disguised && (wantsMove || inp.jump || inp.pick || inp.work)) {
      s.disguised = false;
    }

    let canMove = !s.disguised;

    // 작업(길게 누르기)
    if (canMove && inp.work && s.onGround && !s.climbing) {
      const target = this.findWorkTarget();
      if (target) {
        if (!s.work || s.work.obj !== target.obj) { s.work = { ...target, t: 0 }; this.onSfx('work'); }
        s.work.t += dt;
        canMove = false;
        if (s.work.t >= s.work.need) { this.completeWork(s.work); s.work = null; }
      } else s.work = null;
    } else s.work = null;

    if (canMove && inp.pick) this.staffPick();

    const scx = s.x + s.w / 2;
    // 사다리
    if (canMove && !s.climbing) {
      const lx = L.ladders.find((x) => Math.abs(scx - (x + 6)) < 10);
      if (lx !== undefined) {
        const startUp = inp.ay < -0.6 && s.y + s.h > UPPER_FLOOR + 1;
        const startDown = inp.ay > 0.6 && this.onUpper();
        if (startUp || startDown) {
          s.climbing = true; s.ladderX = lx; s.vy = 0;
          if (startDown) s.y += 2;
        }
      }
    }
    if (s.climbing) {
      s.x = s.ladderX + 6 - s.w / 2;
      s.vx = 0; s.vy = 0;
      s.floor = null; s.onGround = false;
      if (Math.abs(inp.ay) > 0.3) s.y += Math.sign(inp.ay) * 110 * dt;
      if (s.y + s.h <= UPPER_FLOOR && inp.ay < 0) { s.y = UPPER_FLOOR - s.h; s.climbing = false; s.floor = 'upper'; s.onGround = true; }
      else if (s.y + s.h >= LOWER_FLOOR) { s.y = LOWER_FLOOR - s.h; s.climbing = false; s.floor = 'lower'; s.onGround = true; }
      else if (inp.jump) { s.climbing = false; s.vy = -260; this.onSfx('jump'); }
      else if (Math.abs(inp.ax) > 0.7) { s.climbing = false; }
    } else {
      s.vx = canMove ? inp.ax * STAFF_SPEED : 0;
      if (Math.abs(inp.ax) > 0.1 && canMove) s.facing = Math.sign(inp.ax);
      if (canMove && inp.jump && s.onGround) {
        if (inp.ay > 0.6 && this.onUpper()) { s.dropT = 0.25; s.y += 1; }
        else { s.vy = -440; this.onSfx('jump'); }
        s.onGround = false; s.floor = null;
      }
      // 물리
      s.dropT -= dt;
      const prevBottom = s.y + s.h;
      s.vy = Math.min(700, s.vy + S_GRAV * dt);
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.onGround = false; s.floor = null;
      if (s.vy >= 0) {
        const bottom = s.y + s.h;
        if (s.dropT <= 0 && prevBottom <= UPPER_FLOOR + 0.5 && bottom >= UPPER_FLOOR) {
          s.y = UPPER_FLOOR - s.h; s.vy = 0; s.onGround = true; s.floor = 'upper';
        } else if (bottom >= LOWER_FLOOR) {
          s.y = LOWER_FLOOR - s.h; s.vy = 0; s.onGround = true; s.floor = 'lower';
        }
      }
      if (s.y < BACK_TOP + 2) { s.y = BACK_TOP + 2; if (s.vy < 0) s.vy = 0; }
    }
    // 화면 왼쪽 끝에 밀림
    s.x = Math.max(this.camX + 2, Math.min(this.camX + W - s.w - 2, s.x));
  }

  // ───────────────────────────── 들킴 판정
  private updateExposure(dt: number) {
    const s = this.staff;
    const f = this.frame();
    this.inFrame = s.x + s.w > f.x0 && s.x < f.x1 && s.y < f.y1;
    this.exposed = this.inFrame && !s.disguised;
    const hidden = this.inFrame && s.disguised;
    if (hidden && !this.wasHiddenInFrame) {
      this.dodges++;
      this.float(s.x - 8, s.y - 14, '위장!', '#9fe3ff');
    }
    this.wasHiddenInFrame = hidden;
    if (this.exposed) this.suspicion += (this.lookPhase === 'look' ? 70 : 55) * dt;
    else this.suspicion = Math.max(0, this.suspicion - 30 * dt);
    if (this.suspicion >= 100) {
      this.suspicion = 0;
      this.caught++;
      this.immersion -= 20;
      this.say('들켰다! “저거 뭐야?” 몰입도 -20', '#ff6b6b');
      this.float(this.player.x - 4, this.player.y - 20, '?!', '#ff6b6b');
      this.onSfx('caught');
    }
  }

  // ───────────────────────────── 무대 감독
  private addTask(t: Omit<Task, 'id'>) {
    const task = { ...t, id: ++this.taskSeq };
    this.tasks.push(task);
    if (t.surprise || t.director) this.onSfx('alert');
    return task;
  }

  private updateDirector() {
    const L = this.level;
    const p = this.player;
    if (p.state === 'win') return;

    // 1) 블록 도착 예측 → 채우기 업무
    for (const b of L.blocks) {
      if (b.hidden || b.hit || b.tasked || b.content) continue;
      const e = this.eta(b.x + 8);
      if (e <= TASK_LEAD && e > 0) {
        b.tasked = true;
        this.addTask({ kind: 'fill', x: b.x + 8, item: 'coin', block: b });
      }
    }
    // 2) 대본에 적힌 적 출현
    for (const d of L.doors) {
      if (!d.scripted || d.used || d.tasked) continue;
      const e = this.eta(d.x);
      if (e <= TASK_LEAD + 1 && e > 1) {
        d.tasked = true;
        this.addTask({ kind: 'enemy', x: d.x, door: d });
      }
    }
    // 3) 손상된 발판
    for (const pit of L.pits) {
      const br = pit.bridge;
      if (!br || br.tasked || br.dur >= 100) continue;
      const e = this.eta(pit.x);
      if (e <= TASK_LEAD + 3 && e > 0) {
        br.tasked = true;
        this.addTask({ kind: 'repair', x: pit.x, pit });
      }
    }
    // 4) 샛길 결정 (호기심)
    for (const br of L.branches) {
      if (br.decided || p.x < br.x - 140) continue;
      br.decided = true;
      br.detour = Math.random() < PLAYER_CURIOSITY;
      const b = br.block!;
      if (br.detour) {
        this.say('플레이어가 샛길로 빠진다! 숨은 블록을 채워라', '#ffd36b');
        if (!b.content) { b.tasked = true; this.addTask({ kind: 'fill', x: b.x + 8, item: 'coin', block: b, surprise: true }); }
      }
    }
    // 5) 재미도 낮음 → 적 추가 투입
    if (this.fun < 45 && this.t - this.lastDirectorEnemy > 9) {
      const d = L.doors.find((d) => !d.used && !d.tasked && this.eta(d.x) > 3.5 && this.eta(d.x) < 9);
      if (d) {
        d.tasked = true;
        this.lastDirectorEnemy = this.t;
        this.addTask({ kind: 'enemy', x: d.x, door: d, director: true });
        this.say('무대 감독: 너무 심심하다! 적 배우 추가 투입', '#c9a6ff');
      }
    }
    // 6) 연속 사망 → 몰래 1UP
    const recent = this.deaths.filter((d) => this.t - d < 30).length;
    if (recent >= 2 && this.t - this.last1up > 20) {
      const b = L.blocks.find((b) => !b.hidden && !b.hit && b.content !== '1up' && this.eta(b.x) > 3 && this.eta(b.x) < 9);
      if (b) {
        this.last1up = this.t;
        const existing = this.tasks.find((t) => t.block === b);
        if (existing) { existing.item = '1up'; existing.director = true; }
        else if (!b.content) { b.tasked = true; this.addTask({ kind: 'fill', x: b.x + 8, item: '1up', block: b, director: true }); }
        this.say(`무대 감독: 너무 어렵다! 블록 ${b.id}에 몰래 1UP`, '#8dff9a');
        this.onSfx('alert');
      }
    }
  }

  private doneTask(t: Task) {
    this.tasks = this.tasks.filter((x) => x !== t);
    this.tasksDone++;
    if (this.firstTaskDoneAt < 0) this.firstTaskDoneAt = this.t;
  }
  private missTask(t: Task) {
    this.tasks = this.tasks.filter((x) => x !== t);
    this.tasksMissed++;
  }

  private updateTasks() {
    const cx = this.player.x + this.player.w / 2;
    for (const t of [...this.tasks]) {
      if (t.kind === 'enemy' && cx >= t.x) {
        this.missTask(t);
        if (t.door) t.door.used = true;
        this.immersion -= 6;
        this.say('적 배우가 지각했다! 몰입도 -6', '#ff8a8a');
        this.onSfx('empty');
      } else if (t.kind === 'repair' && t.pit && cx > t.pit.x + t.pit.w) {
        this.missTask(t);
      } else if (t.kind === 'fill' && cx > t.x + 30) {
        this.missTask(t); // 플레이어가 그냥 지나침 (사망 등)
      }
    }
  }

  // ───────────────────────────── 게이지
  private updateGauges(dt: number) {
    const boring = this.t - this.lastFunEvent > 6;
    this.fun = Math.max(0, this.fun - (0.5 + (boring ? 0.8 : 0)) * dt);
    this.immersion = Math.min(100, this.immersion + 0.3 * dt);
    this.sumImm += this.immersion * dt;
    this.sumFun += this.fun * dt;
    this.samples += dt;
    if (this.immersion <= 0) {
      this.immersion = 0;
      this.failReason = '“이 게임 버그 많네…” 플레이어가 접속을 끊었다.';
      this.finish('fail');
    } else if (this.fun <= 0) {
      this.fun = 0;
      this.failReason = '“재미없어.” 플레이어가 지루해서 게임을 껐다.';
      this.finish('fail');
    }
  }

  private finish(state: 'fail' | 'clear') {
    this.state = state;
    this.onSfx(state === 'clear' ? 'done' : 'caught');
  }

  result() {
    const avgImm = this.samples ? this.sumImm / this.samples : 0;
    const avgFun = this.samples ? this.sumFun / this.samples : 0;
    const total = this.tasksDone + this.tasksMissed;
    const rate = total ? this.tasksDone / total : 1;
    let score = 0.35 * avgImm + 0.35 * avgFun + 30 * rate - 4 * this.caught;
    if (this.state === 'fail') score = Math.min(score, 40);
    const grade = score >= 85 ? 'S' : score >= 72 ? 'A' : score >= 58 ? 'B' : score >= 45 ? 'C' : 'D';
    return {
      time: this.t, avgImm, avgFun, done: this.tasksDone, missed: this.tasksMissed,
      caught: this.caught, dodges: this.dodges, deaths: this.deaths.length, score: Math.round(score), grade,
      progress: Math.min(1, this.player.x / this.level.goalX),
    };
  }
}
