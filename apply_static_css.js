const fs = require('fs');
const files = ['home.html', 'dashboard.html', 'models.html', 'simulations.html', 'settings.html'];

files.forEach(file => {
    let html = fs.readFileSync(file, 'utf-8');
    
    // Replace CDN script, tailwind-config, and inline style block with link to style.css
    const headBlockRegex = /<script src="https:\/\/cdn\.tailwindcss\.com[\s\S]*?<\/style>/;
    if (headBlockRegex.test(html)) {
        html = html.replace(headBlockRegex, '<link rel="stylesheet" href="style.css"/>');
    }
    
    // Remove visibility:hidden from body
    html = html.replace('style="visibility:hidden"', '');
    
    // Remove the reveal script at the end of body if present
    const revealScriptRegex = /\s*<script>\s*window\.addEventListener\('load',[\s\S]*?<\/script>/;
    if (revealScriptRegex.test(html)) {
        html = html.replace(revealScriptRegex, '');
    }
    
    fs.writeFileSync(file, html);
    console.log('Converted ' + file + ' to static CSS');
});
