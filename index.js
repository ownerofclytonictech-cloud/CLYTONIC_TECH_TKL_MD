const express = require('express');
const axios = require('axios');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('./config');
const fs = require('fs');
const path = require('path');

// === WEB SERVER & ANTI-SLEEP ===
const app = express();

// Serve the HTML Dashboard
app.use(express.static('public'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Keep-alive ping endpoint
app.get('/ping', (req, res) => res.send('pong'));

app.listen(config.port, () => {
    console.log(`🌐 Web Server running on port ${config.port}`);
    setInterval(async () => {
        try {
            await axios.get(`${config.appUrl}/ping`);
            console.log('⚡ Anti-Sleep Ping Sent');
        } catch (e) {
            console.log('Ping failed');
        }
    }, 10 * 60 * 1000);
});

// === PLUGIN LOADER ===
const plugins = new Map();
function loadPlugins() {
    const pluginDir = path.join(__dirname, 'plugins');
    if (fs.existsSync(pluginDir)) {
        const files = fs.readdirSync(pluginDir).filter(f => f.endsWith('.js'));
        for (const file of files) {
            try {
                const plugin = require(`./plugins/${file}`);
                if (plugin.commands) {
                    plugin.commands.forEach(cmd => {
                        plugins.set(cmd.name, cmd);
                        if (cmd.aliases) cmd.aliases.forEach(a => plugins.set(a, cmd));
                    });
                }
            } catch (e) {
                console.log(`Error loading plugin ${file}:`, e.message);
            }
        }
    }
    console.log(`✅ ${plugins.size} commands loaded`);
}

// === WHATSAPP CONNECTION ===
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: [config.botName, 'Chrome', '1.0.0']
    });

    let codeInterval;

    // === AUTO-REFRESH PAIRING CODE ===
    if (!sock.authState.creds.registered) {
        const generateFreshCode = async () => {
            try {
                const code = await sock.requestPairingCode(config.ownerNumber);
                console.log(`\n=========================================`);
                console.log(`🔑 FRESH PAIRING CODE: ${code}`);
                console.log(`=========================================\n`);
            } catch (err) {
                // Ignore rate limits, try again in 50s
            }
        };
        setTimeout(generateFreshCode, 3000); 
        codeInterval = setInterval(generateFreshCode, 50000); 
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(`✅ ${config.botName} CONNECTED!`);
            if (codeInterval) clearInterval(codeInterval); // Stop generating codes once linked!
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        
        if (!text.startsWith(config.prefix)) return;
        
        const args = text.slice(config.prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        const plugin = plugins.get(command);
        if (plugin) {
            try {
                await plugin.execute({ sock, msg, from, sender, args, config });
            } catch (e) {
                sock.sendMessage(from, { text: `❌ Error: ${e.message}` }, { quoted: msg });
            }
        }
    });
}

loadPlugins();
startBot();
