import pkg from '@whiskeysockets/baileys';
const { proto } = pkg;
import config from '../../config.cjs'; // Ensure config has ANTI_DELETE setting

// Global toggle for anti-delete (based on config file)
let antiDeleteEnabled = config.ANTI_DELETE || false;  // Read the setting from config
const messageCache = new Map();
const sentMessages = new Set();  // Track sent deleted message IDs

// Define allowed groups and senders for forwarding messages
const allowedGroups = ['groupID1', 'groupID2'];  // Add allowed group IDs here
const allowedSenders = ['allowedSenderID1', 'allowedSenderID2'];  // Add allowed sender IDs here

const AntiDelete = async (m, Matrix) => {
    const prefix = config.PREFIX;
    const text = m.body.slice(prefix.length).trim().split(' ');
    const cmd = text[0]?.toLowerCase();
    const subCmd = text[1]?.toLowerCase();

    // Cache all messages (for content recovery)
    Matrix.ev.on('messages.upsert', ({ messages }) => {
        if (!antiDeleteEnabled) return;

        messages.forEach(msg => {
            if (msg.key.fromMe || !msg.message) return;
            messageCache.set(msg.key.id, {
                content: msg.message.conversation || 
                        msg.message.extendedTextMessage?.text ||
                        (msg.message.imageMessage ? '[Image]' :
                         msg.message.videoMessage ? '[Video]' :
                         msg.message.audioMessage ? '[Audio]' :
                         '[Media Message]'),
                sender: msg.key.participant || msg.key.remoteJid,
                timestamp: new Date().getTime(), // Save timestamp in milliseconds
                chatJid: msg.key.remoteJid
            });
        });
    });

    // Handle anti-delete commands
    if (cmd === 'antidelete') {
        try {
            if (subCmd === 'on') {
                antiDeleteEnabled = true;
                await m.reply(`╭━━━〔 *ANTI-DELETE* 〕━━━┈⊷
┃▸╭───────────
┃▸┃๏ *GLOBAL ACTIVATION*
┃▸└───────────···๏
╰────────────────┈⊷
Anti-delete protection is now *ACTIVE* in:
✦ All Groups
✦ Private Chats
✦ Every conversation

> *© 3 MEN ARMY*`);
                await m.React('✅');
            } 
            else if (subCmd === 'off') {
                antiDeleteEnabled = false;
                messageCache.clear();
                await m.reply(`╭━━━〔 *ANTI-DELETE* 〕━━━┈⊷
┃▸╭───────────
┃▸┃๏ *GLOBAL DEACTIVATION*
┃▸└───────────···๏
╰────────────────┈⊷
Anti-delete protection is now *DISABLED* everywhere.

> *© 3 MEN ARMY*`);
                await m.React('✅');
            }
            else {
                await m.reply(`╭━━━〔 *ANTI-DELETE* 〕━━━┈⊷
┃▸╭───────────
┃▸┃๏ *SYSTEM CONTROL*
┃▸└───────────···๏
╰────────────────┈⊷
*${prefix}antidelete on* - Activate everywhere
*${prefix}antidelete off* - Deactivate everywhere

Current Status: ${antiDeleteEnabled ? '✅ ACTIVE' : '❌ INACTIVE'}

> *© 3 MEN ARMY*`);
                await m.React('ℹ️');
            }
            return;
        } catch (error) {
            console.error('AntiDelete Command Error:', error);
            await m.React('❌');
        }
    }

    // Handle message deletions globally when enabled
    Matrix.ev.on('messages.update', async (update) => {
        if (!antiDeleteEnabled) return;

        try {
            for (const item of update) {
                const { key, update: { message: deletedMessage } } = item;

                // Skip messages from the bot itself (to avoid echoing its own deletions)
                if (key.fromMe) continue;

                // Check if the message comes from an allowed group or sender
                if (!allowedGroups.includes(key.remoteJid) && !allowedSenders.includes(key.participant)) {
                    console.log(`Skipped forwarding message from ${key.remoteJid} or ${key.participant}`);
                    continue;
                }

                // Cache and forward only non-redundant messages
                const cachedMsg = messageCache.get(key.id);
                if (!cachedMsg || sentMessages.has(key.id)) continue;  // Avoid sending duplicate forwarded messages

                const deletedMsgContent = cachedMsg.content;

                // Prepare the forwarded newsletter message details
                const forwardedMessage = {
                    text: `*DELETED MESSAGE*:\n\n${deletedMsgContent}`,
                    contextInfo: {
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363317462952356@newsletter',
                            newsletterName: "ᴊᴏᴇʟ xᴍᴅ ʙᴏᴛ",
                            serverMessageId: -1,
                        },
                        forwardingScore: 999, // Score to indicate it has been forwarded
                        externalAdReply: {
                            title: "ᴊᴏᴇʟ xᴍᴅ ʙᴏᴛ ᴠ¹⁰",
                            body: "ᴘɪɴɢ sᴘᴇᴇᴅ ᴄᴀʟᴄᴜʟᴀᴛɪᴏɴs",
                            thumbnailUrl: 'https://avatars.githubusercontent.com/u/162905644?v=4',
                            sourceUrl: 'https://whatsapp.com/channel/0029Vak2PevK0IBh2pKJPp2K',
                            mediaType: 1,
                            renderLargerThumbnail: false,
                        },
                    },
                };

                // Send the deleted message content as a forwarded message
                await Matrix.sendMessage(key.remoteJid, forwardedMessage, { quoted: m });

                // Mark the message as sent to prevent duplicate notifications
                sentMessages.add(key.id);

                // Remove the deleted message from cache
                messageCache.delete(key.id);
            }
        } catch (error) {
            console.error('Anti-Delete Handler Error:', error);
        }
    });

    // Cache Cleanup: Remove expired messages (1 minute expiration)
    setInterval(() => {
        const now = Date.now();
        messageCache.forEach((msg, key) => {
            if (now - msg.timestamp > 60000) {  // 1 minute expiration time
                messageCache.delete(key);
            }
        });
    }, 60000);
};

export default AntiDelete;
