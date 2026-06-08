class Connect4Game {
    constructor() {
        this.rows = 6;
        this.columns = 7;
        this.board = Array(this.rows * this.columns).fill('');
        this.currentTurn = 'X';
        this.winner = null;
        this.winningCells = [];
        this.started = false;
    }

    start() {
        this.started = true;
    }

    makeMove(column, player) {
        const col = Number(column);
        if (!this.started || this.winner || this.currentTurn !== player) return false;
        if (!Number.isInteger(col) || col < 0 || col >= this.columns) return false;

        for (let row = this.rows - 1; row >= 0; row--) {
            const index = this._index(row, col);
            if (this.board[index] === '') {
                this.board[index] = player;
                this._updateWinner(row, col, player);
                if (!this.winner) {
                    this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';
                }
                return true;
            }
        }

        return false;
    }

    getState() {
        return {
            board: this.board,
            currentTurn: this.currentTurn,
            winner: this.winner,
            winningCells: this.winningCells,
            started: this.started,
            rows: this.rows,
            columns: this.columns,
            gameType: 'connect4',
        };
    }

    _updateWinner(row, col, player) {
        const directions = [
            [0, 1],
            [1, 0],
            [1, 1],
            [1, -1],
        ];

        for (const [dr, dc] of directions) {
            const cells = [
                ...this._collect(row, col, player, -dr, -dc).reverse(),
                this._index(row, col),
                ...this._collect(row, col, player, dr, dc),
            ];

            if (cells.length >= 4) {
                this.winner = player;
                this.winningCells = cells.slice(0, 4);
                return;
            }
        }

        if (this.board.every((cell) => cell !== '')) {
            this.winner = 'draw';
        }
    }

    _collect(row, col, player, dr, dc) {
        const cells = [];
        let nextRow = row + dr;
        let nextCol = col + dc;

        while (
            nextRow >= 0 &&
            nextRow < this.rows &&
            nextCol >= 0 &&
            nextCol < this.columns
        ) {
            const index = this._index(nextRow, nextCol);
            if (this.board[index] !== player) break;
            cells.push(index);
            nextRow += dr;
            nextCol += dc;
        }

        return cells;
    }

    _index(row, col) {
        return row * this.columns + col;
    }
}

module.exports = Connect4Game;
