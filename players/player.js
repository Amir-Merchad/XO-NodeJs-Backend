class Player {
    constructor(
        socketId,
        nickname,
        playerCode,
    ) {
        this.socketId = socketId;
        this.nickname = nickname;
        this.playerCode = playerCode;

        this.friends = [];
        this.friendRequests = [];
    }
}

module.exports = Player;