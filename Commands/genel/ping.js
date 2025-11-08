const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Shows the bot's latency.'),
  
  async execute(interaction) {
    const ping = interaction.client.ws.ping;
    await interaction.reply(`Ping! Delay: **${ping}ms**`);
  }
}