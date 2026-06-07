class PartyManager {
    constructor(store) {
        this.store = store;
        this.parties = store?.getState().parties || {};

        for (const party of Object.values(this.parties)) {
            party.members = (party.members || []).map((member) => ({ ...member, socketId: null }));
            party.invitedCodes = new Set(party.invitedCodes || []);
            party.messages = party.messages || [];
            party.voiceStates = {};
            party.roomCode = null;
        }
        this._save();
    }

    createParty(hostSocketId, hostNickname, hostCode, partyName) {
        const partyCode = this._generateCode();
        const host = this._member(hostSocketId, hostNickname, hostCode);
        const party = {
            partyCode,
            name: this._sanitizeName(partyName) || `${host.nickname}'s Party`,
            hostCode: host.playerCode,
            members: [host],
            invitedCodes: new Set(),
            messages: [],
            voiceStates: {},
            roomCode: null,
            maxSize: 10,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        this.parties[partyCode] = party;
        this._save();
        return party;
    }

    getParty(partyCode) {
        return this.parties[this._normalizePartyCode(partyCode)] || null;
    }

    getPartyByMember(socketId) {
        return Object.values(this.parties).find((party) => party.members.some((member) => member.socketId === socketId)) || null;
    }

    getPartyByMemberCode(playerCode) {
        const code = this._normalizePlayerCode(playerCode);
        return Object.values(this.parties).find((party) => party.members.some((member) => member.playerCode === code)) || null;
    }

    isMember(partyCode, playerCode) {
        const party = this.getParty(partyCode);
        const code = this._normalizePlayerCode(playerCode);
        return !!party?.members.some((member) => member.playerCode === code);
    }

    addInvitation(partyCode, playerCode) {
        const party = this.getParty(partyCode);
        if (!party) return false;
        party.invitedCodes.add(this._normalizePlayerCode(playerCode));
        party.updatedAt = Date.now();
        this._save();
        return true;
    }

    addMember(partyCode, member) {
        const party = this.getParty(partyCode);
        if (!party) return { ok: false, message: 'Party not found' };
        if (party.members.length >= party.maxSize) return { ok: false, message: 'Party is full' };

        const normalized = this._member(member.socketId, member.nickname, member.playerCode);
        const existing = party.members.find((item) => item.playerCode === normalized.playerCode);
        if (existing) {
            existing.socketId = normalized.socketId;
            existing.nickname = normalized.nickname;
            existing.lastSeen = Date.now();
            party.updatedAt = Date.now();
            this._save();
            return { ok: true, party };
        }

        party.members.push(normalized);
        party.invitedCodes.delete(normalized.playerCode);
        party.updatedAt = Date.now();
        this._save();
        return { ok: true, party };
    }

    attachMember(player) {
        const party = this.getPartyByMemberCode(player.playerCode);
        if (!party) return null;

        const member = party.members.find((item) => item.playerCode === player.playerCode);
        member.socketId = player.socketId;
        member.nickname = player.nickname;
        member.lastSeen = Date.now();
        party.updatedAt = Date.now();
        this._save();
        return party;
    }

    disconnectMember(socketId) {
        const party = this.getPartyByMember(socketId);
        if (!party) return null;

        const member = party.members.find((item) => item.socketId === socketId);
        if (!member) return null;

        member.socketId = null;
        member.lastSeen = Date.now();
        delete party.voiceStates[member.playerCode];
        party.updatedAt = Date.now();
        this._save();
        return party;
    }

    removeMember(partyCode, socketIdOrPlayerCode) {
        const party = this.getParty(partyCode);
        if (!party) return null;

        const code = this._normalizePlayerCode(socketIdOrPlayerCode);
        const leaving = party.members.find((member) => member.socketId === socketIdOrPlayerCode || member.playerCode === code);
        party.members = party.members.filter((member) => member.socketId !== socketIdOrPlayerCode && member.playerCode !== code);

        if (leaving) delete party.voiceStates[leaving.playerCode];

        if (party.members.length === 0) {
            delete this.parties[party.partyCode];
            this._save();
            return null;
        }

        if (!party.members.some((member) => member.playerCode === party.hostCode)) {
            party.hostCode = party.members[0].playerCode;
        }

        party.updatedAt = Date.now();
        this._save();
        return party;
    }

    removeParty(partyCode) {
        const party = this.getParty(partyCode);
        if (party) {
            delete this.parties[party.partyCode];
            this._save();
        }
    }

    renameParty(partyCode, name) {
        const party = this.getParty(partyCode);
        if (!party) return null;
        party.name = this._sanitizeName(name) || party.name;
        party.updatedAt = Date.now();
        this._save();
        return party;
    }

    addMessage(partyCode, sender, text) {
        const party = this.getParty(partyCode);
        const value = String(text || '').trim();
        if (!party || !sender || !value) return null;

        const message = {
            id: `party-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            socketId: sender.socketId,
            playerCode: sender.playerCode,
            nickname: sender.nickname,
            text: value.substring(0, 500),
            timestamp: Date.now(),
        };

        party.messages.push(message);
        if (party.messages.length > 100) party.messages.shift();
        party.updatedAt = Date.now();
        this._save();
        return message;
    }

    setVoiceState(partyCode, playerCode, active, muted) {
        const party = this.getParty(partyCode);
        const code = this._normalizePlayerCode(playerCode);
        if (!party) return null;

        if (!active) {
            delete party.voiceStates[code];
        } else {
            party.voiceStates[code] = {
                playerCode: code,
                active: true,
                muted: !!muted,
                updatedAt: Date.now(),
            };
        }

        return party.voiceStates[code] || { playerCode: code, active: false, muted: false };
    }

    setRoom(partyCode, roomCode) {
        const party = this.getParty(partyCode);
        if (!party) return null;
        party.roomCode = roomCode;
        party.updatedAt = Date.now();
        this._save();
        return party;
    }

    getState(partyCode) {
        const party = this.getParty(partyCode);
        if (!party) return null;

        return {
            partyCode: party.partyCode,
            name: party.name,
            hostCode: party.hostCode,
            members: party.members,
            maxSize: party.maxSize,
            messages: party.messages,
            voiceStates: party.voiceStates,
            roomCode: party.roomCode,
        };
    }

    _generateCode() {
        let code;
        do {
            code = `P${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        } while (this.parties[code]);
        return code;
    }

    _member(socketId, nickname, playerCode) {
        return {
            socketId: socketId || null,
            nickname: String(nickname || 'Player').trim().substring(0, 18) || 'Player',
            playerCode: this._normalizePlayerCode(playerCode),
            lastSeen: Date.now(),
        };
    }

    _sanitizeName(name) {
        return String(name || '').trim().substring(0, 40);
    }

    _normalizePartyCode(code) {
        return String(code || '').trim().toUpperCase();
    }

    _normalizePlayerCode(code) {
        return String(code || '').trim().toUpperCase();
    }

    _save() {
        if (!this.store) return;

        const serialized = {};
        for (const [code, party] of Object.entries(this.parties)) {
            serialized[code] = {
                ...party,
                invitedCodes: Array.from(party.invitedCodes || []),
                voiceStates: {},
                roomCode: null,
                members: (party.members || []).map((member) => ({ ...member, socketId: null })),
            };
        }
        this.store.getState().parties = serialized;
        this.store.save();
    }
}

module.exports = PartyManager;
