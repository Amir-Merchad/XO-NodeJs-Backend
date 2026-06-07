class PlayerRegistry {
    constructor() {
        this.players = {};
        this.codeMap = {};
        this.profiles = {};
    }

    register(socketId, nickname) {
        const existing = this.players[socketId];
        if (existing) {
            existing.nickname = this._sanitizeNickname(nickname) || existing.nickname;
            this._saveProfile(existing);
            return existing;
        }

        const playerCode = this._generateCode();
        const player = {
            socketId,
            nickname: this._sanitizeNickname(nickname) || 'Player',
            playerCode,
            friends: new Set(),
            incomingFriendRequests: new Set(),
            outgoingFriendRequests: new Set(),
        };

        this.players[socketId] = player;
        this.codeMap[playerCode] = socketId;
        this._saveProfile(player);
        return player;
    }

    getBySocketId(socketId) {
        return this.players[socketId] || null;
    }

    getByCode(playerCode) {
        const code = this._normalizeCode(playerCode);
        const sid = this.codeMap[code];
        return sid ? this.players[sid] : null;
    }

    getProfile(playerCode) {
        return this.profiles[this._normalizeCode(playerCode)] || null;
    }

    isOnline(playerCode) {
        return !!this.codeMap[this._normalizeCode(playerCode)];
    }

    getFriends(player) {
        if (!player) return [];

        return Array.from(player.friends).map((code) => {
            const online = this.getByCode(code);
            const profile = this.getProfile(code);
            return {
                playerCode: code,
                nickname: online?.nickname || profile?.nickname || 'Unknown Player',
                isOnline: !!online,
            };
        });
    }

    getIncomingRequests(player) {
        if (!player) return [];

        return Array.from(player.incomingFriendRequests).map((code) => {
            const online = this.getByCode(code);
            const profile = this.getProfile(code);
            return {
                playerCode: code,
                nickname: online?.nickname || profile?.nickname || 'Unknown Player',
                isOnline: !!online,
            };
        });
    }

    getOutgoingRequests(player) {
        if (!player) return [];

        return Array.from(player.outgoingFriendRequests).map((code) => {
            const online = this.getByCode(code);
            const profile = this.getProfile(code);
            return {
                playerCode: code,
                nickname: online?.nickname || profile?.nickname || 'Unknown Player',
                isOnline: !!online,
            };
        });
    }

    requestFriend(sender, targetCode) {
        const code = this._normalizeCode(targetCode);
        const target = this.getByCode(code);

        if (!sender) return { ok: false, message: 'Register first' };
        if (!target) return { ok: false, message: 'Player not found or offline' };
        if (sender.playerCode === target.playerCode) return { ok: false, message: "You can't add yourself" };
        if (sender.friends.has(target.playerCode)) return { ok: false, message: 'Already friends' };

        if (sender.incomingFriendRequests.has(target.playerCode)) {
            return this.acceptFriend(sender, target.playerCode);
        }

        sender.outgoingFriendRequests.add(target.playerCode);
        target.incomingFriendRequests.add(sender.playerCode);

        return { ok: true, sender, target, autoAccepted: false };
    }

    acceptFriend(receiver, senderCode) {
        const code = this._normalizeCode(senderCode);
        const sender = this.getByCode(code);

        if (!receiver) return { ok: false, message: 'Register first' };
        if (!sender) return { ok: false, message: 'Player not found or offline' };
        if (!receiver.incomingFriendRequests.has(sender.playerCode) && !sender.outgoingFriendRequests.has(receiver.playerCode)) {
            return { ok: false, message: 'No pending request from this player' };
        }

        receiver.incomingFriendRequests.delete(sender.playerCode);
        receiver.outgoingFriendRequests.delete(sender.playerCode);
        sender.incomingFriendRequests.delete(receiver.playerCode);
        sender.outgoingFriendRequests.delete(receiver.playerCode);

        receiver.friends.add(sender.playerCode);
        sender.friends.add(receiver.playerCode);

        return { ok: true, receiver, sender, autoAccepted: true };
    }

    rejectFriend(receiver, senderCode) {
        const code = this._normalizeCode(senderCode);
        const sender = this.getByCode(code);

        if (!receiver) return { ok: false, message: 'Register first' };

        receiver.incomingFriendRequests.delete(code);
        if (sender) sender.outgoingFriendRequests.delete(receiver.playerCode);

        return { ok: true, receiver, senderCode: code, sender };
    }

    removeFriend(player, friendCode) {
        const code = this._normalizeCode(friendCode);
        const friend = this.getByCode(code);

        if (!player) return { ok: false, message: 'Register first' };

        player.friends.delete(code);
        player.incomingFriendRequests.delete(code);
        player.outgoingFriendRequests.delete(code);

        if (friend) {
            friend.friends.delete(player.playerCode);
            friend.incomingFriendRequests.delete(player.playerCode);
            friend.outgoingFriendRequests.delete(player.playerCode);
        }

        return { ok: true, player, friend };
    }

    toPublicPlayer(player) {
        if (!player) return null;

        return {
            socketId: player.socketId,
            nickname: player.nickname,
            playerCode: player.playerCode,
        };
    }

    remove(socketId) {
        const player = this.players[socketId];
        if (!player) return;

        this._saveProfile(player);
        delete this.codeMap[player.playerCode];
        delete this.players[socketId];
    }

    whoHasAsFriend(playerCode) {
        const code = this._normalizeCode(playerCode);
        return Object.values(this.players).filter((player) => player.friends.has(code));
    }

    _generateCode() {
        let code;
        do {
            code = Math.random().toString(36).substring(2, 8).toUpperCase();
        } while (this.codeMap[code]);
        return code;
    }

    _normalizeCode(playerCode) {
        return String(playerCode || '').trim().toUpperCase();
    }

    _sanitizeNickname(nickname) {
        const value = String(nickname || '').trim();
        if (!value) return '';
        return value.substring(0, 18);
    }

    _saveProfile(player) {
        this.profiles[player.playerCode] = {
            playerCode: player.playerCode,
            nickname: player.nickname,
            lastSeen: Date.now(),
        };
    }
}

module.exports = PlayerRegistry;
