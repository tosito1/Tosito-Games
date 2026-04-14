/**
 * Admin Migration Script: Seed initial hub items into Firestore.
 * This runs once from the browser console (Admin only) or can be adapted for a script.
 */
async function seedHubItems() {
  const items = [
    { id:'remote', section:'strategy', title:'Mando Mévil', emoji:'📱', desc:'Usa tu smartphone como mando inalámbrico para jugar...', action:'openRemoteModal()', color:'var(--sky)', order:1, visible:true },
    { id:'chess', section:'strategy', title:'Ajedrez Pro', emoji:'♟️', desc:'Juega contra la IA, resuelve puzzles tácticos y compite...', action:"showScreen('lobby')", color:'', order:2, visible:true },
    { id:'ttt', section:'strategy', title:'Tres en Raya', emoji:'❌⭕', desc:'Rápido, letal e icónico. Juega contra la IA...', action:'showTTTScreen()', color:'', order:3, visible:true },
    { id:'damas', section:'strategy', title:'Las Damas', emoji:'🔴', desc:'El clásico juego de estrategia con reglamento oficial...', action:'showCheckersScreen()', color:'', order:4, visible:true },
    
    { id:'stack', section:'arcade', title:'Cyber Stack', emoji:'🧱', desc:'Desafío de equilibrio 3D. Apila bloques de neón...', action:'showStackScreen()', color:'', order:1, visible:true },
    { id:'slither', section:'arcade', title:'Slither Neo', emoji:'🐍', desc:'Evolución multijugador. Consume energía y domina...', action:'showSlitherScreen()', color:'var(--indigo)', order:2, visible:true },
    { id:'hexafalls', section:'arcade', title:'Hexa Falls', emoji:'🏃‍♂️', desc:'Acción multijugador frenética. Esquiva obstáculos...', action:'showHexaFallsScreen()', color:'#f472b6', order:3, visible:true },
    { id:'anomalia', section:'arcade', title:'Anomalía', emoji:'🛸', desc:'Shooter arcade de alta intensidad. Evoluciona tu nave...', action:'showAnomaliaScreen()', color:'#ef4444', order:4, visible:true },
    { id:'turbo', section:'arcade', title:'Turbo Drift', emoji:'🏎️', desc:'Simulador de drift retro. Domina las curvas...', action:'showTurboDriftScreen()', color:'#10b981', order:5, visible:true },
    
    { id:'match3', section:'puzzles', title:'Gem Match Pro', emoji:'💎', desc:'Explosiones de neón y cascadas infinitas...', action:"showLogicGame('match3')", color:'#ec4899', order:1, visible:true },
    { id:'pipes', section:'puzzles', title:'Logic Flow', emoji:'🔌', desc:'Conecta los circuitos rotando las piezas...', action:"showLogicGame('pipes')", color:'#06b6d4', order:2, visible:true },
    { id:'memory', section:'puzzles', title:'Mind Flip', emoji:'🧠', desc:'Entrena tu memoria con parejas de neón...', action:"showLogicGame('memory')", color:'#6366f1', order:3, visible:true },
    { id:'2048', section:'puzzles', title:'2048 Ultra', emoji:'🔢', desc:'Une los números para alcanzar la baldosa 2048...', action:"showLogicGame('2048')", color:'#f97316', order:4, visible:true }
  ];

  console.log("🚀 Seeding Hub Items...");
  for (const item of items) {
    await db.collection('globals').doc('hub_content').collection('items').doc(item.id).set(item);
    console.log(`✅ Seeded: ${item.title}`);
  }
  console.log("✨ Migration Complete!");
}
