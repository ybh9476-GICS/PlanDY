const fs = require('fs');

const icons = {
    logo: `<svg class="brand-logo" viewBox="0 0 153.03 28.13" width="135" height="25" style="display:block;"><g><path fill="#211959" d="M14.26,8.47c-.85.09-1.58.62-1.93,1.4L4.33,28.13h5.59c.88-.06,1.65-.61,2-1.41l8-18.25h-5.66Z"/><path fill="#211959" d="M9.99,8.47h-5.58L.13,18.3c-.34.77,0,1.4.7,1.4h5.58l4.28-9.83c.34-.77,0-1.4-.7-1.4"/><path fill="#b20e10" d="M30.73.04h-5.58l-8.57,19.66h5.59c.84-.09,1.58-.62,1.92-1.4L31.43,1.4c.34-.77,0-1.4-.7-1.4"/><path fill="#b20e10" d="M39.27.04h-5.58l-4.9,11.23h5.58c.85-.09,1.58-.62,1.93-1.4l3.67-8.43c.34-.77,0-1.4-.7-1.4"/><polygon fill="#1d1d1b" points="46.43 17.4 44.68 8.58 49.36 8.58 50.02 14.41 55.83 8.58 59.98 8.58 50.46 17.4 48.26 22.49 44.23 22.49 46.43 17.4"/><path fill="#1d1d1b" d="M74.82,8.58l-3.88,9c-1.75,4-5.67,5.5-9.34,5.5s-6.24-1.55-4.58-5.5l3.89-9h4l-3.8,8.78c-.71,1.81-.24,2.95,1.65,2.95,1.87-.04,3.53-1.2,4.2-2.95l3.8-8.78h4.06Z"/><path fill="#1d1d1b" d="M74.98,22.49l2.15-5h3.16c3.57,0,6.39-1.11,7.84-4.47s-.4-4.47-4-4.47h-7.21l-6,13.91,4.06.03ZM78.29,14.82l1.54-3.54h2.58c1.56.05,1.93.75,1.49,1.77-.55,1.15-1.73,1.85-3,1.77h-2.61Z"/><path fill="#1d1d1b" d="M92.54,22.78c4.72.04,8.97-2.84,10.67-7.25,2-4.59.41-7.24-4.41-7.24-4.72-.05-8.98,2.83-10.67,7.24-2,4.59-.41,7.25,4.41,7.25M98.95,15.59c-.89,2.06-2.51,4.49-5.25,4.49s-2.25-2.43-1.36-4.49,2.55-4.61,5.3-4.61,2.28,2.42,1.28,4.61"/><path fill="#1d1d1b" d="M109.04,22.78c4.72.05,8.98-2.84,10.67-7.25,2-4.59.41-7.24-4.41-7.24-4.72-.05-8.97,2.84-10.67,7.24-2,4.59-.41,7.25,4.41,7.25M115.45,15.59c-.89,2.06-2.51,4.49-5.24,4.49s-2.26-2.43-1.37-4.49,2.56-4.61,5.3-4.61,2.25,2.43,1.31,4.61"/><polygon fill="#1d1d1b" points="124.26 8.58 129.91 8.58 130.31 18.95 130.36 18.9 134.83 8.58 138.46 8.58 132.44 22.49 126.85 22.49 126.52 11.84 126.49 11.84 121.88 22.49 118.25 22.49 124.26 8.58"/><path fill="#1d1d1b" d="M146.72,17.29h-3l1.17-2.7h7l-3.21,7.43c-2.55.49-5.14.74-7.73.76-4.47-.14-6-2.9-4.16-7.25,1.74-4.26,5.82-7.09,10.42-7.24,3.58-.1,7.07.4,5.38,4.45h-4c.38-1.35-.55-1.76-1.88-1.76-2.73,0-4.69,2.3-5.66,4.55-1.18,2.74-.53,4.55,2.37,4.55.74-.02,1.47-.1,2.2-.24l1.1-2.55Z"/></g></svg>`,
    home: `<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
    overview: `<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    floor: `<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
    zone: `<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`,
    rack: `<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
    editor: `<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
    route: `<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"></circle><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"></path><circle cx="18" cy="5" r="3"></circle></svg>`,
    settings: `<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line><circle cx="12" cy="10" r="2.2"></circle><path d="M12 6.5v1.2M12 11.1v1.2M8.8 10h1.2M14 10h1.2M9.7 7.7l.8.8M13.5 11.5l.8.8M14.3 7.7l-.8.8M10.5 11.5l-.8.8"></path></svg>`,
    menu: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`,
    search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    bell: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
    filter: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>`,
    plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    chevronRight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`
};

const spaHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>유풍 창고 관리 시스템(WMS) - 디지털 트윈 오케스트레이션</title>
    <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    <link rel="stylesheet" href="style.css"/>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>document.addEventListener("DOMContentLoaded", function() { mermaid.initialize({startOnLoad:true, theme:"neutral"}); });</script>
</head>
<body>

<!-- SideNavBar (Fixed) -->
<aside id="sidebar" class="sidebar">
    <div class="sidebar-header">
        <div class="hide-on-collapse">
            <div class="sidebar-title">
                ${icons.logo}
            </div>
            <p class="sidebar-subtitle" style="margin-top:0.25rem;">유풍 창고 관리 시스템(WMS)</p>
        </div>
        <button id="sidebarToggle" class="sidebar-toggle-btn" data-tooltip="사이드바 접기">
            ${icons.menu}
        </button>
    </div>
    <nav class="nav-menu">
        <a href="#overview" data-tab="overview" data-tooltip="개요" class="nav-link active">
            <div class="nav-link-indicator"></div>
            ${icons.overview}
            <span class="hide-on-collapse">개요</span>
        </a>
        <a href="#floor" data-tab="floor" data-tooltip="층 관리" class="nav-link">
            <div class="nav-link-indicator" style="display:none;"></div>
            ${icons.floor}
            <span class="hide-on-collapse">층 관리</span>
        </a>
        <a href="#zone" data-tab="zone" data-tooltip="범위 관리" class="nav-link">
            <div class="nav-link-indicator" style="display:none;"></div>
            ${icons.zone}
            <span class="hide-on-collapse">범위 관리</span>
        </a>
        <a href="#rack" data-tab="rack" data-tooltip="랙 관리" class="nav-link">
            <div class="nav-link-indicator" style="display:none;"></div>
            ${icons.rack}
            <span class="hide-on-collapse">랙 관리</span>
        </a>
        <a href="#editor" data-tab="editor" data-tooltip="저작도구" class="nav-link">
            <div class="nav-link-indicator" style="display:none;"></div>
            ${icons.editor}
            <span class="hide-on-collapse">저작도구</span>
        </a>
        <a href="#route" data-tab="route" data-tooltip="경로 찾기" class="nav-link">
            <div class="nav-link-indicator" style="display:none;"></div>
            ${icons.route}
            <span class="hide-on-collapse">경로 찾기</span>
        </a>
        <a href="#settings" data-tab="settings" data-tooltip="시스템 설정" class="nav-link">
            <div class="nav-link-indicator" style="display:none;"></div>
            ${icons.settings}
            <span class="hide-on-collapse">시스템 설정</span>
        </a>
    </nav>
    <div class="sidebar-footer">
        <div class="sidebar-utility-bar">
            <button id="sidebarSearchBtn" class="nav-link sidebar-action-btn" data-tooltip="검색">
                <div class="nav-link-indicator" style="display:none;"></div>
                ${icons.search}
                <span class="hide-on-collapse">검색</span>
            </button>
            <button id="sidebarBellBtn" class="nav-link sidebar-action-btn" data-tooltip="업데이트">
                <div class="nav-link-indicator" style="display:none;"></div>
                ${icons.bell}
                <span class="hide-on-collapse">업데이트</span>
            </button>
        </div>
    </div>
</aside>

