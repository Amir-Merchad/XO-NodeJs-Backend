const { Server } = require("socket.io");
const http = require("http");
const express = require("express");
const RoomManager = require("./rooms/roomManager");
const SocialStore = require("./social/socialStore");
const PlayerRegistry = require("./social/playerRegistry");
const PartyManager = require("./social/partyManager");
const registerRoomHandlers = require("./sockets/roomHandler");
const registerGameHandlers = require("./sockets/gameHandler");
const registerChatHandlers = require("./sockets/chatHandler");
const registerSocialHandlers = require("./sockets/socialHandler");
const getVoiceConfig = require("./services/voiceConfig");
const PushService = require("./services/pushService");

const PORT = process.env.PORT || 3000;

async function startServer() {
    const socialStore = await new SocialStore().init();
    const roomManager = new RoomManager();
    const playerRegistry = new PlayerRegistry(socialStore);
    const partyManager = new PartyManager(socialStore);
    const pushService = new PushService();

    const app = express();
    const server = http.createServer(app);

    const io = new Server(server, {
        cors: { origin: "*" },
    });

    io.on("connection", (socket) => {
        console.log(`[CONNECT] ${socket.id}`);

        registerRoomHandlers(io, socket, roomManager, playerRegistry, partyManager);
        registerGameHandlers(io, socket, roomManager);
        registerChatHandlers(io, socket, roomManager);
        registerSocialHandlers(io, socket, playerRegistry, partyManager, roomManager, pushService);

        socket.on('get-voice-config', () => {
            socket.emit('voice-config', getVoiceConfig());
        });

        socket.on("disconnect", () => {
            console.log(`[DISCONNECT] ${socket.id}`);
            const entries = Object.entries(roomManager.rooms);
            for (const [roomCode, room] of entries) {
                const wasInRoom = room.players.some(p => p.socketId === socket.id);
                if (wasInRoom) {
                    room.removePlayer(socket.id);
                    io.to(roomCode).emit('player-disconnected', { socketId: socket.id });
                    if (room.players.length === 0) {
                        roomManager.removeRoom(roomCode);
                        if (room.partyCode) {
                            partyManager.setRoom(room.partyCode, null);
                            const partyState = partyManager.getState(room.partyCode);
                            if (partyState) io.to(`party:${room.partyCode}`).emit('party-state', partyState);
                        }
                    } else {
                        io.to(roomCode).emit('room-state', room.getState());
                    }
                }
            }
        });
    });

    app.get("/", (req, res) => {
        res.send("Game Backend Running");
    });

    app.get("/voice-config", (req, res) => {
        res.json(getVoiceConfig());
    });

    app.get("/social-store-status", async (req, res) => {
        res.json(await socialStore.status());
    });

    app.get("/push-status", (req, res) => {
        res.json({
            ...pushService.status(),
            ...playerRegistry.pushTokenStats(),
        });
    });

    async function shutdown(signal) {
        console.log(`[SHUTDOWN] ${signal}: flushing social store`);
        try {
            await socialStore.flush();
        } catch (error) {
            console.error('[SHUTDOWN] Social store flush failed:', error.message);
        }

        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 5000).unref();
    }

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));

    server.listen(PORT, () => {
        console.log(`Server running on ${PORT}`);
    });
}

startServer().catch((error) => {
    console.error('[STARTUP] Failed to start server:', error);
    process.exit(1);
});
