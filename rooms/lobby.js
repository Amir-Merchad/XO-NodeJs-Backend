const XOGame =
    require("../games/xo/xoGame");
const Connect4Game =
    require("../games/connect4/connect4Game");

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

            default:
                return false;
        }
    }
}

module.exports = Lobby;