<!-- Main Content Shell -->
<main id="main-content" class="main-content">
    <!-- TAB 1: OVERVIEW VIEW -->
    <section id="view-overview" class="content-area view-panel" style="display:block;">
        <div class="section-header">
            <div>
                <h3 class="section-title">유풍 창고 관리 시스템(WMS) 개요</h3>
                <p class="section-subtitle">디지털 트윈 기반 창고관리시스템(WMS) 기획 제안 및 핵심 운용 프로세스</p>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary">${icons.filter} 필터</button>
                <button class="btn btn-primary">${icons.plus} 기획 제안서 업데이트</button>
            </div>
        </div>

        <div style="margin-bottom: 2rem; background:#fff; padding:1.5rem; border-radius:0.75rem; border:1px solid rgba(195,198,215,0.4);">
            <h4 style="font-size:18px; font-weight:700; margin-bottom:0.75rem; color:var(--color-primary);">시스템 기획 개요 및 프로세스 흐름</h4>
            <p style="color:var(--color-secondary); line-height:1.6; margin-bottom:1.5rem;">
                본 유풍 창고 관리 시스템(WMS, Warehouse Management System) 프로젝트는 3D 디지털 트윈 환경을 구축하여 <strong>공장 → 건물 → 층 → 범위 → 구역 → 랙 → 단</strong>에 이르는 로케이션 계층 구조를 직관적으로 조망하고, 최적 자재 배치 및 층간 승강기(E/V) 연계 경로 검색을 제공합니다.
            </p>
            <div class="mermaid" style="display:flex; justify-content:center; margin:1.5rem 0;">
                graph TD
                    A[1. 출발지 & 도착지 검색 조건 입력] --> B[2. 자재/완제품 분류 탭 및 품목 슬롯 선택]
                    B --> C[3. 선택 층 재고 및 여유공간 인디케이터 확인]
                    C --> D[4. 최적 랙 Location ID 도출: B2C / G2D]
                    D --> E[5. 1F 출입구 ➔ E/V ➔ 2F 3D 이동 경로 렌더링]
                    E --> F[6. 3D 빌보드 기점 및 작업자 가이드 제공]
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; margin-bottom:2rem;">
            <div class="card" style="margin-bottom:0;">
                <h4 class="card-title">1F 선택층 현황 & 자재 인디케이터</h4>
                <p class="card-desc">국가, 공장, 건물, 층 드롭다운 선택 시 상단에 원단, 테이프, 밴드, 단추, 포장재의 재고/여유공간이 인디케이터 바 형태로 즉시 조망됩니다.</p>
                <img src="assets/wms/video_frames/video_step_1.jpg" alt="1F 선택층 현황" style="width:100%; border-radius:0.5rem; border:1px solid #e5e7eb; margin-top:0.75rem;"/>
            </div>
            <div class="card" style="margin-bottom:0;">
                <h4 class="card-title">3D 층간 E/V 연계 최적 경로 가이드</h4>
                <p class="card-desc">1F 출입구부터 1F E/V, 2F E/V를 거쳐 2F 부자재 창고의 G2D 랙까지 이어지는 수평/수직 이동 동선을 3D 그린 라인 및 빌보드로 안내합니다.</p>
                <img src="assets/wms/video_frames/video_step_5.jpg" alt="3D 최적 경로" style="width:100%; border-radius:0.5rem; border:1px solid #e5e7eb; margin-top:0.75rem;"/>
            </div>
        </div>

        <div class="card" style="margin-bottom:0;">
            <h4 class="card-title" style="margin-bottom:1rem;">WMS 핵심 용어 및 구조 명세</h4>
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px;">
                    <thead>
                        <tr style="background-color:var(--color-surface-container-low); border-bottom:2px solid #e5e7eb;">
                            <th style="padding:10px 14px; font-weight:700;">용어 (Term)</th>
                            <th style="padding:10px 14px; font-weight:700;">기능 명칭</th>
                            <th style="padding:10px 14px; font-weight:700;">핵심 내용 및 편집 기능 명세</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom:1px solid #f0f0f0;">
                            <td style="padding:10px 14px; font-weight:600; color:var(--color-primary);">층 (Floor)</td>
                            <td style="padding:10px 14px;">층 편집</td>
                            <td style="padding:10px 14px;">층별 면적 정보 입력 시 해당 건물에 자동으로 층 생성 및 층별 창고 현황을 조망할 수 있습니다.</td>
                        </tr>
                        <tr style="border-bottom:1px solid #f0f0f0;">
                            <td style="padding:10px 14px; font-weight:600; color:var(--color-primary);">범위 (Zone)</td>
                            <td style="padding:10px 14px;">범위 편집</td>
                            <td style="padding:10px 14px;">자재 및 완제품 별로 구분되는 영역. 저작도구를 이용해 층 내 범위를 생성하고 정보 확인이 가능합니다.</td>
                        </tr>
                        <tr style="border-bottom:1px solid #f0f0f0;">
                            <td style="padding:10px 14px; font-weight:600; color:var(--color-primary);">구역 (Area)</td>
                            <td style="padding:10px 14px;">구역 편집</td>
                            <td style="padding:10px 14px;">작업자 동선으로 구분되는 랙(Rack)의 집합. 행/열 개수 및 정렬방식, 랙 타입을 지정하여 자동 교차점 배치합니다.</td>
                        </tr>
                        <tr>
                            <td style="padding:10px 14px; font-weight:600; color:var(--color-primary);">단 (Level)</td>
                            <td style="padding:10px 14px;">단 (ID)</td>
                            <td style="padding:10px 14px;">랙의 층 단위. 랙의 단별로 자동 Location ID가 부여되며 자재 및 완제품 등록/재고 및 여유공간 현황을 파악합니다.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>

    <!-- TAB 3: FLOOR VIEW -->
    <section id="view-floor" class="content-area view-panel" style="display:none;">
        <div class="section-header">
            <div>
                <h3 class="section-title">층(Floor) 관리 및 건물별 현황</h3>
                <p class="section-subtitle">건물별 층 생성, 면적 정보 관리 및 선택 층별 재고/여유공간 통합 인디케이터</p>
            </div>
        </div>

        <div style="background:#fff; padding:1.5rem; border-radius:0.75rem; border:1px solid rgba(195,198,215,0.4); margin-bottom:1.5rem;">
            <h4 style="font-size:16px; font-weight:700; margin-bottom:1rem; color:var(--color-on-surface);">선택 층 (1F EAST동) 자재 통합 인디케이터 현황</h4>
            <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:1rem; text-align:center;">
                <div style="background:#f8fafc; padding:1rem; border-radius:0.5rem; border:1px solid #e2e8f0;">
                    <p style="font-size:12px; color:var(--color-secondary); font-weight:600;">원단</p>
                    <p style="font-size:20px; font-weight:700; color:var(--color-primary); margin-top:0.25rem;">100 <span style="font-size:14px; color:#64748b;">/ 200</span></p>
                </div>
                <div style="background:#f8fafc; padding:1rem; border-radius:0.5rem; border:1px solid #e2e8f0;">
                    <p style="font-size:12px; color:var(--color-secondary); font-weight:600;">테이프</p>
                    <p style="font-size:20px; font-weight:700; color:var(--color-primary); margin-top:0.25rem;">300 <span style="font-size:14px; color:#64748b;">/ 500</span></p>
                </div>
                <div style="background:#f8fafc; padding:1rem; border-radius:0.5rem; border:1px solid #e2e8f0;">
                    <p style="font-size:12px; color:var(--color-secondary); font-weight:600;">밴드</p>
                    <p style="font-size:20px; font-weight:700; color:var(--color-tertiary); margin-top:0.25rem;">350 <span style="font-size:14px; color:#64748b;">/ 350</span></p>
                </div>
                <div style="background:#f8fafc; padding:1rem; border-radius:0.5rem; border:1px solid #e2e8f0;">
                    <p style="font-size:12px; color:var(--color-secondary); font-weight:600;">단추</p>
                    <p style="font-size:20px; font-weight:700; color:var(--color-primary); margin-top:0.25rem;">1,200 <span style="font-size:14px; color:#64748b;">/ 5,000</span></p>
                </div>
                <div style="background:#f8fafc; padding:1rem; border-radius:0.5rem; border:1px solid #e2e8f0;">
                    <p style="font-size:12px; color:var(--color-secondary); font-weight:600;">포장재</p>
                    <p style="font-size:20px; font-weight:700; color:var(--color-primary); margin-top:0.25rem;">500 <span style="font-size:14px; color:#64748b;">/ 1,000</span></p>
                </div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:1.5rem;">
            <div class="card" style="margin-bottom:0;">
                <h4 class="card-title">1F 창고 3D 조감도 (부자재 & 원자재)</h4>
                <img src="assets/wms/image15.png" alt="1F 창고 조감도" style="width:100%; border-radius:0.5rem; border:1px solid #e5e7eb; margin-top:0.5rem;"/>
            </div>
            <div class="card" style="margin-bottom:0;">
                <h4 class="card-title" style="margin-bottom:0.75rem;">건물 층 관리 리스트</h4>
                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                    <thead>
                        <tr style="background-color:var(--color-surface-container-low); border-bottom:2px solid #e5e7eb;">
                            <th style="padding:8px 10px;">층 구분</th>
                            <th style="padding:8px 10px;">면적</th>
                            <th style="padding:8px 10px;">창고 구성</th>
                            <th style="padding:8px 10px;">상태</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom:1px solid #f0f0f0;">
                            <td style="padding:10px; font-weight:700; color:var(--color-primary);">1F (EAST동)</td>
                            <td style="padding:10px;">2,400 m²</td>
                            <td style="padding:10px;">원자재 창고 / 부자재 창고</td>
                            <td style="padding:10px;"><span style="color:#16a34a; font-weight:600;">● 정상 운용</span></td>
                        </tr>
                        <tr>
                            <td style="padding:10px; font-weight:700; color:var(--color-primary);">2F (EAST동)</td>
                            <td style="padding:10px;">1,800 m²</td>
                            <td style="padding:10px;">완제품 보관 구역 / 출하 구역</td>
                            <td style="padding:10px;"><span style="color:#16a34a; font-weight:600;">● 정상 운용</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>

    <!-- TAB 4: ZONE VIEW -->
    <section id="view-zone" class="content-area view-panel" style="display:none;">
        <div class="section-header">
            <div>
                <h3 class="section-title">범위(Zone) 관리 및 영역 명세</h3>
                <p class="section-subtitle">원자재 및 부자재/완제품 구분을 위한 층 내 범위 생성 및 품목 현황</p>
            </div>
        </div>

        <div style="background:#fff; padding:1.5rem; border-radius:0.75rem; border:1px solid rgba(195,198,215,0.4); margin-bottom:1.5rem;">
            <h4 style="font-size:16px; font-weight:700; margin-bottom:1rem; color:var(--color-primary);">로케이션 계층 구조 (Location Hierarchy)</h4>
            <div class="mermaid" style="display:flex; justify-content:center; margin:1rem 0;">
                graph LR
                    Factory[공장: 엑사코] --> Building[건물: EAST동]
                    Building --> Floor[층: 1F / 2F]
                    Floor --> Zone1[범위 A: 부자재 창고]
                    Floor --> Zone2[범위 B: 원자재 창고]
                    Zone1 --> Area[구역: A/B/C/D 행]
                    Zone2 --> Area
                    Area --> Rack[랙: Rack ID]
                    Rack --> Level[단: B2C1 ~ B2C4]
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
            <div class="card" style="margin-bottom:0;">
                <h4 class="card-title">범위 생성 및 영역 조감</h4>
                <img src="assets/wms/image15.png" alt="범위 영역 조감" style="width:100%; border-radius:0.5rem; border:1px solid #e5e7eb; margin-top:0.5rem;"/>
            </div>
            <div class="card" style="margin-bottom:0;">
                <h4 class="card-title" style="margin-bottom:0.75rem;">범위별 보관 품목 관리 표</h4>
                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                    <thead>
                        <tr style="background-color:var(--color-surface-container-low); border-bottom:2px solid #e5e7eb;">
                            <th style="padding:8px; font-weight:700;">범위 명칭</th>
                            <th style="padding:8px; font-weight:700;">구분</th>
                            <th style="padding:8px; font-weight:700;">보관 품목 예시</th>
                            <th style="padding:8px; font-weight:700;">여유공간</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom:1px solid #f0f0f0;">
                            <td style="padding:10px; font-weight:700; color:#2563eb;">부자재 창고</td>
                            <td style="padding:10px;">부자재</td>
                            <td style="padding:10px;">단추, 테이프, 밴드, 지퍼, 포장재</td>
                            <td style="padding:10px; font-weight:600; color:#16a34a;">42% 여유</td>
                        </tr>
                        <tr>
                            <td style="padding:10px; font-weight:700; color:#059669;">원자재 창고</td>
                            <td style="padding:10px;">원자재</td>
                            <td style="padding:10px;">A01 블루/블랙/그린/레드 Kangol 원단</td>
                            <td style="padding:10px; font-weight:600; color:#16a34a;">35% 여유</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>

    <!-- TAB 5: RACK VIEW -->
    <section id="view-rack" class="content-area view-panel" style="display:none;">
        <div class="section-header">
            <div>
                <h3 class="section-title">구역 및 랙(Rack) 배치 관리</h3>
                <p class="section-subtitle">작업자 동선 기반 구역 정렬, 랙 타입 설정 및 단(ID)별 자재/여유공간 현황</p>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:1.5rem;">
            <div class="card" style="margin-bottom:0;">
                <h4 class="card-title">랙 선택 세부 정보 & 3D 뷰어 (B2C 랙 예시)</h4>
                <p class="card-desc">랙(Rack) 클릭 시 좌측 뷰어에 단(Level)별 적재량 및 품목 상세 정보(Kangol 원단 스펙)가 실시간 표시됩니다.</p>
                <img src="assets/wms/video_frames/video_step_5.jpg" alt="랙 3D 뷰어" style="width:100%; border-radius:0.5rem; border:1px solid #e5e7eb; margin-top:0.5rem;"/>
            </div>
            <div class="card" style="margin-bottom:0;">
                <h4 class="card-title" style="margin-bottom:0.75rem;">B2C 랙 단(Level)별 ID 및 수량 현황</h4>
                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                    <thead>
                        <tr style="background-color:var(--color-surface-container-low); border-bottom:2px solid #e5e7eb;">
                            <th style="padding:8px; font-weight:700;">단 (ID)</th>
                            <th style="padding:8px; font-weight:700;">보관 품목명</th>
                            <th style="padding:8px; font-weight:700;">수량 / 수용량</th>
                            <th style="padding:8px; font-weight:700;">적재 상태</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom:1px solid #f0f0f0; background-color:#f0fdf4;">
                            <td style="padding:10px; font-weight:700; color:#15803d;">B2C4 (4단)</td>
                            <td style="padding:10px; font-weight:600;">(여유 공간)</td>
                            <td style="padding:10px;">0 / 1,500</td>
                            <td style="padding:10px;"><span style="color:#16a34a; font-weight:700;">EMPTY (비어있음)</span></td>
                        </tr>
                        <tr style="border-bottom:1px solid #f0f0f0;">
                            <td style="padding:10px; font-weight:700;">B2C3 (3단)</td>
                            <td style="padding:10px;">A01 블랙 Kangol 원단</td>
                            <td style="padding:10px;">750 / 750</td>
                            <td style="padding:10px;"><span style="color:#2563eb; font-weight:600;">FULL (적재 완료)</span></td>
                        </tr>
                        <tr style="border-bottom:1px solid #f0f0f0;">
                            <td style="padding:10px; font-weight:700;">B2C2 (2단)</td>
                            <td style="padding:10px;">A01 블랙 Kangol 원단</td>
                            <td style="padding:10px;">750 / 750</td>
                            <td style="padding:10px;"><span style="color:#2563eb; font-weight:600;">FULL (적재 완료)</span></td>
                        </tr>
                        <tr>
                            <td style="padding:10px; font-weight:700;">B2C1 (1단)</td>
                            <td style="padding:10px;">A01 블랙 Kangol 원단</td>
                            <td style="padding:10px;">1,500 / 1,500</td>
                            <td style="padding:10px;"><span style="color:#2563eb; font-weight:600;">FULL (적재 완료)</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>

    <!-- TAB 6: AUTHORING TOOL / EDITOR VIEW (NEW AUTHORING TOOL MENU) -->
    <section id="view-editor" class="content-area view-panel" style="display:none;">
        <div class="section-header">
            <div>
                <h3 class="section-title">3D 창고 랙 저작도구 (Authoring Tool)</h3>
                <p class="section-subtitle">3D 창고 공간 모델링 로딩 기반 랙 타입, 그리드 규격, 프리팹 관리 및 랙 조작 에디팅</p>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary">📂 프리팹 불러오기</button>
                <button class="btn btn-primary">💾 저작 결과 WMS 반영</button>
            </div>
        </div>

        <!-- Editor Toolbar -->
        <div style="background:#1e293b; color:#fff; padding:0.75rem 1.25rem; border-radius:0.75rem; margin-bottom:1.25rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
            <div style="display:flex; align-items:center; gap:1rem;">
                <span style="font-size:13px; font-weight:600; color:#94a3b8;">창고 3D 모델:</span>
                <select style="background:#0f172a; color:#f8fafc; border:1px solid #334155; padding:6px 12px; border-radius:6px; font-size:13px; font-weight:600;">
                    <option>방글라데시 엑사코 EAST동 1F 창고 메인 모델</option>
                    <option>방글라데시 엑사코 EAST동 2F 완제품 보관 모델</option>
                    <option>한국 본사 MAIN동 R&D 테스트 3D 모델</option>
                </select>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
                <span style="font-size:13px; font-weight:600; color:#94a3b8; margin-right:0.25rem;">조작 모드:</span>
                <button style="background:#2563eb; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">✋ 이동 (M)</button>
                <button style="background:#334155; color:#cbd5e1; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">📍 배치 (P)</button>
                <button style="background:#334155; color:#cbd5e1; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">🔄 회전 90° (R)</button>
                <button style="background:#334155; color:#cbd5e1; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">📋 복제 (D)</button>
                <button style="background:#dc2626; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">🗑️ 삭제 (Del)</button>
            </div>
        </div>

        <!-- Main Editor Grid Split: 3D Canvas Viewport (Left 65%) vs Rack Property Panel (Right 35%) -->
        <div style="display:grid; grid-template-columns: 1.8fr 1fr; gap:1.5rem; margin-bottom:1.5rem;">
            <!-- 3D Canvas Viewport -->
            <div class="card" style="margin-bottom:0; padding:1.25rem; background:#0f172a; border:1px solid #1e293b; color:#fff; position:relative; overflow:hidden;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#22c55e;"></span>
                        <span style="font-size:14px; font-weight:700; color:#f8fafc;">3D Canvas Viewport - 창고 내부 랙 저작 실시간 렌더러</span>
                    </div>
                    <span style="font-size:12px; color:#64748b; background:#1e293b; padding:2px 8px; border-radius:4px;">Grid Snap: 1.0m</span>
                </div>

                <div style="position:relative; width:100%; border-radius:0.5rem; overflow:hidden; border:1px solid #334155;">
                    <img src="assets/wms/video_frames/video_step_1.jpg" alt="3D 저작 캔버스 뷰포트" style="width:100%; display:block; filter: brightness(0.95);"/>
                    <!-- Interactive 3D Editing Gizmo Overlay Graphic -->
                    <div style="position:absolute; top:20%; left:35%; border:2px dashed #38bdf8; background:rgba(56,189,248,0.15); width:180px; height:110px; border-radius:4px; display:flex; flex-direction:column; justify-content:space-between; padding:6px; box-shadow:0 0 15px rgba(56,189,248,0.4);">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="background:#0284c7; color:#fff; font-size:10px; font-weight:700; padding:1px 5px; border-radius:3px;">SELECTED: RACK_B2C</span>
                            <span style="color:#38bdf8; font-size:12px; font-weight:700;">🔄 90°</span>
                        </div>
                        <div style="text-align:center; font-size:11px; font-weight:700; color:#e0f2fe;">
                            [ 4행 x 10열 ]<br/>
                            Size: 12m x 1m x 4.5m
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:10px; color:#cbd5e1;">
                            <span>X: 14.5m</span>
                            <span>Y: 0.0m</span>
                            <span>Z: 8.2m</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Rack Property Panel (Editing Parameters) -->
            <div style="display:flex; flex-direction:column; gap:1rem;">
                <!-- 1. 랙 타입 선택 -->
                <div class="card" style="margin-bottom:0; padding:1.25rem;">
                    <h4 style="font-size:15px; font-weight:700; color:var(--color-primary); margin-bottom:0.75rem;">1. 랙 타입 선택 (Rack Type)</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                        <label style="background:#eff6ff; border:2px solid #2563eb; border-radius:0.5rem; padding:8px 10px; cursor:pointer; text-align:center;">
                            <input type="radio" name="rackType" checked style="accent-color:#2563eb; margin-right:4px;"/>
                            <span style="font-size:13px; font-weight:700; color:#1e40af;">단면 랙 (Single)</span>
                        </label>
                        <label style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:0.5rem; padding:8px 10px; cursor:pointer; text-align:center;">
                            <input type="radio" name="rackType" style="margin-right:4px;"/>
                            <span style="font-size:13px; font-weight:600; color:#475569;">양면 랙 (Double)</span>
                        </label>
                        <label style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:0.5rem; padding:8px 10px; cursor:pointer; text-align:center;">
                            <input type="radio" name="rackType" style="margin-right:4px;"/>
                            <span style="font-size:13px; font-weight:600; color:#475569;">파렛트 랙 (Pallet)</span>
                        </label>
                        <label style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:0.5rem; padding:8px 10px; cursor:pointer; text-align:center;">
                            <input type="radio" name="rackType" style="margin-right:4px;"/>
                            <span style="font-size:13px; font-weight:600; color:#475569;">하이랙 (High-Bay)</span>
                        </label>
                    </div>
                </div>

                <!-- 2. 행/열 개수 및 사이즈 설정 -->
                <div class="card" style="margin-bottom:0; padding:1.25rem;">
                    <h4 style="font-size:15px; font-weight:700; color:var(--color-primary); margin-bottom:0.75rem;">2. 행/열 개수 및 사이즈 설정</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.75rem;">
                        <div>
                            <label style="font-size:12px; font-weight:600; color:#64748b; display:block; margin-bottom:2px;">행 개수 (Rows)</label>
                            <input type="number" value="4" style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:700; color:#0f172a;"/>
                        </div>
                        <div>
                            <label style="font-size:12px; font-weight:600; color:#64748b; display:block; margin-bottom:2px;">열 개수 (Cols)</label>
                            <input type="number" value="10" style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:700; color:#0f172a;"/>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem;">
                        <div>
                            <label style="font-size:11px; font-weight:600; color:#64748b; display:block; margin-bottom:2px;">너비 (W)</label>
                            <input type="text" value="12.0m" style="width:100%; padding:5px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; font-weight:600; text-align:center;"/>
                        </div>
                        <div>
                            <label style="font-size:11px; font-weight:600; color:#64748b; display:block; margin-bottom:2px;">깊이 (D)</label>
                            <input type="text" value="1.0m" style="width:100%; padding:5px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; font-weight:600; text-align:center;"/>
                        </div>
                        <div>
                            <label style="font-size:11px; font-weight:600; color:#64748b; display:block; margin-bottom:2px;">높이 (H)</label>
                            <input type="text" value="4.5m (4단)" style="width:100%; padding:5px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; font-weight:600; text-align:center;"/>
                        </div>
                    </div>
                </div>

                <!-- 3. 프리팹(Prefab) 저장 및 불러오기 -->
                <div class="card" style="margin-bottom:0; padding:1.25rem;">
                    <h4 style="font-size:15px; font-weight:700; color:var(--color-primary); margin-bottom:0.75rem;">3. 프리팹 (Prefab) 관리</h4>
                    <div style="margin-bottom:0.75rem;">
                        <label style="font-size:12px; font-weight:600; color:#64748b; display:block; margin-bottom:2px;">프리팹 이름 지정</label>
                        <input type="text" value="Standard_Pallet_Rack_V2" style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:600; color:#0f172a; margin-bottom:0.5rem;"/>
                        <div style="display:flex; gap:0.5rem;">
                            <button style="flex:1; background:#059669; color:#fff; border:none; padding:7px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">💾 프리팹 저장</button>
                            <button style="flex:1; background:#0284c7; color:#fff; border:none; padding:7px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">📂 불러오기</button>
                        </div>
                    </div>
                </div>

                <!-- 4. 랙 이동, 배치, 회전, 복제, 삭제 조작 패널 -->
                <div class="card" style="margin-bottom:0; padding:1.25rem; background:#f8fafc;">
                    <h4 style="font-size:15px; font-weight:700; color:var(--color-primary); margin-bottom:0.75rem;">4. 랙 선택 요소 조작 컨트롤러</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                        <button style="background:#fff; border:1px solid #cbd5e1; padding:8px; border-radius:6px; font-size:12px; font-weight:700; color:#334155; cursor:pointer; text-align:left;">✋ 이동 (Move)</button>
                        <button style="background:#fff; border:1px solid #cbd5e1; padding:8px; border-radius:6px; font-size:12px; font-weight:700; color:#334155; cursor:pointer; text-align:left;">📍 Snap 배치 (Place)</button>
                        <button style="background:#fff; border:1px solid #cbd5e1; padding:8px; border-radius:6px; font-size:12px; font-weight:700; color:#334155; cursor:pointer; text-align:left;">🔄 90도 회전 (Rotate)</button>
                        <button style="background:#fff; border:1px solid #cbd5e1; padding:8px; border-radius:6px; font-size:12px; font-weight:700; color:#334155; cursor:pointer; text-align:left;">📋 선택 복제 (Duplicate)</button>
                    </div>
                    <button style="width:100%; background:#fee2e2; border:1px solid #fca5a5; color:#b91c1c; padding:8px; border-radius:6px; font-size:13px; font-weight:700; margin-top:0.5rem; cursor:pointer;">🗑️ 선택한 랙 즉시 삭제 (Delete)</button>
                </div>
            </div>
        </div>

        <!-- Workflow & Specifications Table -->
        <div style="background:#fff; padding:1.5rem; border-radius:0.75rem; border:1px solid rgba(195,198,215,0.4); margin-bottom:1.5rem;">
            <h4 style="font-size:16px; font-weight:700; margin-bottom:1rem; color:var(--color-primary);">저작도구 워크플로우 & 4대 요소 편집 명세</h4>
            <div class="mermaid" style="display:flex; justify-content:center; margin:1rem 0;">
                graph LR
                    Load3D[1. 3D 창고 모델 로딩] --> SelectType[2. 랙 타입 및 규격 설정]
                    SelectType --> Placement[3. 3D 그리드 기반 랙 배치/이동/회전]
                    Placement --> Prefab[4. 랙 프리팹 Prefab 저장]
                    Prefab --> Apply[5. 구역 및 WMS 로케이션 반영]
            </div>

            <div style="overflow-x:auto; margin-top:1.5rem;">
                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                    <thead>
                        <tr style="background-color:var(--color-surface-container-low); border-bottom:2px solid #e5e7eb;">
                            <th style="padding:10px; font-weight:700;">구분</th>
                            <th style="padding:10px; font-weight:700;">편집 요소 명칭</th>
                            <th style="padding:10px; font-weight:700;">세부 기능 및 저작 옵션 명세</th>
                            <th style="padding:10px; font-weight:700;">조작 컨트롤러 / 핫키</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom:1px solid #f0f0f0;">
                            <td style="padding:10px; font-weight:700; color:#2563eb;">1. 랙 타입 선택</td>
                            <td style="padding:10px;">Rack Type Selector</td>
                            <td style="padding:10px;">단면 랙, 양면 랙, 파렛트 랙, 하이랙(High-Bay) 중 창고 목적에 적합한 랙 템플릿 선택</td>
                            <td style="padding:10px;"><span style="background:#eff6ff; color:#1d4ed8; padding:2px 6px; border-radius:4px; font-weight:600;">UI 카드 및 Radio 클릭</span></td>
                        </tr>
                        <tr style="border-bottom:1px solid #f0f0f0;">
                            <td style="padding:10px; font-weight:700; color:#2563eb;">2. 행/열 및 사이즈</td>
                            <td style="padding:10px;">Dimension Editor</td>
                            <td style="padding:10px;">랙의 행(Rows)과 열(Cols) 개수, 가로(Width) x 깊이(Depth) x 높이(Height) 및 단(Level) 수 설정</td>
                            <td style="padding:10px;"><span style="background:#eff6ff; color:#1d4ed8; padding:2px 6px; border-radius:4px; font-weight:600;">숫자 입력 폼 & 슬라이더</span></td>
                        </tr>
                        <tr style="border-bottom:1px solid #f0f0f0;">
                            <td style="padding:10px; font-weight:700; color:#2563eb;">3. 프리팹 관리</td>
                            <td style="padding:10px;">Prefab Manager</td>
                            <td style="padding:10px;">설정 완료된 랙을 프리팹(Prefab) 객체로 저장하여 다른 창고나 층에 재사용 및 불러오기</td>
                            <td style="padding:10px;"><span style="background:#ecfdf5; color:#047857; padding:2px 6px; border-radius:4px; font-weight:600;">[💾 저장] / [📂 불러오기]</span></td>
                        </tr>
                        <tr>
                            <td style="padding:10px; font-weight:700; color:#2563eb;">4. 랙 조작 모드</td>
                            <td style="padding:10px;">3D Transform Gizmo</td>
                            <td style="padding:10px;">3D 공간 상에서 랙의 실시간 위치 이동(Move), 그리드 배치(Snap), 90도 회전(Rotate), 복제(Duplicate), 삭제(Delete)</td>
                            <td style="padding:10px;"><span style="background:#fef2f2; color:#b91c1c; padding:2px 6px; border-radius:4px; font-weight:600;">3D 기즈모 & M/P/R/D/Del</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>

    <!-- TAB 7: ROUTE VIEW -->
    <section id="view-route" class="content-area view-panel" style="display:none;">
        <div class="section-header">
            <div>
                <h3 class="section-title">자재 위치 검색 및 3D 경로 탐색</h3>
                <p class="section-subtitle">출발지-도착지 조건 검색 및 층간 E/V 연계 3D 최적 이동 경로 가이드</p>
            </div>
        </div>

        <div style="background:#fff; padding:1.5rem; border-radius:0.75rem; border:1px solid rgba(195,198,215,0.4); margin-bottom:1.5rem;">
            <h4 style="font-size:16px; font-weight:700; margin-bottom:1rem; color:var(--color-primary);">5단계 경로 탐색 운용 시퀀스</h4>
            <div class="mermaid" style="display:flex; justify-content:center; margin:1rem 0;">
                sequenceDiagram
                    autonumber
                    actor Worker as 작업자
                    participant UI as WMS 3D UI
                    participant System as WMS 경로 엔진

                    Worker->>UI: 1. 선택 층 '포장재' 위치 및 인디케이터 클릭
                    Worker->>UI: 2. 메인 3D 화면 랙 클릭 ➔ 재고 상태 확인
                    Worker->>UI: 3. 도착지 검색창 자재 슬롯 선택 (A01 블랙 Kangol 원단)
                    System->>UI: 4. 선택 자재 여유공간 랙 위치 자동 탐색 (G2D / B2C)
                    System->>UI: 5. 1F 출입구 ➔ 1F E/V ➔ 2F E/V ➔ G2D 3D 동선 가이드 생성
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:1.5rem;">
            <div class="card" style="margin-bottom:0;">
                <h4 class="card-title">실시간 3D 경로 탐색 결과 뷰어</h4>
                <img src="assets/wms/video_frames/video_step_5.jpg" alt="실시간 3D 경로 뷰어" style="width:100%; border-radius:0.5rem; border:1px solid #e5e7eb; margin-top:0.5rem;"/>
            </div>
            <div class="card" style="margin-bottom:0;">
                <h4 class="card-title" style="margin-bottom:0.75rem;">경로 기점 및 Location 명세</h4>
                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                    <thead>
                        <tr style="background-color:var(--color-surface-container-low); border-bottom:2px solid #e5e7eb;">
                            <th style="padding:8px; font-weight:700;">구분</th>
                            <th style="padding:8px; font-weight:700;">기점 명칭</th>
                            <th style="padding:8px; font-weight:700;">상세 위치 정보</th>
                            <th style="padding:8px; font-weight:700;">3D 빌보드</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom:1px solid #f0f0f0;">
                            <td style="padding:10px; font-weight:700; color:#2563eb;">출발지</td>
                            <td style="padding:10px;">1F 출입구</td>
                            <td style="padding:10px;">1F > EAST동 하역 출입구</td>
                            <td style="padding:10px;"><span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:600;">[1F 출입구]</span></td>
                        </tr>
                        <tr style="border-bottom:1px solid #f0f0f0;">
                            <td style="padding:10px; font-weight:700; color:#d97706;">경유지</td>
                            <td style="padding:10px;">1F E/V ➔ 2F E/V</td>
                            <td style="padding:10px;">층간 승강기 수직 이송 동선</td>
                            <td style="padding:10px;"><span style="background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-weight:600;">[1F E/V / 2F E/V]</span></td>
                        </tr>
                        <tr>
                            <td style="padding:10px; font-weight:700; color:#16a34a;">도착지</td>
                            <td style="padding:10px;">G2D / B2C 랙</td>
                            <td style="padding:10px;">2F > 부자재 창고 > G2D 랙</td>
                            <td style="padding:10px;"><span style="background:#dcfce7; color:#15803d; padding:2px 6px; border-radius:4px; font-weight:600;">[G2D]</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>

    <!-- TAB 8: SETTINGS VIEW -->
    <section id="view-settings" class="content-area view-panel" style="display:none;">
        <div class="section-header">
            <div>
                <h3 class="section-title">디지털 트윈 환경 및 시스템 설정</h3>
                <p class="section-subtitle">국가/공장/건물 인디케이터 코드 관리, 3D 뷰포트 옵션 및 사용자 권한</p>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
            <div class="card" style="margin-bottom:0;">
                <h4 class="card-title" style="margin-bottom:0.75rem;">인디케이터 마스터 코드 설정</h4>
                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                    <thead>
                        <tr style="background-color:var(--color-surface-container-low); border-bottom:2px solid #e5e7eb;">
                            <th style="padding:8px; font-weight:700;">국가</th>
                            <th style="padding:8px; font-weight:700;">공장</th>
                            <th style="padding:8px; font-weight:700;">건물</th>
                            <th style="padding:8px; font-weight:700;">층</th>
                            <th style="padding:8px; font-weight:700;">비고</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom:1px solid #f0f0f0;">
                            <td style="padding:10px; font-weight:700;">방글라데시 (BD)</td>
                            <td style="padding:10px;">엑사코 (Exaco)</td>
                            <td style="padding:10px;">EAST 동</td>
                            <td style="padding:10px;">1F, 2F</td>
                            <td style="padding:10px; color:#16a34a; font-weight:600;">메인 창고</td>
                        </tr>
                        <tr>
                            <td style="padding:10px; font-weight:700;">한국 (KR)</td>
                            <td style="padding:10px;">본사 창고</td>
                            <td style="padding:10px;">MAIN 동</td>
                            <td style="padding:10px;">1F</td>
                            <td style="padding:10px; color:#64748b;">R&D 센터</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="card" style="margin-bottom:0;">
                <h4 class="card-title" style="margin-bottom:0.75rem;">사용자 및 권한 설정</h4>
                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                    <thead>
                        <tr style="background-color:var(--color-surface-container-low); border-bottom:2px solid #e5e7eb;">
                            <th style="padding:8px; font-weight:700;">사용자명</th>
                            <th style="padding:8px; font-weight:700;">직책/소속</th>
                            <th style="padding:8px; font-weight:700;">관리 권한</th>
                            <th style="padding:8px; font-weight:700;">상태</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom:1px solid #f0f0f0;">
                            <td style="padding:10px; font-weight:700; color:var(--color-primary);">김프로</td>
                            <td style="padding:10px;">Lead Architect</td>
                            <td style="padding:10px;">전체 시스템 관리자 (System Admin)</td>
                            <td style="padding:10px;"><span style="color:#16a34a; font-weight:600;">● 접속 중</span></td>
                        </tr>
                        <tr>
                            <td style="padding:10px; font-weight:700;">이엔지</td>
                            <td style="padding:10px;">WMS Operator</td>
                            <td style="padding:10px;">랙 배치 & 경로 검색 권한</td>
                            <td style="padding:10px;"><span style="color:#2563eb; font-weight:600;">● 활성</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>
