import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { AuthorityManager } from '#managers';

const GUARD_LIST = [
  { key: 'roleDeleteGuard', label: 'Rol Silme Koruması' },
  { key: 'roleUpdateGuard', label: 'Rol Güncelleme Koruması' },
  { key: 'channelDeleteGuard', label: 'Kanal Silme Koruması' },
  { key: 'channelUpdateGuard', label: 'Kanal Güncelleme Koruması' },
  { key: 'botAddGuard', label: 'Bot Ekleme Koruması' },
  { key: 'webGuard', label: 'Webhook Koruması' },
  { key: 'memberRoleGuard', label: 'Üye Rol Değişimi' },
  { key: 'guildUrlGuard', label: 'Sunucu URL Koruması' },
  { key: 'guildUpdateGuard', label: 'Sunucu Güncelleme' },
  { key: 'kickGuard', label: 'Atma Koruması' },
  { key: 'banGuard', label: 'Yasaklama Koruması' },
  { key: 'kickBanLimitGuard', label: 'Kick Ban Limit' },
  { key: 'messageCommandExecuter', label: 'Mesaj Komutları' },
  { key: 'slashCommandExecuter', label: 'Slash Komutları' },
];

export default {
  data: new SlashCommandBuilder()
    .setName('guard')
    .setDescription('Guard ayarlarini yonet (Ac/Kapat/Listele)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('Belirli bir guardi ac veya kapat')
        .addStringOption(option => {
          const o = option
            .setName('guard')
            .setDescription('Islem yapilacak guard adi')
            .setRequired(true);
          GUARD_LIST.forEach(g => o.addChoices({ name: g.key, value: g.key }));
          return o;
        })
        .addBooleanOption(option =>
          option
            .setName('durum')
            .setDescription('Acmak icin True, kapatmak icin False')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Tum guardlarin mevcut durumunu listele')
    ),

  async execute(interaction) {
    const { guildConfigFindById, guildConfigUpdate } = await import('#services');
    const { themes } = await import('#data');
    const { themeBuilder } = await import('#libs');

    await interaction.deferReply({ ephemeral: false });

    if (!interaction.guild) {
      return interaction.editReply({ content: 'Bu komut sadece sunucularda kullanılabilir.' });
    }

    const authority = new AuthorityManager(interaction.client, interaction.guild);
    const allowed = await authority.isGuildOwnerOrBotOwner(interaction.user.id, interaction.guild);
    if (!allowed) {
      return interaction.editReply({ content: '❌ Bu komutu **sadece sunucu sahibi** veya **bot sahibi** kullanabilir.' });
    }

    const guildId = interaction.guild.id;
    const subcommand = interaction.options.getSubcommand();

    const cfg = await guildConfigFindById(guildId);
    if (!cfg.success) {
      return interaction.editReply({ content: 'Sunucu ayarlari yuklenemedi.' });
    }
    const guildData = cfg.data;

    const tb = new themeBuilder(interaction.guild);

    if (subcommand === 'toggle') {
      const guardKey = interaction.options.getString('guard');
      const durum = interaction.options.getBoolean('durum');

      const guardMeta = GUARD_LIST.find(g => g.key === guardKey);
      if (!guardMeta) {
        return interaction.editReply({ content: 'Gecersiz guard adi.' });
      }

      const updateRes = await guildConfigUpdate(guildId, { [guardKey]: durum });
      if (!updateRes.success) {
        return interaction.editReply({ content: 'Guard ayari guncellenemedi.' });
      }

      const durumText = durum ? '✅ ACIK' : '❌ KAPALI';
      const theme = await tb.embedThemeBuilder(themes.success, {
        action: true,
        title: 'Guard Ayarı Guncellendi',
        author: tb.getNameAndAvatars('guild'),
        description: `**${guardMeta.label} (${guardKey})** guardi basariyla **${durumText}** durumuna getirildi.`,
        footer: tb.getNameAndAvatars('user', interaction.user),
      });

      return interaction.editReply({ embeds: [theme.embed] });
    }

    if (subcommand === 'list') {
      const lines = GUARD_LIST.map(g => {
        const value = guildData[g.key];
        const statusEmoji = value ? '🟢' : '🔴';
        const statusText = value ? 'ACIK' : 'KAPALI';
        return `${statusEmoji} **${g.label}** (\`${g.key}\`): **${statusText}**`;
      });

      const theme = await tb.embedThemeBuilder(themes.success, {
        action: true,
        title: 'Guard Durumlari',
        author: tb.getNameAndAvatars('guild'),
        description: lines.join('\n'),
        footer: tb.getNameAndAvatars('user', interaction.user),
      });

      return interaction.editReply({ embeds: [theme.embed] });
    }
  },
};
