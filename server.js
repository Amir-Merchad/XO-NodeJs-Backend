const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const rooms = {};

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

    socket.on("create-room", ({ playerCount }) => {
        const roomCode = generateRoomCode();

        rooms[roomCode] = {
            players: [socket.id],
            playerCount: playerCount,
        };

        socket.join(roomCode);

        console.log(`Room created: ${roomCode}`);

        socket.emit("room-created", {
            roomCode,
        });
    });

    socket.on("join-room", ({ roomCode }) => {
        const room = rooms[roomCode];

        if (!room) {
            socket.emit("join-room-error", {
                message: "Room does not exist",
            });
            return;
        }

        if (room.players.length >= room.playerCount) {
            socket.emit("join-room-error", {
                message: "Room is full",
            });
            return;
        }

        room.players.push(socket.id);

        socket.join(roomCode);

        console.log(
            `Player joined room ${roomCode}`
        );

        io.to(roomCode).emit("player-joined", {
            roomCode,
            playerCount: room.players.length,
        });
    });

    socket.on("hello", (message) => {
        console.log(`[HELLO] ${socket.id}: ${message}`);

        socket.emit("hello-response", {
            message: "Hello from Node.js!",
        });
    });

    socket.on("disconnect", () => {
        console.log(`[DISCONNECT] ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("XO Backend Running 🚀");
});

server.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});