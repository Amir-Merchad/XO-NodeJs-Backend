function registerChatHandlers(io, socket, roomManager) {
    function getOther(roomCode) {
        const room = roomManager.getRoom(roomCode);
        if (!room) return null;
        return room.players.find(p => p.socketId !== socket.id) || null;
    }

    function getPlayerInfo(roomCode) {
        const room = roomManager.getRoom(roomCode);
        if (!room) return null;
        const i = room.players.findIndex(p => p.socketId === socket.id);
        if (i === -1) return null;
        return { symbol: i === 0 ? 'X' : 'O', nickname: room.players[i].nickname || 'Player' };
    }

    // ── Text chat ─────────────────────────────────────────────────────────────
    socket.on('send-message', ({ roomCode, text }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room || !text?.trim()) return;
        const info = getPlayerInfo(roomCode);
        if (!info) return;

        const msg = {
            id:        `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            socketId:  socket.id,
            symbol:    info.symbol,
            nickname:  info.nickname,
            text:      text.trim().substring(0, 200),
            timestamp: Date.now(),
        };
        room.messages.push(msg);
        if (room.messages.length > 100) room.messages.shift();
        io.to(roomCode).emit('message-received', msg);
    });

    // ── Quick emoji reaction ──────────────────────────────────────────────────
    socket.on('send-reaction', ({ roomCode, emoji }) => {
        const info = getPlayerInfo(roomCode);
        if (!info) return;
        io.to(roomCode).emit('reaction-received', {
            id:       Date.now() + Math.random(),
            socketId: socket.id,
            symbol:   info.symbol,
            emoji,
        });
    });

    // ── WebRTC voice signaling ────────────────────────────────────────────────
    socket.on('voice-offer', ({ roomCode, offer }) => {
        const other = getOther(roomCode);
        if (other) io.to(other.socketId).emit('voice-offer', { offer, from: socket.id });
    });
    socket.on('voice-answer', ({ roomCode, answer }) => {
        const other = getOther(roomCode);
        if (other) io.to(other.socketId).emit('voice-answer', { answer });
    });
    socket.on('voice-ice', ({ roomCode, candidate }) => {
        const other = getOther(roomCode);
        if (other) io.to(other.socketId).emit('voice-ice', { candidate });
    });
    socket.on('voice-end', ({ roomCode }) => {
        const other = getOther(roomCode);
        if (other) io.to(other.socketId).emit('voice-ended');
    });
    // ── Voice peer mic-state broadcast ────────────────────────────────────────
    socket.on('voice-peer-state', ({ roomCode, active, muted }) => {
        const other = getOther(roomCode);
        if (other) io.to(other.socketId).emit('voice-peer-state', { active, muted });
    });
}

module.exports = registerChatHandlers;
