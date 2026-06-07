function getVoiceConfig() {
    const configuredServers = parseJsonIceServers(process.env.VOICE_ICE_SERVERS) || buildTurnServersFromEnv();
    const iceServers = configuredServers.length > 0 ? configuredServers : defaultIceServers();
    const forceRelay = String(process.env.VOICE_FORCE_RELAY || '').toLowerCase() === 'true';

    return {
        iceServers,
        iceTransportPolicy: forceRelay ? 'relay' : 'all',
    };
}

function parseJsonIceServers(value) {
    if (!value) return null;

    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return null;
        return parsed.filter((server) => server && server.urls);
    } catch (error) {
        console.error('[VOICE_CONFIG] VOICE_ICE_SERVERS is not valid JSON:', error.message);
        return null;
    }
}

function buildTurnServersFromEnv() {
    const turnUrls = splitList(process.env.TURN_URLS || process.env.TURN_URL);
    const username = process.env.TURN_USERNAME;
    const credential = process.env.TURN_CREDENTIAL || process.env.TURN_PASSWORD;
    const stunUrls = splitList(process.env.STUN_URLS || process.env.STUN_URL || 'stun:stun.l.google.com:19302');
    const servers = [];

    if (stunUrls.length > 0) {
        servers.push({ urls: stunUrls });
    }

    if (turnUrls.length > 0 && username && credential) {
        servers.push({
            urls: turnUrls,
            username,
            credential,
        });
    }

    return servers;
}

function defaultIceServers() {
    return [
        { urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
    ];
}

function splitList(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

module.exports = getVoiceConfig;
