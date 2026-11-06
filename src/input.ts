// 터치(가상 스틱 + 버튼) + 키보드 입력. 버튼 누름은 프레임 단위 '엣지'로 소비된다.

export interface InputState {
  ax: number; // -1..1
  ay: number; // -1..1 (위가 음수)
  jump: boolean; // 이번 프레임에 눌림
  pick: boolean;
  disguise: boolean;
  work: boolean; // 누르고 있는 중
}

type Btn = 'jump' | 'pick' | 'work' | 'disguise';

export class Input {
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private stickVec = { x: 0, y: 0 };
  private held: Record<Btn, boolean> = { jump: false, pick: false, work: false, disguise: false };
  private pressed: Record<Btn, boolean> = { jump: false, pick: false, work: false, disguise: false };
  private keys = new Set<string>();

  constructor(private stickEl: HTMLElement, private knobEl: HTMLElement, buttons: Record<Btn, HTMLElement>) {
    const radius = () => stickEl.getBoundingClientRect().width / 2;

    stickEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.stickId !== null) return;
      this.stickId = e.pointerId;
      stickEl.setPointerCapture(e.pointerId);
      const r = stickEl.getBoundingClientRect();
      this.stickOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.moveStick(e.clientX, e.clientY, radius());
    });
    stickEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      this.moveStick(e.clientX, e.clientY, radius());
    });
    const endStick = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.stickVec = { x: 0, y: 0 };
      knobEl.style.transform = 'translate(-50%, -50%)';
    };
    stickEl.addEventListener('pointerup', endStick);
    stickEl.addEventListener('pointercancel', endStick);

    (Object.keys(buttons) as Btn[]).forEach((name) => {
      const el = buttons[name];
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        this.held[name] = true;
        this.pressed[name] = true;
        el.classList.add('down');
        try { navigator.vibrate?.(12); } catch { /* 미지원 기기 */ }
      });
      const up = () => { this.held[name] = false; el.classList.remove('down'); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    const keyMap: Record<string, Btn> = { Space: 'jump', KeyZ: 'jump', KeyJ: 'pick', KeyX: 'pick', KeyK: 'work', KeyC: 'work', KeyL: 'disguise', KeyV: 'disguise' };
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      const b = keyMap[e.code];
      if (b && !e.repeat) { this.held[b] = true; this.pressed[b] = true; buttons[b].classList.add('down'); }
      if (b || e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const b = keyMap[e.code];
      if (b) { this.held[b] = false; buttons[b].classList.remove('down'); }
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      (Object.keys(this.held) as Btn[]).forEach((b) => (this.held[b] = false));
    });
  }

  private moveStick(cx: number, cy: number, r: number) {
    let dx = cx - this.stickOrigin.x;
    let dy = cy - this.stickOrigin.y;
    const len = Math.hypot(dx, dy);
    const max = r * 0.75;
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    this.stickVec = { x: dx / max, y: dy / max };
    this.knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  read(): InputState {
    let ax = this.stickVec.x;
    let ay = this.stickVec.y;
    if (Math.abs(ax) < 0.2) ax = 0;
    if (Math.abs(ay) < 0.35) ay = 0;
    const k = this.keys;
    if (k.has('ArrowLeft') || k.has('KeyA')) ax = -1;
    if (k.has('ArrowRight') || k.has('KeyD')) ax = 1;
    if (k.has('ArrowUp') || k.has('KeyW')) ay = -1;
    if (k.has('ArrowDown') || k.has('KeyS')) ay = 1;
    const s: InputState = {
      ax, ay,
      jump: this.pressed.jump,
      pick: this.pressed.pick,
      disguise: this.pressed.disguise,
      work: this.held.work,
    };
    this.pressed = { jump: false, pick: false, work: false, disguise: false };
    return s;
  }

  reset() {
    this.pressed = { jump: false, pick: false, work: false, disguise: false };
  }
}