</main>

<button class="fab-btn" title="태스크 추가">
    ${icons.plus}
</button>

<script>
    // SPA Tab Router Implementation
    const navLinks = document.querySelectorAll('.nav-link');
    const viewPanels = document.querySelectorAll('.view-panel');

    const validTabs = ['overview', 'floor', 'zone', 'rack', 'editor', 'route', 'settings', 'dashboard', 'models', 'simulations', 'authoring'];

    function switchTab(tabId) {
        // Alias mappings for backwards compatibility
        if (tabId === 'home') tabId = 'overview';
        if (tabId === 'dashboard') tabId = 'floor';
        if (tabId === 'models') tabId = 'zone';
        if (tabId === 'simulations') tabId = 'rack';
        if (tabId === 'authoring') tabId = 'editor';

        if (!validTabs.includes(tabId)) tabId = 'overview';

        // Update nav links active state
        navLinks.forEach(link => {
            let target = link.getAttribute('data-tab');
            const isTarget = (target === tabId);
            link.classList.toggle('active', isTarget);
            const indicator = link.querySelector('.nav-link-indicator');
            if (indicator) indicator.style.display = isTarget ? 'block' : 'none';
        });

        // Update views
        viewPanels.forEach(panel => {
            panel.style.display = (panel.id === 'view-' + tabId) ? 'block' : 'none';
        });
    }

    // Event Listeners for Nav Links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const tabId = link.getAttribute('data-tab');
            if (!tabId) return;
            e.preventDefault();
            window.location.hash = tabId;
            switchTab(tabId);
        });
    });

    // Handle Hash Change / Back-Forward Navigation
    window.addEventListener('hashchange', () => {
        let hash = window.location.hash.replace('#', '');
        switchTab(hash);
    });

    // Initial Load
    let initialHash = window.location.hash.replace('#', '') || 'overview';
    switchTab(initialHash);

    // Sidebar Collapse Logic
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const hideElements = document.querySelectorAll('.hide-on-collapse');
    let isCollapsed = false;

    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.add('transition-all');
        mainContent.classList.add('transition-all');
        isCollapsed = !isCollapsed;

        if (isCollapsed) {
            sidebar.classList.add('collapsed');
            mainContent.classList.add('collapsed');
            sidebarToggle.setAttribute('data-tooltip', '사이드바 접기');
            hideElements.forEach(el => {
                el.classList.add('opacity-0');
                setTimeout(() => el.classList.add('hidden'), 150);
            });
        } else {
            sidebar.classList.remove('collapsed');
            mainContent.classList.remove('collapsed');
            sidebarToggle.setAttribute('data-tooltip', '사이드바 접기');
            hideElements.forEach(el => {
                el.classList.remove('hidden');
                setTimeout(() => el.classList.remove('opacity-0'), 10);
            });
        }
    });
