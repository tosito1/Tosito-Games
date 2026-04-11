const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../public/js/app_v80.js');
let js = fs.readFileSync(jsPath, 'utf8');

const replacements = [
    { from: 'window.showLogicGame = function(gameId = null) {', to: "window.showLogicGame = function(gameId = null) {\n  if(typeof signalRemoteLayout==='function') signalRemoteLayout('gaming');" },
    { from: 'window.exitLogicMaster = function() {', to: "window.exitLogicMaster = function() {\n  if(typeof signalRemoteLayout==='function') signalRemoteLayout('simple');" },
    { from: 'window.showStackScreen = function() {', to: "window.showStackScreen = function() {\n  if(typeof signalRemoteLayout==='function') signalRemoteLayout('gaming');" },
    { from: 'window.showHexaFallsScreen = function() {', to: "window.showHexaFallsScreen = function() {\n  if(typeof signalRemoteLayout==='function') signalRemoteLayout('gaming');" },
    { from: "if (event.data === 'exit_game') {", to: "if (event.data === 'exit_game') {\n    if(typeof signalRemoteLayout==='function') signalRemoteLayout('simple');" }
];

replacements.forEach(r => {
    if (js.includes(r.from) && !js.includes(r.to)) {
        js = js.replace(r.from, r.to);
        console.log(`[INJECTED] Signal for: ${r.from.substring(0, 30)}...`);
    }
});

fs.writeFileSync(jsPath, js, 'utf8');
console.log('Injections complete.');
