import { EmbedBuilder } from 'discord.js';

export default {
  name: 'test',
  description: 'Test command for theme builder.',
  async execute(client, message, args) {
    try {	  
	  const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setAuthor({
        name: message.guild?.name ?? message.author.username,
        iconURL: message.guild?.iconURL?.({ dynamic: true }) ?? message.author.displayAvatarURL({ dynamic: true }),
      })
      .setDescription('Test komutu başarıyla çalıştı! ✅')
      .setFooter({
        text: `${message.author.tag} tarafından çalıştırıldı`,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();
	  
	  message.reply({ embeds: [embed] });
    } catch (err) {
      console.error('Test command error: ', err);
	  message.reply('❌ Komut çalıştırılırken bir hata oluştu.');
    }
  },
};
