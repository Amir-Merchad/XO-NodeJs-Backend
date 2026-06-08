class GuessNumberGame {
    constructor() {
        this.currentTurn = 'X';
        this.started = false;
        this.winner = null;
        this.rangeMin = 1;
        this.rangeMax = 100;
        this.secrets = { X: null, O: null };
        this.guesses = [];
    }

    start() {
        this.started = true;
    }

    makeMove(move, player) {
        if (!this.started || this.winner) return false;
        if (player !== 'X' && player !== 'O') return false;

        const action = move?.action;
        const value = this._readNumber(move?.value ?? move?.index);

        if (action === 'set-secret') {
            return this._setSecret(player, value);
        }

        if (action === 'guess') {
            return this._guess(player, value);
        }

        return false;
    }

    getState() {
        return {
            gameType: 'guess_number',
            currentTurn: this.currentTurn,
            winner: this.winner,
            started: this.started,
            phase: this._bothReady() ? 'guessing' : 'setup',
            rangeMin: this.rangeMin,
            rangeMax: this.rangeMax,
            ready: {
                X: this.secrets.X !== null,
                O: this.secrets.O !== null,
            },
            guesses: this.guesses,
        };
    }

    _setSecret(player, value) {
        if (!this._isValidNumber(value)) return false;
        if (this.secrets[player] !== null) return false;

        this.secrets[player] = value;
        return true;
    }

    _guess(player, value) {
        if (!this._bothReady()) return false;
        if (this.currentTurn !== player) return false;
        if (!this._isValidNumber(value)) return false;

        const opponent = player === 'X' ? 'O' : 'X';
        const target = this.secrets[opponent];
        const result = value === target ? 'correct' : value < target ? 'higher' : 'lower';

        this.guesses.push({
            player,
            guess: value,
            result,
            timestamp: Date.now(),
        });

        if (result === 'correct') {
            this.winner = player;
        } else {
            this.currentTurn = opponent;
        }

        return true;
    }

    _bothReady() {
        return this.secrets.X !== null && this.secrets.O !== null;
    }

    _isValidNumber(value) {
        return Number.isInteger(value) && value >= this.rangeMin && value <= this.rangeMax;
    }

    _readNumber(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return NaN;
        return Math.floor(number);
    }
}

module.exports = GuessNumberGame;
