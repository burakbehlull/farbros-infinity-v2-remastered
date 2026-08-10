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

const BOOL_LIST = [
  { key: 'isAuthorityEnable', label: 'Whitelist Sistemi' },
  { key: 'isAuthorities', label: 'Yetki Bazlı Kontrol' },
];

export default {
  data: new SlashCommandBuilder()
    .setName('durum')
    .setDescription('Sunucu koruma ayarlarının TAMAMINI tek seferde göster')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const { guildConfigFindById } = await import('#services');
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

    const cfg = await guildConfigFindById(interaction.guild.id);
    if (!cfg.success) return interaction.editReply({ content: 'Sunucu ayarları yüklenemedi.' });
    const d = cfg.data;
    const tb = new themeBuilder(interaction.guild);
    const nameAvatar = tb.getNameAndAvatars('user', interaction.user);
    const guildAvatar = tb.getNameAndAvatars('guild');

    const bool = (v) => v ? '🟢 AÇIK' : '🔴 KAPALI';

    const genelLines = [
      `**Ana Koruma (enable):** ${bool(d.enable)}`,
      `**Prefix:** \`${d.prefix ?? '—'}\``,
      `**Log Kanalı:** ${d.logChannelId ? `<#${d.logChannelId}> (\`${d.logChannelId}\`)` : '_Ayarlanmamış_'}`,
      `**Jail Rolü:** ${d.jailRoleId ? `<@&${d.jailRoleId}> (\`${d.jailRoleId}\`)` : '_Ayarlanmamış_'}`,
      `**Ceza Türü:** \`${d.punishmentType ?? '—'}\``,
      `**Kick/Ban Limiti:** \`${d.limit ?? 0}\` (0 = sınırsız)`,
      '',
      '**Whitelist Anahtarları:**',
      ...BOOL_LIST.map(s => `- **${s.label}** (\`${s.key}\`): ${bool(d[s.key])}`),
      '',
      `**Sunucu ID:** \`${interaction.guild.id}\``,
      `**Config Kaydı (guildId):** \`${d.guildId ?? interaction.guild.id}\``,
    ];
    const theme1 = await tb.embedThemeBuilder(themes.classic, {
      action: true,
      title: '🛡️  Genel Ayarlar',
      author: guildAvatar,
      description: genelLines.join('\n'),
      footer: nameAvatar,
    });

    const guardLines = GUARD_LIST.map(g => `- ${bool(d[g.key])}  **${g.label}** (\`${g.key}\`)`);
    const theme2 = await tb.embedThemeBuilder(themes.success, {
      action: true,
      title: '🛡️  Guard Durumları',
      author: guildAvatar,
      description: guardLines.join('\n'),
      footer: nameAvatar,
    });

    const members = (d.members || []).length === 0
      ? '_Boş_'
      : d.members.map(id => `- <@${id}> \`${id}\``).join('\n');
    const roles = (d.roles || []).length === 0
      ? '_Boş_'
      : d.roles.map(id => `- <@&${id}> \`${id}\``).join('\n');
    const auths = (d.authorities || []).length === 0
      ? '_Boş_'
      : d.authorities.map(a => `- \`${a}\``).join('\n');

    const whitelistLines = [
      BOOL_LIST.map(s => `${bool(d[s.key])} **${s.label}**`).join('   '),
      '',
      '**Güvenli Kullanıcılar (members):**',
      members,
      '',
      '**Güvenli Roller (roles):**',
      roles,
      '',
      '**İstisna Yetkiler (authorities):**',
      auths,
    ];
    const theme3 = await tb.embedThemeBuilder(themes.warn, {
      action: true,
      title: '🛡️  Whitelist & Güvenli Liste',
      author: guildAvatar,
      description: whitelistLines.join('\n'),
      footer: nameAvatar,
    });

    return interaction.editReply({ embeds: [theme1.embed, theme2.embed, theme3.embed] });
  },
};
