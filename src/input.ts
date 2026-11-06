// 입력: 터치(가상 스틱+버튼) · 키보드 · 게임패드. 여러 입력원을 합쳐서 플레이어별 InputState를 만든다.

export interface InputState {
  ax: number; // -1..1
  ay: number; // -1..1 (위가 음수)
  jump: boolean; // 이번 프레임에 눌림
  pick: boolean;
  disguise: boolean;
  work: boolean; // 누르고 있는 중
}

type Btn = 'jump' | 'pick' | 'work' | 'disguise';
const BTNS: Btn[] = ['jump', 'pick', 'work', 'disguise'];
const LABEL: Record<Btn, string> = { jump: '점프', pick: '집기', work: '작업', disguise: '위장' };

export interface Source { read(): InputState; reset(): void }

const blank = (): InputState => ({ ax: 0, ay: 0, jump: false, pick: false, disguise: false, work: false });

export function merge(states: InputState[]): InputState {
  const out = blank();
  for (const s of states) {
    if (Math.abs(s.ax) > Math.abs(out.ax)) out.ax = s.ax;
    if (Math.abs(s.ay) > Math.abs(out.ay)) out.ay = s.ay;
    out.jump ||= s.jump; out.pick ||= s.pick; out.disguise ||= s.disguise; out.work ||= s.work;
  }
  return out;
}

// ─────────────────────────────── 터치
export class TouchControls implements Source {
  root: HTMLElement;
  private stickId: number | null = null;
  private origin = { x: 0, y: 0 };
  private vec = { x: 0, y: 0 };
  private held: Record<Btn, boolean> = { jump: false, pick: false, work: false, disguise: false };
  private pressed: Record<Btn, boolean> = { jump: false, pick: false, work: false, disguise: false };
  buttons = {} as Record<Btn, HTMLElement>;

  /** layout: solo = 1인(왼쪽 스틱, 오른쪽 버튼) / p1 = 왼쪽 절반 / p2 = 오른쪽 절반 */
  constructor(parent: HTMLElement, layout: 'solo' | 'p1' | 'p2') {
    this.root = document.createElement('div');
    this.root.className = `pad pad-${layout}`;
    const stick = document.createElement('div');
    stick.className = 'ctrl stick';
    const knob = document.createElement('div');
    knob.className = 'knob';
    stick.appendChild(knob);
    this.root.appendChild(stick);
    for (const b of BTNS) {
      const el = document.createElement('div');
      el.className = `ctrl btn b-${b}`;
      el.innerHTML = b === 'work' ? `<span>${LABEL[b]}<small>꾹</small></span>` : LABEL[b];
      this.root.appendChild(el);
      this.buttons[b] = el;
    }
    if (layout !== 'solo') {
      const tag = document.createElement('div');
      tag.className = 'pad-tag';
      tag.textContent = layout === 'p1' ? '1P 도트' : '2P 롤백';
      this.root.appendChild(tag);
    }
    parent.appendChild(this.root);

    const radius = () => stick.getBoundingClientRect().width / 2;
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.stickId !== null) return;
      this.stickId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      const r = stick.getBoundingClientRect();
      this.origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.move(e.clientX, e.clientY, radius(), knob);
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) this.move(e.clientX, e.clientY, radius(), knob);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.vec = { x: 0, y: 0 };
      knob.style.transform = 'translate(-50%, -50%)';
    };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);

    for (const b of BTNS) {
      const el = this.buttons[b];
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        this.held[b] = true;
        this.pressed[b] = true;
        el.classList.add('down');
        try { navigator.vibrate?.(12); } catch { /* 미지원 */ }
      });
      const up = () => { this.held[b] = false; el.classList.remove('down'); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  private move(cx: number, cy: number, r: number, knob: HTMLElement) {
    let dx = cx - this.origin.x;
    let dy = cy - this.origin.y;
    const len = Math.hypot(dx, dy);
    const max = r * 0.75;
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    this.vec = { x: dx / max, y: dy / max };
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  read(): InputState {
    const s: InputState = {
      ax: Math.abs(this.vec.x) < 0.2 ? 0 : this.vec.x,
      ay: Math.abs(this.vec.y) < 0.35 ? 0 : this.vec.y,
      jump: this.pressed.jump, pick: this.pressed.pick, disguise: this.pressed.disguise, work: this.held.work,
    };
    this.reset();
    return s;
  }
  reset() { this.pressed = { jump: false, pick: false, work: false, disguise: false }; }
  destroy() { this.root.remove(); }
}

// ─────────────────────────────── 키보드
const held = new Set<string>();
const pressedCodes = new Set<string>();
let kbInit = false;
function initKeyboard() {
  if (kbInit) return;
  kbInit = true;
  window.addEventListener('keydown', (e) => {
    if (!e.repeat) pressedCodes.add(e.code);
    held.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
}

export interface KeyMap { left: string[]; right: string[]; up: string[]; down: string[]; jump: string[]; pick: string[]; work: string[]; disguise: string[] }

export const KEYS_SOLO: KeyMap = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyZ'], pick: ['KeyJ', 'KeyX', 'KeyE'], work: ['KeyK', 'KeyC', 'KeyQ'], disguise: ['KeyL', 'KeyV', 'KeyR'],
};
export const KEYS_P1: KeyMap = {
  left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
  jump: ['Space'], pick: ['KeyE'], work: ['KeyQ'], disguise: ['KeyR'],
};
export const KEYS_P2: KeyMap = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  jump: ['Numpad0', 'Slash', 'Enter'], pick: ['Numpad1', 'Period'], work: ['Numpad2', 'Comma'], disguise: ['Numpad3', 'KeyM'],
};

export class KeyboardControls implements Source {
  constructor(private map: KeyMap) { initKeyboard(); }
  private any(codes: string[]) { return codes.some((c) => held.has(c)); }
  private edge(codes: string[]) {
    let hit = false;
    for (const c of codes) if (pressedCodes.delete(c)) hit = true;
    return hit;
  }
  read(): InputState {
    const m = this.map;
    return {
      ax: (this.any(m.right) ? 1 : 0) - (this.any(m.left) ? 1 : 0),
      ay: (this.any(m.down) ? 1 : 0) - (this.any(m.up) ? 1 : 0),
      jump: this.edge(m.jump), pick: this.edge(m.pick), disguise: this.edge(m.disguise), work: this.any(m.work),
    };
  }
  reset() { pressedCodes.clear(); }
}

// ─────────────────────────────── 게임패드 (A 점프 · B 집기 · X 작업 · Y 위장)
export class GamepadControls implements Source {
  private prev = [false, false, false, false];
  constructor(private index: number) {}
  read(): InputState {
    const pad = navigator.getGamepads?.()[this.index];
    if (!pad) return blank();
    const btn = (i: number) => !!pad.buttons[i]?.pressed;
    let ax = pad.axes[0] ?? 0;
    let ay = pad.axes[1] ?? 0;
    if (Math.abs(ax) < 0.25) ax = 0;
    if (Math.abs(ay) < 0.35) ay = 0;
    if (btn(14)) ax = -1;
    if (btn(15)) ax = 1;
    if (btn(12)) ay = -1;
    if (btn(13)) ay = 1;
    const now = [btn(0), btn(1), btn(2), btn(3)];
    const edge = (i: number) => now[i] && !this.prev[i];
    const s = { ax, ay, jump: edge(0), pick: edge(1), work: now[2], disguise: edge(3) };
    this.prev = now;
    return s;
  }
  reset() {}
}
