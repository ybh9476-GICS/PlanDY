const fs = require('fs');

const files = ['home.html', 'dashboard.html', 'models.html', 'simulations.html', 'settings.html'];

files.forEach(file => {
    let html = fs.readFileSync(file, 'utf-8');
    
    // 2. Remove transition-all duration-300 from main-content using a more robust Regex
    html = html.replace(
        /<main id="main-content" class="ml-\[260px\] h-screen flex flex-col bg-surface-container-low transition-all duration-300">/,
        '<main id="main-content" class="ml-[260px] h-screen flex flex-col bg-surface-container-low">'
    );
    
    fs.writeFileSync(file, html);
    console.log('Fixed ' + file);
});