</script>

<!-- Search Modal Overlay -->
<div id="searchModal" class="search-modal-overlay" style="display:none;">
    <div class="search-modal-container">
        <div class="search-modal-header">
            <div style="display:flex; align-items:center; gap:0.35rem;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <h4 style="font-size:13px; font-weight:700; color:#0f172a; margin:0;">통합 검색</h4>
            </div>
            <button id="searchModalCloseBtn" class="search-modal-close" title="닫기">&times;</button>
        </div>
        <div class="search-modal-body">
            <div class="search-input-wrapper">
                <input type="text" id="searchInput" placeholder="검색어 입력 (예: 랙, 원단)" autocomplete="off"/>
                <button id="searchSubmitBtn" class="btn btn-primary" style="padding: 6px 14px; font-size:12.5px; font-weight:700;">검색</button>
            </div>
            <div id="searchResultsContainer" style="display:none; margin-top:0.75rem;">
                <div id="searchResultsHeader" style="font-size:11.5px; font-weight:700; color:#64748b; margin-bottom:0.4rem;"></div>
                <div id="searchResultsList" class="search-results-list"></div>
            </div>
        </div>
    </div>
</div>

<!-- Notifications Popup Modal -->
<div id="notificationModal" class="search-modal-overlay" style="display:none;">
    <div id="notificationModalContainer" class="search-modal-container notification-modal-container" style="width: 450px;">
        <div id="notificationModalHeader" class="search-modal-header">
            <div style="display:flex; align-items:center; gap:0.35rem;">
                ${icons.bell}
                <h4 style="font-size:13px; font-weight:700; color:#0f172a; margin:0;">업데이트 내역</h4>
            </div>
            <button id="notificationModalCloseBtn" class="search-modal-close" title="닫기">&times;</button>
        </div>
        <div class="search-modal-body" style="padding:0.75rem 0.9rem; max-height: calc(100vh - 120px); overflow-y:auto;">
            <div id="updateItemsList" class="card-list" style="gap:0.5rem; padding-bottom:0;"></div>
            <div id="updateEmptyMessage" style="text-align:center; padding:2rem 1rem; color:#94a3b8; font-size:12.5px;">
                아직 등록된 업데이트 내역이 없습니다.<br>
                <span style="font-size:11.5px; color:#cbd5e1;">본문 텍스트를 드래그하여 업데이트를 등록하세요.</span>
            </div>
        </div>
    </div>
