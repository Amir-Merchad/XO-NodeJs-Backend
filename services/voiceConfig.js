function getVoiceConfig() {
    const configuredServers =
        parseJsonIceServers(process.env.VOICE_ICE_SERVERS) ||
        buildTurnServersFromEnv();

    const iceServers =
        configuredServers.length > 0
            ? configuredServers
            : defaultIceServers();

    const forceRelay =
        cleanEnvValue(process.env.VOICE_FORCE_RELAY)
            .toLowerCase() === "true";

    const config = {
        iceServers,
        iceTransportPolicy: forceRelay ? "relay" : "all",
    };

    console.log("[VOICE_CONFIG]", JSON.stringify(maskVoiceConfig(config)));

    return config;
}

function parseJsonIceServers(value) {
    const cleaned = cleanEnvValue(value, "VOICE_ICE_SERVERS");
    if (!cleaned) return null;

    try {
        const parsed = JSON.parse(cleaned);

        if (!Array.isArray(parsed)) {
            return null;
        }

        return parsed.filter(
            server => server && server.urls
        );
    } catch (error) {
        console.error(
            "[VOICE_CONFIG] VOICE_ICE_SERVERS is not valid JSON:",
            error.message
        );

        return null;
    }
}

function buildTurnServersFromEnv() {
    const stunUrls = splitList(
        envValue("STUN_URLS") ||
        envValue("STUN_URL") ||
        "stun:stun.l.google.com:19302"
    );

    const turnUrls = splitList(
        envValue("TURN_URLS") ||
        envValue("TURN_URL")
    );

    const username =
        cleanEnvValue(process.env.TURN_USERNAME, "TURN_USERNAME");

    const credential =
        cleanEnvValue(
            process.env.TURN_CREDENTIAL ||
            process.env.TURN_PASSWORD,
            process.env.TURN_CREDENTIAL ? "TURN_CREDENTIAL" : "TURN_PASSWORD"
        );

    const servers = [];

    if (stunUrls.length > 0) {
        servers.push({
            urls: stunUrls,
        });
    }

    if (
        turnUrls.length > 0 &&
        username &&
        credential
    ) {
        servers.push({
            urls: turnUrls,
            username,
            credential,
        });
    } else {
        console.warn(
            "[VOICE_CONFIG] TURN is not configured. Different-network calls may fail."
        );
    }

    return servers;
}

function defaultIceServers() {
    return [
        {
            urls: [
                "stun:stun.l.google.com:19302",
                "stun:global.stun.twilio.com:3478",
            ],
        },
    ];
}

function splitList(value) {
    return cleanEnvValue(value)
        .split(",")
        .map(item => cleanEnvValue(item))
        .filter(Boolean);
}

function envValue(name) {
    return cleanEnvValue(process.env[name], name);
}

function cleanEnvValue(value, keyName = "") {
    let text = String(value || "").trim();
    if (!text) return "";

    if (keyName && text.startsWith(`${keyName}=`)) {
        text = text.substring(keyName.length + 1).trim();
    }

    const quoted =
        (text.startsWith('"') && text.endsWith('"')) ||
        (text.startsWith("'") && text.endsWith("'"));

    if (!quoted) return text;

    try {
        const parsed = JSON.parse(text);
        return typeof parsed === "string" ? parsed.trim() : text;
    } catch (_) {
        return text.substring(1, text.length - 1).trim();
    }
}

function maskVoiceConfig(config) {
    return {
        ...config,
        iceServers: config.iceServers.map((server) => {
            if (!server || !server.credential) return server;
            return {
                ...server,
                username: server.username ? "***" : server.username,
                credential: "***",
            };
        }),
    };
}

module.exports = getVoiceConfig;
