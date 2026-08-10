import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { AuthorityManager } from '#managers';

const PUNISHMENT_VALUES = [
  'no-choice',
  'ban',
  'kick',
  'jail',
  'remove-roles',
  'remove-authorities',
  'remove-authorities-and-roles-give-jail',
  'disable-role-authorities',
  'ban-and-disable-guild-authorities',
];

export default {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Genel sunucu koruma ayarlarini yonet (prefix, log, jail, ceza turu, limit)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('prefix').setDescription('Onek (prefix) ayarla')
        .addStringOption(o => o.setName('deger').setDescription('Yeni prefix (ornegin !, ., &)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('log-channel').setDescription('Log atilacak kanali ayarla')
        .addChannelOption(o => o.setName('kanal').setDescription('Log kanali')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('jail-role').setDescription('Jail (cezali) rolunu ayarla')
        .addRoleOption(o => o.setName('rol').setDescription('Jail rolu').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('punishment-type').setDescription('Ihlal durumunda uygulanacak cezayi belirle')
        .addStringOption(o => {
          const opt = o.setName('tur').setDescription('Ceza turu').setRequired(true);
          PUNISHMENT_VALUES.forEach(v => opt.addChoices({ name: v, value: v }));
          return opt;
        })
    )
    .addSubcommand(sub =>
      sub.setName('limit').setDescription('Kick Ban limiti (kickBanLimitGuard icin)')
        .addIntegerOption(o => o.setName('deger').setDescription('Limit (0 = sinirsiz)').setMinValue(0).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('main-toggle').setDescription('Tum koruma sistemini ac/kapat (enable)')
        .addBooleanOption(o => o.setName('durum').setDescription('Acmak icin True, kapatmak icin False').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('list').setDescription('Tum genel ayarlari listele')),

  async execute(interaction) {
    const { guildConfigFindById, guildConfigUpdate } = await import('#services');
    const { themes, penalties } = await import('#data');
    const { themeBuilder } = await import('#libs');

    await interaction.deferReply({ ephemeral: false });

    if (!interaction.guild) return interaction.editReply({ content: 'Bu komut sadece sunucularda kullanılabilir.' });

    const authority = new AuthorityManager(interaction.client, interaction.guild);
    const allowed = await authority.isGuildOwnerOrBotOwner(interaction.user.id, interaction.guild);
    if (!allowed) return interaction.editReply({ content: '❌ Bu komutu **sadece sunucu sahibi** veya **bot sahibi** kullanabilir.' });

    const guildId = interaction.guild.id;
    const tb = new themeBuilder(interaction.guild);
    const subcommand = interaction.options.getSubcommand();

    async function respondOk(description) {
      const theme = await tb.embedThemeBuilder(themes.success, {
        action: true,
        title: 'Ayarlar Guncellendi',
        author: tb.getNameAndAvatars('guild'),
        description,
        footer: tb.getNameAndAvatars('user', interaction.user),
      });
      return interaction.editReply({ embeds: [theme.embed] });
    }

    async function respondList(description) {
      const theme = await tb.embedThemeBuilder(themes.classic, {
        action: true,
        title: 'Genel Ayarlar',
        author: tb.getNameAndAvatars('guild'),
        description,
        footer: tb.getNameAndAvatars('user', interaction.user),
      });
      return interaction.editReply({ embeds: [theme.embed] });
    }

    if (subcommand === 'list') {
      const cfg = await guildConfigFindById(guildId);
      if (!cfg.success) return interaction.editReply({ content: 'Ayarlar yuklenemedi.' });
      const d = cfg.data;
      const punishmentLabel = Object.values(penalties || {}).includes(d.punishmentType)
        ? d.punishmentType
        : (PUNISHMENT_VALUES.includes(d.punishmentType) ? d.punishmentType : String(d.punishmentType));
      const enableText = d.enable ? '🟢 ACIK' : '🔴 KAPALI';
      const description = [
        `**Ana Koruma (enable):** ${enableText}`,
        '',
        `**Prefix:** \`${d.prefix ?? '—'}\``,
        `**Log Kanali:** ${d.logChannelId ? `<#${d.logChannelId}> (\`${d.logChannelId}\`)` : '— Ayarlanmamis'}`,
        `**Jail Rolü:** ${d.jailRoleId ? `<@&${d.jailRoleId}> (\`${d.jailRoleId}\`)` : '— Ayarlanmamis'}`,
        `**Ceza Turu:** \`${punishmentLabel}\``,
        `**Kick Ban Limiti:** \`${d.limit ?? 0}\` (0 = sinirsiz)`,
      ].join('\n');
      return respondList(description);
    }

    if (subcommand === 'prefix') {
      const deger = interaction.options.getString('deger');
      const res = await guildConfigUpdate(guildId, { prefix: deger });
      if (!res.success) return interaction.editReply({ content: 'Guncelleme basarisiz.' });
      return respondOk(`Prefix basariyla \`${deger}\` olarak ayarlandi.`);
    }

    if (subcommand === 'log-channel') {
      const channel = interaction.options.getChannel('kanal');
      if (!channel) return interaction.editReply({ content: 'Kanal bilgisi alinamadi.' });
      const res = await guildConfigUpdate(guildId, { logChannelId: channel.id });
      if (!res.success) return interaction.editReply({ content: 'Guncelleme basarisiz.' });
      return respondOk(`Log kanali basariyla <#${channel.id}> olarak ayarlandi.`);
    }

    if (subcommand === 'jail-role') {
      const role = interaction.options.getRole('rol');
      if (!role) return interaction.editReply({ content: 'Rol bilgisi alinamadi.' });
      const res = await guildConfigUpdate(guildId, { jailRoleId: role.id });
      if (!res.success) return interaction.editReply({ content: 'Guncelleme basarisiz.' });
      return respondOk(`Jail rolu basariyla <@&${role.id}> olarak ayarlandi.`);
    }

    if (subcommand === 'punishment-type') {
      const tur = interaction.options.getString('tur');
      const res = await guildConfigUpdate(guildId, { punishmentType: tur });
      if (!res.success) return interaction.editReply({ content: 'Guncelleme basarisiz.' });
      return respondOk(`Ceza turu basariyla **${tur}** olarak ayarlandi.`);
    }

    if (subcommand === 'limit') {
      const deger = interaction.options.getInteger('deger');
      const res = await guildConfigUpdate(guildId, { limit: deger });
      if (!res.success) return interaction.editReply({ content: 'Guncelleme basarisiz.' });
      const text = deger === 0 ? 'sinirsiz' : `${deger}`;
      return respondOk(`Kick ban limiti basariyla **${text}** olarak ayarlandi.`);
    }

    if (subcommand === 'main-toggle') {
      const durum = interaction.options.getBoolean('durum');
      const res = await guildConfigUpdate(guildId, { enable: durum });
      if (!res.success) return interaction.editReply({ content: 'Guncelleme basarisiz.' });
      const durumText = durum ? '✅ ACIK' : '❌ KAPALI';
      return respondOk(`Tum koruma sistemi (ana enable) **${durumText}** durumuna getirildi.`);
    }
  },
};
