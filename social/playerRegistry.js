class PlayerRegistry {
    constructor(store) {
        this.store = store;
        this.players = {};
        this.codeMap = {};
        this.clientMap = {};
        this.profiles = store?.getState().profiles || {};

        for (const profile of Object.values(this.profiles)) {
            if (profile.clientId) this.clientMap[profile.clientId] = profile.playerCode;
        }
    }

    register(socketId, nickname, clientId, existingPlayerCode) {
        const existing = this.players[socketId];
        if (existing) {
            existing.nickname = this._sanitizeNickname(nickname) || existing.nickname;
            this._syncPlayerToProfile(existing);
            return existing;
        }

        const cleanClientId = this._sanitizeToken(clientId) || this._generateClientId();
        const requestedCode = this._normalizeCode(existingPlayerCode);
        const restoredCode = this.clientMap[cleanClientId] || (requestedCode && this.profiles[requestedCode] ? requestedCode : null);
        const playerCode = restoredCode || this._generateCode();
        const profile = this._ensureProfile(playerCode, cleanClientId, nickname);

        profile.clientId = profile.clientId || cleanClientId;
        profile.nickname = this._sanitizeNickname(nickname) || profile.nickname || 'Player';
        profile.lastSeen = Date.now();
        this.clientMap[profile.clientId] = playerCode;

        const previousSocketId = this.codeMap[playerCode];
        if (previousSocketId && previousSocketId !== socketId) {
            delete this.players[previousSocketId];
        }

        const player = this._profileToPlayer(profile, socketId);
        this.players[socketId] = player;
        this.codeMap[playerCode] = socketId;
        this._save();
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

    getDirectMessages(playerCode, withPlayerCode) {
        const thread = this._dmThreadKey(playerCode, withPlayerCode);
        return this.store?.getState().dmThreads[thread] || [];
    }

    addDirectMessage(sender, targetCode, text) {
        const targetProfile = this.getProfile(targetCode);
        const value = String(text || '').trim();
        if (!sender || !targetProfile || !value) return null;

        const message = {
            id: `dm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            fromCode: sender.playerCode,
            fromNickname: sender.nickname,
            toCode: targetProfile.playerCode,
            toNickname: targetProfile.nickname,
            text: value.substring(0, 500),
            timestamp: Date.now(),
        };

        const threads = this.store.getState().dmThreads;
        const thread = this._dmThreadKey(sender.playerCode, targetProfile.playerCode);
        threads[thread] = threads[thread] || [];
        threads[thread].push(message);
        if (threads[thread].length > 200) threads[thread].shift();
        this._save();
        return message;
    }

    requestFriend(sender, targetCode) {
        const code = this._normalizeCode(targetCode);
        const targetProfile = this.getProfile(code);
        const targetOnline = this.getByCode(code);

        if (!sender) return { ok: false, message: 'Register first' };
        if (!targetProfile) return { ok: false, message: 'Player not found' };
        if (sender.playerCode === targetProfile.playerCode) return { ok: false, message: "You can't add yourself" };
        if (sender.friends.has(targetProfile.playerCode)) return { ok: false, message: 'Already friends' };

        if (sender.incomingFriendRequests.has(targetProfile.playerCode)) {
            return this.acceptFriend(sender, targetProfile.playerCode);
        }

        sender.outgoingFriendRequests.add(targetProfile.playerCode);
        const incoming = this._profileSet(targetProfile, 'incomingFriendRequests');
        incoming.add(sender.playerCode);
        targetProfile.incomingFriendRequests = Array.from(incoming);
        if (targetOnline) targetOnline.incomingFriendRequests.add(sender.playerCode);

        this._syncPlayerToProfile(sender);
        this._save();

        return {
            ok: true,
            sender,
            target: targetOnline,
            targetProfile,
            autoAccepted: false,
        };
    }

    acceptFriend(receiver, senderCode) {
        const code = this._normalizeCode(senderCode);
        const senderProfile = this.getProfile(code);
        const senderOnline = this.getByCode(code);

        if (!receiver) return { ok: false, message: 'Register first' };
        if (!senderProfile) return { ok: false, message: 'Player not found' };
        if (!receiver.incomingFriendRequests.has(senderProfile.playerCode) && !this._profileSet(senderProfile, 'outgoingFriendRequests').has(receiver.playerCode)) {
            return { ok: false, message: 'No pending request from this player' };
        }

        receiver.incomingFriendRequests.delete(senderProfile.playerCode);
        receiver.outgoingFriendRequests.delete(senderProfile.playerCode);
        receiver.friends.add(senderProfile.playerCode);

        const senderIncoming = this._profileSet(senderProfile, 'incomingFriendRequests');
        const senderOutgoing = this._profileSet(senderProfile, 'outgoingFriendRequests');
        const senderFriends = this._profileSet(senderProfile, 'friends');
        senderIncoming.delete(receiver.playerCode);
        senderOutgoing.delete(receiver.playerCode);
        senderFriends.add(receiver.playerCode);

        if (senderOnline) {
            senderOnline.incomingFriendRequests.delete(receiver.playerCode);
            senderOnline.outgoingFriendRequests.delete(receiver.playerCode);
            senderOnline.friends.add(receiver.playerCode);
            this._syncPlayerToProfile(senderOnline);
        } else {
            this._writeProfileSets(senderProfile, {
                incomingFriendRequests: senderIncoming,
                outgoingFriendRequests: senderOutgoing,
                friends: senderFriends,
            });
        }

        this._syncPlayerToProfile(receiver);
        this._save();

        return {
            ok: true,
            receiver,
            sender: senderOnline,
            senderProfile,
            autoAccepted: true,
        };
    }

    rejectFriend(receiver, senderCode) {
        const code = this._normalizeCode(senderCode);
        const senderProfile = this.getProfile(code);
        const senderOnline = this.getByCode(code);

        if (!receiver) return { ok: false, message: 'Register first' };

        receiver.incomingFriendRequests.delete(code);
        if (senderProfile) {
            const outgoing = this._profileSet(senderProfile, 'outgoingFriendRequests');
            outgoing.delete(receiver.playerCode);
            senderProfile.outgoingFriendRequests = Array.from(outgoing);
        }
        if (senderOnline) senderOnline.outgoingFriendRequests.delete(receiver.playerCode);

        this._syncPlayerToProfile(receiver);
        if (senderOnline) this._syncPlayerToProfile(senderOnline);
        this._save();

        return { ok: true, receiver, senderCode: code, sender: senderOnline, senderProfile };
    }

    removeFriend(player, friendCode) {
        const code = this._normalizeCode(friendCode);
        const friendProfile = this.getProfile(code);
        const friendOnline = this.getByCode(code);

        if (!player) return { ok: false, message: 'Register first' };

        player.friends.delete(code);
        player.incomingFriendRequests.delete(code);
        player.outgoingFriendRequests.delete(code);

        if (friendProfile) {
            const friends = this._profileSet(friendProfile, 'friends');
            const incoming = this._profileSet(friendProfile, 'incomingFriendRequests');
            const outgoing = this._profileSet(friendProfile, 'outgoingFriendRequests');
            friends.delete(player.playerCode);
            incoming.delete(player.playerCode);
            outgoing.delete(player.playerCode);
            friendProfile.friends = Array.from(friends);
            friendProfile.incomingFriendRequests = Array.from(incoming);
            friendProfile.outgoingFriendRequests = Array.from(outgoing);
        }

        if (friendOnline) {
            friendOnline.friends.delete(player.playerCode);
            friendOnline.incomingFriendRequests.delete(player.playerCode);
            friendOnline.outgoingFriendRequests.delete(player.playerCode);
            this._syncPlayerToProfile(friendOnline);
        }

        this._syncPlayerToProfile(player);
        this._save();

        return { ok: true, player, friend: friendOnline, friendProfile };
    }

    toPublicPlayer(playerOrProfile) {
        if (!playerOrProfile) return null;

        return {
            socketId: playerOrProfile.socketId,
            nickname: playerOrProfile.nickname,
            playerCode: playerOrProfile.playerCode,
            clientId: playerOrProfile.clientId,
        };
    }

    remove(socketId) {
        const player = this.players[socketId];
        if (!player) return;

        player.lastSeen = Date.now();
        this._syncPlayerToProfile(player);
        delete this.codeMap[player.playerCode];
        delete this.players[socketId];
        this._save();
    }

    whoHasAsFriend(playerCode) {
        const code = this._normalizeCode(playerCode);
        return Object.values(this.players).filter((player) => player.friends.has(code));
    }

    _profileToPlayer(profile, socketId) {
        return {
            socketId,
            clientId: profile.clientId,
            nickname: profile.nickname || 'Player',
            playerCode: profile.playerCode,
            friends: new Set(profile.friends || []),
            incomingFriendRequests: new Set(profile.incomingFriendRequests || []),
            outgoingFriendRequests: new Set(profile.outgoingFriendRequests || []),
            fcmTokens: new Set(profile.fcmTokens || []),
        };
    }

    _ensureProfile(playerCode, clientId, nickname) {
        const code = this._normalizeCode(playerCode);
        this.profiles[code] = this.profiles[code] || {
            playerCode: code,
            clientId,
            nickname: this._sanitizeNickname(nickname) || 'Player',
            friends: [],
            incomingFriendRequests: [],
            outgoingFriendRequests: [],
            fcmTokens: [],
            createdAt: Date.now(),
            lastSeen: Date.now(),
        };
        return this.profiles[code];
    }

    _syncPlayerToProfile(player) {
        const profile = this._ensureProfile(player.playerCode, player.clientId, player.nickname);
        profile.clientId = player.clientId;
        profile.nickname = player.nickname;
        profile.friends = Array.from(player.friends);
        profile.incomingFriendRequests = Array.from(player.incomingFriendRequests);
        profile.outgoingFriendRequests = Array.from(player.outgoingFriendRequests);
        profile.fcmTokens = Array.from(player.fcmTokens || []);
        profile.lastSeen = Date.now();
    }

    updatePushToken(player, token) {
        const value = this._sanitizePushToken(token);
        if (!player || !value) return false;

        player.fcmTokens = player.fcmTokens || new Set();
        player.fcmTokens.add(value);
        this._syncPlayerToProfile(player);
        this._save();
        return true;
    }

    removePushToken(player, token) {
        const value = this._sanitizePushToken(token);
        if (!player || !value) return false;

        player.fcmTokens = player.fcmTokens || new Set();
        player.fcmTokens.delete(value);
        this._syncPlayerToProfile(player);
        this._save();
        return true;
    }

    removePushTokenFromProfile(profileOrCode, token) {
        const value = this._sanitizePushToken(token);
        const code = typeof profileOrCode === 'string'
            ? this._normalizeCode(profileOrCode)
            : this._normalizeCode(profileOrCode?.playerCode);
        const profile = this.profiles[code];
        if (!profile || !value) return false;

        const before = Array.isArray(profile.fcmTokens) ? profile.fcmTokens.length : 0;
        profile.fcmTokens = (profile.fcmTokens || []).filter((item) => item !== value);

        const online = this.getByCode(code);
        if (online?.fcmTokens) online.fcmTokens.delete(value);

        if (profile.fcmTokens.length !== before) {
            this._save();
            return true;
        }
        return false;
    }

    pushTokenStats() {
        const profiles = Object.values(this.profiles);
        const counts = profiles.map((profile) => Array.isArray(profile.fcmTokens) ? profile.fcmTokens.filter(Boolean).length : 0);
        return {
            profileCount: profiles.length,
            profilesWithPushTokens: counts.filter((count) => count > 0).length,
            pushTokenCount: counts.reduce((total, count) => total + count, 0),
        };
    }

    _profileSet(profile, key) {
        return new Set(profile?.[key] || []);
    }

    _writeProfileSets(profile, sets) {
        for (const [key, value] of Object.entries(sets)) {
            profile[key] = Array.from(value);
        }
    }

    _dmThreadKey(a, b) {
        return [this._normalizeCode(a), this._normalizeCode(b)].sort().join(':');
    }

    _generateCode() {
        let code;
        do {
            code = Math.random().toString(36).substring(2, 8).toUpperCase();
        } while (this.profiles[code] || this.codeMap[code]);
        return code;
    }

    _generateClientId() {
        return `client-${Date.now()}-${Math.random().toString(36).substring(2, 12)}`;
    }

    _normalizeCode(playerCode) {
        return String(playerCode || '').trim().toUpperCase();
    }

    _sanitizeNickname(nickname) {
        const value = String(nickname || '').trim();
        if (!value) return '';
        return value.substring(0, 18);
    }

    _sanitizeToken(token) {
        return String(token || '').trim().substring(0, 80);
    }

    _sanitizePushToken(token) {
        return String(token || '').trim().substring(0, 512);
    }

    _save() {
        if (this.store) this.store.save();
    }
}

module.exports = PlayerRegistry;
