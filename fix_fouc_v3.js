const fs = require('fs');
const files = ['home.html', 'dashboard.html', 'models.html', 'simulations.html', 'settings.html'];

const oldCssRegex = /        \/\* 페이지 로드 시 부드러운 페이드인 효과로 남은 미세한 렌더링 깜빡임 완벽 차단 \*\/[\s\S]*?@keyframes fadeIn {[\s\S]*?to { opacity: 1; }[\s\S]*?}/;

const newCss = `        /* 페이지 로드 시 부드러운 페이드인 효과 (Tailwind 로딩 완료 후 표시) */
        body {
            opacity: 0;
            transition: opacity 0.4s ease-out;
        }
        body.tailwind-ready {
            opacity: 1;
        }`;

const newScript = `
    <!-- Tailwind CSS 로딩 완료 체크 스크립트 -->
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const twCheckInterval = setInterval(() => {
                const testEl = document.createElement('div');
                testEl.className = 'hidden';
                document.body.appendChild(testEl);
                if (window.getComputedStyle(testEl).display === 'none') {
                    clearInterval(twCheckInterval);
                    document.body.classList.add('tailwind-ready');
                    testEl.remove();
                } else {
                    testEl.remove();
                }
            }, 10);
            setTimeout(() => {
                clearInterval(twCheckInterval);
                document.body.classList.add('tailwind-ready');
            }, 2000);
        });
    </script>
</head>`;

files.forEach(file => {
    let html = fs.readFileSync(file, 'utf-8');
    
    // Replace old CSS
    if (oldCssRegex.test(html)) {
        html = html.replace(oldCssRegex, newCss);
    }
    
    // Inject the check script before </head>
    if (!html.includes('<!-- Tailwind CSS 로딩 완료 체크 스크립트 -->')) {
        html = html.replace('</head>', newScript);
    }
    
    fs.writeFileSync(file, html);
    console.log('Fixed ' + file);
});
