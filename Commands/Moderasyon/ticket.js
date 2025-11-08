const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    PermissionsBitField, 
    REST, 
    Routes, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    ChannelType 
} = require("discord.js");

// 🔑 Token and Owner ID here
const BOT_TOKEN = "MTQzNjMwNjIzMzc1Njg4MDg5Ng.G94uKw.kqzUwr-yYQCi1lMzhfP6Yun9plrJPWqZr5KL0A";   // Write your bot token here
const OWNER_ID = "1018202307801915532";

// Bot client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// Counter
let ticketCounter = 0;
const activeTickets = new Map();

// 🔢 Format ticket numbers as 0001
function formatTicketNumber(num) {
    return num.toString().padStart(4, "0");
}

// When the bot is ready
client.once("ready", async () => {
    console.log(`🤖 Bot logged in as: ${client.user.tag}`);

    // Register slash commands
    const commands = [
        {
            name: "ticket",
            description: "Opens a support ticket"
        },
        {
            name: "shutdown",
            description: "Shuts down the bot (owner only)"
        }
    ];

    const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
    try {
        console.log("⏳ Loading slash commands...");
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log("✅ Slash commands loaded.");
    } catch (err) {
        console.error("❌ Error while loading slash commands:", err);
    }
});

// Interaction listener
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    // 🎫 Ticket Command
    if (interaction.isChatInputCommand() && interaction.commandName === "ticket") {
        const existing = activeTickets.get(interaction.user.id);
        if (existing) {
            return interaction.reply({ 
                content: "❌ You already have an open ticket.", 
                ephemeral: true 
            });
        }

        ticketCounter++;
        const formatted = formatTicketNumber(ticketCounter);

        const channel = await interaction.guild.channels.create({
            name: `ticket-${formatted}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: interaction.guild.roles.everyone.id,
                    deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
                }
            ]
        });

        activeTickets.set(interaction.user.id, channel.id);

        const closeBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("close_ticket")
                .setLabel("❌ Close Ticket")
                .setStyle(ButtonStyle.Danger)
        );

        await channel.send({ 
            content: `🎟️ ${interaction.user} opened a ticket!`, 
            components: [closeBtn] 
        });

        return interaction.reply({ 
            content: `✅ Your ticket has been created: ${channel}`, 
            ephemeral: true 
        });
    }

    // 🔒 Shutdown Command
    if (interaction.isChatInputCommand() && interaction.commandName === "shutdown") {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ 
                content: "❌ Only the bot owner can use this command.", 
                ephemeral: true 
            });
        }

        await interaction.reply("🛑 Bot shutting down in 3 seconds...");
        setTimeout(() => process.exit(0), 3000);
    }

    // ❌ Close Ticket Button
    if (interaction.isButton() && interaction.customId === "close_ticket") {
        const channel = interaction.channel;
        const ownerId = [...activeTickets.entries()]
            .find(([_, c]) => c === channel.id)?.[0];

        if (ownerId) activeTickets.delete(ownerId);

        await interaction.reply("✅ Closing ticket...");
        setTimeout(() => channel.delete().catch(() => {}), 2000);
    }
});

// If a channel is manually deleted, clean up the Map
client.on("channelDelete", channel => {
    for (const [userId, chId] of activeTickets.entries()) {
        if (chId === channel.id) {
            activeTickets.delete(userId);
            break;
        }
    }
});

// Run the bot
client.login(BOT_TOKEN);
