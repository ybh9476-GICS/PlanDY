# 기획 템플릿 · WMS 디지털 트윈

WMS(창고 관리 시스템) 디지털 트윈의 기획·데모 화면을 위한 웹 템플릿입니다. 로그인 권한, 메뉴 기반 화면 전환, 카드 편집 및 경로 찾기 등 기획 검토에 필요한 UI를 제공합니다.

## 주요 기능

- 로컬 테스트 로그인과 `Viewer`·`Editor` 권한 전환
- 개요, 층 관리, 범위 관리, 랙 관리, 저작도구, 경로 찾기, 시스템 설정, 테스트 메뉴
- Editor 전용 카드 추가·수정·삭제·순서 변경
- 텍스트·표·이미지 기반 카드 콘텐츠와 Mermaid 흐름도 표시
- 메뉴, 검색, 도움말, 업데이트 등록 UI

## 시작하기

### 준비 사항

- Node.js 18 이상
- Python 3 (로컬 미리 보기 서버용)

### 의존성 설치

```powershell
npm ci
```

### 로컬에서 실행

```powershell
.\scripts\start-local-preview.ps1
```

브라우저에서 [http://127.0.0.1:4173](http://127.0.0.1:4173)을 엽니다.

로그인은 로컬 테스트 전용입니다. 아이디와 비밀번호에 각각 영문·숫자 8자를 입력하면 로그인할 수 있으며, 처음 로그인한 권한은 `Viewer`입니다.

## 개발 명령어

```powershell
# 구조 회귀 테스트
npm test

# index.html 변경 후 호환 진입 페이지 동기화
npm run sync:pages
```

`index.html`은 화면 마크업의 원본입니다. `home.html`, `overview.html` 등의 HTML 파일은 기존 경로 호환을 위한 동기화 산출물이므로, 원본을 수정한 뒤 반드시 `npm run sync:pages`를 실행합니다.

## 프로젝트 구조

```text
index.html                 화면 마크업 원본
js/app.js                  해시 기반 메뉴 전환과 사이드바
js/role-permissions.js     로컬 로그인과 Viewer/Editor 권한
js/app-features.js         검색·알림·업데이트 등록
js/test-editor.js          공통 카드 편집 기능
css/style.css              공통 스타일
css/test-editor.css        카드 편집기 스타일
assets/                    화면 이미지·미디어
tests/                     구조 회귀 테스트
scripts/sync-pages.js      호환 HTML 동기화
```

## GitHub에 변경 올리기

파일을 수정한 뒤 아래 순서로 GitHub에 반영합니다.

```powershell
git status
git add -A
git commit -m "변경 내용 설명"
git push
```

현재 원격 저장소는 [ybh9476-GICS/PlanTemplate](https://github.com/ybh9476-GICS/PlanTemplate)입니다.
