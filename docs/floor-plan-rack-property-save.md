# 랙 속성 패널 및 마스터 저장 변경 (2026-09-17)

## 적용 범위

평면도 에디터의 선택 랙 패널만 변경했다. 대상 코드 옆 변경 버튼과 랙 속성 변경 팝업을 제거하고, 다음 항목을 랙타입/셀 수 안내 아래에 배치했다.

- 한 베이 가로, 한 랙열 전체 깊이, 전체 높이, 단당 높이: m 단위, 소수점 두 자리
- 단수, 깊이 방향 셀 수: 정수

Enter 또는 입력 필드에서 이동하면 자동 반영한다. 입력 중 셀 배치를 미리 보여준다. 원래 타입을 공유하는 다른 랙의 규격은 유지하고, 선택한 랙의 전용 타입을 만들어 변경한다. 반복 수정 시 전용 타입을 재사용한다. 기존 저장 수치는 다른 항목을 수정했다는 이유로 반올림하지 않는다.

삭제와 속성 저장 버튼을 나란히 배치했다. 삭제 버튼/키보드 Delete는 확인창을 거치고, 취소하면 그대로 유지한다. 실행 취소로 삭제를 복원할 수 있다.

## 속성 저장의 대상과 연결 설정

속성 저장은 로컬 도면 저장과 별개다. 이름 입력창의 저장은 Google 계정 승인을 받은 후 아래 **실제 기준정보 원본**에 새 행을 추가한다. 기존 항목을 덮어쓰지 않는다.

- 문서: WMS_기준정보_템플릿_GICS
- 문서 ID: `12G9JIftGIVStzWUxIVZrz0JZsJ858Mc90V7-fnfBiHM`
- 시트: `랙타입 마스터` (sheetId `100867756`)
- 헤더: A4:H4
- 열 순서: 랙타입코드, 랙타입명, 베이폭(m), 깊이(m), 전체높이(m), 단수, 단당높이(m), 깊이수

사이트에 Google OAuth 웹 클라이언트 ID가 없으므로 `data/floor-plan-google-config.js`의 `clientId`는 현재 비어 있다. 실제 원본 저장은 아직 활성화/검증되지 않았다. 연결이 없을 때는 명확한 오류를 표시하며, 로컬 저장으로 바꿔 성공했다고 표시하지 않는다.

Google Cloud에서 Sheets API를 활성화하고 OAuth 웹 클라이언트의 승인된 JavaScript 출처에 `http://127.0.0.1:4173`과 실제 사용할 사이트 출처를 등록해야 한다. OAuth 동의 화면/테스트 사용자 설정도 필요한 계정에 맞춰 구성한다. 공개 클라이언트 ID만 설정 파일에 넣으며, 비밀번호·클라이언트 비밀키·접근 토큰을 파일에 넣지 않는다. 원본 시트를 편집할 수 있는 Google 계정으로 승인해야 한다. 사이트 Viewer/Editor와 Google 시트 편집 권한은 별개다.

저장 직전에 원본 헤더와 이름 목록을 읽는다. 동일한 이름이 있으면 한국 시간 `YYYY-MM-DD HH:mm:ss`를 이름 뒤에 자동으로 붙인다. 같은 초의 이름까지 중복이면 순번을 붙인다. 자동 생성한 고유 타입 코드와 8개 값으로 한 행만 추가하고, 추가된 행을 다시 읽어 확인한다. 이름은 수식으로 해석되지 않도록 RAW 방식으로 저장한다. 저장 성공한 타입은 현재 에디터의 기준정보 선택 목록에 즉시 추가된다. 기존 도면의 다른 랙은 변경되지 않는다.

저장 중 중복 클릭과 Esc 취소를 막는다. Google 연결 토큰은 메모리에만 유지한다. 편집 세션이 끝나면 추가 요청 전 실행을 차단한다. 추가 요청 중 통신이 끊어지면 생성한 고유 코드로 원본을 확인한다. 성공 여부를 확인할 수 없을 때는 해당 창의 재시도를 막고, 원본에서 확인할 코드를 안내한다. 저장 응답을 받은 후 재확인이 실패한 경우도 성공으로 표시하지 않는다.

