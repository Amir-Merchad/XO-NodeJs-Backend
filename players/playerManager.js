const Player = require("./player");

class PlayerManager {
    constructor() {
        this.players = {};
    }

    generatePlayerCode() {
        return Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase();
    }

    registerPlayer(
        socketId,
        nickname,
    ) {
        const player =
            new Player(
                socketId,
                nickname,
                this.generatePlayerCode(),
            );

        this.players[socketId] =
            player;

        return player;
    }

    getPlayer(socketId) {
        return this.players[socketId];
    }

    getPlayerByCode(
        playerCode,
    ) {
        return Object.values(
            this.players,
        ).find(
            p =>
                p.playerCode ===
                playerCode,
        );
    }

    removePlayer(
        socketId,
    ) {
        delete this.players[
            socketId
            ];
    }
}

module.exports =
    PlayerManager;