/**
 * Social socket handlers: player registration, friends, DMs, parties.
 */
function registerSocialHandlers(io, socket, playerRegistry, partyManager, roomManager) {

    // ── Player registration ───────────────────────────────────────────────────
    socket.on('register-player', ({ nickname }) => {
        const player = playerRegistry.register(socket.id, nickname);
        socket.emit('your-player-code', { playerCode: player.playerCode });

        // Notify any existing friends that this player is back online
        for (const code of player.friends) {
            const friend = playerRegistry.getByCode(code);
            if (friend) {
                io.to(friend.socketId).emit('friend-online', {
                    playerCode: player.playerCode,
                    nickname:   player.nickname,
                });
            }
        }
        // Also notify players who have "us" as a friend
        for (const other of playerRegistry.whoHasAsFriend(player.playerCode)) {
            if (other.socketId !== socket.id) {
                io.to(other.socketId).emit('friend-online', {
                    playerCode: player.playerCode,
                    nickname:   player.nickname,
                });
            }
        }
    });

    // ── Get friends list ──────────────────────────────────────────────────────
    socket.on('get-friends', () => {
        const me = playerRegistry.getBySocketId(socket.id);
        if (!me) return;
        const list = Array.from(me.friends).map(code => {
            const f = playerRegistry.getByCode(code);
            return f
                ? { playerCode: code, nickname: f.nickname, isOnline: true  }
                : { playerCode: code, nickname: '???',      isOnline: false };
        });
        socket.emit('friends-list', { friends: list });
    });

    // ── Add friend by playerCode ──────────────────────────────────────────────
    socket.on('add-friend', ({ playerCode }) => {
        const me = playerRegistry.getBySocketId(socket.id);
        if (!me) return;
        if (playerCode === me.playerCode) {
            socket.emit('add-friend-error', { message: "You can't add yourself" });
            return;
        }
        const target = playerRegistry.getByCode(playerCode);
        if (!target) {
            socket.emit('add-friend-error', { message: 'Player not found or offline' });
            return;
        }
        me.friends.add(playerCode);
        socket.emit('friend-added', {
            playerCode: target.playerCode,
            nickname:   target.nickname,
            isOnline:   true,
        });
        // Let the other player know
        io.to(target.socketId).emit('friend-request-received', {
            fromCode:     me.playerCode,
            fromNickname: me.nickname,
        });
    });

    // ── Remove friend ─────────────────────────────────────────────────────────
    socket.on('remove-friend', ({ playerCode }) => {
        const me = playerRegistry.getBySocketId(socket.id);
        if (!me) return;
        me.friends.delete(playerCode);
        socket.emit('friend-removed', { playerCode });
    });

    // ── Direct message ────────────────────────────────────────────────────────
    socket.on('send-dm', ({ toPlayerCode, text }) => {
        const me = playerRegistry.getBySocketId(socket.id);
        if (!me || !text?.trim()) return;

        const target = playerRegistry.getByCode(toPlayerCode);
        if (!target) {
            socket.emit('dm-error', { message: 'Player is offline' });
            return;
        }

        const msg = {
            id:           `dm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            fromCode:     me.playerCode,
            fromNickname: me.nickname,
            toCode:       toPlayerCode,
            text:         text.trim().substring(0, 500),
            timestamp:    Date.now(),
        };

        io.to(target.socketId).emit('dm-received', msg);
        socket.emit('dm-sent', msg);
    });

    // ── Create party ──────────────────────────────────────────────────────────
    socket.on('create-party', ({ partyName }) => {
        const me = playerRegistry.getBySocketId(socket.id);
        if (!me) return;

        // Leave existing party first
        _leaveCurrentParty();

        const party = partyManager.createParty(socket.id, me.nickname, me.playerCode, partyName);
        socket.join(`party:${party.partyCode}`);
        socket.emit('party-created', partyManager.getState(party.partyCode));
    });

    // ── Join party by code ────────────────────────────────────────────────────
    socket.on('join-party', ({ partyCode }) => {
        const me = playerRegistry.getBySocketId(socket.id);
        if (!me) return;

        const party = partyManager.getParty(partyCode);
        if (!party) { socket.emit('join-party-error', { message: 'Party not found' }); return; }
        if (party.members.length >= party.maxSize) { socket.emit('join-party-error', { message: 'Party is full' }); return; }

        _leaveCurrentParty();

        partyManager.addMember(partyCode, { socketId: socket.id, nickname: me.nickname, playerCode: me.playerCode });
        socket.join(`party:${partyCode}`);

        io.to(`party:${partyCode}`).emit('party-state', partyManager.getState(partyCode));
    });

    // ── Get party state ───────────────────────────────────────────────────────
    socket.on('get-party-state', ({ partyCode }) => {
        const state = partyManager.getState(partyCode);
        if (state) socket.emit('party-state', state);
    });

    // ── Invite friend to party ────────────────────────────────────────────────
    socket.on('invite-to-party', ({ partyCode, playerCode }) => {
        const me     = playerRegistry.getBySocketId(socket.id);
        const target = playerRegistry.getByCode(playerCode);
        const party  = partyManager.getParty(partyCode);
        if (!me || !target || !party) return;

        io.to(target.socketId).emit('party-invite-received', {
            partyCode:    party.partyCode,
            partyName:    party.name,
            fromNickname: me.nickname,
        });
    });

    // ── Leave party ───────────────────────────────────────────────────────────
    socket.on('leave-party', ({ partyCode }) => {
        _doLeaveParty(partyCode);
    });

    // ── Kick member (host only) ───────────────────────────────────────────────
    socket.on('kick-from-party', ({ partyCode, playerCode }) => {
        const me    = playerRegistry.getBySocketId(socket.id);
        const party = partyManager.getParty(partyCode);
        if (!me || !party || me.playerCode !== party.hostCode) return;

        const member = party.members.find(m => m.playerCode === playerCode);
        if (!member) return;

        const remaining = partyManager.removeMember(partyCode, member.socketId);
        const memberSocket = io.sockets.sockets.get(member.socketId);
        if (memberSocket) {
            memberSocket.leave(`party:${partyCode}`);
            io.to(member.socketId).emit('party-left', { partyCode, reason: 'kicked' });
        }
        if (remaining) io.to(`party:${partyCode}`).emit('party-state', partyManager.getState(partyCode));
    });

    // ── Start game room from party (host only) ────────────────────────────────
    socket.on('party-create-room', ({ partyCode }) => {
        const me    = playerRegistry.getBySocketId(socket.id);
        const party = partyManager.getParty(partyCode);
        if (!me || !party || me.playerCode !== party.hostCode) return;

        const playerCount = Math.min(party.members.length, 4);
        const room        = roomManager.createRoom(playerCount);

        const toJoin = party.members.slice(0, playerCount);
        for (const member of toJoin) {
            room.addPlayer({ socketId: member.socketId, nickname: member.nickname });
            const s = io.sockets.sockets.get(member.socketId);
            if (s) s.join(room.roomCode);
        }

        io.to(`party:${partyCode}`).emit('party-room-created', { roomCode: room.roomCode });
        io.to(room.roomCode).emit('room-state', room.getState());
    });

    // ── Rename party (host only) ──────────────────────────────────────────────
    socket.on('rename-party', ({ partyCode, name }) => {
        const me    = playerRegistry.getBySocketId(socket.id);
        const party = partyManager.getParty(partyCode);
        if (!me || !party || me.playerCode !== party.hostCode || !name?.trim()) return;
        party.name = name.trim().substring(0, 40);
        io.to(`party:${partyCode}`).emit('party-state', partyManager.getState(partyCode));
    });

    // ── Helpers ───────────────────────────────────────────────────────────────
    function _leaveCurrentParty() {
        const existing = partyManager.getPartyByMember(socket.id);
        if (existing) _doLeaveParty(existing.partyCode);
    }

    function _doLeaveParty(partyCode) {
        const remaining = partyManager.removeMember(partyCode, socket.id);
        socket.leave(`party:${partyCode}`);
        socket.emit('party-left', { partyCode });
        if (remaining) io.to(`party:${partyCode}`).emit('party-state', partyManager.getState(partyCode));
    }

    // ── Disconnect cleanup ────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        const me = playerRegistry.getBySocketId(socket.id);
        if (!me) return;

        // Notify friends
        for (const code of me.friends) {
            const friend = playerRegistry.getByCode(code);
            if (friend) io.to(friend.socketId).emit('friend-offline', { playerCode: me.playerCode });
        }
        // Notify people who have us as a friend
        for (const other of playerRegistry.whoHasAsFriend(me.playerCode)) {
            if (other.socketId !== socket.id) {
                io.to(other.socketId).emit('friend-offline', { playerCode: me.playerCode });
            }
        }

        // Leave party
        const party = partyManager.getPartyByMember(socket.id);
        if (party) {
            const remaining = partyManager.removeMember(party.partyCode, socket.id);
            if (remaining) io.to(`party:${party.partyCode}`).emit('party-state', partyManager.getState(party.partyCode));
        }

        playerRegistry.remove(socket.id);
    });
}

module.exports = registerSocialHandlers;

