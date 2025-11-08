const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  REST,
  Routes,
  ApplicationCommandOptionType,
  PermissionsBitField
} = require("discord.js");

const fs = require("fs");
require("dotenv").config();

// =============== CONFIG ===============
const BOT_TOKEN = ""; // Token
const OWNER_ID = "";
const CLIENT_ID = ""; // Bot ID
const AUTO_ROLE_ID = ""; // Member rol ID
const ADMIN_ROLE_ID = ""; // ✅ Admin rol ID

const COUNTER_FILE = "./counter.json";

// Sayaç dosyası
function loadCounter() {
  if (!fs.existsSync(COUNTER_FILE)) {
    fs.writeFileSync(
      COUNTER_FILE,
      JSON.stringify({ counter: 0, tickets: {} }, null, 2)
    );
  }
  return JSON.parse(fs.readFileSync(COUNTER_FILE));
}

function saveCounter() {
  fs.writeFileSync(COUNTER_FILE, JSON.stringify(counterData, null, 2));
}

let counterData = loadCounter();

// Ticket numarası formatı
function formatTicketNumber(num) {
  if (num < 10) return `000${num}`;
  if (num < 100) return `00${num}`;
  if (num < 1000) return `0${num}`;
  return `${num}`;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel],
});

// ================== LOG SİSTEMİ ==================
let logChannelId = null; // sadece hafızada tutulacak

async function sendLog(guild, embed) {
  if (!logChannelId) return;
  const channel = guild.channels.cache.get(logChannelId);
  if (!channel) return;
  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("❌ Log could not be sent.:", err);
  }
}

// Bot hazır olduğunda
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Slash commandlar
  const commands = [
    {
      name: "ticketsetup",
      description: "Send ticket panel to a channel",
      options: [
        {
          name: "channel",
          description: "Channel to send ticket panel",
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
      ],
    },
    {
      name: "clear",
      description: "Delete messages in a channel",
      options: [
        {
          name: "amount",
          description: "Number of messages to delete",
          type: ApplicationCommandOptionType.Integer,
          required: true,
        },
      ],
    },
    {
      name: "log",
      description: "Set log channel",
      options: [
        {
          name: "create",
          description: "Set channel for logs",
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "channel",
              description: "Channel to send logs",
              type: ApplicationCommandOptionType.Channel,
              required: true,
            },
          ],
        },
      ],
    },
  ];

  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

  try {
    console.log("🔄 Registering slash commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands,
    });
    console.log("✅ Slash commands registered.");
  } catch (error) {
    console.error("❌ Error registering commands:", error);
  }
});

// Oto rol
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await member.roles.add(AUTO_ROLE_ID);
    console.log(`✅ ${member.user.tag} The user has been given an auto role`);
  } catch (err) {
    console.error("❌ Error while assigning the auto role:", err);
  }
});

// Slash komutları
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Ticket panel
  if (interaction.commandName === "ticketsetup") {
    const targetChannel = interaction.options.getChannel("channel");

    const embed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("🎟️ Support Tickets")
      .setDescription(
        "If you need help, click the button below to create a ticket.\n\n" +
        "Our team will assist you shortly."
      )
      .setFooter({ text: "Support System" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("🎟️ Create Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    await targetChannel.send({ embeds: [embed], components: [row] });

    await interaction.reply({
      content: `✅ Ticket panel has been sent to ${targetChannel}`,
      ephemeral: true,
    });
  }

  // Clear komutu
  if (interaction.commandName === "clear") {
    const amount = interaction.options.getInteger("amount");

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: "❌ You don't have permission to use this command.", ephemeral: true });
    }

    if (amount < 1 || amount > 100) {
      return interaction.reply({ content: "❌ You can delete between 1 and 100 messages at a time.", ephemeral: true });
    }

    await interaction.channel.bulkDelete(amount, true)
      .then(deleted => {
        interaction.reply({ content: `✅ Deleted ${deleted.size} messages.`, ephemeral: true });
      })
      .catch(err => {
        console.error(err);
        interaction.reply({ content: "❌ An error occurred while deleting messages.", ephemeral: true });
      });
  }

  // Log command
