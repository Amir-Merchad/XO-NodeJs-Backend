const XOGame =
    require("../games/xo/xoGame");

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

            default:
                return false;
        }
    }
}

module.exports = Lobby;