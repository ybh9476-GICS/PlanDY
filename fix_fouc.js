const fs = require('fs');
const files = ['home.html', 'dashboard.html', 'models.html', 'simulations.html', 'settings.html'];
const cssToInject = `
        /* FOUC 방지용 기본 레이아웃 고정 */
        #sidebar { width: 260px; height: 100vh; position: fixed; left: 0; top: 0; }
        #main-content { margin-left: 260px; min-height: 100vh; }
    </style>`;

files.forEach(file => {
    let html = fs.readFileSync(file, 'utf-8');
    if (!html.includes('/* FOUC 방지용 기본 레이아웃 고정 */')) {
        html = html.replace('</style>', cssToInject);
        fs.writeFileSync(file, html);
        console.log('Injected CSS to ' + file);
    }
});
