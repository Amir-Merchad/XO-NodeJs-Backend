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
        const code = String(roomCode || '').trim().toUpperCase();
        return this.rooms[code];
    }

    removeRoom(roomCode) {
        const code = String(roomCode || '').trim().toUpperCase();
        delete this.rooms[code];
    }
}

module.exports = RoomManager;
