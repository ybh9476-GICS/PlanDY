const fs = require('fs');

const homeHtml = fs.readFileSync('home.html', 'utf-8');

const pages = [
    {
        filename: 'dashboard.html',
        id: 'dashboard.html',
        title: 'DT 대시보드',
        content: `
<section class="flex-1 overflow-y-auto p-8 max-w-[1200px] mx-auto w-full">
<div class="flex justify-between items-end mb-8">
<div>
<h3 class="font-headline-lg text-headline-lg text-on-surface">디지털 트윈 대시보드</h3>
<p class="text-secondary mt-2">전체 시스템 상태 및 주요 지표 요약</p>
</div>
</div>
<div class="bg-white p-12 rounded-xl border border-outline-variant/40 flex items-center justify-center h-[400px]">
<div class="text-center">
<span class="material-symbols-outlined text-[64px] text-outline-variant mb-4">analytics</span>
<p class="text-secondary text-headline-md font-bold">대시보드 위젯 영역</p>
<p class="text-outline text-body-md mt-2">3D 모델링 현황, 활성화된 시뮬레이션 등이 배치됩니다.</p>
</div>
</div>
</section>
`
    },
    {
        filename: 'models.html',
        id: 'models.html',
        title: '3D 모델 관리',
        content: `
<section class="flex-1 overflow-y-auto p-8 max-w-[1200px] mx-auto w-full">
<div class="flex justify-between items-end mb-8">
<div>
<h3 class="font-headline-lg text-headline-lg text-on-surface">3D 에셋 및 모델 관리</h3>
<p class="text-secondary mt-2">디지털 트윈 환경에 적용될 3D 객 카탈로그</p>
</div>
</div>
<div class="bg-white p-12 rounded-xl border border-outline-variant/40 flex items-center justify-center h-[400px]">
<div class="text-center">
<span class="material-symbols-outlined text-[64px] text-outline-variant mb-4">view_in_ar</span>
<p class="text-secondary text-headline-md font-bold">3D 모델 뷰어 및 리스트 영역</p>
<p class="text-outline text-body-md mt-2">glb, obj 등의 3D 에셋 목록 및 상세 뷰어가 렌더링됩니다.</p>
</div>
</div>
</section>
`
    },
    {
        filename: 'simulations.html',
        id: 'simulations.html',
        title: '시뮬레이션 환경',
        content: `
<section class="flex-1 overflow-y-auto p-8 max-w-[1200px] mx-auto w-full">
<div class="flex justify-between items-end mb-8">
<div>
<h3 class="font-headline-lg text-headline-lg text-on-surface">시뮬레이션 구동 및 테스트</h3>
<p class="text-secondary mt-2">물리 엔진 파라미터 및 환경 변수 시뮬레이션 상태</p>
</div>
</div>
<div class="bg-white p-12 rounded-xl border border-outline-variant/40 flex items-center justify-center h-[400px]">
<div class="text-center">
<span class="material-symbols-outlined text-[64px] text-outline-variant mb-4">science</span>
<p class="text-secondary text-headline-md font-bold">시뮬레이션 컨트롤 패널</p>
<p class="text-outline text-body-md mt-2">시뮬레이션 구동 로그 및 실시간 현황이 출력됩니다.</p>
</div>
</div>
</section>
`
    },
    {
        filename: 'settings.html',
        id: 'settings.html',
        title: '시스템 설정',
        content: `
<section class="flex-1 overflow-y-auto p-8 max-w-[1200px] mx-auto w-full">
<div class="flex justify-between items-end mb-8">
<div>
<h3 class="font-headline-lg text-headline-lg text-on-surface">시스템 및 API 설정</h3>
<p class="text-secondary mt-2">사용자 권한, API 키, 인프라 연동 환경 설정</p>
</div>
</div>
<div class="bg-white p-12 rounded-xl border border-outline-variant/40 flex items-center justify-center h-[400px]">
<div class="text-center">
<span class="material-symbols-outlined text-[64px] text-outline-variant mb-4">admin_panel_settings</span>
<p class="text-secondary text-headline-md font-bold">환경 설정 폼(Form)</p>
<p class="text-outline text-body-md mt-2">통합 설정 및 관리자 기능이 제공될 공간입니다.</p>
</div>
</div>
</section>
`
    }
];

