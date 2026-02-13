const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
const router = express.Router();
const pino = require("pino");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");

const { upload } = require('./mega');

function removeFile(FilePath) {
    if (fs.existsSync(FilePath)) {
        fs.rmSync(FilePath, { recursive: true, force: true });
    }
}

router.get('/', async (req, res) => {
    let num = req.query.number;

    // ✅ FIX 1: Number validation
    if (!num) {
        return res.status(400).send({ error: "Number is required" });
    }

    num = num.replace(/[^0-9]/g, '');

    const { state, saveCreds } = await useMultiFileAuthState('./session');

    try {
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(
                    state.keys,
                    pino({ level: "silent" })
                ),
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
        });

        sock.ev.on('creds.update', saveCreds);

        // ✅ FIX 2: Controlled connection handling
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === "open") {
                try {
                    await delay(8000);

                    const authPath = './session/';
                    const userJid = jidNormalizedUser(sock.user.id);

                    function randomMegaId(length = 6, numberLength = 4) {
                        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                        let result = '';
                        for (let i = 0; i < length; i++) {
                            result += chars.charAt(Math.floor(Math.random() * chars.length));
                        }
                        const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                        return `${result}${number}`;
                    }

                    const megaUrl = await upload(
                        fs.createReadStream(authPath + 'creds.json'),
                        `${randomMegaId()}.json`
                    );

                    const sessionId = megaUrl.replace('https://mega.nz/file/', '');

                    await sock.sendMessage(userJid, { text: sessionId });

                } catch (err) {
                    console.log("Upload/send error:", err);
                }

                await delay(1000);
                removeFile('./session');
                process.exit(0); // ✅ FIX 3: Now reachable
            }

            // ✅ FIX 4: Safe reconnect (no recursion)
            if (connection === "close") {
                const statusCode = lastDisconnect?.error?.output?.statusCode;

                if (statusCode !== 401) {
                    console.log("Reconnecting...");
                } else {
                    console.log("Session logged out.");
                    removeFile('./session');
                }
            }
        });

        // Pairing section
        if (!sock.authState.creds.registered) {
            await delay(1500);
            const code = await sock.requestPairingCode(num);

            if (!res.headersSent) {
                return res.send({ code });
            }
        }

    } catch (err) {
        console.log("Fatal error:", err);
        removeFile('./session');

        if (!res.headersSent) {
            return res.status(500).send({ error: "Service Unavailable" });
        }
    }
});

process.on('uncaughtException', function (err) {
    console.log('Uncaught exception:', err);
});

module.exports = router;
