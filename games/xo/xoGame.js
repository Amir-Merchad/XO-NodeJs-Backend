class XOGame {
    constructor() {
        this.board = [
            "", "", "",
            "", "", "",
            "", "", ""
        ];

        this.currentTurn = "X";
        this.winner = null;
        this.started = false;
    }

    start() {
        this.started = true;
    }

    makeMove(index, player) {
        if (
            this.board[index] !== '' ||
            this.winner ||
            !this.started
        ) return false;

        if (this.currentTurn !== player) return false;

        this.board[index] = player;
        this.winner = this.checkWinner();

        if (!this.winner) {
            this.currentTurn =
                this.currentTurn === 'X' ? 'O' : 'X';
        }

        return true;
    }

    checkWinner() {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6],
        ];

        for (const [a, b, c] of lines) {
            if (
                this.board[a] &&
                this.board[a] === this.board[b] &&
                this.board[a] === this.board[c]
            ) {
                return this.board[a];
            }
        }

        if (this.board.every(cell => cell !== '')) return 'draw';
        return null;
    }

    getState() {
        return {
            board: this.board,
            currentTurn: this.currentTurn,
            winner: this.winner,
            started: this.started,
        };
    }
}

module.exports = XOGame;