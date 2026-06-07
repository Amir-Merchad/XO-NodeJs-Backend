const Lobby = require('./lobby');

class Room {
    constructor(roomCode, maxPlayers = 2) {
        this.roomCode = roomCode;

        this.maxPlayers = maxPlayers;

        this.players = [];

        this.selectedGame = null;

        this.game = null;

        this.state = "waiting";

        this.lobby = new Lobby(this);
    }

    addPlayer(player) {
        if (this.isFull()) {
            return false;
        }

        this.players.push(player);

        if (this.players.length >= 2) {
            this.state = "lobby";
        }

        return true;
    }

    removePlayer(socketId) {
        this.players =
            this.players.filter(
                player =>
                    player.socketId !== socketId
            );
    }

    isFull() {
        return (
            this.players.length >=
            this.maxPlayers
        );
    }

    getState() {
        return {
            roomCode:
            this.roomCode,

            state:
            this.state,

            players:
            this.players,

            selectedGame:
            this.selectedGame,
        };
    }


}

module.exports = Room;