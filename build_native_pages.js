const fs = require('fs');

function getHeader(title) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Planning Hub - ${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
    <link rel="stylesheet" href="style.css"/>
</head>
<body>`;
}

function getSidebar(activePage) {
    return `
<!-- SideNavBar (Fixed) -->
<aside id="sidebar" class="sidebar">
    <div class="sidebar-header">
        <div class="hide-on-collapse">
            <h1 class="sidebar-title">Planning Hub</h1>
            <p class="sidebar-subtitle">Project Orchestration</p>
        </div>
        <button id="sidebarToggle" class="sidebar-toggle-btn">
            <span id="sidebarToggleIcon" class="material-symbols-outlined">menu_open</span>
        </button>
    </div>
    <nav class="nav-menu">
        <a href="home.html" class="nav-link ${activePage === 'home' ? 'active' : ''}">
            ${activePage === 'home' ? '<div class="nav-link-indicator"></div>' : ''}
            <span class="material-symbols-outlined nav-icon">home</span>
            <span class="hide-on-collapse">홈</span>
        </a>
        <a href="dashboard.html" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}">
            ${activePage === 'dashboard' ? '<div class="nav-link-indicator"></div>' : ''}
            <span class="material-symbols-outlined nav-icon">dashboard</span>
            <span class="hide-on-collapse">DT 대시보드</span>
        </a>
        <a href="models.html" class="nav-link ${activePage === 'models' ? 'active' : ''}">
            ${activePage === 'models' ? '<div class="nav-link-indicator"></div>' : ''}
            <span class="material-symbols-outlined nav-icon">3d_rotation</span>
            <span class="hide-on-collapse">3D 모델 관리</span>
        </a>
        <a href="simulations.html" class="nav-link ${activePage === 'simulations' ? 'active' : ''}">
            ${activePage === 'simulations' ? '<div class="nav-link-indicator"></div>' : ''}
            <span class="material-symbols-outlined nav-icon">science</span>
            <span class="hide-on-collapse">시뮬레이션 환경</span>
        </a>
        <a href="settings.html" class="nav-link ${activePage === 'settings' ? 'active' : ''}">
            ${activePage === 'settings' ? '<div class="nav-link-indicator"></div>' : ''}
            <span class="material-symbols-outlined nav-icon">settings</span>
            <span class="hide-on-collapse">시스템 설정</span>
        </a>
    </nav>
    <div class="sidebar-footer">
        <div class="user-profile">
            <img class="avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAfJcygw8Y2iG7jvcpP8IXJA94LX3fd6ATMUbSaN0HBp4ddydfsvweTnbszY9MGJFhAIdaq9fzFMhI1jBMjUIUy10nGCAkzRgzwo99vfDOk7BJa-IC2ydlOn0_K9HKMRTOXlqUkS0lHb4jH96CqOaggpwGgO2DKUnbBl-SzSP-QrfzLFUOCq_YtspPc8zWYxIUF4gswIPH6is_Pf5arnnnd-FhNG4RnIBE6PpYJJ5sEdRfQBeciC70" alt="김프로 사진"/>
            <div class="hide-on-collapse">
                <p class="user-name">김프로</p>
                <p class="user-role">Lead Architect</p>
            </div>
        </div>
    </div>
</aside>`;
}

function getTopHeader(headerTitle) {
    return `
    <header class="top-header">
        <div class="flex items-center">
            <h2 class="page-title">${headerTitle}</h2>
        </div>
        <div class="header-actions">
            <div class="search-box">
                <span class="material-symbols-outlined text-secondary" style="font-size: 20px;">search</span>
                <input type="text" class="search-input" placeholder="업데이트 검색..."/>
            </div>
            <div class="icon-btn-group">
                <button class="icon-btn">
                    <span class="material-symbols-outlined">notifications</span>
                </button>
                <button class="icon-btn">
                    <span class="material-symbols-outlined">help</span>
                </button>
            </div>
        </div>
    </header>`;
}

function getFooterScript() {
    return `
    <script>
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
        const hideElements = document.querySelectorAll('.hide-on-collapse');
        let isCollapsed = false;

        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.add('transition-all');
            mainContent.classList.add('transition-all');
            isCollapsed = !isCollapsed;

            if (isCollapsed) {
                sidebar.classList.add('collapsed');
                mainContent.classList.add('collapsed');
                hideElements.forEach(el => {
                    el.classList.add('opacity-0');
                    setTimeout(() => el.classList.add('hidden'), 150);
                });
                sidebarToggleIcon.textContent = 'menu';
            } else {
                sidebar.classList.remove('collapsed');
                mainContent.classList.remove('collapsed');
                hideElements.forEach(el => {
                    el.classList.remove('hidden');
                    setTimeout(() => el.classList.remove('opacity-0'), 10);
                });
                sidebarToggleIcon.textContent = 'menu_open';
            }
        });
    </script>
