const fs = require('fs');
const path = require('path');

const mappings = [
    // Spanish Accents (Lower)
    { from: /Ã¡/g, to: 'á' },
    { from: /Ã©/g, to: 'é' },
    { from: /Ã­/g, to: 'í' },
    { from: /Ã³/g, to: 'ó' },
    { from: /Ãº/g, to: 'ú' },
    { from: /Ã±/g, to: 'ñ' },
    
    // Spanish Accents (Upper)
    { from: /Ã…/g, to: 'Á' },
    { from: /Ã‰/g, to: 'É' },
    { from: /Ã /g, to: 'Í' },
    { from: /Ã“/g, to: 'Ó' },
    { from: /Ãš/g, to: 'Ú' },
    { from: /Ã‘/g, to: 'Ñ' },

    // Special Symbols
    { from: /â€”/g, to: '—' },
    { from: /â€“/g, to: '–' },
    { from: /Â¿/g, to: '¿' },
    { from: /Â¡/g, to: '¡' },
    { from: /Â°/g, to: '°' },
    { from: /â€¢/g, to: '•' },

    // Arrows
    { from: /â–²/g, to: '▲' },
    { from: /â–¼/g, to: '▼' },
    { from: /â—€/g, to: '◀' },
    { from: /â–¶/g, to: '▶' },

    // Emojis (Common in project)
    { from: /âš ï¸ /g, to: '⚠️' },
    { from: /ðŸ“±/g, to: '📱' },
    { from: /ðŸ•¹ï¸ /g, to: '🕹️' },
    { from: /ðŸ“¡/g, to: '📡' },
    { from: /ðŸŽ®/g, to: '🎮' },
    { from: /ðŸ“…/g, to: '📅' },
    { from: /ðŸ †/g, to: '🏆' },
    { from: /âš¡/g, to: '⚡' },
    { from: /ðŸ’ª/g, to: '💪' },
    { from: /ðŸŽ¯/g, to: '🎯' },
    { from: /ðŸ§ /g, to: '🧠' }
];

function fixFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    mappings.forEach(m => {
        content = content.replace(m.from, m.to);
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[FIXED] ${filePath}`);
    } else {
        console.log(`[CLEAN] ${filePath} (No mojibake found)`);
    }
}

// target files
const files = [
    path.join(__dirname, '../public/index.html'),
    path.join(__dirname, '../public/js/app_v80.js')
];

files.forEach(fixFile);
console.log("Cleanup complete.");
