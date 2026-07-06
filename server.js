const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let gameState = null;
const players = new Map();
const gameRooms = new Map();

console.log('🎮 PAY DAY Multiplayer Server Starting...');

wss.on('connection', (ws) => {
  const playerId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  
  console.log(`✅ New connection: ${playerId}`);
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      if (msg.type === 'join') {
        const roomId = msg.roomId || 'default';
        if (!gameRooms.has(roomId)) {
          gameRooms.set(roomId, new Map());
        }
        gameRooms.get(roomId).set(playerId, { ws, name: msg.playerName });
        ws.playerId = playerId;
        ws.roomId = roomId;
        
        console.log(`[${roomId}] 👤 ${msg.playerName} joined. Total: ${gameRooms.get(roomId).size}`);
        
        // Notify all players in this room
        const roomPlayers = Array.from(gameRooms.get(roomId).values()).map(p => p.name);
        broadcastToRoom(roomId, { type: 'playerJoined', players: roomPlayers, playerId });
      }
      
      if (msg.type === 'gameStateUpdate') {
        gameState = msg.data;
        const roomId = ws.roomId || 'default';
        broadcastToRoom(roomId, { type: 'gameStateSync', data: gameState }, playerId);
      }
      
      if (msg.type === 'action') {
        const roomId = ws.roomId || 'default';
        broadcastToRoom(roomId, { type: 'playerAction', action: msg.action, playerId }, playerId);
      }
    } catch (e) {
      console.error('❌ Message error:', e.message);
    }
  });

  ws.on('close', () => {
    const roomId = ws.roomId || 'default';
    if (gameRooms.has(roomId)) {
      const playerName = gameRooms.get(roomId).get(playerId)?.name || 'Unknown';
      gameRooms.get(roomId).delete(playerId);
      const roomPlayers = Array.from(gameRooms.get(roomId).values()).map(p => p.name);
      broadcastToRoom(roomId, { type: 'playerLeft', players: roomPlayers });
      console.log(`[${roomId}] 👋 ${playerName} disconnected. Remaining: ${gameRooms.get(roomId).size}`);
    }
  });

  ws.on('error', (err) => {
    console.error(`❌ WebSocket error (${playerId}):`, err.message);
  });
});

function broadcastToRoom(roomId, msg, excludePlayerId = null) {
  if (!gameRooms.has(roomId)) return;
  gameRooms.get(roomId).forEach((player, id) => {
    if (id !== excludePlayerId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(msg));
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎮 PAY DAY Server running!`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}`);
  console.log(`🔗 Network: Find your IP with 'ipconfig' (Windows) or 'ifconfig' (Mac/Linux)`);
  console.log(`   Then use: http://<your-ip>:${PORT}\n`);
});
