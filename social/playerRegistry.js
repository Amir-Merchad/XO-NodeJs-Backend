/**
 * Tracks every connected socket as a "player" with a shareable playerCode.
 * Friends are stored per-session (no DB — resets on server restart).
 */
class PlayerRegistry {
    constructor() {
        this.players = {};   // socketId  → player object
        this.codeMap  = {};  // playerCode → socketId
    }

    /** Register (or update) a player. Returns the player object. */
    register(socketId, nickname) {
        const existing = this.players[socketId];
        if (existing) {
            existing.nickname = nickname || existing.nickname;
            return existing;
        }
        const playerCode = this._generateCode();
        const player = {
            socketId,
            nickname:    nickname || 'Player',
            playerCode,
            friends:     new Set(),   // Set of playerCodes
        };
        this.players[socketId]    = player;
        this.codeMap[playerCode]  = socketId;
        return player;
    }

    getBySocketId(socketId)  { return this.players[socketId] || null; }
    getByCode(playerCode)    { const sid = this.codeMap[playerCode]; return sid ? this.players[sid] : null; }
    isOnline(playerCode)     { return !!this.codeMap[playerCode]; }

    remove(socketId) {
        const p = this.players[socketId];
        if (!p) return;
        delete this.codeMap[p.playerCode];
        delete this.players[socketId];
    }

    /** Find every player that has `playerCode` in their friends set. */
    whoHasAsFriend(playerCode) {
        return Object.values(this.players).filter(p => p.friends.has(playerCode));
    }

    _generateCode() {
        let code;
        do { code = Math.random().toString(36).substring(2, 8).toUpperCase(); }
        while (this.codeMap[code]);
        return code;
    }
}

module.exports = PlayerRegistry;

