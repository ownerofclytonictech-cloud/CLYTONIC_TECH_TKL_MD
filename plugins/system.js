const si = require('systeminformation');
const config = require('../config');

const commands = [
    {
        name: 'system',
        aliases: ['status', 'server'],
        description: 'Show server stats (RAM, CPU, Uptime)',
        async execute({ sock, msg, from }) {
            const mem = await si.mem();
            const cpu = await si.currentLoad();
            const time = await si.time();
            
            const usedRam = (mem.active / 1024 / 1024 / 1024).toFixed(2);
            const totalRam = (mem.total / 1024 / 1024 / 1024).toFixed(2);
            const uptime = `${Math.floor(time.uptime / 3600)}h ${Math.floor((time.uptime % 3600) / 60)}m`;
            
            const statusText = `🖥️ *CLYTONIC SERVER STATUS*\n\n` +
                `🟢 *Server:* ONLINE\n` +
                `🔗 *Linked:* CONNECTED ✅\n` +
                `🧠 *RAM Usage:* ${usedRam} GB / ${totalRam} GB\n` +
                `⚙️ *CPU Load:* ${cpu.currentLoad.toFixed(2)}%\n` +
                `⏱️ *Uptime:* ${uptime}\n\n` +
                `_Powered by ${config.ownerName}_ ⚡`;
                
            await sock.sendMessage(from, { text: statusText }, { quoted: msg });
        }
    },
    {
        name: 'ram',
        description: 'Check bot RAM usage',
        async execute({ sock, msg, from }) {
            const mem = await si.mem();
            const used = (mem.active / 1024 / 1024).toFixed(2);
            await sock.sendMessage(from, { text: `🧠 *Bot RAM Usage:* ${used} MB` }, { quoted: msg });
        }
    },
    {
        name: 'owner',
        description: 'Show owner contact',
        async execute({ sock, msg, from }) {
            const text = `👑 *OWNER INFO*\n\n` +
                `📛 Name: ${config.ownerName}\n` +
                `📱 Number: +${config.ownerNumber}\n` +
                `📧 Email: ${config.ownerEmail}\n\n` +
                `_Powered by ${config.botName}_ ⚡`;
            await sock.sendMessage(from, { text }, { quoted: msg });
        }
    }
];

module.exports = { commands };