</body>
</html>`;
}

// 1. Home Page
const homeContent = `
${getHeader('프로젝트 업데이트 센터')}
${getSidebar('home')}
<main id="main-content" class="main-content">
    ${getTopHeader('프로젝트 업데이트 센터')}
    <section class="content-area">
        <div class="section-header">
            <div>
                <p class="section-category">Timeline</p>
                <h3 class="section-title">최근 30일 활동 내역</h3>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary">
                    <span class="material-symbols-outlined" style="font-size: 18px;">filter_list</span>
                    필터
                </button>
                <button class="btn btn-primary">
                    <span class="material-symbols-outlined" style="font-size: 18px;">add</span>
                    업데이트 기록
                </button>
            </div>
        </div>

        <div class="card-list">
            <!-- Item 1 -->
            <div class="card">
                <div class="card-header">
                    <div class="card-tag-wrapper">
                        <span class="dot dot-primary"></span>
                        <span class="tag-text text-primary">기획/설계</span>
                    </div>
                    <span class="card-date">2024.05.20 14:30</span>
                </div>
                <h4 class="card-title">기획서 초안 작성 및 시스템 요구사항 정의</h4>
                <p class="card-desc">클라우드 기반 프로젝트 오케스트레이션 툴의 핵심 기능 명세 및 엔티티 관계도(ERD) 초안 작업이 완료되었습니다. 다음 미팅에서 이해관계자 검토 예정입니다.</p>
                <div class="card-footer">
                    <div class="avatar-group">
                        <div class="avatar-badge bg-primary-fixed">JD</div>
                        <div class="avatar-badge bg-secondary-fixed">MK</div>
                    </div>
                    <a href="#" class="card-link">
                        바로가기
                        <span class="material-symbols-outlined" style="font-size: 18px;">chevron_right</span>
                    </a>
                </div>
            </div>

            <!-- Item 2 -->
            <div class="card">
                <div class="card-header">
                    <div class="card-tag-wrapper">
                        <span class="dot dot-tertiary"></span>
                        <span class="tag-text text-tertiary">인프라</span>
                    </div>
                    <span class="card-date">2024.05.18 09:15</span>
                </div>
                <h4 class="card-title">스테이징 환경 배포 자동화 파이프라인 구축</h4>
                <p class="card-desc">CI/CD 파이프라인 구성이 완료되어 이제 메인 브랜치 머지 시 자동으로 스테이징 서버에 배포됩니다. 배포 리드타임이 20% 단축되었습니다.</p>
                <div class="card-footer">
                    <div class="avatar-group">
                        <div class="avatar-badge bg-surface-container-highest">SV</div>
                    </div>
                    <a href="#" class="card-link">
                        바로가기
                        <span class="material-symbols-outlined" style="font-size: 18px;">chevron_right</span>
                    </a>
                </div>
            </div>

            <!-- Item 3 -->
            <div class="card">
                <div class="card-header">
                    <div class="card-tag-wrapper">
                        <span class="dot dot-error"></span>
                        <span class="tag-text text-error">QA</span>
                    </div>
                    <span class="card-date">2024.05.15 17:45</span>
                </div>
                <h4 class="card-title">UI 구성요소 접근성 테스트 결과 보고</h4>
                <p class="card-desc">웹 콘텐츠 접근성 지침(WCAG 2.1)을 기준으로 사이드바 내비게이션 및 폼 컨트롤 요소들의 명암비와 키보드 내비게이션 점검을 마쳤습니다.</p>
                <div class="card-footer">
                    <div class="avatar-group">
                        <div class="avatar-badge bg-primary-fixed">TH</div>
                        <div class="avatar-badge bg-tertiary-fixed">JW</div>
                    </div>
                    <a href="#" class="card-link">
                        바로가기
                        <span class="material-symbols-outlined" style="font-size: 18px;">chevron_right</span>
                    </a>
                </div>
            </div>

            <!-- Item 4 -->
            <div class="card">
                <div class="card-header">
                    <div class="card-tag-wrapper">
                        <span class="dot dot-secondary"></span>
                        <span class="tag-text text-secondary">디자인</span>
                    </div>
                    <span class="card-date">2024.05.12 11:00</span>
                </div>
                <h4 class="card-title">통합 대시보드 위젯 라이브러리 가이드 배포</h4>
                <p class="card-desc">데이터 시각화를 위한 차트, 진행률 표시줄 등 범용 대시보드 위젯들의 디자인 가이드라인과 피그마 컴포넌트 라이브러리가 업데이트되었습니다.</p>
                <div class="card-footer">
                    <div class="avatar-group">
                        <div class="avatar-badge bg-secondary-fixed">MK</div>
                    </div>
                    <a href="#" class="card-link">
                        바로가기
                        <span class="material-symbols-outlined" style="font-size: 18px;">chevron_right</span>
                    </a>
                </div>
            </div>
        </div>
    </section>
