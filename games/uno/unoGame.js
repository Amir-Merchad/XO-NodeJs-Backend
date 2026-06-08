class UnoGame {
    constructor() {
        this.started = false;
        this.winner = null;
        this.currentTurn = 'X';
        this.drawPile = [];
        this.discardPile = [];
        this.hands = { X: [], O: [] };
        this.currentColor = null;
        this.message = '';
    }

    start() {
        this.started = true;
        this.drawPile = this._shuffle(this._buildDeck());
        this.hands = { X: this._drawCards(7), O: this._drawCards(7) };

        let first = this._drawCards(1)[0];
        while (first.type !== 'number') {
            this.drawPile.unshift(first);
            this.drawPile = this._shuffle(this.drawPile);
            first = this._drawCards(1)[0];
        }

        this.discardPile = [first];
        this.currentColor = first.color;
        this.message = 'Match the color or number';
    }

    makeMove(move, player) {
        if (!this.started || this.winner) return false;
        if (player !== this.currentTurn) return false;

        const action = move?.action;
        if (action === 'draw') return this._drawTurn(player);
        if (action === 'play') return this._playCard(player, Number(move.index), move.color);
        return false;
    }

    getState() {
        return this._publicState();
    }

    getStateForPlayer(symbol) {
        const state = this._publicState();
        if (symbol === 'X' || symbol === 'O') {
            state.hand = this.hands[symbol];
            state.myCardCount = this.hands[symbol].length;
            state.opponentCardCount = this.hands[this._other(symbol)].length;
        } else {
            state.hand = [];
            state.myCardCount = 0;
            state.opponentCardCount = 0;
        }
        return state;
    }

    _playCard(player, index, chosenColor) {
        const hand = this.hands[player];
        if (!Number.isInteger(index) || index < 0 || index >= hand.length) return false;

        const card = hand[index];
        if (!this._canPlay(card)) return false;

        hand.splice(index, 1);
        this.discardPile.push(card);
        this.currentColor = card.color === 'wild' ? this._validChosenColor(chosenColor) : card.color;

        if (hand.length === 0) {
            this.winner = player;
            this.message = 'UNO!';
            return true;
        }

        this._applyCardEffect(player, card);
        return true;
    }

    _drawTurn(player) {
        this.hands[player].push(...this._drawCards(1));
        this.currentTurn = this._other(player);
        this.message = `${player} drew a card`;
        return true;
    }

    _applyCardEffect(player, card) {
        const opponent = this._other(player);
        if (card.type === 'draw2') {
            this.hands[opponent].push(...this._drawCards(2));
            this.currentTurn = player;
            this.message = 'Draw two';
            return;
        }
        if (card.type === 'skip' || card.type === 'reverse') {
            this.currentTurn = player;
            this.message = card.type === 'skip' ? 'Skipped' : 'Reversed';
            return;
        }
        if (card.type === 'wild') {
            this.currentTurn = opponent;
            this.message = 'Wild color changed';
            return;
        }

        this.currentTurn = opponent;
        this.message = 'Card played';
    }

    _canPlay(card) {
        const top = this.discardPile[this.discardPile.length - 1];
        if (!top || card.color === 'wild') return true;
        return card.color === this.currentColor || card.value === top.value || card.type === top.type;
    }

    _drawCards(count) {
        const cards = [];
        for (let i = 0; i < count; i++) {
            if (this.drawPile.length === 0) this._recycleDiscardPile();
            const card = this.drawPile.pop();
            if (card) cards.push(card);
        }
        return cards;
    }

    _recycleDiscardPile() {
        const top = this.discardPile.pop();
        this.drawPile = this._shuffle(this.discardPile);
        this.discardPile = top ? [top] : [];
    }

    _publicState() {
        return {
            gameType: 'uno',
            started: this.started,
            winner: this.winner,
            currentTurn: this.currentTurn,
            topCard: this.discardPile[this.discardPile.length - 1] || null,
            currentColor: this.currentColor,
            deckCount: this.drawPile.length,
            discardCount: this.discardPile.length,
            cardCounts: {
                X: this.hands.X.length,
                O: this.hands.O.length,
            },
            message: this.message,
        };
    }

    _buildDeck() {
        const colors = ['red', 'yellow', 'green', 'blue'];
        const deck = [];
        for (const color of colors) {
            deck.push(this._card(color, 'number', 0));
            for (let value = 1; value <= 9; value++) {
                deck.push(this._card(color, 'number', value));
                deck.push(this._card(color, 'number', value));
            }
            for (const type of ['skip', 'reverse', 'draw2']) {
                deck.push(this._card(color, type, type));
                deck.push(this._card(color, type, type));
            }
        }
        for (let i = 0; i < 4; i++) deck.push(this._card('wild', 'wild', 'wild'));
        return deck;
    }

    _card(color, type, value) {
        return {
            id: `${color}-${type}-${value}-${Math.random().toString(36).substring(2, 8)}`,
            color,
            type,
            value,
        };
    }

    _shuffle(cards) {
        const copy = [...cards];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    _other(player) {
        return player === 'X' ? 'O' : 'X';
    }

    _validChosenColor(color) {
        const value = String(color || '').toLowerCase();
        return ['red', 'yellow', 'green', 'blue'].includes(value) ? value : 'red';
    }
}

module.exports = UnoGame;
