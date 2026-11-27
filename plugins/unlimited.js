const axios = require('axios');
const config = require('../config');

const commands = [
    {
        name: 'ai',
        aliases: ['chat', 'gpt'],
        description: 'Unlimited AI (No API Key)',
        async execute({ sock, msg, from, args }) {
            const query = args.join(' ');
            if (!query) return sock.sendMessage(from, { text: `❌ Usage: ${config.prefix}ai <question>` }, { quoted: msg });
            
            await sock.sendMessage(from, { text: '⏳ Thinking...' }, { quoted: msg });
            try {
                const res = await axios.get(`https://api.yanzbotz.my.id/api/ai/gpt4?query=${encodeURIComponent(query)}`);
                await sock.sendMessage(from, { text: `🤖 *AI:*\n\n${res.data.result}` }, { quoted: msg });
            } catch (e) {
                await sock.sendMessage(from, { text: `❌ AI Server busy.` }, { quoted: msg });
            }
        }
    },
    {
        name: 'ping',
        description: 'Check bot latency',
        async execute({ sock, msg, from }) {
            const start = Date.now();
            await sock.sendMessage(from, { text: '🏓 Pong!' }, { quoted: msg });
            const latency = Date.now() - start;
            await sock.sendMessage(from, { text: `⚡ Latency: ${latency}ms` });
        }
    }
];

module.exports = { commands };
