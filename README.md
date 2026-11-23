# 우리반 도구함

우리반타이머 + QR 메이커 + AI 대화를 하나로 합친 앱입니다. (Windows exe · Android apk · 웹)

| 탭 | 기능 |
|---|---|
| 시계 | 큰 시계 + 세계시각 8도시 |
| 스톱워치 | 기록(랩) |
| 타이머 | 직접 입력 숫자판, 진행 중 시간 더하기/빼기, 작은 창 모드(PC) |
| 알람 | 여러 개 등록, 앱을 내려도 휴대폰 알림으로 울림(apk) |
| QR | 제목 + URL → 제목이 적힌 QR 이미지(PNG) 저장, 최근 20개 기록 |
| AI | Google Gemini 와 대화 (스트리밍 답변, 모델 선택, 빠른 질문 칩, 답변 속 주소를 바로 QR로) |

단축키: `1`~`6` 탭 이동 · `Space` 시작/멈춤 · `R` 초기화 · `T` 테마 · `M` 작은 창 · `F11` 전체화면

## AI(Google API) 설정
1. https://aistudio.google.com/apikey 에서 API 키를 만듭니다.
2. 앱의 **AI 탭 → 🔑 API 키**에 붙여넣고 저장합니다.

- 키는 코드·저장소에 들어 있지 않습니다. 각자 기기의 앱 저장소(localStorage)에만 저장되고 Google 서버로만 전송됩니다.
- 학생 이름·연락처 등 개인정보는 입력하지 마세요.
- 모델 목록은 키로 Google에서 불러옵니다. 기본값은 `gemini-flash-latest` 입니다.

## 빌드 (자동)
`main` 브랜치에 올리면 GitHub Actions 가 자동으로 만듭니다.

- Windows: `ClassHub-Portable.exe`(설치 없이), `ClassHub-Setup.exe`(설치형)
- Android: `ClassHub.apk`
- 웹: `gh-pages` 브랜치 (Settings → Pages → Branch 를 `gh-pages` 로 지정하면 아이폰에서도 사용 가능)

결과물은 **Releases** 에 올라갑니다. (Actions 탭 → Run workflow 로 수동 실행도 가능)

## 폴더
- `www/` 화면(HTML·CSS·JS) — 웹/PC/안드로이드가 공통으로 사용
- `electron/` PC 앱(창 제어)
- `android-res/` 안드로이드 아이콘·알림 소리
- `scripts/` 아이콘·소리 생성 스크립트

QR 생성 코드: QRCode for JavaScript © Kazuhiko Arase (MIT)