const mainContentRegex = /<section class="flex-1 overflow-y-auto p-8 max-w-\[1200px\] mx-auto w-full">[\s\S]*?<\/section>/;

pages.forEach(page => {
    let newHtml = homeHtml;
    
    // 1. Demote home link to inactive
    newHtml = newHtml.replace(
        '<a class="relative flex items-center gap-3 py-3 px-4 rounded-lg bg-secondary-container text-primary font-bold" href="home.html">\\n<div class="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"><\\/div>\\n<span class="material-symbols-outlined shrink-0">home<\\/span>\\n<span class="hide-on-collapse whitespace-nowrap opacity-100 transition-opacity duration-300">홈<\\/span>\\n<\\/a>',
        '<a class="flex items-center gap-3 py-3 px-4 rounded-lg text-secondary hover:bg-surface-container-low transition-colors duration-200" href="home.html">\\n<span class="material-symbols-outlined shrink-0">home</span>\\n<span class="hide-on-collapse whitespace-nowrap opacity-100 transition-opacity duration-300">홈</span>\\n</a>'
    );
    // Safer regex
    const homeActiveRegex = new RegExp('<a class="relative flex items-center gap-3 py-3 px-4 rounded-lg bg-secondary-container text-primary font-bold" href="home.html">\\\\s*<div class="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"><\\\\/div>\\\\s*<span class="material-symbols-outlined shrink-0">home<\\\\/span>\\\\s*<span class="hide-on-collapse whitespace-nowrap opacity-100 transition-opacity duration-300">홈<\\\\/span>\\\\s*<\\\\/a>');
    newHtml = newHtml.replace(
        homeActiveRegex,
        '<a class="flex items-center gap-3 py-3 px-4 rounded-lg text-secondary hover:bg-surface-container-low transition-colors duration-200" href="home.html">\\n<span class="material-symbols-outlined shrink-0">home</span>\\n<span class="hide-on-collapse whitespace-nowrap opacity-100 transition-opacity duration-300">홈</span>\\n</a>'
    );
    
    // 2. Promote target link to active. 
    const targetLinkRegex = new RegExp('<a class="flex items-center gap-3 py-3 px-4 rounded-lg text-secondary hover:bg-surface-container-low transition-colors duration-200" href="' + page.id + '">\\\\s*<span class="material-symbols-outlined shrink-0">([^<]+)<\\\\/span>\\\\s*<span class="hide-on-collapse whitespace-nowrap opacity-100 transition-opacity duration-300">([^<]+)<\\\\/span>\\\\s*<\\\\/a>');
    newHtml = newHtml.replace(
        targetLinkRegex,
        (match, p1, p2) => {
            return '<a class="relative flex items-center gap-3 py-3 px-4 rounded-lg bg-secondary-container text-primary font-bold" href="' + page.id + '">\n' +
                   '<div class="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"></div>\n' +
                   '<span class="material-symbols-outlined shrink-0">' + p1 + '</span>\n' +
                   '<span class="hide-on-collapse whitespace-nowrap opacity-100 transition-opacity duration-300">' + p2 + '</span>\n' +
                   '</a>';
        }
    );
    
    // 3. Replace title tag
    newHtml = newHtml.replace(/<title>.*?<\/title>/, '<title>Planning Hub - ' + page.title + '</title>');

    // 4. Replace header title
    newHtml = newHtml.replace(/<h2 class="font-headline-md text-headline-md font-bold text-on-surface">.*?<\/h2>/, '<h2 class="font-headline-md text-headline-md font-bold text-on-surface">' + page.title + '</h2>');
    
    // 5. Replace main content section
    newHtml = newHtml.replace(mainContentRegex, page.content.trim());
    
    fs.writeFileSync(page.filename, newHtml);
    console.log('Created ' + page.filename);
});
