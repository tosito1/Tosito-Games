const fs = require('fs');
const path = require('path');

const mappings = [
    // Higher probability of mojibake
    { from: /Ã¡/g, to: 'á' }, { from: /Ã©/g, to: 'é' }, { from: /Ã­/g, to: 'í' }, { from: /Ã³/g, to: 'ó' }, { from: /Ãº/g, to: 'ú' }, { from: /Ã±/g, to: 'ñ' },
    { from: /Ã /g, to: 'Á' }, { from: /Ã‰/g, to: 'É' }, { from: /Ã /g, to: 'Í' }, { from: /Ã“/g, to: 'Ó' }, { from: /Ãš/g, to: 'Ú' }, { from: /Ã‘/g, to: 'Ñ' },
    { from: /â€”/g, to: '—' }, { from: /âš ï¸ /g, to: '⚠️' }, { from: /ðŸ“±/g, to: '📱' }, { from: /ðŸ•¹ï¸ /g, to: '🕹️' },
    { from: /ðŸ“¡/g, to: '📡' }, { from: /ðŸŽ®/g, to: '🎮' }, { from: /â–²/g, to: '▲' }, { from: /â–¼/g, to: '▼' },
    { from: /â—€/g, to: '◀' }, { from: /â–¶/g, to: '▶' }, { from: /âœ…/g, to: '✅' }, { from: /âœ–ï¸ /g, to: '✖️' },
    { from: /Ã—/g, to: '×' }, { from: /Â°/g, to: '°' }, { from: /Â¿/g, to: '¿' }, { from: /Â¡/g, to: '¡' }
];

function normalize(file) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    mappings.forEach(m => { content = content.split(m.from).join(m.to); });
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`[CLEANED] ${file}`);
    } else {
        console.log(`[OK] ${file}`);
    }
}

const targets = [
    path.join(__dirname, '../public/index.html'),
    path.join(__dirname, '../public/js/app_v80.js'),
    path.join(__dirname, '../public/anomalia_game.html'),
    path.join(__dirname, '../public/slither_game.html'),
    path.join(__dirname, '../public/turbo-drift.html')
];

targets.forEach(normalize);
console.log('Normalization complete.');