</div>

<!-- Floating Update Register Button -->
<button id="floatingUpdateBtn" style="display:none; position:fixed; z-index:99999; padding:5px 12px; font-size:11.5px; font-weight:700; color:#fff; background:#2563eb; border:none; border-radius:5px; cursor:pointer; box-shadow:0 2px 8px rgba(37,99,235,0.3); white-space:nowrap; transition: opacity 0.15s;">
    📝 업데이트 등록
</button>

<!-- Update Registration Popup Modal -->
<div id="updateRegisterModal" class="search-modal-overlay" style="display:none; z-index:100000;">
    <div id="updateRegisterContainer" class="search-modal-container" style="width:420px; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);">
        <div id="updateRegisterHeader" class="search-modal-header">
            <div style="display:flex; align-items:center; gap:0.35rem;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                <h4 style="font-size:13px; font-weight:700; color:#0f172a; margin:0;">업데이트 내역 등록</h4>
            </div>
            <button id="updateRegisterCloseBtn" class="search-modal-close" title="닫기">&times;</button>
        </div>
        <div class="search-modal-body" style="padding:0.85rem 1rem;">
            <div style="margin-bottom:0.6rem;">
                <label style="font-size:11.5px; font-weight:700; color:#64748b; display:block; margin-bottom:0.3rem;">📌 선택 텍스트</label>
                <div id="updateSelectedText" style="font-size:12.5px; color:#0f172a; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:5px; padding:0.55rem 0.7rem; line-height:1.45; max-height:80px; overflow-y:auto; word-break:break-all;"></div>
            </div>
            <div style="margin-bottom:0.3rem;">
                <label style="font-size:11.5px; font-weight:700; color:#64748b; display:block; margin-bottom:0.3rem;">📍 메뉴 위치</label>
                <div id="updateMenuLocation" style="font-size:12px; color:#475569; background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:0.4rem 0.7rem;"></div>
            </div>
            <div style="margin-bottom:0.75rem; margin-top:0.6rem;">
                <label for="updateDescription" style="font-size:11.5px; font-weight:700; color:#64748b; display:block; margin-bottom:0.3rem;">✏️ 설명</label>
                <textarea id="updateDescription" placeholder="업데이트 설명을 입력하세요..." style="width:100%; min-height:70px; max-height:120px; resize:vertical; font-size:12.5px; color:#0f172a; background:#fff; border:1px solid #cbd5e1; border-radius:5px; padding:0.55rem 0.7rem; line-height:1.45; font-family:inherit; box-sizing:border-box; outline:none; transition:border-color 0.15s;" onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#cbd5e1'"></textarea>
            </div>
            <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                <button id="updateCancelBtn" class="btn btn-secondary" style="padding:6px 16px; font-size:12px; font-weight:600;">취소</button>
                <button id="updateSubmitBtn" class="btn btn-primary" style="padding:6px 16px; font-size:12px; font-weight:700;">등록</button>
            </div>
        </div>
    </div>
