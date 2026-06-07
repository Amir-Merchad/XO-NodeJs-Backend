function registerGameHandlers(io, socket, roomManager) {
    socket.on("select-game", ({ roomCode, gameType }) => {
        const room = roomManager.getRoom(roomCode);

        if (!room) {
            return;
        }

        const success = room.lobby.selectGame(gameType);

        if (!success) {
            socket.emit(
                "game-selection-error",
                {
                    message: "Unsupported game"
                }
            );

            return;
        }

        io.to(roomCode).emit(
            "game-selected",
            {
                gameType
            }
        );

        io.to(roomCode).emit(
            "room-state",
            room.getState()
        );
    });

    socket.on(
        "start-game",
        ({ roomCode }) => {

            const room = roomManager.getRoom(roomCode);

            if (
                !room ||
                !room.game
            ) {
                return;
            }

            room.game.start();

            io.to(roomCode).emit(
                "game-started",
                room.game.getState()
            );
        }
    );

    socket.on('make-move', ({ roomCode, index }) => {
        const room = roomManager.getRoom(roomCode);

        if (!room || !room.game) return;

        const playerIndex = room.players.findIndex(
            p => p.socketId === socket.id
        );

        if (playerIndex === -1) return;

        const player = playerIndex === 0 ? 'X' : 'O';
        const success = room.game.makeMove(index, player);

        if (!success) {
            socket.emit('move-error', { message: 'Invalid move' });
            return;
        }

        io.to(roomCode).emit('move-made', room.game.getState());

        if (room.game.winner) {
            io.to(roomCode).emit('game-over', {
                winner: room.game.winner,
                board: room.game.board,
            });
        }
    });
}

module.exports = registerGameHandlers;