</main>
<button class="fab-btn">
    <span class="material-symbols-outlined" style="font-size: 28px;">add_task</span>
</button>
${getFooterScript()}`;

fs.writeFileSync('home.html', homeContent);

// Helper for other pages
function generateSimplePage(filename, activeKey, title, headerTitle, subtitle, iconName, placeholderTitle, placeholderDesc) {
    const pageHtml = `
${getHeader(title)}
${getSidebar(activeKey)}
<main id="main-content" class="main-content">
    ${getTopHeader(headerTitle)}
    <section class="content-area">
        <div class="section-header">
            <div>
                <h3 class="section-title">${headerTitle}</h3>
                <p class="section-subtitle">${subtitle}</p>
            </div>
        </div>
        <div class="placeholder-box">
            <div>
                <span class="material-symbols-outlined placeholder-icon">${iconName}</span>
                <p class="placeholder-title">${placeholderTitle}</p>
                <p class="placeholder-desc">${placeholderDesc}</p>
            </div>
        </div>
    </section>
</main>
<button class="fab-btn">
    <span class="material-symbols-outlined" style="font-size: 28px;">add_task</span>
</button>
${getFooterScript()}`;

    fs.writeFileSync(filename, pageHtml);
}

generateSimplePage(
    'dashboard.html',
    'dashboard',
    'DT 대시보드',
    '디지털 트윈 대시보드',
    '전체 시스템 상태 및 주요 지표 요약',
    'analytics',
    '대시보드 위젯 영역',
    '3D 모델링 현황, 활성화된 시뮬레이션 등이 배치됩니다.'
);

generateSimplePage(
    'models.html',
    'models',
    '3D 모델 관리',
    '3D 에셋 및 모델 관리',
    '디지털 트윈 환경에 적용될 3D 객체 카탈로그',
    'view_in_ar',
    '3D 모델 뷰어 및 리스트 영역',
    'glb, obj 등의 3D 에셋 목록 및 상세 뷰어가 렌더링됩니다.'
);

generateSimplePage(
    'simulations.html',
    'simulations',
    '시뮬레이션 환경',
    '시뮬레이션 구동 및 테스트',
    '물리 엔진 파라미터 및 환경 변수 시뮬레이션 상태',
    'science',
    '시뮬레이션 컨트롤 패널',
    '시뮬레이션 구동 로그 및 실시간 현황이 출력됩니다.'
);

generateSimplePage(
    'settings.html',
    'settings',
    '시스템 설정',
    '디지털 트윈 환경 설정',
    '시스템 환경 설정 및 사용자 권한 관리',
    'settings',
    '시스템 설정 옵션 영역',
    '서버 연결 정보, 통합 API 키 관리 설정이 배치됩니다.'
);

console.log('Successfully generated all 5 native CSS pages!');
