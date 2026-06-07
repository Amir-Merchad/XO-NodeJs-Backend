function registerSocialHandlers(io, socket, playerRegistry, partyManager, roomManager) {
    socket.on('register-player', ({ nickname, clientId, playerCode } = {}) => {
        const player = playerRegistry.register(socket.id, nickname, clientId, playerCode);
        const restoredParty = partyManager.attachMember(player);
        if (restoredParty) socket.join(partyRoom(restoredParty.partyCode));

        socket.emit('player-registered', playerRegistry.toPublicPlayer(player));
        if (restoredParty) socket.emit('party-state', partyManager.getState(restoredParty.partyCode));
        emitSocialState(player);
        if (restoredParty) emitPartyState(restoredParty.partyCode);
        notifyFriendsOnline(player);
    });

    socket.on('get-social-state', () => {
        const player = getMe();
        if (player) emitSocialState(player);
    });

    socket.on('get-friends', () => {
        const player = getMe();
        if (player) emitFriends(player);
    });

    socket.on('send-friend-request', ({ playerCode } = {}) => {
        handleFriendRequest(playerCode);
    });

    socket.on('add-friend', ({ playerCode } = {}) => {
        handleFriendRequest(playerCode);
    });

    function handleFriendRequest(playerCode) {
        const sender = getMe();
        const result = playerRegistry.requestFriend(sender, playerCode);

        if (!result.ok) {
            socket.emit('add-friend-error', { message: result.message });
            return;
        }

        if (result.autoAccepted) {
            emitFriendAdded(result.receiver, result.sender, result.senderProfile);
            return;
        }

        socket.emit('friend-request-sent', {
            playerCode: result.targetProfile.playerCode,
            nickname: result.targetProfile.nickname,
        });
        if (result.target) {
            io.to(result.target.socketId).emit('friend-request-received', {
                playerCode: sender.playerCode,
                nickname: sender.nickname,
                isOnline: true,
            });
            emitSocialState(result.target);
        }

        emitSocialState(sender);
    }

    socket.on('accept-friend-request', ({ senderCode, playerCode } = {}) => {
        const receiver = getMe();
        const result = playerRegistry.acceptFriend(receiver, senderCode || playerCode);

        if (!result.ok) {
            socket.emit('add-friend-error', { message: result.message });
            return;
        }

        emitFriendAdded(result.receiver, result.sender, result.senderProfile);
    });

    socket.on('reject-friend-request', ({ senderCode, playerCode } = {}) => {
        const receiver = getMe();
        const result = playerRegistry.rejectFriend(receiver, senderCode || playerCode);

        if (!result.ok) {
            socket.emit('add-friend-error', { message: result.message });
            return;
        }

        socket.emit('friend-request-rejected', { playerCode: result.senderCode });
        if (result.sender) {
            io.to(result.sender.socketId).emit('friend-request-declined', {
                playerCode: receiver.playerCode,
                nickname: receiver.nickname,
            });
            emitSocialState(result.sender);
        }
        emitSocialState(receiver);
    });

    socket.on('remove-friend', ({ playerCode } = {}) => {
        const player = getMe();
        const result = playerRegistry.removeFriend(player, playerCode);

        if (!result.ok) {
            socket.emit('friend-error', { message: result.message });
            return;
        }

        socket.emit('friend-removed', { playerCode: normalizePlayerCode(playerCode) });
        if (result.friend) {
            io.to(result.friend.socketId).emit('friend-removed', { playerCode: player.playerCode });
            emitSocialState(result.friend);
        }
        emitSocialState(player);
    });

    socket.on('send-dm', ({ toPlayerCode, text } = {}) => {
        const sender = getMe();
        const target = playerRegistry.getByCode(toPlayerCode);
        const targetProfile = playerRegistry.getProfile(toPlayerCode);
        const value = String(text || '').trim();

        if (!sender || !value) return;
        if (!targetProfile) {
            socket.emit('dm-error', { message: 'Player not found' });
            return;
        }
        if (!sender.friends.has(targetProfile.playerCode)) {
            socket.emit('dm-error', { message: 'You can only message friends' });
            return;
        }

        const message = playerRegistry.addDirectMessage(sender, targetProfile.playerCode, value);
        if (!message) return;

        socket.emit('dm-sent', message);
        if (target) io.to(target.socketId).emit('dm-received', message);
    });

    socket.on('create-party', ({ partyName } = {}) => {
        const player = getMe();
        if (!player) return;

        leaveCurrentParty();

        const party = partyManager.createParty(socket.id, player.nickname, player.playerCode, partyName);
        socket.join(partyRoom(party.partyCode));
        socket.emit('party-created', partyManager.getState(party.partyCode));
        emitPartyState(party.partyCode);
        emitSocialState(player);
    });

    socket.on('join-party', ({ partyCode } = {}) => {
        const player = getMe();
        const party = partyManager.getParty(partyCode);

        if (!player) return;
        if (!party) {
            socket.emit('join-party-error', { message: 'Party not found' });
            return;
        }

        leaveCurrentParty();

        const result = partyManager.addMember(party.partyCode, playerRegistry.toPublicPlayer(player));
        if (!result.ok) {
            socket.emit('join-party-error', { message: result.message });
            return;
        }

        socket.join(partyRoom(party.partyCode));
        emitPartyState(party.partyCode);
        emitSocialState(player);
    });

    socket.on('get-party-state', ({ partyCode } = {}) => {
        const player = getMe();
        const party = partyManager.getParty(partyCode);

        if (!player || !party || !partyManager.isMember(party.partyCode, player.playerCode)) return;
        socket.emit('party-state', partyManager.getState(party.partyCode));
    });

    socket.on('invite-to-party', ({ partyCode, playerCode } = {}) => {
        const sender = getMe();
        const target = playerRegistry.getByCode(playerCode);
        const targetProfile = playerRegistry.getProfile(playerCode);
        const party = partyManager.getParty(partyCode);

        if (!sender || !targetProfile || !party) return;
        if (!partyManager.isMember(party.partyCode, sender.playerCode)) return;
        if (!sender.friends.has(targetProfile.playerCode)) {
            socket.emit('party-error', { message: 'You can only invite friends' });
            return;
        }

        partyManager.addInvitation(party.partyCode, targetProfile.playerCode);
        if (target) {
            io.to(target.socketId).emit('party-invite-received', {
                partyCode: party.partyCode,
                partyName: party.name,
                fromPlayerCode: sender.playerCode,
                fromNickname: sender.nickname,
            });
            emitSocialState(target);
        }
        emitPartyState(party.partyCode);
    });

    socket.on('send-party-message', ({ partyCode, text } = {}) => {
        const sender = getMe();
        const party = partyManager.getParty(partyCode);

        if (!sender || !party || !partyManager.isMember(party.partyCode, sender.playerCode)) return;

        const message = partyManager.addMessage(party.partyCode, sender, text);
        if (message) io.to(partyRoom(party.partyCode)).emit('party-message-received', message);
    });

    socket.on('leave-party', ({ partyCode } = {}) => {
        leaveParty(partyCode);
    });

    socket.on('kick-from-party', ({ partyCode, playerCode } = {}) => {
        const sender = getMe();
        const party = partyManager.getParty(partyCode);
        const code = normalizePlayerCode(playerCode);

        if (!sender || !party || party.hostCode !== sender.playerCode) return;

        const member = party.members.find((item) => item.playerCode === code);
        if (!member || member.playerCode === sender.playerCode) return;

        const remaining = partyManager.removeMember(party.partyCode, member.socketId);
        const memberSocket = io.sockets.sockets.get(member.socketId);
        if (memberSocket) {
            memberSocket.leave(partyRoom(party.partyCode));
            io.to(member.socketId).emit('party-left', { partyCode: party.partyCode, reason: 'kicked' });
            const player = playerRegistry.getBySocketId(member.socketId);
            if (player) emitSocialState(player);
        }

        if (remaining) emitPartyState(party.partyCode);
    });

    socket.on('rename-party', ({ partyCode, name } = {}) => {
        const sender = getMe();
        const party = partyManager.getParty(partyCode);

        if (!sender || !party || party.hostCode !== sender.playerCode) return;
        partyManager.renameParty(party.partyCode, name);
        emitPartyState(party.partyCode);
    });

    socket.on('party-create-room', ({ partyCode, invitedPlayerCodes, playerCount } = {}) => {
        const creator = getMe();
        const party = partyManager.getParty(partyCode);

        if (!creator || !party || !partyManager.isMember(party.partyCode, creator.playerCode)) return;

        const memberCodes = new Set(party.members.map((member) => member.playerCode));
        const invitedCodes = Array.isArray(invitedPlayerCodes)
            ? invitedPlayerCodes.map(normalizePlayerCode).filter((code) => code && code !== creator.playerCode && memberCodes.has(code))
            : [];

        const maxPlayers = Math.max(2, Math.min(Number(playerCount) || invitedCodes.length + 1, 4));
        const limitedInvites = invitedCodes.slice(0, Math.max(0, maxPlayers - 1));
        const room = roomManager.createRoom(maxPlayers);

        room.hostSocketId = socket.id;
        room.partyCode = party.partyCode;
        room.addPlayer({
            socketId: creator.socketId,
            nickname: creator.nickname,
            playerCode: creator.playerCode,
        });
        socket.join(room.roomCode);
        partyManager.setRoom(party.partyCode, room.roomCode);

        socket.emit('room-created-from-party', {
            roomCode: room.roomCode,
            partyCode: party.partyCode,
            playerCount: room.maxPlayers,
        });

        for (const code of limitedInvites) {
            const target = playerRegistry.getByCode(code);
            if (!target) continue;

            io.to(target.socketId).emit('room-invite-received', {
                roomCode: room.roomCode,
                partyCode: party.partyCode,
                fromPlayerCode: creator.playerCode,
                fromNickname: creator.nickname,
                playerCount: room.maxPlayers,
            });
        }

        io.to(partyRoom(party.partyCode)).emit('party-room-created', {
            roomCode: room.roomCode,
            partyCode: party.partyCode,
            creatorPlayerCode: creator.playerCode,
            invitedPlayerCodes: limitedInvites,
            playerCount: room.maxPlayers,
        });
        io.to(room.roomCode).emit('room-state', room.getState());
        emitPartyState(party.partyCode);
    });

    socket.on('party-voice-peer-state', ({ partyCode, active, muted } = {}) => {
        const sender = getMe();
        const party = partyManager.getParty(partyCode);

        if (!sender || !party || !partyManager.isMember(party.partyCode, sender.playerCode)) return;

        const state = partyManager.setVoiceState(party.partyCode, sender.playerCode, !!active, !!muted);
        socket.to(partyRoom(party.partyCode)).emit('party-voice-peer-state', {
            partyCode: party.partyCode,
            fromPlayerCode: sender.playerCode,
            fromNickname: sender.nickname,
            active: state.active,
            muted: state.muted,
        });
        emitPartyState(party.partyCode);
    });

    socket.on('party-voice-offer', ({ partyCode, toPlayerCode, offer } = {}) => {
        forwardPartyVoice('party-voice-offer', partyCode, toPlayerCode, { offer });
    });

    socket.on('party-voice-answer', ({ partyCode, toPlayerCode, answer } = {}) => {
        forwardPartyVoice('party-voice-answer', partyCode, toPlayerCode, { answer });
    });

    socket.on('party-voice-ice', ({ partyCode, toPlayerCode, candidate } = {}) => {
        forwardPartyVoice('party-voice-ice', partyCode, toPlayerCode, { candidate });
    });

    socket.on('disconnect', () => {
        const player = playerRegistry.getBySocketId(socket.id);
        if (!player) return;

        notifyFriendsOffline(player);

        const party = partyManager.getPartyByMember(socket.id);
        if (party) {
            partyManager.setVoiceState(party.partyCode, player.playerCode, false, false);
            socket.to(partyRoom(party.partyCode)).emit('party-voice-peer-state', {
                partyCode: party.partyCode,
                fromPlayerCode: player.playerCode,
                fromNickname: player.nickname,
                active: false,
                muted: false,
            });

            const remaining = partyManager.disconnectMember(socket.id);
            if (remaining) emitPartyState(party.partyCode);
        }

        playerRegistry.remove(socket.id);
    });

    function getMe() {
        return playerRegistry.getBySocketId(socket.id);
    }

    function emitFriendAdded(receiver, sender, senderProfile) {
        io.to(receiver.socketId).emit('friend-added', publicFriend(sender || senderProfile));
        if (sender) io.to(sender.socketId).emit('friend-added', publicFriend(receiver));
        emitSocialState(receiver);
        if (sender) emitSocialState(sender);
    }

    function emitSocialState(player) {
        if (!player) return;
        const party = partyManager.getPartyByMember(player.socketId);

        io.to(player.socketId).emit('social-state', {
            player: playerRegistry.toPublicPlayer(player),
            friends: playerRegistry.getFriends(player),
            incomingFriendRequests: playerRegistry.getIncomingRequests(player),
            outgoingFriendRequests: playerRegistry.getOutgoingRequests(player),
            dmThreads: buildDmThreads(player),
            partyInvites: buildPartyInvites(player),
            party: party ? partyManager.getState(party.partyCode) : null,
        });
    }

    function emitFriends(player) {
        io.to(player.socketId).emit('friends-list', {
            friends: playerRegistry.getFriends(player),
        });
    }

    function buildDmThreads(player) {
        const threads = {};
        for (const friendCode of player.friends) {
            threads[friendCode] = playerRegistry.getDirectMessages(player.playerCode, friendCode);
        }
        return threads;
    }

    function buildPartyInvites(player) {
        return Object.values(partyManager.parties)
            .filter((party) => party.invitedCodes?.has(player.playerCode) && !partyManager.isMember(party.partyCode, player.playerCode))
            .map((party) => {
                const host = party.members.find((member) => member.playerCode === party.hostCode);
                return {
                    partyCode: party.partyCode,
                    partyName: party.name,
                    fromPlayerCode: party.hostCode,
                    fromNickname: host?.nickname || 'Party Host',
                };
            });
    }

    function emitPartyState(partyCode) {
        const party = partyManager.getParty(partyCode);
        if (!party) return;

        io.to(partyRoom(party.partyCode)).emit('party-state', partyManager.getState(party.partyCode));
        for (const member of party.members) {
            const player = playerRegistry.getBySocketId(member.socketId);
            if (player) emitSocialState(player);
        }
    }

    function leaveCurrentParty() {
        const party = partyManager.getPartyByMember(socket.id);
        if (party) leaveParty(party.partyCode);
    }

    function leaveParty(partyCode) {
        const player = getMe();
        const party = partyManager.getParty(partyCode);
        if (!player || !party || !partyManager.isMember(party.partyCode, player.playerCode)) return;

        partyManager.setVoiceState(party.partyCode, player.playerCode, false, false);
        socket.to(partyRoom(party.partyCode)).emit('party-voice-peer-state', {
            partyCode: party.partyCode,
            fromPlayerCode: player.playerCode,
            fromNickname: player.nickname,
            active: false,
            muted: false,
        });

        const remaining = partyManager.removeMember(party.partyCode, socket.id);
        socket.leave(partyRoom(party.partyCode));
        socket.emit('party-left', { partyCode: party.partyCode });

        if (remaining) emitPartyState(party.partyCode);
        emitSocialState(player);
    }

    function notifyFriendsOnline(player) {
        for (const friend of playerRegistry.whoHasAsFriend(player.playerCode)) {
            io.to(friend.socketId).emit('friend-online', publicFriend(player));
            emitSocialState(friend);
        }
    }

    function notifyFriendsOffline(player) {
        const notified = new Set();
        for (const code of player.friends) {
            const friend = playerRegistry.getByCode(code);
            if (friend) {
                notified.add(friend.socketId);
                io.to(friend.socketId).emit('friend-offline', { playerCode: player.playerCode });
                emitSocialState(friend);
            }
        }

        for (const other of playerRegistry.whoHasAsFriend(player.playerCode)) {
            if (other.socketId !== socket.id && !notified.has(other.socketId)) {
                io.to(other.socketId).emit('friend-offline', { playerCode: player.playerCode });
                emitSocialState(other);
            }
        }
    }

    function forwardPartyVoice(eventName, partyCode, toPlayerCode, payload) {
        const sender = getMe();
        const target = playerRegistry.getByCode(toPlayerCode);
        const party = partyManager.getParty(partyCode);

        if (!sender || !target || !party) return;
        if (!partyManager.isMember(party.partyCode, sender.playerCode)) return;
        if (!partyManager.isMember(party.partyCode, target.playerCode)) return;

        io.to(target.socketId).emit(eventName, {
            partyCode: party.partyCode,
            fromPlayerCode: sender.playerCode,
            fromNickname: sender.nickname,
            ...payload,
        });
    }
}

function publicFriend(player) {
    return {
        playerCode: player.playerCode,
        nickname: player.nickname,
        isOnline: true,
    };
}

function normalizePlayerCode(playerCode) {
    return String(playerCode || '').trim().toUpperCase();
}

function partyRoom(partyCode) {
    return `party:${partyCode}`;
}

module.exports = registerSocialHandlers;