</div>

<script>
    // Global Search Engine Logic
    const searchModal = document.getElementById('searchModal');
    const searchModalContainer = document.querySelector('.search-modal-container');
    const searchModalHeader = document.querySelector('.search-modal-header');
    const searchInput = document.getElementById('searchInput');
    const searchSubmitBtn = document.getElementById('searchSubmitBtn');
    const searchModalCloseBtn = document.getElementById('searchModalCloseBtn');
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    const searchResultsHeader = document.getElementById('searchResultsHeader');
    const searchResultsList = document.getElementById('searchResultsList');

    const tabNameMap = {
        'overview': '개요',
        'floor': '층 관리',
        'zone': '범위 관리',
        'rack': '랙 관리',
        'editor': '저작도구',
        'route': '경로 찾기',
        'settings': '시스템 설정'
    };

    let isDraggingModal = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialContainerLeft = 0;
    let initialContainerTop = 0;

    function positionSearchModalNearButton() {
        const searchBtn = document.querySelector('[data-tooltip="검색"]');
        if (searchBtn) {
            const btnRect = searchBtn.getBoundingClientRect();
            searchModalContainer.style.transform = 'none';
            searchModalContainer.style.left = (btnRect.right + 12) + 'px';
            const modalHeight = searchModalContainer.offsetHeight || 280;
            let top = btnRect.bottom - modalHeight;
            top = Math.max(16, Math.min(top, window.innerHeight - modalHeight - 16));
            searchModalContainer.style.top = top + 'px';
            searchModalContainer.style.bottom = 'auto';
        }
    }

    function openSearchModal() {
        closeNotificationModal();
        searchModal.style.display = 'block';
        positionSearchModalNearButton();
        searchInput.focus();
    }

    function closeSearchModal() {
        searchModal.style.display = 'none';
        searchInput.value = '';
        searchResultsContainer.style.display = 'none';
        searchResultsList.innerHTML = '';
        document.querySelectorAll('.search-target-highlight').forEach(function(el) {
            el.classList.remove('search-target-highlight');
        });
    }

    // Draggable Search Modal Header
    searchModalHeader.addEventListener('mousedown', function(e) {
        if (e.target.closest('#searchModalCloseBtn')) return;

        isDraggingModal = true;
        searchModalHeader.style.cursor = 'grabbing';

        const rect = searchModalContainer.getBoundingClientRect();
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialContainerLeft = rect.left;
        initialContainerTop = rect.top;

        searchModalContainer.style.transform = 'none';
        searchModalContainer.style.left = initialContainerLeft + 'px';
        searchModalContainer.style.top = initialContainerTop + 'px';

        document.addEventListener('mousemove', onModalMouseMove);
        document.addEventListener('mouseup', onModalMouseUp);
    });

    function onModalMouseMove(e) {
        if (!isDraggingModal) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;

        let newLeft = initialContainerLeft + dx;
        let newTop = initialContainerTop + dy;

        const maxLeft = window.innerWidth - searchModalContainer.offsetWidth;
        const maxTop = window.innerHeight - searchModalContainer.offsetHeight;

        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        searchModalContainer.style.left = newLeft + 'px';
        searchModalContainer.style.top = newTop + 'px';
    }

    function onModalMouseUp() {
        if (isDraggingModal) {
            isDraggingModal = false;
            searchModalHeader.style.cursor = 'move';
            document.removeEventListener('mousemove', onModalMouseMove);
            document.removeEventListener('mouseup', onModalMouseUp);
        }
    }

    const sidebarSearchBtn = document.getElementById('sidebarSearchBtn');
    const sidebarBellBtn = document.getElementById('sidebarBellBtn');

    if (sidebarSearchBtn) {
        sidebarSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openSearchModal();
        });
    }

    searchModalCloseBtn.addEventListener('click', closeSearchModal);

    // Notification Modal Logic
    const notificationModal = document.getElementById('notificationModal');
    const notificationModalContainer = document.getElementById('notificationModalContainer');
    const notificationModalHeader = document.getElementById('notificationModalHeader');
    const notificationModalCloseBtn = document.getElementById('notificationModalCloseBtn');

    let isDraggingNotification = false;
    let notifStartX = 0, notifStartY = 0, notifInitLeft = 0, notifInitTop = 0;

    function positionNotificationModalNearButton() {
        const bellBtn = document.getElementById('sidebarBellBtn') || document.querySelector('[data-tooltip="업데이트"]');
        if (bellBtn) {
            const btnRect = bellBtn.getBoundingClientRect();
            notificationModalContainer.style.transform = 'none';
            notificationModalContainer.style.left = (btnRect.right + 12) + 'px';
            const modalHeight = notificationModalContainer.offsetHeight || 380;
            let top = btnRect.bottom - modalHeight;
            top = Math.max(16, Math.min(top, window.innerHeight - modalHeight - 16));
            notificationModalContainer.style.top = top + 'px';
            notificationModalContainer.style.bottom = 'auto';
        }
    }

    function openNotificationModal() {
        closeSearchModal();
        notificationModal.style.display = 'block';
        positionNotificationModalNearButton();
    }

    function closeNotificationModal() {
        notificationModal.style.display = 'none';
    }

    if (sidebarBellBtn) {
        sidebarBellBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openNotificationModal();
        });
    }

    if (notificationModalCloseBtn) {
        notificationModalCloseBtn.addEventListener('click', closeNotificationModal);
    }

    if (notificationModalHeader) {
        notificationModalHeader.addEventListener('mousedown', function(e) {
            if (e.target.closest('#notificationModalCloseBtn')) return;
            isDraggingNotification = true;
            notificationModalHeader.style.cursor = 'grabbing';

            const rect = notificationModalContainer.getBoundingClientRect();
            notifStartX = e.clientX;
            notifStartY = e.clientY;
            notifInitLeft = rect.left;
            notifInitTop = rect.top;

            notificationModalContainer.style.transform = 'none';
            notificationModalContainer.style.left = notifInitLeft + 'px';
            notificationModalContainer.style.top = notifInitTop + 'px';

            document.addEventListener('mousemove', onNotifMouseMove);
            document.addEventListener('mouseup', onNotifMouseUp);
        });
    }

    function onNotifMouseMove(e) {
        if (!isDraggingNotification) return;
        const dx = e.clientX - notifStartX;
        const dy = e.clientY - notifStartY;
        let newLeft = notifInitLeft + dx;
        let newTop = notifInitTop + dy;
        const maxLeft = window.innerWidth - notificationModalContainer.offsetWidth;
        const maxTop = window.innerHeight - notificationModalContainer.offsetHeight;
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));
        notificationModalContainer.style.left = newLeft + 'px';
        notificationModalContainer.style.top = newTop + 'px';
    }

    function onNotifMouseUp() {
        if (isDraggingNotification) {
            isDraggingNotification = false;
            notificationModalHeader.style.cursor = 'move';
            document.removeEventListener('mousemove', onNotifMouseMove);
            document.removeEventListener('mouseup', onNotifMouseUp);
        }
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (searchModal && searchModal.style.display !== 'none') closeSearchModal();
            if (notificationModal && notificationModal.style.display !== 'none') closeNotificationModal();
            if (updateRegisterModal && updateRegisterModal.style.display !== 'none') closeUpdateRegisterModal();
        }
    });

    // ==========================================
    // Update Registration System
    // ==========================================
    const updateItemsList = document.getElementById('updateItemsList');
    const updateEmptyMessage = document.getElementById('updateEmptyMessage');
    const floatingUpdateBtn = document.getElementById('floatingUpdateBtn');
    const updateRegisterModal = document.getElementById('updateRegisterModal');
    const updateSelectedText = document.getElementById('updateSelectedText');
    const updateMenuLocation = document.getElementById('updateMenuLocation');
    const updateDescription = document.getElementById('updateDescription');
    const updateSubmitBtn = document.getElementById('updateSubmitBtn');
    const updateCancelBtn = document.getElementById('updateCancelBtn');
    const updateRegisterCloseBtn = document.getElementById('updateRegisterCloseBtn');

    let pendingSelectedText = '';
    let pendingMenuLocation = '';
    const updateEntries = [];

    // Detect current active tab name
    function getCurrentTabName() {
        const activeLink = document.querySelector('.nav-link.active[data-tab]');
        if (activeLink) {
            const tabId = activeLink.getAttribute('data-tab');
            return tabNameMap[tabId] || tabId;
        }
        return '알 수 없음';
    }

    // Show floating button on text selection (mouseup)
    document.addEventListener('mouseup', function(e) {
        // Ignore if inside modals or floating button
        if (e.target.closest('#searchModal') || e.target.closest('#notificationModal') ||
            e.target.closest('#updateRegisterModal') || e.target.closest('#floatingUpdateBtn') ||
            e.target.closest('.sidebar')) return;

        setTimeout(function() {
            const selection = window.getSelection();
            const selectedStr = selection.toString().trim();

            if (selectedStr.length > 0) {
                pendingSelectedText = selectedStr;
                pendingMenuLocation = getCurrentTabName();

                floatingUpdateBtn.style.display = 'block';
                let left = e.clientX + 8;
                let top = e.clientY - 36;
                // Clamp to viewport
                if (left + 160 > window.innerWidth) left = window.innerWidth - 170;
                if (top < 8) top = e.clientY + 12;
                floatingUpdateBtn.style.left = left + 'px';
                floatingUpdateBtn.style.top = top + 'px';
            } else {
                floatingUpdateBtn.style.display = 'none';
            }
        }, 10);
    });

    // Hide floating button on click elsewhere
    document.addEventListener('mousedown', function(e) {
        if (!e.target.closest('#floatingUpdateBtn')) {
            // small delay to let mouseup fire first
            setTimeout(function() {
                const sel = window.getSelection();
                if (!sel || sel.toString().trim().length === 0) {
                    floatingUpdateBtn.style.display = 'none';
                }
            }, 200);
        }
    });

    // Click floating button → open registration modal
    floatingUpdateBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        floatingUpdateBtn.style.display = 'none';
        openUpdateRegisterModal();
    });

    function openUpdateRegisterModal() {
        updateSelectedText.textContent = pendingSelectedText;
        updateMenuLocation.textContent = pendingMenuLocation;
        updateDescription.value = '';
        updateRegisterModal.style.display = 'block';
        setTimeout(function() { updateDescription.focus(); }, 100);
    }

    function closeUpdateRegisterModal() {
        updateRegisterModal.style.display = 'none';
        pendingSelectedText = '';
        pendingMenuLocation = '';
        window.getSelection().removeAllRanges();
    }

    updateRegisterCloseBtn.addEventListener('click', closeUpdateRegisterModal);
    updateCancelBtn.addEventListener('click', closeUpdateRegisterModal);

    // Submit update entry
    updateSubmitBtn.addEventListener('click', function() {
        const selectedText = pendingSelectedText;
        const menuLocation = pendingMenuLocation;
        const description = updateDescription.value.trim();

        if (!selectedText) return;

        const now = new Date();
        const dateStr = now.getFullYear() + '.' +
            String(now.getMonth() + 1).padStart(2, '0') + '.' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0');

        const entry = {
            selectedText: selectedText,
            menuLocation: menuLocation,
            description: description,
            date: dateStr
        };
        updateEntries.unshift(entry);

        renderUpdateItems();
        closeUpdateRegisterModal();
    });

    function renderUpdateItems() {
        updateItemsList.innerHTML = '';
        if (updateEntries.length === 0) {
            updateEmptyMessage.style.display = 'block';
            return;
        }
        updateEmptyMessage.style.display = 'none';

        updateEntries.forEach(function(entry, idx) {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.cssText = 'padding:0.75rem 0.85rem; border-radius:6px; background:#f8fafc; border:1px solid #e2e8f0; margin-bottom:0;';

            let descHtml = '';
            if (entry.description) {
                descHtml = '<p style="font-size:12px; margin:0.25rem 0 0 0; color:#475569; line-height:1.4;">' +
                    entry.description.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>';
            }

            const truncatedText = entry.selectedText.length > 120
                ? entry.selectedText.substring(0, 120) + '...'
                : entry.selectedText;

            card.innerHTML =
                '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">' +
                    '<span style="font-size:11px; font-weight:600; color:#2563eb; background:#eff6ff; padding:1px 6px; border-radius:3px;">' + entry.menuLocation + '</span>' +
                    '<span style="font-size:11px; color:#94a3b8;">' + entry.date + '</span>' +
                '</div>' +
                '<p style="font-size:12.5px; font-weight:600; color:#0f172a; margin:0 0 0.15rem 0; line-height:1.4; word-break:break-all;">"' +
                    truncatedText.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '"</p>' +
                descHtml;

            updateItemsList.appendChild(card);
        });
    }

    // ==========================================
    // Search Engine Logic
    // ==========================================
    function executeSearch() {
        const query = searchInput.value.trim();
        if (!query) {
            searchResultsContainer.style.display = 'none';
            return;
        }

        const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);
        if (keywords.length === 0) return;

        const results = [];
        const seenTexts = new Set();

        Object.keys(tabNameMap).forEach(tabId => {
            const panel = document.getElementById('view-' + tabId);
            if (!panel) return;

            const targets = panel.querySelectorAll('h3, h4, p, th, td, li, .card-title, .card-desc, .section-title, .section-subtitle');
            
            targets.forEach(elem => {
                let text = elem.innerText || elem.textContent;
                if (!text) return;

                text = text.replace(/\s+/g, ' ').trim();
                if (text.length === 0) return;

                const lowerText = text.toLowerCase();
                const matchedKW = keywords.find(kw => lowerText.includes(kw));

                if (matchedKW) {
                    const uniqueKey = tabId + ':' + text;
                    if (seenTexts.has(uniqueKey)) return;
                    seenTexts.add(uniqueKey);

                    let displaySentence = text;
                    if (displaySentence.length > 90) {
                        const kwIdx = lowerText.indexOf(matchedKW);
                        const start = Math.max(0, kwIdx - 25);
                        const end = Math.min(text.length, kwIdx + 65);
                        displaySentence = (start > 0 ? '...' : '') + text.substring(start, end).trim() + (end < text.length ? '...' : '');
                    }

                    let highlightedText = displaySentence;
                    keywords.forEach(function(kw) {
                        if (!kw) return;
                        var lowerKw = kw.toLowerCase();
                        var idx = highlightedText.toLowerCase().indexOf(lowerKw);
                        if (idx !== -1) {
                            var matchedStr = highlightedText.substring(idx, idx + kw.length);
                            highlightedText = highlightedText.substring(0, idx) + '<mark>' + matchedStr + '</mark>' + highlightedText.substring(idx + kw.length);
                        }
                    });

                    results.push({
                        tabId: tabId,
                        tabTitle: tabNameMap[tabId],
                        sentence: highlightedText,
                        targetElement: elem
                    });
                }
            });
        });

        searchResultsContainer.style.display = 'block';
        searchResultsList.innerHTML = '';

        if (results.length === 0) {
            searchResultsHeader.innerText = '검색 결과 (0건)';
            searchResultsList.innerHTML = '<div class="search-result-no-match">"' + query + '"에 대한 검색 결과가 없습니다.</div>';
        } else {
            searchResultsHeader.innerText = '검색 결과 (' + results.length + '건)';
            
            results.forEach(function(res) {
                const card = document.createElement('div');
                card.className = 'search-result-card';
                card.innerHTML = '<div class="search-result-sentence">' + res.sentence + '</div>' +
                    '<div class="search-result-meta">' +
                    '<span class="search-result-badge">' + res.tabTitle + '</span>' +
                    '</div>';

                card.addEventListener('click', () => {
                    document.querySelectorAll('.search-result-card').forEach(function(c) {
                        c.classList.remove('active-result');
                    });
                    card.classList.add('active-result');

                    document.querySelectorAll('.search-target-highlight').forEach(function(el) {
                        el.classList.remove('search-target-highlight');
                    });

                    window.location.hash = res.tabId;
                    switchTab(res.tabId);

                    setTimeout(() => {
                        res.targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        res.targetElement.classList.add('search-target-highlight');
                    }, 100);
                });

                searchResultsList.appendChild(card);
            });
        }

        setTimeout(positionSearchModalNearButton, 10);
    }

    searchSubmitBtn.addEventListener('click', executeSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            executeSearch();
        }
    });
</script>
</body>
</html>`;

fs.writeFileSync('index.html', spaHtml);
console.log('Successfully updated index.html with update registration system!');
