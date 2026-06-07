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

        this.hostSocketId = null;
        this.partyCode = null;

        // ── Match state ──────────────────────────────
        this.matchConfig = { targetWins: 3 };
        this.scores = {};          // { socketId: { wins, draws, losses, points } }
        this.currentRound = 0;
        this.matchOver = false;
        this.startingPlayerIndex = 0; // 0 = X starts, 1 = O starts; alternates
        this.waitingForNextRound = false;
        this.endMatchProposerId = null;   // tracks who proposed ending the match early
        this.messages = [];              // chat history (max 100)
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
        const before = this.players.length;
        this.players = this.players.filter(
            player => player.socketId !== socketId
        );

        if (this.hostSocketId === socketId) {
            this.hostSocketId = this.players[0]?.socketId || null;
        }

        if (this.players.length < 2 && this.state !== 'waiting') {
            this.state = 'waiting';
        }

        return this.players.length !== before;
    }

    isFull() {
        return (
            this.players.length >=
            this.maxPlayers
        );
    }

    resetMatch() {
        this.game = null;
        this.selectedGame = null;
        this.matchOver = false;
        this.currentRound = 0;
        this.scores = {};
        this.waitingForNextRound = false;
        this.startingPlayerIndex = 0;
        this.endMatchProposerId = null;
        this.state = this.players.length >= 2 ? 'lobby' : 'waiting';
    }

    getState() {
        return {
            roomCode:     this.roomCode,
            state:        this.state,
            players:      this.players,   // includes { socketId, nickname }
            maxPlayers:   this.maxPlayers,
            hostSocketId: this.hostSocketId,
            partyCode:    this.partyCode,
            selectedGame: this.selectedGame,
            matchConfig:  this.matchConfig,
            scores:       this.scores,
            currentRound: this.currentRound,
        };
    }

}

module.exports = Room;
