# 기획 템플릿 · WMS 디지털 트윈

WMS(창고 관리 시스템) 디지털 트윈의 기획·데모 화면을 위한 웹 템플릿입니다. 로그인 권한, 메뉴 기반 화면 전환, 카드 편집 및 경로 찾기 등 기획 검토에 필요한 UI를 제공합니다.

## 주요 기능

- 로컬 테스트 로그인과 `Viewer`·`Editor` 권한 전환
- 개요, 층 관리, 범위 관리, 랙 관리, 저작도구, 경로 찾기, 시스템 설정, 테스트 메뉴
- Editor 전용 카드 추가·수정·삭제·순서 변경
- 텍스트·표·이미지·PDF 기반 카드 콘텐츠와 Mermaid 흐름도 표시
- 이미지·PDF를 Git과 Netlify에 함께 게시할 수 있는 로컬 파일 저장 도우미
- 메뉴, 검색, 도움말, 업데이트 등록 UI

## 시작하기

### 준비 사항

- Node.js 18 이상

### 의존성 설치

```powershell
npm ci
```

### 로컬에서 실행

프로젝트 폴더의 `start-local-editor.cmd`를 두 번 클릭합니다. 또는 PowerShell에서 다음 명령을 실행합니다.

```powershell
npm run dev
```

브라우저에서 [http://127.0.0.1:4173](http://127.0.0.1:4173)을 엽니다.

로그인은 로컬 테스트 전용입니다. `edituser` 또는 `viewuser` 계정으로 로그인하며, 처음 로그인한 권한은 `Viewer`입니다.

## 카드 첨부파일 등록과 게시

1. 반드시 `start-local-editor.cmd`로 로컬 사이트를 실행합니다.
2. Editor 권한에서 카드에 이미지 또는 PDF를 추가하고 `등록`을 누릅니다.
3. 파일은 `assets/content`에 저장되고, 파일 목록은 `data/attachments.json`에 기록됩니다.
4. 카드 등록·수정·삭제·순서 변경이나 메뉴 변경이 완료되면 `data/site-content.json`과 파일 실행용 `data/site-content.js`가 자동으로 갱신됩니다.
5. 메뉴 관리의 `콘텐츠 JSON` 아래에서 저장 상태를 확인하거나 `지금 프로젝트에 저장`을 눌러 수동으로 다시 저장할 수 있습니다.
6. 자동 저장은 브라우저 저장 내용과 프로젝트 파일을 맞추며, Git 커밋·푸시는 자동으로 하지 않습니다.
7. `data/site-content.json`, `data/site-content.js`, `data/attachments.json`, `assets/content` 변경을 모두 Git에 커밋·푸시합니다.
8. Netlify가 GitHub 저장소와 연결되어 있으면 푸시 후 자동 배포됩니다.

카드를 삭제해도 첨부파일은 즉시 삭제되지 않습니다. 같은 파일을 다른 카드가 사용할 수 있기 때문입니다. 메뉴 관리의 `첨부파일 검사·정리`에서 미사용 파일만 휴지통으로 옮기고, 필요하면 복구하거나 영구 삭제합니다. 같은 파일을 여러 번 등록하면 내용이 같은 파일은 한 번만 저장됩니다.

## 개발 명령어

```powershell
# 구조 회귀 테스트
npm test

# index.html 변경 후 호환 진입 페이지 동기화
npm run sync:pages

# data/site-content.json 변경 후 file:// 실행용 콘텐츠 동기화
npm run sync:content
```

`index.html`은 화면 마크업의 원본입니다. `home.html`, `overview.html` 등의 HTML 파일은 기존 경로 호환을 위한 동기화 산출물이므로, 원본을 수정한 뒤 반드시 `npm run sync:pages`를 실행합니다.

## 프로젝트 구조

```text
index.html                 화면 마크업 원본
js/app.js                  해시 기반 메뉴 전환과 사이드바
js/role-permissions.js     로컬 로그인과 Viewer/Editor 권한
js/app-features.js         검색·알림·업데이트 등록
js/test-editor-v14.js      공통 카드 편집 기능
css/style.css              공통 스타일
css/test-editor.css        카드 편집기 스타일
assets/                    화면 이미지·미디어
tests/                     구조 회귀 테스트
scripts/sync-pages.js      호환 HTML 동기화
scripts/local-content-server.js 로컬 화면·첨부파일 저장 서버
assets/content/            Git·Netlify에 게시할 카드 첨부파일
data/attachments.json      첨부파일 목록
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
