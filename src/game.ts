import {
  BACK_TOP, Block, Bridge, buildLevel, Door, FRONT_H, GROUND_Y, Item, Level, LOWER_FLOOR, PLAT_Y,
  PLAYER_CURIOSITY, PLAYER_SKILL, PLAYER_SPEED, Pit, PropKind, TASK_LEAD, UPPER_FLOOR, W, H,
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
  tag?: 'surprise' | 'director' | 'crash';
}

export interface Enemy {
  x: number; y: number; w: number; h: number;
  alive: boolean; judged: boolean; squashT: number; popT: number;
}

export interface Floater { x: number; y: number; text: string; color: string; t: number; big?: boolean }
export interface Frame { x0: number; x1: number; y1: number }
export interface FloorItem { x: number; y: number; vx: number; vy: number; kind: Item; resting: boolean; by: number; age: number }

export type Sfx = 'pick' | 'put' | 'work' | 'done' | 'coin' | 'empty' | 'alert' | 'stomp' | 'die' | 'caught'
  | 'disguise' | 'jump' | 'nearmiss' | 'combo' | 'glitch' | 'throw';

const P_GRAV = 900;
const S_GRAV = 1000;
const STAFF_SPEED = 130;
const COMBO_WINDOW = 5;

export class Staff {
  x: number; y = LOWER_FLOOR - 18; w = 10; h = 18; vx = 0; vy = 0;
  onGround = true; floor: 'lower' | 'upper' | null = 'lower'; climbing = false; ladderX = 0;
  dropT = 0; carry: Item | null = null; facing = 1;
  disguised = false; prop: PropKind | 'box' = 'box'; disguiseAt = -99;
  work: null | { obj: Door | Bridge; kind: 'door' | 'bridge'; t: number; need: number; door?: Door; pit?: Pit } = null;
  inFrame = false; exposed = false; wasHiddenInFrame = false;
  constructor(public id: number, x: number) { this.x = x; }
  get cx() { return this.x + this.w / 2; }
}

