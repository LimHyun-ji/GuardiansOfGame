// 칩튠 느낌의 짧은 효과음 (WebAudio 사각파). 첫 터치 이후에만 소리가 난다.
let ctx: AudioContext | null = null;
let muted = false;

export function initAudio() {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    void ctx.resume();
  } catch { ctx = null; }
}

export function setMuted(m: boolean) { muted = m; }
export function isMuted() { return muted; }

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06, slide = 0, delay = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export function sfx(name: string) {
  switch (name) {
    case 'pick': tone(660, 0.06); tone(880, 0.06, 'square', 0.05, 0, 0.05); break;
    case 'put': tone(523, 0.07); tone(784, 0.1, 'square', 0.05, 0, 0.06); break;
    case 'work': tone(220, 0.08, 'triangle', 0.08); break;
    case 'done': tone(523, 0.08); tone(659, 0.08, 'square', 0.05, 0, 0.07); tone(784, 0.14, 'square', 0.05, 0, 0.14); break;
    case 'coin': tone(988, 0.05); tone(1319, 0.18, 'square', 0.05, 0, 0.05); break;
    case 'empty': tone(180, 0.2, 'sawtooth', 0.05, -60); break;
    case 'alert': tone(880, 0.07, 'square', 0.04); tone(880, 0.07, 'square', 0.04, 0, 0.12); break;
    case 'stomp': tone(300, 0.1, 'square', 0.06, -180); break;
    case 'die': tone(500, 0.4, 'triangle', 0.08, -400); break;
    case 'caught': tone(140, 0.35, 'sawtooth', 0.07, -40); break;
    case 'disguise': tone(400, 0.05, 'triangle', 0.06, 200); break;
    case 'jump': tone(330, 0.08, 'square', 0.03, 220); break;
  }
}
