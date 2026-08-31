import os

script_content = '''const fs = require('fs');

const icons = {
    logo: `<svg class="brand-logo" viewBox="0 0 153.03 28.13" width="135" height="25" style="display:block;"><g><path fill="#211959" d="M14.26,8.47c-.85.09-1.58.62-1.93,1.4L4.33,28.13h5.59c.88-.06,1.65-.61,2-1.41l8-18.25h-5.66Z"/><path fill="#211959" d="M9.99,8.47h-5.58L.13,18.3c-.34.77,0,1.4.7,1.4h5.58l4.28-9.83c.34-.77,0-1.4-.7-1.4"/><path fill="#b20e10" d="M30.73.04h-5.58l-8.57,19.66h5.59c.84-.09,1.58-.62,1.92-1.4L31.43,1.4c.34-.77,0-1.4-.7-1.4"/><path fill="#b20e10" d="M39.27.04h-5.58l-4.9,11.23h5.58c.85-.09,1.58-.62,1.93-1.4l3.67-8.43c.34-.77,0-1.4-.7-1.4"/><polygon fill="#1d1d1b" points="46.43 17.4 44.68 8.58 49.36 8.58 50.02 14.41 55.83 8.58 59.98 8.58 50.46 17.4 48.26 22.49 44.23 22.49 46.43 17.4"/><path fill="#1d1d1b" d="M74.82,8.58l-3.88,9c-1.75,4-5.67,5.5-9.34,5.5s-6.24-1.55-4.58-5.5l3.89-9h4l-3.8,8.78c-.71,1.81-.24,2.95,1.65,2.95,1.87-.04,3.53-1.2,4.2-2.95l3.8-8.78h4.06Z"/><path fill="#1d1d1b" d="M74.98,22.49l2.15-5h3.16c3.57,0,6.39-1.11,7.84-4.47s-.4-4.47-4-4.47h-7.21l-6,13.91,4.06.03ZM78.29,14.82l1.54-3.54h2.58c1.56.05,1.93.75,1.49,1.77-.55,1.15-1.73,1.85-3,1.77h-2.61Z"/><path fill="#1d1d1b" d="M92.54,22.78c4.72.04,8.97-2.84,10.67-7.25,2-4.59.41-7.24-4.41-7.24-4.72-.05-8.98,2.83-10.67,7.24-2,4.59-.41,7.25,4.41,7.25M98.95,15.59c-.89,2.06-2.51,4.49-5.25,4.49s-2.25-2.43-1.36-4.49,2.55-4.61,5.3-4.61,2.28,2.42,1.28,4.61"/><path fill="#1d1d1b" d="M109.04,22.78c4.72.05,8.98-2.84,10.67-7.25,2-4.59.41-7.24-4.41-7.24-4.72-.05-8.97,2.84-10.67,7.24-2,4.59-.41,7.25,4.41,7.25M115.45,15.59c-.89,2.06-2.51,4.49-5.24,4.49s-2.26-2.43-1.37-4.49,2.56-4.61,5.3-4.61,2.25,2.43,1.31,4.61"/><polygon fill="#1d1d1b" points="124.26 8.58 129.91 8.58 130.31 18.95 130.36 18.9 134.83 8.58 138.46 8.58 132.44 22.49 126.85 22.49 126.52 11.84 126.49 11.84 121.88 22.49 118.25 22.49 124.26 8.58"/><path fill="#1d1d1b" d="M146.72,17.29h-3l1.17-2.7h7l-3.21,7.43c-2.55.49-5.14.74-7.73.76-4.47-.14-6-2.9-4.16-7.25,1.74-4.26,5.82-7.09,10.42-7.24,3.58-.1,7.07.4,5.38,4.45h-4c.38-1.35-.55-1.76-1.88-1.76-2.73,0-4.69,2.3-5.66,4.55-1.18,2.74-.53,4.55,2.37,4.55.74-.02,1.47-.1,2.2-.24l1.1-2.55Z"/></g></svg>`,
    home: `<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
    floor: `<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
    zone: `<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`,
    rack: `<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
    route: `<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    settings: `<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    menu: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`,
    search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    bell: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
    help: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    filter: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>`,
    plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    chevronRight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`
};

const spaHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>유풍 WMS 기획 - 디지털 트윈 오케스트레이션</title>
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
                \${icons.logo}
            </div>
            <p class="sidebar-subtitle" style="margin-top:0.25rem;">유풍 WMS 기획</p>
        </div>
        <button id="sidebarToggle" class="sidebar-toggle-btn" data-tooltip="사이드바 접기">
            \${icons.menu}
        </button>
    </div>
    <nav class="nav-menu">
        <a href="#home" data-tab="home" data-tooltip="홈" class="nav-link active">
            <div class="nav-link-indicator"></div>
            \${icons.home}
            <span class="hide-on-collapse">홈</span>
        </a>
        <a href="#floor" data-tab="floor" data-tooltip="층 관리" class="nav-link">
            <div class="nav-link-indicator" style="display:none;"></div>
            \${icons.floor}
            <span class="hide-on-collapse">층 관리</span>
        </a>
        <a href="#zone" data-tab="zone" data-tooltip="범위 관리" class="nav-link">
            <div class="nav-link-indicator" style="display:none;"></div>
            \${icons.zone}
            <span class="hide-on-collapse">범위 관리</span>
        </a>
        <a href="#rack" data-tab="rack" data-tooltip="구역/랙 관리" class="nav-link">
            <div class="nav-link-indicator" style="display:none;"></div>
            \${icons.rack}
            <span class="hide-on-collapse">구역/랙 관리</span>
        </a>
        <a href="#route" data-tab="route" data-tooltip="경로 찾기" class="nav-link">
            <div class="nav-link-indicator" style="display:none;"></div>
            \${icons.route}
            <span class="hide-on-collapse">경로 찾기</span>
        </a>
        <a href="#settings" data-tab="settings" data-tooltip="시스템 설정" class="nav-link">
            <div class="nav-link-indicator" style="display:none;"></div>
            \${icons.settings}
            <span class="hide-on-collapse">시스템 설정</span>
        </a>
    </nav>
    <div class="sidebar-footer">
        <div class="sidebar-utility-bar">
            <button class="sidebar-action-btn" data-tooltip="검색">
                \${icons.search}
            </button>
            <button class="sidebar-action-btn" data-tooltip="알림">
                \${icons.bell}
            </button>
            <button class="sidebar-action-btn" data-tooltip="도움말">
                \${icons.help}
            </button>
        </div>
        <div class="user-profile" data-tooltip="김프로 (Lead Architect)">
            <img class="avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAfJcygw8Y2iG7jvcpP8IXJA94LX3fd6ATMUbSaN0HBp4ddydfsvweTnbszY9MGJFhAIdaq9fzFMhI1jBMjUIUy10nGCAkzRgzwo99vfDOk7BJa-IC2ydlOn0_K9HKMRTOXlqUkS0lHb4jH96CqOaggpwGgO2DKUnbBl-SzSP-QrfzLFUOCq_YtspPc8zWYxIUF4gswIPH6is_Pf5arnnnd-FhNG4RnIBE6PpYJJ5sEdRfQBeciC70" alt="김프로 사진"/>
            <div class="hide-on-collapse">
                <p class="user-name">김프로</p>
                <p class="user-role">Lead Architect</p>
            </div>
        </div>
    </div>
</aside>

<!-- Main Content Shell -->
<main id="main-content" class="main-content">
    <!-- TAB 1: HOME VIEW -->
    <section id="view-home" class="content-area view-panel">
        <div class="section-header">
            <div>
                <h3 class="section-title">유풍 WMS 프로젝트 센터</h3>
                <p class="section-subtitle">디지털 트윈 기반 창고관리시스템(WMS) 기획 제안 및 핵심 운용 프로세스</p>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary">\${icons.filter} 필터</button>
                <button class="btn btn-primary">\${icons.plus} 기획 제안서 업데이트</button>
            </div>
        </div>

        <div style="margin-bottom: 2rem; background:#fff; padding:1.5rem; border-radius:0.75rem; border:1px solid rgba(195,198,215,0.4);">
            <h4 style="font-size:18px; font-weight:700; margin-bottom:0.75rem; color:var(--color-primary);">시스템 기획 개요 및 프로세스 흐름</h4>
            <p style="color:var(--color-secondary); line-height:1.6; margin-bottom:1.5rem;">
                본 유풍 WMS(Warehouse Management System) 프로젝트는 3D 디지털 트윈 환경을 구축하여 <strong>공장 → 건물 → 층 → 범위 → 구역 → 랙 → 단</strong>에 이르는 로케이션 계층 구조를 직관적으로 조망하고, 최적 자재 배치 및 층간 승강기(E/V) 연계 경로 검색을 제공합니다.
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
                <img src="assets/content/99ac17822cca183bd7d447482ad77b622b4647cb4e9d44ca4f3e3d8555e87ccc.jpg" alt="1F 선택층 현황" style="width:100%; border-radius:0.5rem; border:1px solid #e5e7eb; margin-top:0.75rem;"/>
            </div>
            <div class="card" style="margin-bottom:0;">
                <h4 class="card-title">3D 층간 E/V 연계 최적 경로 가이드</h4>
                <p class="card-desc">1F 출입구부터 1F E/V, 2F E/V를 거쳐 2F 부자재 창고의 G2D 랙까지 이어지는 수평/수직 이동 동선을 3D 그린 라인 및 빌보드로 안내합니다.</p>
                <img src="assets/content/d0413614b3cbd060b3538d11f7dbafb532d97cfc455bf693c58fbf5cd006915c.jpg" alt="3D 최적 경로" style="width:100%; border-radius:0.5rem; border:1px solid #e5e7eb; margin-top:0.75rem;"/>
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

    <!-- TAB 2: FLOOR VIEW -->
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
                <img src="assets/content/844c9f8f3f348ad8e58502382a71382956754cecccd6228cec3b5339f1e0a4e9.png" alt="1F 창고 조감도" style="width:100%; border-radius:0.5rem; border:1px solid #e5e7eb; margin-top:0.5rem;"/>
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

    <!-- TAB 3: ZONE VIEW -->
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
                <img src="assets/content/844c9f8f3f348ad8e58502382a71382956754cecccd6228cec3b5339f1e0a4e9.png" alt="범위 영역 조감" style="width:100%; border-radius:0.5rem; border:1px solid #e5e7eb; margin-top:0.5rem;"/>
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

    <!-- TAB 4: RACK VIEW -->
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
                <img src="assets/content/d0413614b3cbd060b3538d11f7dbafb532d97cfc455bf693c58fbf5cd006915c.jpg" alt="랙 3D 뷰어" style="width:100%; border-radius:0.5rem; border:1px solid #e5e7eb; margin-top:0.5rem;"/>
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

    <!-- TAB 5: ROUTE VIEW -->
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
                <img src="assets/content/d0413614b3cbd060b3538d11f7dbafb532d97cfc455bf693c58fbf5cd006915c.jpg" alt="실시간 3D 경로 뷰어" style="width:100%; border-radius:0.5rem; border:1px solid #e5e7eb; margin-top:0.5rem;"/>
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

    <!-- TAB 6: SETTINGS VIEW -->
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
    \${icons.plus}
</button>

<script>
    // SPA Tab Router Implementation
    const navLinks = document.querySelectorAll('.nav-link');
    const viewPanels = document.querySelectorAll('.view-panel');

    const validTabs = ['home', 'floor', 'zone', 'rack', 'route', 'settings', 'dashboard', 'models', 'simulations'];

    function switchTab(tabId) {
        // Alias mappings for backwards compatibility
        if (tabId === 'dashboard') tabId = 'floor';
        if (tabId === 'models') tabId = 'zone';
        if (tabId === 'simulations') tabId = 'rack';

        if (!validTabs.includes(tabId)) tabId = 'home';

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
            e.preventDefault();
            const tabId = link.getAttribute('data-tab');
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
    let initialHash = window.location.hash.replace('#', '') || 'home';
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
            sidebarToggle.setAttribute('data-tooltip', '사이드바 펼치기');
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
</body>
</html>`;

fs.writeFileSync('index.html', spaHtml);
console.log('Successfully generated complete WMS index.html!');
