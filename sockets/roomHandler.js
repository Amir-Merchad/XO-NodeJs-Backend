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
}

module.exports = registerRoomHandlers;