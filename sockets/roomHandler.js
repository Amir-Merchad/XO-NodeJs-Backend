function registerRoomHandlers(
    io,
    socket,
    roomManager
) {
    socket.on("create-room", ({ playerCount }) => {

        const room = roomManager.createRoom( playerCount || 2);

        room.addPlayer({
            socketId: socket.id,
        });

        socket.join(room.roomCode);

        socket.emit(
            "room-created",
            {
                roomCode:
                room.roomCode,
                playerCount:
                room.maxPlayers
            }
        );

        io.to(room.roomCode).emit(
            "room-state",
            room.getState()
        );
    });

    socket.on("join-room", ({ roomCode }) => {

        const room =
            roomManager.getRoom(
                roomCode
            );

        if (!room) {
            socket.emit(
                "join-room-error",
                {
                    message:
                        "Room does not exist"
                }
            );

            return;
        }

        if (room.isFull()) {
            socket.emit(
                "join-room-error",
                {
                    message:
                        "Room is full"
                }
            );

            return;
        }

        room.addPlayer({
            socketId: socket.id,
        });

        socket.join(roomCode);

        io.to(roomCode).emit(
            "player-joined",
            {
                roomCode,
                playerCount:
                room.players.length
            }
        );

        io.to(roomCode).emit(
            "room-state",
            room.getState()
        );

    });
    // ── Get current room state (used by lobby on re-mount) ──────────────────
    socket.on('get-room-state', ({ roomCode }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;
        socket.emit('room-state', room.getState());
    });

    // ── Close room (any player; removes room and sends everyone home) ────────
    socket.on('close-room', ({ roomCode }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;

        // Notify everyone before removing
        io.to(roomCode).emit('room-closed', { roomCode });

        // Drop all sockets from the Socket.IO room
        const socketsInRoom = io.sockets.adapter.rooms.get(roomCode);
        if (socketsInRoom) {
            socketsInRoom.forEach(sid => {
                const s = io.sockets.sockets.get(sid);
                if (s) s.leave(roomCode);
            });
        }

        roomManager.removeRoom(roomCode);
    });
}

module.exports = registerRoomHandlers;