원본의 이름 확인과 행 추가는 별도 요청이므로 여러 사용자가 동시에 동일한 새 이름을 저장하는 경우까지 완전히 원자적으로 보장하지는 않는다. 완전한 동시 저장 중복 방지가 필요하면 시트 측 잠금이 가능한 서버 저장 연결이 추가로 필요하다.

## 검증 결과

- 변경 전 `npm.cmd test`: 통과
- 변경 전 Edge에서 속성 입력은 팝업에만 있고 삭제가 즉시 실행되는 동작 재현
- 변경 후 `npm.cmd test`: 통과
- Edge Viewer/Editor: 자동 반영, 선택한 랙만 수정, 전용 타입 재사용, 잘못된 정수 입력/Esc 복원, 삭제 취소/확인/실행 취소, 기존 초안 보존 확인
- 기존 브라우저 회귀: 기본 편집, 추가 입력, 메뉴 이동/Grid, 중복 코드, 셀 가운데 배치, 랙 목록, Viewer 제한, 미터 표시, 랙 회전/잠금 검증 통과
- 저장 모듈 모의 Google 응답: 8개 열 추가, 중복 이름 시간 추가, 재확인, 선택 목록 추가 통과
- 저장 모듈 단위 검증: 헤더 변경/편집 권한 거부/세션 종료 차단, 추가 요청 응답 유실 복구, 결과 불명 시 재시도 제한 통과
- 실제 Google 로그인/원본 행 추가: OAuth 클라이언트 ID가 없어 **미검증**. 원본 시트에 테스트 행을 추가하지 않았다.

검증 파일: `tests/floor-plan-rack-save-browser.cjs`, `tests/floor-plan-rack-master.test.cjs`. 화면 및 결과: `output/floor-plan-rack-save/`.

Google 공식 문서:
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append

## 변경 파일

- js/floor-plan-editor.js: 패널 입력, 자동 반영, 삭제 확인, 이름 입력창, 비동기 저장 처리
- css/floor-plan-editor.css: 숫자 속성 구획 및 삭제/저장 버튼 배치
- js/floor-plan-rack-master.js, data/floor-plan-google-config.js: Google 원본 추가 및 연결 설정
- index.html, 호환 진입 페이지 12개: 모듈 연결 및 캐시 버전
- package.json: 마스터 저장 검증을 기존 평면도 테스트에 포함
- tests/floor-plan-rack-save-browser.cjs, tests/floor-plan-rack-master.test.cjs: 신규 검증
- tests/floor-plan-rack-browser.cjs, tests/floor-plan-rack-list-browser.cjs, tests/floor-plan-viewer-browser.cjs, tests/floor-plan-precision-browser.cjs: 팝업 대신 패널 입력 및 삭제 확인을 검증
- docs/floor-plan-editor.md, 이 문서: 현재 동작과 연결 미완료 상태 기록

Editor 추가 브라우저 검증도 동일 절차로 통과했다. 검증 스크립트의 문자열 치환 오류는 수정하고 다시 실행했다. 실제 사용자 Chrome 프로필·모바일 터치는 검증하지 않았다.


## 랙타입코드 입력 추가 (2026-09-17)

속성 저장 팝업에 자동 생성된 랙타입코드를 표시하고 직접 수정할 수 있게 했다. 원본 마스터의 중복 코드는 저장을 차단하며, 코드 입력 후 Enter로도 저장한다. 코드 형식은 기존 모델 규칙을 유지한다. 랙타입명 중복의 저장 시간 추가는 유지한다. 상세 파일·검증·한계는 [floor-plan-rack-type-code.md](floor-plan-rack-type-code.md)를 따른다.
