class PartyManager {
    constructor() {
        this.parties = {};
    }

    createParty(hostSocketId, hostNickname, hostCode, partyName) {
        const partyCode = this._generateCode();
        const host = this._member(hostSocketId, hostNickname, hostCode);
        const party = {
            partyCode,
            name: this._sanitizeName(partyName) || `${hostNickname}'s Party`,
            hostCode,
            members: [host],
            invitedCodes: new Set(),
            messages: [],
            voiceStates: {},
            roomCode: null,
            maxSize: 10,
        };

        this.parties[partyCode] = party;
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
            return { ok: true, party };
        }

        party.members.push(normalized);
        party.invitedCodes.delete(normalized.playerCode);
        return { ok: true, party };
    }

    removeMember(partyCode, socketId) {
        const party = this.getParty(partyCode);
        if (!party) return null;

        const leaving = party.members.find((member) => member.socketId === socketId);
        party.members = party.members.filter((member) => member.socketId !== socketId);

        if (leaving) {
            delete party.voiceStates[leaving.playerCode];
        }

        if (party.members.length === 0) {
            delete this.parties[party.partyCode];
            return null;
        }

        if (!party.members.some((member) => member.playerCode === party.hostCode)) {
            party.hostCode = party.members[0].playerCode;
        }

        return party;
    }

    removeParty(partyCode) {
        const party = this.getParty(partyCode);
        if (party) delete this.parties[party.partyCode];
    }

    renameParty(partyCode, name) {
        const party = this.getParty(partyCode);
        if (!party) return null;
        party.name = this._sanitizeName(name) || party.name;
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
            socketId,
            nickname: String(nickname || 'Player').trim().substring(0, 18) || 'Player',
            playerCode: this._normalizePlayerCode(playerCode),
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
}

module.exports = PartyManager;
