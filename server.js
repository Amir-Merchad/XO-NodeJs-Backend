const { Server } = require("socket.io");
const http = require("http");
const express = require("express");
const RoomManager = require("./rooms/roomManager");
const PlayerRegistry = require("./social/playerRegistry");
const PartyManager = require("./social/partyManager");
const registerRoomHandlers = require("./sockets/roomHandler");
const registerGameHandlers = require("./sockets/gameHandler");
const registerChatHandlers = require("./sockets/chatHandler");
const registerSocialHandlers = require("./sockets/socialHandler");

const roomManager    = new RoomManager();
const playerRegistry = new PlayerRegistry();
const partyManager   = new PartyManager();

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
});

io.on("connection", (socket) => {
    console.log(`[CONNECT] ${socket.id}`);

    registerRoomHandlers(io, socket, roomManager);
    registerGameHandlers(io, socket, roomManager);
    registerChatHandlers(io, socket, roomManager);
    registerSocialHandlers(io, socket, playerRegistry, partyManager, roomManager);

    socket.on("disconnect", () => {
        console.log(`[DISCONNECT] ${socket.id}`);
        const entries = Object.entries(roomManager.rooms);
        for (const [roomCode, room] of entries) {
            const wasInRoom = room.players.some(p => p.socketId === socket.id);
            if (wasInRoom) {
                room.removePlayer(socket.id);
                io.to(roomCode).emit('player-disconnected', { socketId: socket.id });
                if (room.players.length === 0) roomManager.removeRoom(roomCode);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => { res.send("Game Backend Running 🚀"); });
server.listen(PORT, () => { console.log(`Server running on ${PORT}`); });
