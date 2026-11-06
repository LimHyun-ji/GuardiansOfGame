import './style.css';
import { Game } from './game';
import { Input } from './input';
import { render } from './render';
import { initAudio, sfx, setMuted, isMuted } from './audio';
import { W, H } from './level';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d')!;
const titleEl = $('title');
const resultEl = $('result');
const controlsEl = $('controls');
const rotateEl = $('rotate');

const input = new Input($('stick'), $('knob'), {
  jump: $('b-jump'),
  pick: $('b-pick'),
  work: $('b-work'),
  disguise: $('b-disguise'),
});

let game = new Game();
game.onSfx = sfx;
let running = false;

// ── 화면 맞춤: 논리 해상도 640×360, 가능하면 정수 배율 확대
let scale = 1;
function resize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fit = Math.min(vw / W, vh / H);
  scale = fit >= 2 ? Math.floor(fit) : fit;
  const cw = Math.floor(W * scale);
  const ch = Math.floor(H * scale);
  canvas.style.width = `${cw}px`;
  canvas.style.height = `${ch}px`;
  canvas.style.left = `${Math.floor((vw - cw) / 2)}px`;
  canvas.style.top = `${Math.floor((vh - ch) / 2)}px`;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

function portrait() {
  return getComputedStyle(rotateEl).display !== 'none';
}

function start() {
  initAudio();
  game = new Game();
  game.onSfx = sfx;
  input.reset();
  titleEl.hidden = true;
  resultEl.hidden = true;
  controlsEl.hidden = false;
  running = true;
  // 전체화면 + 가로 고정 (지원되는 기기만)
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  try {
    const p = el.requestFullscreen?.();
    p?.then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape')).catch(() => {});
  } catch { /* 무시 */ }
}

function showResult() {
  running = false;
  controlsEl.hidden = true;
  const r = game.result();
  const clear = game.state === 'clear';
  $('r-eyebrow').textContent = clear ? '정산 · 횡스크롤부 스테이지 1' : '정산 · 플레이어 이탈';
  $('r-title').textContent = clear ? '스테이지 클리어!' : '실패';
  const gradeEl = $('r-grade');
  gradeEl.textContent = r.grade;
  gradeEl.className = clear ? 'grade' : 'grade fail';
  $('r-reason').textContent = clear
    ? '플레이어는 끝까지 아무것도 눈치채지 못했다… 아마도.'
    : game.failReason;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  const rows: [string, string][] = [
    ['생존 시간', fmt(r.time)],
    ['진행도', `${Math.round(r.progress * 100)}%`],
    ['처리한 업무', `${r.done}건`],
    ['놓친 업무', `${r.missed}건`],
    ['들킨 횟수', `${r.caught}회`],
    ['위장 성공', `${r.dodges}회`],
    ['평균 몰입도', `${Math.round(r.avgImm)}`],
    ['평균 재미도', `${Math.round(r.avgFun)}`],
    ['플레이어 사망', `${r.deaths}회`],
    ['점수', `${r.score}`],
  ];
  $('r-stats').innerHTML = rows.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  resultEl.hidden = false;
}

$('start').addEventListener('click', start);
$('again').addEventListener('click', start);
$('b-mute').addEventListener('click', () => {
  setMuted(!isMuted());
  $('b-mute').textContent = isMuted() ? '×' : '♪';
});

// 스크롤/줌 제스처 막기
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

let last = performance.now();
function loop(now: number) {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  if (running && !portrait() && !document.hidden) {
    const inp = input.read();
    game.update(dt, inp);
    if (game.state !== 'play') showResult();
  }
  render(ctx, game);
  requestAnimationFrame(loop);
}

// 폰트가 로드된 뒤 시작해야 캔버스 글자가 깨지지 않는다
(document.fonts?.load('12px "Do Hyeon"') ?? Promise.resolve()).finally(() => requestAnimationFrame(loop));
