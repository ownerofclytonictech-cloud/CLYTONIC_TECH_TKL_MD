const express = require('express');
const axios = require('axios');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('./config');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json()); // To parse JSON from the frontend

// Serve the HTML Dashboard
app.use(express.static('public'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Keep-alive ping endpoint
app.get('/ping', (req, res) => res.send('pong'));

// === GLOBAL SOCKET VARIABLE ===
let sock;

// === API ROUTE FOR PAIRING CODE ===
app.post('/api/pair', async (req, res) => {
    const { number } = req.body;
    if (!number) return res.status(400).json({ error: 'Phone number required' });
    
    try {
        if (!sock) return res.status(500).json({ error: 'Bot socket not ready yet. Wait 5 seconds.' });
        // Request the real code from WhatsApp
        const code = await sock.requestPairingCode(number);
        res.json({ code: code });
    } catch (err) {
        console.error("Pairing API Error:", err);
        res.status(500).json({ error: 'Failed to generate code. WhatsApp might be rate-limiting.' });
    }
});

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
    
    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: [config.botName, 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(`✅ ${config.botName} CONNECTED!`);
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
