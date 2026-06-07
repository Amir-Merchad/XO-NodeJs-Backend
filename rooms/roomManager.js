const Room = require("./rooms");

class RoomManager {
    constructor() {
        this.rooms = {};
    }

    generateRoomCode() {
        return Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase();
    }

    createRoom(maxPlayers = 2) {
        const roomCode = this.generateRoomCode();

        const room = new Room(
            roomCode,
            maxPlayers
        );

        this.rooms[roomCode] = room;

        return room;
    }

    getRoom(roomCode) {
        return this.rooms[roomCode];
    }

    removeRoom(roomCode) {
        delete this.rooms[roomCode];
    }
}

module.exports = RoomManager;