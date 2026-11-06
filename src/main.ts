import './style.css';
import { Game } from './game';
import { GamepadControls, KEYS_P1, KEYS_P2, KEYS_SOLO, KeyboardControls, merge, Source, TouchControls } from './input';
import { render } from './render';
import { initAudio, sfx, setMuted, isMuted } from './audio';
import { W, H } from './level';
import { sprites } from './sprites';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d')!;
const titleEl = $('title');
const resultEl = $('result');
const controlsEl = $('controls');
const rotateEl = $('rotate');

let game = new Game(1);
game.onSfx = sfx;
let running = false;
let players = 1;
let pads: TouchControls[] = [];
let sources: Source[][] = [];

// ── 화면 맞춤: 논리 해상도 640×360, 가능하면 정수 배율 확대
function resize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fit = Math.min(vw / W, vh / H);
  const scale = fit >= 2 ? Math.floor(fit) : fit;
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

const portrait = () => getComputedStyle(rotateEl).display !== 'none';

function setupControls(n: number) {
  pads.forEach((p) => p.destroy());
  pads = n === 1 ? [new TouchControls(controlsEl, 'solo')] : [new TouchControls(controlsEl, 'p1'), new TouchControls(controlsEl, 'p2')];
  sources = n === 1
    ? [[pads[0], new KeyboardControls(KEYS_SOLO), new GamepadControls(0)]]
    : [
        [pads[0], new KeyboardControls(KEYS_P1), new GamepadControls(0)],
        [pads[1], new KeyboardControls(KEYS_P2), new GamepadControls(1)],
      ];
  controlsEl.classList.toggle('duo', n > 1);
}

function start(n = players) {
  players = n;
  initAudio();
  game = new Game(n);
  game.onSfx = sfx;
  setupControls(n);
  sources.flat().forEach((s) => s.reset());
  titleEl.hidden = true;
  resultEl.hidden = true;
  controlsEl.hidden = false;
  running = true;
  const el = document.documentElement;
  try {
    const p = el.requestFullscreen?.();
    p?.then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape')).catch(() => {});
  } catch { /* 지원 안 함 */ }
}

function showResult() {
  running = false;
  controlsEl.hidden = true;
  const r = game.result();
  const clear = game.state === 'clear';
  $('r-eyebrow').textContent = clear ? `정산 · 횡스크롤부 스테이지 1 · ${players}인` : '정산 · 플레이어 이탈';
  $('r-title').textContent = clear ? '스테이지 클리어!' : '실패';
  const gradeEl = $('r-grade');
  gradeEl.textContent = r.grade;
  gradeEl.className = clear ? 'grade' : 'grade fail';
  $('r-reason').textContent = clear ? '플레이어는 끝까지 아무것도 눈치채지 못했다… 아마도.' : game.failReason;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  const rows: [string, string][] = [
    ['점수', String(r.points)],
    ['생존 시간', fmt(r.time)],
    ['처리한 업무', `${r.done}건`],
    ['놓친 업무', `${r.missed}건`],
    ['최대 콤보', `x${r.maxCombo}`],
    ['아슬아슬', `${r.nearMisses}회`],
    ['위장 성공', `${r.dodges}회`],
    ['들킨 횟수', `${r.caught}회`],
    ['평균 몰입도', `${Math.round(r.avgImm)}`],
    ['평균 재미도', `${Math.round(r.avgFun)}`],
  ];
  $('r-stats').innerHTML = rows.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  resultEl.hidden = false;
}

$('start1').addEventListener('click', () => start(1));
$('start2').addEventListener('click', () => start(2));
$('again').addEventListener('click', () => start());
$('to-title').addEventListener('click', () => { resultEl.hidden = true; titleEl.hidden = false; });
$('b-mute').addEventListener('click', () => {
  setMuted(!isMuted());
  $('b-mute').textContent = isMuted() ? '×' : '♪';
});

// 플레이 중에만 스크롤/줌 제스처를 막는다 (타이틀·정산 카드는 스크롤 가능)
document.addEventListener('touchmove', (e) => { if (running) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

let last = performance.now();
function loop(now: number) {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  if (running && !portrait() && !document.hidden) {
    const inputs = sources.map((list) => merge(list.map((s) => s.read())));
    game.update(dt, inputs);
    if (game.state !== 'play') showResult();
  }
  render(ctx, game);
  requestAnimationFrame(loop);
}

sprites();
Promise.all([
  document.fonts?.load('12px "Do Hyeon"'),
  document.fonts?.load('8px "Press Start 2P"'),
]).catch(() => {}).finally(() => requestAnimationFrame(loop));
