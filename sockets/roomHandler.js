function registerRoomHandlers(
    io,
    socket,
    roomManager,
    playerRegistry,
    partyManager
) {
    socket.on("create-room", ({ playerCount, nickname }) => {

        const room = roomManager.createRoom(playerCount || 2);
        const registeredPlayer = playerRegistry?.getBySocketId(socket.id);
        const playerNickname = nickname || registeredPlayer?.nickname || 'Player';

        room.hostSocketId = socket.id;

        room.addPlayer({
            socketId: socket.id,
            nickname: playerNickname,
            playerCode: registeredPlayer?.playerCode,
        });

        socket.join(room.roomCode);

        socket.emit("room-created", { roomCode: room.roomCode, playerCount: room.maxPlayers });

        io.to(room.roomCode).emit("room-state", room.getState());
    });

    socket.on("join-room", ({ roomCode, nickname }) => {

        const normalizedRoomCode = normalizeRoomCode(roomCode);
        const room = roomManager.getRoom(normalizedRoomCode);
        const registeredPlayer = playerRegistry?.getBySocketId(socket.id);
        const playerNickname = nickname || registeredPlayer?.nickname || 'Player';

        if (!room) { socket.emit("join-room-error", { message: "Room does not exist" }); return; }

        const existing = room.players.find(player => player.socketId === socket.id);
        if (existing) {
            existing.nickname = playerNickname;
            existing.playerCode = registeredPlayer?.playerCode || existing.playerCode;
            socket.join(room.roomCode);
            socket.emit("room-joined", { roomCode: room.roomCode, playerCount: room.players.length });
            io.to(room.roomCode).emit("room-state", room.getState());
            return;
        }

        if (room.isFull()) { socket.emit("join-room-error", { message: "Room is full" }); return; }

        room.addPlayer({
            socketId: socket.id,
            nickname: playerNickname,
            playerCode: registeredPlayer?.playerCode,
        });

        socket.join(room.roomCode);

        socket.emit("room-joined", { roomCode: room.roomCode, playerCount: room.players.length });
        io.to(room.roomCode).emit("player-joined", { roomCode: room.roomCode, playerCount: room.players.length });

        io.to(room.roomCode).emit("room-state", room.getState());
    });

    socket.on('get-room-state', ({ roomCode }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;
        socket.emit('room-state', room.getState());
    });

    socket.on('leave-room', ({ roomCode } = {}) => {
        leaveRoom(roomCode);
    });

    socket.on('close-room', ({ roomCode }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;
        if (socket.id !== room.hostSocketId) {
            return;
        }
        io.to(room.roomCode).emit('room-closed', { roomCode: room.roomCode });
        const socketsInRoom = io.sockets.adapter.rooms.get(room.roomCode);
        if (socketsInRoom) {
            socketsInRoom.forEach(sid => {
                const s = io.sockets.sockets.get(sid);
                if (s) s.leave(room.roomCode);
            });
        }

        roomManager.removeRoom(room.roomCode);
        clearPartyRoom(room);
    });

    function leaveRoom(roomCode) {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;

        const removed = room.removePlayer(socket.id);
        if (!removed) return;

        socket.leave(room.roomCode);
        socket.emit('room-left', { roomCode: room.roomCode });

        if (room.players.length === 0) {
            roomManager.removeRoom(room.roomCode);
            clearPartyRoom(room);
            return;
        }

        io.to(room.roomCode).emit('player-disconnected', { socketId: socket.id, left: true });
        io.to(room.roomCode).emit('room-state', room.getState());
    }

    function clearPartyRoom(room) {
        if (!room.partyCode || !partyManager) return;

        partyManager.setRoom(room.partyCode, null);
        const partyState = partyManager.getState(room.partyCode);
        if (partyState) io.to(`party:${room.partyCode}`).emit('party-state', partyState);
    }
}

function normalizeRoomCode(roomCode) {
    return String(roomCode || '').trim().toUpperCase();
}

module.exports = registerRoomHandlers;
