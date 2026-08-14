# WMS 디지털 트윈 구조

## 실행 원본

- `index.html`은 화면 마크업의 단일 원본이다.
- 나머지 HTML 파일은 기존 파일명 호환을 위한 동기화 산출물이다.
- `npm run sync:pages`로 호환 페이지를 갱신한다.
- `build_spa.js`, `create_build_spa.js`, `build_native_pages.js`와 `generate_pages.js`는 현재 실행 원본이 아니다. 최신 기능을 보장하지 않으므로 운영 갱신에 사용하지 않는다.

## 런타임 모듈

- `js/app.js`: 해시 탭 라우팅과 사이드바 접기/펼치기
- `js/role-permissions.js`: 로컬 로그인 세션, Viewer/Editor 권한, 로그아웃 처리
- `js/app-features.js`: 검색, 알림, 업데이트 등록
- `js/test-editor.js`: 테스트 메뉴 카드 편집기
- `css/style.css`: 공통 레이아웃과 컴포넌트
- `css/test-editor.css`: 테스트 메뉴 카드 편집기 전용 스타일

## 검증

`npm test`는 메뉴 패널, 런타임 파일, JavaScript 구문, 호환 HTML 동기화 상태를 확인한다. 실제 사용자 동작 회귀 테스트는 이 검증을 통과한 뒤 브라우저에서 수행한다.
