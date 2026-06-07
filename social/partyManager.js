/**
 * Manages party sessions (pre-game lobbies for friend groups).
 */
class PartyManager {
    constructor() {
        this.parties = {};  // partyCode → party object
    }

    createParty(hostSocketId, hostNickname, hostCode, partyName) {
        const partyCode = this._generateCode();
        const party = {
            partyCode,
            name:     partyName || `${hostNickname}'s Party`,
            hostCode,
            members:  [{ socketId: hostSocketId, nickname: hostNickname, playerCode: hostCode }],
            maxSize:  10,
        };
        this.parties[partyCode] = party;
        return party;
    }

    getParty(partyCode)  { return this.parties[partyCode] || null; }

    getPartyByMember(socketId) {
        return Object.values(this.parties).find(p => p.members.some(m => m.socketId === socketId)) || null;
    }

    addMember(partyCode, member) {
        const party = this.parties[partyCode];
        if (!party) return false;
        if (party.members.length >= party.maxSize) return false;
        if (party.members.some(m => m.socketId === member.socketId)) return true; // already in
        party.members.push(member);
        return true;
    }

    /** Remove member; returns remaining party or null if party was dissolved. */
    removeMember(partyCode, socketId) {
        const party = this.parties[partyCode];
        if (!party) return null;
        party.members = party.members.filter(m => m.socketId !== socketId);
        if (party.members.length === 0) {
            delete this.parties[partyCode];
            return null;
        }
        // Re-assign host if host left
        if (!party.members.some(m => m.playerCode === party.hostCode)) {
            party.hostCode = party.members[0].playerCode;
        }
        return party;
    }

    removeParty(partyCode) { delete this.parties[partyCode]; }

    getState(partyCode) {
        const p = this.parties[partyCode];
        if (!p) return null;
        return {
            partyCode: p.partyCode,
            name:      p.name,
            hostCode:  p.hostCode,
            members:   p.members,
            maxSize:   p.maxSize,
        };
    }

    _generateCode() {
        let code;
        do { code = 'P' + Math.random().toString(36).substring(2, 7).toUpperCase(); }
        while (this.parties[code]);
        return code;
    }
}

module.exports = PartyManager;

