# 백스테이지 크루 — 모바일 프로토타입

기획서의 「모바일 프로토타입 사양」을 구현한 그레이박스 웹 게임입니다. 횡스크롤부 스테이지 1개, 1인 플레이(약 3분).

## 실행

```bash
npm install
npm run dev        # 같은 Wi‑Fi의 휴대폰에서 표시되는 Network 주소로 접속
npm run build      # dist/ 에 정적 파일 생성 (아무 정적 호스팅에 올리면 됨)
npm run artifact   # artifact/backstage-crew.html 단일 파일 생성
```

휴대폰은 **가로 화면**으로 플레이합니다. PC에서는 키보드로도 됩니다: 방향키 이동 · Space 점프 · J 집기 · K 작업(꾹) · L 위장.

## 구현된 것

| 기획서 항목 | 구현 위치 |
| --- | --- |
| 640×360 논리 해상도, 앞무대 60% / 뒷무대 40%, 같은 월드 좌표 공유 | `src/level.ts`, `src/render.ts` |
| 플레이어 AI: 달리기·점프, 실력 80%(적 밟기), 호기심 15%(샛길), 블록 도착 예측 | `Game.aiDecide`, `updateDirector` |
| 무대 감독: 예측 → 업무 카드(최대 3장 표시), 재미도 낮으면 적 추가 투입, 연속 사망 시 1UP 지시 | `Game.updateDirector` |
| 슬롯 시스템: 아이템 블록(동전/1UP), 대기실 문(적 출현), 내구도 있는 발판 2개 | `src/level.ts` |
| 들킴 판정: 카메라 프레임 안 + 위장 안 함 → 의심 게이지, 가득 차면 몰입도 −20 | `Game.updateExposure` |
| 두리번 이벤트: 20~30초마다 카메라가 화면 전체를 훑음 (위장 순간 확보용) | `Game.updateLook` |
| 정산 화면: 생존 시간, 처리/놓친 업무, 들킨 횟수, S~D 등급 | `Game.result`, `src/main.ts` |
| 터치 조작: 가상 스틱, 점프, 집기, 작업(길게), 위장 + 진동 피드백 | `src/input.ts` |

## 조정해 볼 값 (`src/level.ts`)

- `TASK_LEAD` = 6초 — 기획서의 “3초 전”은 창고 왕복이 불가능해서 6초로 늘렸습니다.
- `PLAYER_SPEED`, `PLAYER_SKILL`, `PLAYER_CURIOSITY`, 발판 초기 내구도, 블록/문 간격.
- 게이지 증감은 `src/game.ts`의 `hitBlock`, `updateGauges`, `updateTasks`에 모여 있습니다.
