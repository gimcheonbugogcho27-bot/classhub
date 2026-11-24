# 우리반 도구함

우리반타이머 + QR 메이커 + AI 대화를 하나로 합친 앱입니다. (Windows exe · Android apk · 웹)

| 탭 | 기능 |
|---|---|
| 시계 | 큰 시계 + 세계시각 8도시 |
| 스톱워치 | 기록(랩) |
| 타이머 | 직접 입력 숫자판, 진행 중 시간 더하기/빼기, 작은 창 모드(PC) |
| 알람 | 여러 개 등록, 앱을 내려도 휴대폰 알림으로 울림(apk) |
| QR | 제목 + URL → 제목이 적힌 QR 이미지(PNG) 저장, 최근 20개 기록 |
| 시간 맞추기 | 타이머·알람 시간을 **숫자 휠**로 맞춰요 (휴대폰은 손가락으로 돌리고, 컴퓨터는 마우스 휠·드래그·방향키 · 빠르게 돌리면 가속 · 숫자를 누르면 직접 입력 · 휠에서 숫자 키로 바로 입력). 작은 화면 알람은 **끄기 버튼**이나 아무 곳이나 눌러 끌 수 있어요 |
| 소음 | **교실 소음 측정기** — 마이크 소리 크기(0~250)를 신호등으로 보여 주고, 너무 시끄러우면 소리·깜빡임으로 알려요. '조용' 기준 자동 맞춤, 엄격/보통/느슨, 경고 횟수, 상황마다 바뀌는 여러 안내 문장. 소리는 녹음·저장하지 않아요 |
| 구슬 | **구슬 뽑기** — 참여자마다 구슬(이미지)을 넣고 레이스로 당첨자를 뽑아요. 맵 4종, 먼저/마지막 도착, 당첨 인원, 구슬 시점 따라가기, 레이스 중 노래(끄기 가능), 이름별 리더보드, 참여자는 GitHub 저장소 `guselpick`의 이미지 이름에서 자동으로 불러와 고정(예: 07_박준희_아기펭귄.png → 박준희, 인터넷이 없으면 저장된 명단 사용) |
| AI | Google Gemini 와 대화 — 스트리밍 답변, 서버가 바쁘면 자동 재시도·다른 모델, **대화목록**(저장·검색·제목 수정·삭제), **📷 사진 첨부**(최대 3장), **⭐ 내 질문** 저장, **💾 파일로 저장 · 🖨 A4 인쇄**, 답변 속 주소를 바로 QR로, **🔍 실시간 검색**(Google 검색 연결·출처 표시, 켬/끔), **🎨 그림 만들기**(그림 생성·사진 고치기·비율/모델 선택·저장) |

단축키: `1`~`6` 탭 이동 · `Space` 시작/멈춤 · `R` 초기화 · `T` 테마 · `M` 작은 창 · `F11` 전체화면

## AI(Google API) 키 넣기
키는 저장소 코드에 넣지 않고, **빌드할 때 GitHub Secret 으로 자동으로 들어갑니다.** (앱에는 키 입력란이 나오지 않습니다)

1. https://aistudio.google.com/apikey 에서 API 키를 만듭니다.
2. 저장소 **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `GEMINI_API_KEY` / Secret: 만든 키
3. **Actions 탭 → Build EXE & APK → Run workflow** 로 다시 빌드합니다.

- Secret 이 없으면 AI 탭에 🔑 키 입력 버튼이 대신 나타납니다.
- 🎨 그림 만들기는 Google 이미지 모델(Nano Banana 계열)을 쓰며, 무료 키는 이미지 사용량이 없거나 적을 수 있어요. 안 되면 AI Studio에서 결제(과금) 설정을 확인하세요. 만든 그림에는 Google의 SynthID 보이지 않는 워터마크가 들어갑니다.
- 주의: 키는 설치 파일 안에 들어가므로, 파일을 가진 사람은 키를 꺼낼 수 있습니다. Google AI Studio/Cloud 에서 이 키의 사용 한도를 낮게 걸어 두세요.
- 학생 이름·연락처 등 개인정보는 입력하지 마세요.
- 모델 목록은 키로 Google 에서 불러옵니다. 기본값은 `gemini-flash-latest` 입니다.

## 빌드 (자동)
`main` 브랜치에 올리면 GitHub Actions 가 자동으로 만듭니다.

- Windows: `ClassHub-Portable.exe`(설치 없이), `ClassHub-Setup.exe`(설치형)
- Android: `ClassHub.apk`
- 웹: `gh-pages` 브랜치 (Settings → Pages → Branch 를 `gh-pages` 로 지정하면 아이폰에서도 사용 가능)

결과물은 **Releases** 에 올라갑니다. (Actions 탭 → Run workflow 로 수동 실행도 가능)

## 설치할 때 나오는 경고
- **Windows exe**: 코드 서명 인증서(유료)가 없어서 "Windows의 PC 보호" 경고가 나옵니다. **추가 정보 → 실행** 을 누르면 실행됩니다. (경고를 없애려면 인증서를 사서 서명하거나, 오픈소스 무료 서명 프로그램 SignPath Foundation 에 신청해야 합니다.)
- **Android apk**: Play 스토어 밖에서 설치하므로 "출처를 알 수 없는 앱" 허용이 필요합니다. 빌드는 **서명된 release 버전**이며, 아래 고정 키를 등록하면 새 버전이 기존 앱 위에 **업데이트**로 설치됩니다.

### apk 고정 서명 키 (한 번만)
1. 저장소 **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `ANDROID_KEYSTORE_BASE64` / Secret: 키스토어를 base64 로 바꾼 한 줄 글자
3. 다시 빌드하면 "서명 확인" 단계에 같은 인증서 지문(SHA-256)이 계속 나옵니다.

시크릿이 없으면 빌드마다 새 임시 키로 서명되어, 새 apk 를 설치할 때 기존 앱을 먼저 지워야 할 수 있습니다.

## 폴더
- `www/` 화면(HTML·CSS·JS) — 웹/PC/안드로이드가 공통으로 사용
- `electron/` PC 앱(창 제어)
- `android-res/` 안드로이드 아이콘·알림 소리
- `scripts/` 아이콘·소리 생성 스크립트

QR 생성 코드: QRCode for JavaScript © Kazuhiko Arase (MIT)
