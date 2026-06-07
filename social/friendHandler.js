function registerFriendHandlers(
    io,
    socket,
    playerManager,
) {
    socket.on(
        "send-friend-request",
        ({ playerCode }) => {

            const sender =
                playerManager.getPlayer(
                    socket.id,
                );

            const target =
                playerManager.getPlayerByCode(
                    playerCode,
                );

            if (
                !sender ||
                !target
            ) {
                return;
            }

            if (
                target.friends.includes(
                    sender.socketId,
                )
            ) {
                return;
            }

            target.friendRequests.push(
                sender.socketId,
            );

            io.to(
                target.socketId,
            ).emit(
                "friend-request",
                {
                    nickname:
                    sender.nickname,
                    playerCode:
                    sender.playerCode,
                },
            );
        },
    );

    socket.on(
        "accept-friend-request",
        ({ senderCode }) => {

            const receiver =
                playerManager.getPlayer(
                    socket.id,
                );

            const sender =
                playerManager.getPlayerByCode(
                    senderCode,
                );

            if (
                !sender ||
                !receiver
            ) {
                return;
            }

            sender.friends.push(
                receiver.socketId,
            );

            receiver.friends.push(
                sender.socketId,
            );

            io.to(
                sender.socketId,
            ).emit(
                "friend-added",
                {
                    nickname:
                    receiver.nickname,
                    playerCode:
                    receiver.playerCode,
                },
            );

            socket.emit(
                "friend-added",
                {
                    nickname:
                    sender.nickname,
                    playerCode:
                    sender.playerCode,
                },
            );
        },
    );

    socket.on(
        "get-friends",
        () => {

            const player =
                playerManager.getPlayer(
                    socket.id,
                );

            if (!player) {
                return;
            }

            const friends =
                player.friends
                    .map(
                        friendId =>
                            playerManager.getPlayer(
                                friendId,
                            ),
                    )
                    .filter(Boolean)
                    .map(friend => ({
                        nickname:
                        friend.nickname,
                        playerCode:
                        friend.playerCode,
                    }));

            socket.emit(
                "friends-list",
                friends,
            );
        },
    );
}

module.exports =
    registerFriendHandlers;