const LINES = {
  coin: ['오 동전!', '개이득', '짤랑~'],
  oneup: ['1UP?! 개꿀', '목숨 추가 ㅋㅋ'],
  empty: ['어? 비었네?', '버그인가…', '뭐야 텅 빈 블록'],
  stomp: ['밟았다!', '나이스', '한 방!'],
  die: ['아 뭐야!', '억울해!!', '방금 그거 뭔데'],
  suspicious: ['방금 뭐 지나갔어…?', '저 덤불 움직이지 않았나?', '뭔가 있는데…'],
  caught: ['저거 뭐야?! 버그?', '사람 있는데?!', '스크린샷 찍어둬야지'],
  look: ['음… 뭔가 이상한데', '주변 좀 볼까'],
  detour: ['저기 뭐 있나?', '샛길 발견!'],
  collapse: ['발판이 왜 이래?!', '이거 함정이야?'],
  bored: ['좀 지루하네…', '하품 나온다', '언제 끝나지'],
  backstep: ['뭐 놓친 거 있나?', '잠깐, 뒤에 뭐 있었는데'],
  speedrun: ['스피드런 간다!', '기록 깨볼까?'],
  late: ['적이 왜 안 나와?', '여기 원래 적 있지 않나?'],
  glitch: ['화면 깨졌다?!', '렉 걸렸나'],
};
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export class Game {
  level: Level = buildLevel();
  t = 0;
  camX = 0;
  timeScale = 1;
  slowT = 0;
  flashT = 0;
  glitchT = 0;
  state: 'play' | 'fail' | 'clear' = 'play';
  failReason = '';

  player = {
    x: 40, y: GROUND_Y - 16, w: 12, h: 16, vx: 0, vy: 0,
    onGround: true, state: 'run' as 'run' | 'dead' | 'win', deadT: 0, respawnX: 0, lives: 3,
  };
  speedMul = 1;
  backstepT = 0;
  bubble = { text: '', t: 0 };
  private bubbleCd = 0;

  staffs: Staff[];
  enemies: Enemy[] = [];
  items: FloorItem[] = [];
  tasks: Task[] = [];
  floaters: Floater[] = [];
  toast = { text: '', color: '#fff', t: 0 };
  crash: null | { x: number; y: number; t: number } = null;

  immersion = 100;
  fun = 65;
  suspicion = 0;
  private suspHigh = false;
  exposed = false;

  points = 0;
  combo = 0;
  comboT = 0;
  maxCombo = 0;

  // 통계
  caught = 0;
  dodges = 0;
  nearMisses = 0;
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
  nextEventAt = 40;
  eventName = '';
  eventT = 0;
  private lastFunEvent = 0;
  private lastDirectorEnemy = -99;
  private last1up = -99;
  private taskSeq = 0;

  onSfx: (s: Sfx) => void = () => {};

  constructor(public players = 1) {
    this.staffs = [new Staff(0, 150)];
    if (players > 1) this.staffs.push(new Staff(1, 200));
  }

  // ───────────────────────────── 메인 업데이트
  update(realDt: number, inputs: InputState[]) {
    if (this.state !== 'play') return;
    if (this.slowT > 0) { this.slowT -= realDt; this.timeScale = 0.35; } else this.timeScale = 1;
    const dt = realDt * this.timeScale;
    this.t += dt;
    this.flashT = Math.max(0, this.flashT - realDt);
    this.glitchT = Math.max(0, this.glitchT - realDt);
    this.updateLook(dt);
    this.updateEvents(dt);
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.camX = Math.max(this.camX, Math.min(this.player.x - 180, this.level.goalX + 120 - W));
    this.staffs.forEach((s, i) => this.updateStaff(s, dt, inputs[i] ?? EMPTY));
    this.updateItems(dt);
    this.updateDirector();
    this.updateTasks();
    this.updateExposure(dt);
    this.updateGauges(dt);
    if (this.combo > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    if (this.crash) { this.crash.t -= dt; this.crash.x += 160 * dt; if (this.crash.t <= 0) this.crash = null; }
    for (const f of this.floaters) { f.t -= dt; f.y -= 18 * dt; }
    this.floaters = this.floaters.filter((f) => f.t > 0);
    if (this.toast.t > 0) this.toast.t -= dt;
    if (this.bubble.t > 0) this.bubble.t -= dt;
    this.bubbleCd -= dt;
  }

  // ───────────────────────────── 헬퍼
  float(x: number, y: number, text: string, color = '#fff', big = false) {
    this.floaters.push({ x, y, text, color, t: big ? 1.6 : 1.3, big });
  }
  say(text: string, color = '#fff') { this.toast = { text, color, t: 2.6 }; }
  speak(lines: string[], force = false) {
    if (!force && this.bubbleCd > 0) return;
    this.bubble = { text: pick(lines), t: 2.2 };
    this.bubbleCd = 3;
  }
  speed() { return PLAYER_SPEED * this.speedMul; }
  eta(x: number) { return (x - (this.player.x + this.player.w / 2)) / this.speed(); }
  funEvent(delta: number) {
    this.fun = Math.max(0, Math.min(100, this.fun + delta));
    if (delta > 0) this.lastFunEvent = this.t;
  }
  addPoints(n: number, x: number, y: number, label: string, color = '#ffe066') {
    this.points += n;
    this.float(x, y, `${label} +${n}`, color, n >= 150);
  }
  frame(): Frame {
    if (this.lookPhase === 'look') return { x0: this.camX, x1: this.camX + W, y1: H };
    const p = this.player;
    return { x0: p.x - 60, x1: p.x + 150, y1: UPPER_FLOOR + 4 };
  }
  pitAt(cx: number) { return this.level.pits.find((p) => cx > p.x && cx < p.x + p.w); }
  groundAt(cx: number) {
    const pit = this.pitAt(cx);
    return !pit || (!!pit.bridge && !pit.bridge.collapsed);
  }

  // ───────────────────────────── 플레이어 AI
  private jump(v = 330) { this.player.vy = -v; this.player.onGround = false; }

  private aiDecide() {
    const p = this.player;
    const front = p.x + p.w;
    const cx = p.x + p.w / 2;
    const L = this.level;
    for (const pit of L.pits) {
      if (pit.bridge) continue;
      if (cx >= pit.x - 6 && cx < pit.x) return this.jump(360);
    }
    for (const br of L.branches) {
      if (!br.detour || br.entered) continue;
      const d = br.x - front;
      if (d >= 8 && d < 14 && p.y + p.h === GROUND_Y) { br.entered = true; return this.jump(); }
    }
    for (const e of this.enemies) {
      if (!e.alive || e.judged || e.popT > 0) continue;
      const d = e.x - front;
      if (d >= 0 && d <= 40 * this.speedMul) {
        e.judged = true;
        if (Math.random() < PLAYER_SKILL) return this.jump();
        this.float(p.x, p.y - 6, '헛디딤!', '#ffd2d2');
      }
    }
    for (const b of L.blocks) {
      if (b.hit) continue;
      if (b.hidden && !b.branch?.detour) continue;
      const dx = b.x + 8 - cx;
      const vert = p.y - (b.y + 16);
      if (dx >= -1 && dx <= 5 * this.speedMul && vert > 0 && vert <= 40) return this.jump();
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
    if (this.backstepT > 0) { this.backstepT -= dt; p.vx = -45; }
    else p.vx = looking ? 0 : this.speed();
    if (p.onGround && !looking && this.backstepT <= 0) this.aiDecide();

    const prevTop = p.y;
    const prevBottom = p.y + p.h;
    p.vy = Math.min(600, p.vy + P_GRAV * dt);
    p.x += p.vx * dt;
    p.x = Math.max(this.camX + 24, p.x);
    p.y += p.vy * dt;
    p.onGround = false;
    const cx = p.x + p.w / 2;

    if (p.vy < 0) {
      for (const b of L.blocks) {
        if (b.hidden && !b.branch?.detour) continue;
        if (p.x + 2 < b.x + 16 && p.x + p.w - 2 > b.x && prevTop >= b.y + 16 - 0.01 && p.y < b.y + 16) {
          p.y = b.y + 16; p.vy = 0;
          if (!b.hit) this.hitBlock(b);
          break;
        }
      }
    }
    if (p.vy >= 0) {
      const bottom = p.y + p.h;
      let landY = Infinity;
      const consider = (top: number) => { if (prevBottom <= top + 0.5 && bottom >= top && top < landY) landY = top; };
      if (this.groundAt(cx)) consider(GROUND_Y);
      for (const br of L.branches) if (cx > br.x && cx < br.x + br.w) consider(PLAT_Y);
      for (const b of L.blocks) {
        if (b.hidden && !b.hit) continue;
        if (p.x + p.w > b.x + 2 && p.x < b.x + 14) consider(b.y);
      }
      if (landY < Infinity) { p.y = landY - p.h; p.vy = 0; p.onGround = true; }
    }
    if (p.onGround && p.y + p.h === GROUND_Y) {
      const pit = this.pitAt(cx);
      if (pit?.bridge && !pit.bridge.collapsed && pit.bridge.dur < 50) {
        pit.bridge.collapsed = true;
        p.onGround = false;
        this.immersion -= 15;
        this.breakCombo();
        this.say('발판이 무너졌다! 몰입도 -15', '#ff8a8a');
        this.float(pit.x, GROUND_Y - 20, '와르르', '#ffb36b');
        this.speak(LINES.collapse, true);
        this.onSfx('empty');
      }
    }
    if (p.y > FRONT_H + 4) {
      const pit = this.pitAt(cx) ?? L.pits.find((q) => q.x < cx && q.x + q.w + 40 > cx);
      this.killPlayer(pit ? pit.x + pit.w + 6 : p.x + 40);
      return;
    }
    for (const e of this.enemies) {
      if (!e.alive || e.popT > 0) continue;
      if (p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y) {
        if (!p.onGround && p.vy > 0) {
          e.alive = false; e.squashT = 0.5;
          p.vy = -220;
          this.funEvent(9);
          this.float(e.x, e.y - 8, '재미 +9', '#ffd36b');
          this.speak(LINES.stomp);
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
      this.addPoints(Math.round(this.immersion) * 10, p.x - 40, p.y - 30, '클리어 보너스', '#8dff9a');
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
    this.float(p.x, Math.min(p.y, FRONT_H - 30), '재미 -12', '#ff8a8a');
    this.speak(LINES.die, true);
    this.onSfx('die');
  }

  private hitBlock(b: Block) {
    b.hit = true;
    const task = this.tasks.find((t) => t.block === b);
    if (b.content === 'coin') {
      this.funEvent(4);
      this.float(b.x, b.y - 10, '재미 +4', '#ffe066');
      this.speak(LINES.coin);
      this.onSfx('coin');
    } else if (b.content === '1up') {
      this.funEvent(10);
      this.player.lives++;
      this.float(b.x - 4, b.y - 10, '1UP! 재미 +10', '#8dff9a');
      this.speak(LINES.oneup, true);
      this.onSfx('coin');
    } else {
      this.immersion -= 8;
      this.funEvent(-2);
      this.breakCombo();
      this.float(b.x - 6, b.y - 10, '텅…', '#ff9a9a');
      this.say(`블록 ${b.id}이 비어 있었다! 몰입도 -8`, '#ff8a8a');
      this.speak(LINES.empty, true);
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

  // ───────────────────────────── 두리번 (카메라가 화면 전체를 훑음)
  private updateLook(dt: number) {
    const p = this.player;
    if (this.lookPhase === 'none') {
      if (this.t >= this.nextLookAt && p.state === 'run' && p.onGround && !this.eventName) {
        this.lookPhase = 'warn';
        this.lookT = 1.5;
        this.say('플레이어가 두리번거린다! 소품 자리에서 위장!', '#ffd36b');
        this.speak(LINES.look, true);
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
        if (this.nextEventAt < this.t + 6) this.nextEventAt = this.t + 6;
      }
    }
  }

  // ───────────────────────────── 돌발 사건 (크래시 습격 / 뒷걸음질 / 스피드런)
  private updateEvents(dt: number) {
    const p = this.player;
    if (this.eventName) {
      this.eventT -= dt;
      if (this.eventT <= 0) {
        if (this.eventName === 'speedrun') this.speedMul = 1;
        this.eventName = '';
        this.nextEventAt = this.t + 22 + Math.random() * 10;
        if (this.nextLookAt < this.t + 6) this.nextLookAt = this.t + 6;
      }
      return;
    }
    if (this.t < this.nextEventAt || this.lookPhase !== 'none' || p.state !== 'run' || !p.onGround) return;

    const options: (() => boolean)[] = [() => this.evCrash(), () => this.evBackstep(), () => this.evSpeedrun()];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    for (const ev of options) if (ev()) return;
    this.nextEventAt = this.t + 5;
  }

  private evCrash() {
    const L = this.level;
    const ahead = L.blocks.filter((b) => !b.hidden && !b.hit && this.eta(b.x) > 3 && this.eta(b.x) < 10);
    const target = ahead.find((b) => b.content) ?? ahead[0];
    if (!target) return false;
    const had = target.content;
    target.content = null;
    this.eventName = 'crash'; this.eventT = 2;
    this.glitchT = 0.6;
    this.crash = { x: target.x, y: UPPER_FLOOR - 20, t: 1.6 };
    this.say(had ? `크래시 습격! 블록 ${target.id}의 아이템을 훔쳐갔다` : `크래시가 블록 ${target.id} 주변을 망가뜨렸다!`, '#f878f8');
    this.speak(LINES.glitch, true);
    this.onSfx('glitch');
    const existing = this.tasks.find((t) => t.block === target);
    if (existing) existing.tag = 'crash';
    else { target.tasked = true; this.addTask({ kind: 'fill', x: target.x + 8, item: 'coin', block: target, tag: 'crash' }); }
    return true;
  }

  private evBackstep() {
    const p = this.player;
    if (this.level.pits.some((q) => q.x + q.w > p.x - 100 && q.x < p.x + 10)) return false;
    if (p.x - 80 < this.camX + 30) return false;
    this.eventName = 'backstep'; this.eventT = 1.6;
    this.backstepT = 1.6;
    this.say('플레이어가 뒤로 돌아간다! 카메라 주의', '#ffd36b');
    this.speak(LINES.backstep, true);
    this.onSfx('alert');
    return true;
  }

  private evSpeedrun() {
    this.eventName = 'speedrun'; this.eventT = 9;
    this.speedMul = 1.6;
    this.say('스피드런 모드! 플레이어가 1.6배 빨라졌다', '#9fe3ff');
    this.speak(LINES.speedrun, true);
    this.onSfx('alert');
    return true;
  }

  // ───────────────────────────── 스태프 (유저)
  private findWorkTarget(s: Staff) {
    const L = this.level;
    if (s.floor !== 'upper') return null;
    for (const d of L.doors) {
      if (!d.used && Math.abs(s.cx - (d.x + 10)) < 16 && d.x > this.player.x + 40)
        return { obj: d, kind: 'door' as const, need: 0.8, door: d };
    }
    for (const pit of L.pits) {
      const br = pit.bridge;
      if (br && !br.collapsed && br.dur < 100 && Math.abs(s.cx - (pit.x + pit.w / 2)) < 28)
        return { obj: br, kind: 'bridge' as const, need: 1.2, pit };
    }
    return null;
  }

  private completeWork(w: NonNullable<Staff['work']>, s: Staff) {
    if (w.kind === 'door' && w.door) {
      const d = w.door;
      d.used = true;
      this.enemies.push({ x: d.x + 3, y: GROUND_Y - 14, w: 14, h: 14, alive: true, judged: false, squashT: 0, popT: 0.35 });
      this.float(d.x - 10, GROUND_Y - 34, '적 배우 출근!', '#c9a6ff');
      const task = this.tasks.find((t) => t.door === d);
      if (task) this.doneTask(task, s);
    } else if (w.kind === 'bridge' && w.pit?.bridge) {
      w.pit.bridge.dur = 100;
      this.float(w.pit.x, UPPER_FLOOR - 30, '수리 완료', '#8dff9a');
      const task = this.tasks.find((t) => t.pit === w.pit);
      if (task) this.doneTask(task, s);
    }
    this.onSfx('done');
  }

  private staffPick(s: Staff, inp: InputState) {
    const L = this.level;
    // 1) 바닥에 떨어진 아이템 줍기
    if (!s.carry) {
      const it = this.items.find((i) => i.resting && Math.abs(i.x - s.cx) < 14 && Math.abs(i.y - (s.y + s.h)) < 10);
      if (it) {
        s.carry = it.kind;
        this.items = this.items.filter((i) => i !== it);
        this.onSfx('pick');
        return;
      }
    }
    // 2) 창고 상자
    if (s.floor === 'lower') {
      const c = L.crates.find((c) => Math.abs(s.cx - (c.x + 10)) < 13);
      if (c) {
        s.carry = c.kind;
        this.float(s.x - 6, s.y - 12, c.kind === 'coin' ? '동전' : '1UP', '#ffe066');
        this.onSfx('pick');
        return;
      }
    }
    if (!s.carry) return;
    // 3) 블록 슬롯에 넣기
    if (s.floor === 'upper') {
      const b = L.blocks.find((b) => !b.hit && !b.content && Math.abs(s.cx - (b.x + 8)) < 15);
      if (b) {
        b.content = s.carry;
        s.carry = null;
        this.float(b.x - 6, UPPER_FLOOR - 34, `블록 ${b.id} 채움`, '#8dff9a');
        this.onSfx('put');
        const task = this.tasks.find((t) => t.block === b);
        if (task) this.doneTask(task, s);
        return;
      }
    }
    // 4) 옆에 있는 동료에게 건네기
    const mate = this.staffs.find((o) => o !== s && !o.carry && o.floor === s.floor && Math.abs(o.cx - s.cx) < 24);
    if (mate) {
      mate.carry = s.carry;
      s.carry = null;
      this.float(mate.x - 6, mate.y - 14, '패스!', '#9fe3ff');
      this.onSfx('put');
      return;
    }
    // 5) 던지기: 스틱 ↑ 이면 위층으로, 아니면 앞으로
    const up = inp.ay < -0.5;
    this.items.push({
      x: s.cx, y: s.y + 4, vx: up ? 0 : s.facing * 110, vy: up ? -470 : -180,
      kind: s.carry, resting: false, by: s.id, age: 0,
    });
    s.carry = null;
    this.onSfx('throw');
  }

  private updateItems(dt: number) {
    for (const it of this.items) {
      it.age += dt;
      if (it.resting) continue;
      const prev = it.y;
      it.vy = Math.min(600, it.vy + S_GRAV * dt);
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      if (it.y < BACK_TOP + 6) { it.y = BACK_TOP + 6; it.vy = Math.abs(it.vy) * 0.2; }
      // 공중에서 빈손인 스태프가 받기 (던진 본인은 잠깐 제외)
      for (const s of this.staffs) {
        if (s.carry || (s.id === it.by && it.age < 0.4)) continue;
        if (Math.abs(s.cx - it.x) < 10 && it.y > s.y - 4 && it.y < s.y + s.h) {
          s.carry = it.kind;
          it.resting = true; it.age = -1;
          this.float(s.x - 4, s.y - 14, '캐치!', '#9fe3ff');
          this.onSfx('pick');
        }
      }
      if (it.age < 0) continue;
      if (it.vy >= 0 && prev <= UPPER_FLOOR && it.y >= UPPER_FLOOR) { it.y = UPPER_FLOOR; it.resting = true; }
      else if (it.y >= LOWER_FLOOR) { it.y = LOWER_FLOOR; it.resting = true; }
    }
    this.items = this.items.filter((i) => i.age >= 0 && i.x > this.camX - 20);
  }

  private updateStaff(s: Staff, dt: number, inp: InputState) {
    const L = this.level;
    const wantsMove = Math.abs(inp.ax) > 0.35 || Math.abs(inp.ay) > 0.6;

    if (inp.disguise) {
      if (s.disguised) s.disguised = false;
      else if (s.onGround && !s.climbing) {
        const spot = L.props.find((p) => p.floor === s.floor && Math.abs(s.cx - (p.x + 8)) < 10);
        s.disguised = true;
        s.prop = spot ? spot.kind : 'box';
        s.disguiseAt = this.t;
        s.work = null;
        if (spot) s.x = spot.x + 8 - s.w / 2; // 소품 자리에 딱 맞춰 선다
        this.onSfx('disguise');
      }
    } else if (s.disguised && (wantsMove || inp.jump || inp.pick || inp.work)) {
      s.disguised = false;
    }

    let canMove = !s.disguised;

    if (canMove && inp.work && s.onGround && !s.climbing) {
      const target = this.findWorkTarget(s);
      if (target) {
        if (!s.work || s.work.obj !== target.obj) { s.work = { ...target, t: 0 }; this.onSfx('work'); }
        s.work.t += dt;
        canMove = false;
        if (s.work.t >= s.work.need) { this.completeWork(s.work, s); s.work = null; }
      } else s.work = null;
    } else s.work = null;

    if (canMove && inp.pick) this.staffPick(s, inp);

    if (canMove && !s.climbing) {
      const lx = L.ladders.find((x) => Math.abs(s.cx - (x + 6)) < 10);
      if (lx !== undefined) {
        const startUp = inp.ay < -0.6 && s.y + s.h > UPPER_FLOOR + 1 && !inp.pick;
        const startDown = inp.ay > 0.6 && s.floor === 'upper';
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
        if (inp.ay > 0.6 && s.floor === 'upper') { s.dropT = 0.25; s.y += 1; }
        else { s.vy = -440; this.onSfx('jump'); }
        s.onGround = false; s.floor = null;
      }
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
    s.x = Math.max(this.camX + 2, Math.min(this.camX + W - s.w - 2, s.x));
  }

  // ───────────────────────────── 들킴 판정 + 아슬아슬 보너스
  private updateExposure(dt: number) {
    const f = this.frame();
    let rise = 0;
    for (const s of this.staffs) {
      s.inFrame = s.x + s.w > f.x0 && s.x < f.x1 && s.y < f.y1;
      const awkward = s.disguised && s.prop === 'box';
      s.exposed = s.inFrame && (!s.disguised || awkward);
      if (s.inFrame && !s.disguised) rise += this.lookPhase === 'look' ? 70 : 55;
      else if (s.inFrame && awkward) rise += 16;

      const perfect = s.inFrame && s.disguised && !awkward;
      if (perfect && !s.wasHiddenInFrame) {
        this.dodges++;
        if (this.t - s.disguiseAt < 0.6) {
          this.nearMisses++;
          this.addPoints(150, s.x - 18, s.y - 18, '아슬아슬!', '#9fe3ff');
          this.slowT = 0.45; this.flashT = 0.25;
          this.onSfx('nearmiss');
        } else this.addPoints(50, s.x - 10, s.y - 14, '위장', '#9fe3ff');
      }
      s.wasHiddenInFrame = perfect;
    }
    this.exposed = this.staffs.some((s) => s.exposed);
    if (rise > 0) {
      this.suspicion += rise * dt;
      if (this.suspicion > 50) this.speak(LINES.suspicious);
    } else this.suspicion = Math.max(0, this.suspicion - 30 * dt);

    if (this.suspicion >= 70) this.suspHigh = true;
    if (this.suspHigh && !this.exposed && this.suspicion < 100) {
      this.suspHigh = false;
      this.nearMisses++;
      const s = this.staffs[0];
      this.addPoints(200, s.x - 20, s.y - 24, '구사일생!', '#9fe3ff');
      this.slowT = 0.45; this.flashT = 0.25;
      this.onSfx('nearmiss');
    }
    if (this.suspicion >= 100) {
      this.suspicion = 0;
      this.suspHigh = false;
      this.caught++;
      this.immersion -= 20;
      this.breakCombo();
      this.say('들켰다! 몰입도 -20', '#ff6b6b');
      this.float(this.player.x - 4, this.player.y - 20, '?!', '#ff6b6b', true);
      this.speak(LINES.caught, true);
      this.onSfx('caught');
    }
  }

  // ───────────────────────────── 무대 감독
  private addTask(t: Omit<Task, 'id'>) {
    const task = { ...t, id: ++this.taskSeq };
    this.tasks.push(task);
    if (t.tag) this.onSfx('alert');
    return task;
  }

  private updateDirector() {
    const L = this.level;
    const p = this.player;
    if (p.state === 'win') return;
    const lead = TASK_LEAD * Math.max(1, this.speedMul * 0.85);

    for (const b of L.blocks) {
      if (b.hidden || b.hit || b.tasked || b.content) continue;
      const e = this.eta(b.x + 8);
      if (e <= lead && e > 0) { b.tasked = true; this.addTask({ kind: 'fill', x: b.x + 8, item: 'coin', block: b }); }
    }
    for (const d of L.doors) {
      if (!d.scripted || d.used || d.tasked) continue;
      const e = this.eta(d.x);
      if (e <= lead + 1 && e > 1) { d.tasked = true; this.addTask({ kind: 'enemy', x: d.x, door: d }); }
    }
    for (const pit of L.pits) {
      const br = pit.bridge;
      if (!br || br.tasked || br.dur >= 100) continue;
      const e = this.eta(pit.x);
      if (e <= lead + 3 && e > 0) { br.tasked = true; this.addTask({ kind: 'repair', x: pit.x, pit }); }
    }
    for (const br of L.branches) {
      if (br.decided || p.x < br.x - 140) continue;
      br.decided = true;
      br.detour = Math.random() < PLAYER_CURIOSITY;
      const b = br.block!;
      if (br.detour) {
        this.say('플레이어가 샛길로 빠진다! 숨은 블록을 채워라', '#ffd36b');
        this.speak(LINES.detour, true);
        if (!b.content) { b.tasked = true; this.addTask({ kind: 'fill', x: b.x + 8, item: 'coin', block: b, tag: 'surprise' }); }
      }
    }
    if (this.fun < 45 && this.t - this.lastDirectorEnemy > 9) {
      const d = L.doors.find((d) => !d.used && !d.tasked && this.eta(d.x) > 3.5 && this.eta(d.x) < 9);
      if (d) {
        d.tasked = true;
        this.lastDirectorEnemy = this.t;
        this.addTask({ kind: 'enemy', x: d.x, door: d, tag: 'director' });
        this.say('무대 감독: 너무 심심하다! 적 배우 추가 투입', '#c9a6ff');
        this.speak(LINES.bored);
      }
    }
    const recent = this.deaths.filter((d) => this.t - d < 30).length;
    if (recent >= 2 && this.t - this.last1up > 20) {
      const b = L.blocks.find((b) => !b.hidden && !b.hit && b.content !== '1up' && this.eta(b.x) > 3 && this.eta(b.x) < 9);
      if (b) {
        this.last1up = this.t;
        const existing = this.tasks.find((t) => t.block === b);
        if (existing) { existing.item = '1up'; existing.tag = 'director'; }
        else if (!b.content) { b.tasked = true; this.addTask({ kind: 'fill', x: b.x + 8, item: '1up', block: b, tag: 'director' }); }
        this.say(`무대 감독: 너무 어렵다! 블록 ${b.id}에 몰래 1UP`, '#8dff9a');
        this.onSfx('alert');
      }
    }
  }

  private doneTask(t: Task, s: Staff) {
    this.tasks = this.tasks.filter((x) => x !== t);
    this.tasksDone++;
    if (this.firstTaskDoneAt < 0) this.firstTaskDoneAt = this.t;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = COMBO_WINDOW;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const base = t.tag === 'crash' || t.tag === 'surprise' ? 150 : 100;
    this.addPoints(base * this.combo, s.x - 10, s.y - 22, this.combo > 1 ? `콤보 x${this.combo}` : '업무 완료', this.combo > 1 ? '#ffb347' : '#ffe066');
    if (this.combo > 1) this.onSfx('combo');
  }
  private missTask(t: Task) {
    this.tasks = this.tasks.filter((x) => x !== t);
    this.tasksMissed++;
    this.breakCombo();
  }
  private breakCombo() {
    if (this.combo >= 3) this.float(this.staffs[0].x - 10, this.staffs[0].y - 26, '콤보 끊김', '#ff9a9a');
    this.combo = 0; this.comboT = 0;
  }

  private updateTasks() {
    const cx = this.player.x + this.player.w / 2;
    for (const t of [...this.tasks]) {
      if (t.kind === 'enemy' && cx >= t.x) {
        this.missTask(t);
        if (t.door) t.door.used = true;
        this.immersion -= 6;
        this.say('적 배우가 지각했다! 몰입도 -6', '#ff8a8a');
        this.speak(LINES.late);
        this.onSfx('empty');
      } else if (t.kind === 'repair' && t.pit && cx > t.pit.x + t.pit.w) {
        this.missTask(t);
      } else if (t.kind === 'fill' && cx > t.x + 30) {
        this.missTask(t);
      }
    }
  }

  // ───────────────────────────── 게이지
  private updateGauges(dt: number) {
    const boring = this.t - this.lastFunEvent > 6;
    this.fun = Math.max(0, this.fun - (0.5 + (boring ? 0.8 : 0)) * dt);
    if (this.fun < 30) this.speak(LINES.bored);
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
    let score = 0.35 * avgImm + 0.35 * avgFun + 30 * rate - 4 * this.caught + Math.min(15, this.points / 600);
    if (this.state === 'fail') score = Math.min(score, 40);
    const grade = score >= 85 ? 'S' : score >= 72 ? 'A' : score >= 58 ? 'B' : score >= 45 ? 'C' : 'D';
    return {
      time: this.t, avgImm, avgFun, done: this.tasksDone, missed: this.tasksMissed,
      caught: this.caught, dodges: this.dodges, nearMisses: this.nearMisses, maxCombo: this.maxCombo,
      deaths: this.deaths.length, points: this.points, grade,
      progress: Math.min(1, this.player.x / this.level.goalX),
    };
  }
}

const EMPTY: InputState = { ax: 0, ay: 0, jump: false, pick: false, disguise: false, work: false };
