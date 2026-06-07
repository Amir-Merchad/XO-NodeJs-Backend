const { Server } = require("socket.io");
const http = require("http");
const express = require("express");
const RoomManager = require("./rooms/roomManager");
const registerRoomHandlers = require("./sockets/roomHandler");
const registerGameHandlers = require("./sockets/gameHandler");

const roomManager = new RoomManager();

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

function generateRoomCode() {
    return Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
}

io.on("connection", (socket) => {
    console.log(`[CONNECT] ${socket.id}`);

    registerRoomHandlers(
        io,
        socket,
        roomManager
    );

    registerGameHandlers(
        io,
        socket,
        roomManager
    );

    socket.on("disconnect", () => {
        console.log(`[DISCONNECT] ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("Game Backend Running 🚀");
});

server.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});