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
    console.log("Client connected:", socket.id);
    console.log("Client IP:", socket.handshake.address);

    socket.on("hello", (message) => {
        console.log("Received:", message);

        socket.emit("hello-response", {
            message: "Hello from Node.js!",
        });
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });
});

server.listen(3000, () => {
    console.log("Server running on port 3000");
});