if (interaction.commandName === "log") {
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: "❌ You don’t have permission to use this command.", ephemeral: true });
  }

  const sub = interaction.options.getSubcommand();
  if (sub === "create") {
    const channel = interaction.options.getChannel("channel");
    logChannelId = channel.id;
    return interaction.reply({ content: `✅ Log channel has been set to ${channel}.`, ephemeral: true });
  }
}
});

// Button interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  try {
    if (interaction.customId === "create_ticket") {
      const userId = interaction.user.id;

      if (counterData.tickets[userId]) {
        await interaction.reply({
          content: "❌ You already have an open ticket!",
          ephemeral: true,
        });
        return;
      }

      counterData.counter++;
      const ticketNumber = formatTicketNumber(counterData.counter);

      const channel = await interaction.guild.channels.create({
        name: `ticket-${ticketNumber}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: userId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          {
            id: OWNER_ID,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageChannels,
            ],
          },
          {
            id: ADMIN_ROLE_ID, // ✅ Admin role permanently added
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageChannels,
            ],
          },
        ],
      });

      counterData.tickets[userId] = channel.id;
      saveCounter();

      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle(`🎟️ Ticket #${ticketNumber}`)
        .setDescription(`Ticket opened by <@${userId}>.\n\nPlease describe your issue, a staff member will assist you soon.`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("🔒 Close Ticket")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ embeds: [embed], components: [row] });

      await interaction.reply({
        content: `✅ Your ticket has been created: ${channel}`,
        ephemeral: true,
      });
    }

    if (interaction.customId === "close_ticket") {
      await interaction.reply({
        content: "🔒 Closing ticket...",
        ephemeral: true,
      });

      setTimeout(() => {
        const userId = Object.keys(counterData.tickets).find(
          (id) => counterData.tickets[id] === interaction.channel.id
        );

        if (userId) {
          delete counterData.tickets[userId];
          saveCounter();
        }

        interaction.channel.delete().catch(() => {});
      }, 2000);
    }
  } catch (err) {
    console.error("❌ Button error:", err);
    if (!interaction.replied) {
      await interaction.reply({
        content: "⚠️ An error occurred!",
        ephemeral: true,
      });
    }
  }
});

// If a channel is manually deleted, remove its ticket record
client.on(Events.ChannelDelete, (channel) => {
  const userId = Object.keys(counterData.tickets).find(
    (id) => counterData.tickets[id] === channel.id
  );
  if (userId) {
    delete counterData.tickets[userId];
    saveCounter();
  }
});

// ============= LOG EVENTS =============

// Channel created
client.on(Events.ChannelCreate, async (channel) => {
  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("📢 Channel Created")
    .setDescription(`🆕 ${channel} Channel Created.`)
    .setTimestamp();
  sendLog(channel.guild, embed);
});

// Channel deleted
client.on(Events.ChannelDelete, async (channel) => {
  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🗑️ Channel Deleted")
    .setDescription(`❌ **${channel.name}** Channel Deleted.`)
    .setTimestamp();
  sendLog(channel.guild, embed);
});

// Member banned
client.on(Events.GuildBanAdd, async (ban) => {
  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔨 User Banned")
    .setDescription(`🚫 ${ban.user.tag} was banned from the server.`)
    .setTimestamp();
  sendLog(ban.guild, embed);
});

// Ticket opened
client.on(Events.ChannelCreate, async (channel) => {
  if (channel.name.startsWith("ticket-")) {
    const embed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("🎟️ Ticket Opened")
      .setDescription(`📂 ${channel} channel has been created.`)
      .setTimestamp();
    sendLog(channel.guild, embed);
  }
});

// Ticket deleted
client.on(Events.ChannelDelete, async (channel) => {
  if (channel.name && channel.name.startsWith("ticket-")) {
    const embed = new EmbedBuilder()
      .setColor("Orange")
      .setTitle("🎟️ Ticket Deleted")
      .setDescription(`📂 ${channel.name} channel has been deleted.`)
      .setTimestamp();
    sendLog(channel.guild, embed);
  }
});

client.login(BOT_TOKEN);

// ================== EXPRESS SERVER (UptimeRobot) ==================
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(3000, () => {
  console.log("🌍 Web server started on port 3000");
});




