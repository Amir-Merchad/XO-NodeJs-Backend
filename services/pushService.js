class PushService {
    constructor() {
        this.enabled = false;
        this.messaging = null;
        this.credentialSource = null;
        this.initError = null;
        this._init();
    }

    async sendToProfile(profile, payload) {
        if (!this.enabled || !profile) return [];

        const tokens = Array.isArray(profile.fcmTokens)
            ? profile.fcmTokens.filter(Boolean).slice(0, 500)
            : [];
        if (tokens.length === 0) return [];

        const message = {
            tokens,
            notification: {
                title: String(payload.title || 'Gaming Platform').substring(0, 100),
                body: String(payload.body || '').substring(0, 240),
            },
            data: stringifyData(payload.data),
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                },
            },
        };

        try {
            const response = await this.messaging.sendEachForMulticast(message);
            if (response.failureCount > 0) {
                const failures = response.responses
                    .map((item, index) => ({ item, token: tokens[index] }))
                    .filter(({ item }) => !item.success);
                const codes = Array.from(new Set(failures.map(({ item }) => item.error?.code || 'unknown')));
                console.warn(`[PUSH] ${response.failureCount}/${tokens.length} notifications failed: ${codes.join(', ')}`);
            }
            return response.responses
                .map((item, index) => ({ item, token: tokens[index] }))
                .filter(({ item }) => !item.success && isInvalidTokenError(item.error))
                .map(({ token }) => token);
        } catch (error) {
            console.error('[PUSH] Send failed:', error.message);
            return [];
        }
    }

    status() {
        return {
            enabled: this.enabled,
            firebaseEnvConfigured: hasFirebaseEnv(),
            credentialSource: this.credentialSource,
            initError: this.initError,
        };
    }

    _init() {
        let admin;
        try {
            admin = require('firebase-admin');
        } catch (error) {
            this.initError = 'firebase-admin is not installed';
            console.warn('[PUSH] firebase-admin is not installed. Push notifications disabled.');
            return;
        }

        const credential = this._credential(admin);
        if (!credential) {
            console.log('[PUSH] No Firebase credentials set. Push notifications disabled.');
            return;
        }

        if (admin.apps.length === 0) {
            try {
                admin.initializeApp({ credential });
            } catch (error) {
                this.initError = error.message;
                console.error('[PUSH] Firebase initialization failed:', error.message);
                return;
            }
        }

        this.messaging = admin.messaging();
        this.enabled = true;
        this.initError = null;
        console.log('[PUSH] Firebase Cloud Messaging enabled');
    }

    _credential(admin) {
        const rawJson = cleanEnvValue(
            process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
            'FIREBASE_SERVICE_ACCOUNT_JSON'
        );
        const rawBase64 = cleanEnvValue(
            process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
            'FIREBASE_SERVICE_ACCOUNT_BASE64'
        );

        if (rawJson || rawBase64) {
            try {
                const json = rawJson || Buffer.from(rawBase64, 'base64').toString('utf8');
                const parsed = JSON.parse(json);
                if (typeof parsed.private_key === 'string') {
                    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
                }
                this.credentialSource = rawJson ? 'FIREBASE_SERVICE_ACCOUNT_JSON' : 'FIREBASE_SERVICE_ACCOUNT_BASE64';
                return admin.credential.cert(parsed);
            } catch (error) {
                this.initError = error.message;
                console.error('[PUSH] Firebase service account JSON is invalid: ', error.message);
                return null;
            }
        }

        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            this.credentialSource = 'GOOGLE_APPLICATION_CREDENTIALS';
            return admin.credential.applicationDefault();
        }

        return null;
    }
}

function cleanEnvValue(value, keyName) {
    let text = String(value || '').trim();
    if (!text) return '';

    if (keyName && text.startsWith(`${keyName}=`)) {
        text = text.substring(keyName.length + 1).trim();
    }

    const quoted =
        (text.startsWith('"') && text.endsWith('"')) ||
        (text.startsWith("'") && text.endsWith("'"));

    if (!quoted) return text;

    try {
        const parsed = JSON.parse(text);
        return typeof parsed === 'string' ? parsed.trim() : text;
    } catch (_) {
        return text.substring(1, text.length - 1).trim();
    }
}

function hasFirebaseEnv() {
    return !!(
        cleanEnvValue(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, 'FIREBASE_SERVICE_ACCOUNT_JSON') ||
        cleanEnvValue(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'FIREBASE_SERVICE_ACCOUNT_BASE64') ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS
    );
}

function isInvalidTokenError(error) {
    const code = error?.code || '';
    return code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered';
}

function stringifyData(data) {
    const value = data && typeof data === 'object' ? data : {};
    const result = {};
    for (const [key, item] of Object.entries(value)) {
        result[key] = String(item ?? '');
    }
    return result;
}

module.exports = PushService;
