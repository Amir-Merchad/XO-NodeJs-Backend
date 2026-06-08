function registerGameHandlers(io, socket, roomManager) {

    // ── Select game ──────────────────────────────────────────────────────────
    socket.on('select-game', ({ roomCode, gameType }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;
        if (room.hostSocketId && socket.id !== room.hostSocketId) {
            socket.emit('game-selection-error', { message: 'Only the host can choose the game' });
            return;
        }

        const success = room.lobby.selectGame(gameType);
        if (!success) {
            socket.emit('game-selection-error', { message: 'Unsupported game' });
            return;
        }

        io.to(roomCode).emit('game-selected', { gameType });
        io.to(roomCode).emit('room-state', room.getState());
    });

    // ── Start game (round 1) ─────────────────────────────────────────────────
    socket.on('start-game', ({ roomCode, targetWins, targetPoints, gameType }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;
        if (room.hostSocketId && socket.id !== room.hostSocketId) {
            socket.emit('game-start-error', { message: 'Only the host can start the game' });
            return;
        }
        if (room.players.length < 2) {
            socket.emit('game-start-error', { message: 'Need at least two players' });
            return;
        }
        if (gameType || !room.game) {
            const success = room.lobby.selectGame(gameType || room.selectedGame || 'xo');
            if (!success) {
                socket.emit('game-start-error', { message: 'Unsupported game' });
                return;
            }
        }

        room.matchConfig = {
            targetWins: clampTarget(targetWins, 3, 1, 10),
            targetPoints: clampTarget(targetPoints, 9, 3, 60),
        };
        room.currentRound = 1;
        room.matchOver = false;
        room.startingPlayerIndex = 0;
        room.waitingForNextRound = false;

        room.scores = {};
        room.players.forEach(p => {
            room.scores[p.socketId] = { wins: 0, draws: 0, losses: 0, points: 0 };
        });

        room.game.start();

        io.to(roomCode).emit('game-started', {
            ...room.game.getState(),
            gameType: room.selectedGame,
            matchConfig: room.matchConfig,
            scores: room.scores,
            round: room.currentRound,
            players: room.players,
        });
    });

    // ── Make move ────────────────────────────────────────────────────────────
    socket.on('make-move', ({ roomCode, index }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room || !room.game) return;

        const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex === -1 || playerIndex > 1) return;

        const player = playerIndex === 0 ? 'X' : 'O';
        const success = room.game.makeMove(index, player);

        if (!success) {
            socket.emit('move-error', { message: 'Invalid move' });
            return;
        }

        io.to(roomCode).emit('move-made', {
            ...room.game.getState(),
            gameType: room.selectedGame,
        });

        if (room.game.winner) {
            const winner = room.game.winner;

            if (winner === 'draw') {
                room.players.forEach(p => {
                    if (room.scores[p.socketId]) {
                        room.scores[p.socketId].draws++;
                        room.scores[p.socketId].points += 1;
                    }
                });
            } else {
                const winnerIdx = winner === 'X' ? 0 : 1;
                const loserIdx  = 1 - winnerIdx;
                const winnerSid = room.players[winnerIdx]?.socketId;
                const loserSid  = room.players[loserIdx]?.socketId;

                if (winnerSid && room.scores[winnerSid]) {
                    room.scores[winnerSid].wins++;
                    room.scores[winnerSid].points += 3;
                }
                if (loserSid && room.scores[loserSid]) {
                    room.scores[loserSid].losses++;
                }
            }

            let matchWinnerId = null;
            let matchWinnerReason = null;
            for (const p of room.players.slice(0, 2)) {
                const score = room.scores[p.socketId] || {};
                const wins = score.wins || 0;
                const points = score.points || 0;
                if (wins >= room.matchConfig.targetWins || points >= room.matchConfig.targetPoints) {
                    matchWinnerId = p.socketId;
                    matchWinnerReason = points >= room.matchConfig.targetPoints ? 'points' : 'wins';
                    break;
                }
            }

            room.matchOver = !!matchWinnerId;
            room.waitingForNextRound = !room.matchOver;

            io.to(roomCode).emit('round-ended', {
                ...room.game.getState(),
                gameType: room.selectedGame,
                roundWinner: winner,
                scores: room.scores,
                round: room.currentRound,
                matchOver: room.matchOver,
                matchWinnerId,
                matchWinnerReason,
                players: room.players,
                matchConfig: room.matchConfig,
            });
        }
    });

    // ── Next round ───────────────────────────────────────────────────────────
    socket.on('next-round', ({ roomCode }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room || room.matchOver || !room.waitingForNextRound) return;

        const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex === -1 || playerIndex > 1) return;

        room.waitingForNextRound = false;
        room.startingPlayerIndex = 1 - room.startingPlayerIndex;
        room.currentRound++;

        room.lobby.selectGame(room.selectedGame || 'xo');
        room.game.currentTurn = room.startingPlayerIndex === 0 ? 'X' : 'O';
        room.game.start();

        io.to(roomCode).emit('round-started', {
            ...room.game.getState(),
            gameType: room.selectedGame,
            scores: room.scores,
            round: room.currentRound,
            matchConfig: room.matchConfig,
            players: room.players,
        });
    });

    // ── Back to lobby ────────────────────────────────────────────────────────
    socket.on('back-to-lobby', ({ roomCode }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;

        const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex === -1 || (playerIndex > 1 && socket.id !== room.hostSocketId)) return;

        room.resetMatch();

        io.to(roomCode).emit('returned-to-lobby', { roomCode });
        io.to(roomCode).emit('room-state', room.getState());
    });

    // ── Propose ending the current match early (requires both players) ───────
    socket.on('propose-end-match', ({ roomCode }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;

        const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex === -1 || playerIndex > 1) return;

        const other = room.players[playerIndex === 0 ? 1 : 0];
        if (!other) return;

        // Store proposer so the responder can address them
        room.endMatchProposerId = socket.id;

        io.to(other.socketId).emit('end-match-proposed', {
            proposerSocketId: socket.id,
        });

        // Let the proposer know the request was delivered
        socket.emit('end-match-proposal-sent');
    });

    // ── Respond to an end-match proposal ─────────────────────────────────────
    socket.on('respond-end-match', ({ roomCode, accepted }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;

        const proposerId = room.endMatchProposerId;
        room.endMatchProposerId = null;

        if (accepted) {
            room.resetMatch();
            io.to(roomCode).emit('returned-to-lobby', { roomCode });
            io.to(roomCode).emit('room-state', room.getState());
        } else {
            // Notify only the proposer
            if (proposerId) {
                io.to(proposerId).emit('end-match-declined');
            }
        }
    });
}

function clampTarget(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(number)));
}

module.exports = registerGameHandlers;
