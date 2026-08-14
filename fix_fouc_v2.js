const fs = require('fs');
const files = ['home.html', 'dashboard.html', 'models.html', 'simulations.html', 'settings.html'];
const cssToInject = `
        /* FOUC 방지용 기본 레이아웃 고정 */
        #sidebar { 
            width: 260px; 
            height: 100vh; 
            position: fixed; 
            left: 0; 
            top: 0; 
            background-color: #f8f9fa;
            border-right: 1px solid rgba(115, 118, 134, 0.3);
            display: flex;
            flex-direction: column;
            padding: 2rem 1rem;
            box-sizing: border-box;
            z-index: 50;
        }
        #sidebar a {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1rem;
            border-radius: 0.5rem;
            text-decoration: none;
        }
        #sidebar .material-symbols-outlined {
            flex-shrink: 0;
        }
        #main-content { 
            margin-left: 260px; 
            min-height: 100vh; 
            display: flex;
            flex-direction: column;
        }
        
        /* 페이지 로드 시 부드러운 페이드인 효과로 남은 미세한 렌더링 깜빡임 완벽 차단 */
        body {
            opacity: 0;
            animation: fadeIn 0.4s ease-out forwards;
        }
        @keyframes fadeIn {
            to { opacity: 1; }
        }
    </style>`;

files.forEach(file => {
    let html = fs.readFileSync(file, 'utf-8');
    
    // Replace the old FOUC block
    const oldBlockRegex = /\/\* FOUC 방지용 기본 레이아웃 고정 \*\/[\s\S]*?<\/style>/;
    if (oldBlockRegex.test(html)) {
        html = html.replace(oldBlockRegex, cssToInject.trim());
        fs.writeFileSync(file, html);
        console.log('Injected advanced CSS to ' + file);
    }
});
