const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

io.on("connection", (socket) => {
    console.log(`[CONNECT] ${socket.id}`);

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