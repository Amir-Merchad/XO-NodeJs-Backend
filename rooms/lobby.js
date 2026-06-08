const XOGame =
    require("../games/xo/xoGame");
const Connect4Game =
    require("../games/connect4/connect4Game");
const GuessNumberGame =
    require("../games/guessNumber/guessNumberGame");
const UnoGame =
    require("../games/uno/unoGame");

class Lobby {

    constructor(room) {
        this.room = room;
    }

    selectGame(gameType) {

        switch (gameType) {

            case "xo":

                this.room.selectedGame =
                    "xo";

                this.room.game =
                    new XOGame();

                return true;

            case "connect4":

                this.room.selectedGame =
                    "connect4";

                this.room.game =
                    new Connect4Game();

                return true;

            case "guess_number":

                this.room.selectedGame =
                    "guess_number";

                this.room.game =
                    new GuessNumberGame();

                return true;

            case "uno":

                this.room.selectedGame =
                    "uno";

                this.room.game =
                    new UnoGame();

                return true;

            default:
                return false;
        }
    }
}

module.exports = Lobby;
