import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { AuthorityManager } from '#managers';

const BOOL_SETTINGS = [
  { key: 'isAuthorityEnable', label: 'Whitelist Sistemi' },
  { key: 'isAuthorities', label: 'Yetki Bazli Kontrol' },
];

export default {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Guvenli (whitelist) kullanici ve roller ile yetki anahtarlarini yonet')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup(group =>
      group
        .setName('user')
        .setDescription('Guvenli kullanici ekle / kaldir')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Guvenli listeye kullanici ID ekle')
            .addStringOption(o => o.setName('id').setDescription('Kullanici ID').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('Guvenli listeden kullanici ID kaldir')
            .addStringOption(o => o.setName('id').setDescription('Kullanici ID').setRequired(true))
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('role')
        .setDescription('Guvenli rol ekle / kaldir')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Guvenli listeye rol ID ekle')
            .addStringOption(o => o.setName('id').setDescription('Rol ID').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('Guvenli listeden rol ID kaldir')
            .addStringOption(o => o.setName('id').setDescription('Rol ID').setRequired(true))
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('settings')
        .setDescription('Anahtarlari ac/kapat veya tum listeyi goruntule')
        .addSubcommand(sub =>
          sub
            .setName('toggle')
            .setDescription('isAuthorityEnable / isAuthorities anahtarlarini ac/kapat')
            .addStringOption(o => {
              const opt = o.setName('ayar').setDescription('Degistirilecek ayar').setRequired(true);
              BOOL_SETTINGS.forEach(s => opt.addChoices({ name: s.key, value: s.key }));
              return opt;
            })
            .addBooleanOption(o => o.setName('durum').setDescription('Acmak icin True, kapatmak icin False').setRequired(true))
        )
        .addSubcommand(sub => sub.setName('list').setDescription('Whitelist ayarlarinin tamamini listele'))
    ),

  async execute(interaction) {
    const {
      guildConfigFindById,
      addWhitelistItem,
      removeWhitelistItem,
      setBooleanSetting,
    } = await import('#services');
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
    const tb = new themeBuilder(interaction.guild);
    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    async function respondOk(description) {
      const theme = await tb.embedThemeBuilder(themes.success, {
        action: true,
        title: 'Whitelist Ayari',
        author: tb.getNameAndAvatars('guild'),
        description,
        footer: tb.getNameAndAvatars('user', interaction.user),
      });
      return interaction.editReply({ embeds: [theme.embed] });
    }

    async function respondList(description) {
      const theme = await tb.embedThemeBuilder(themes.classic, {
        action: true,
        title: 'Whitelist Listesi',
        author: tb.getNameAndAvatars('guild'),
        description,
        footer: tb.getNameAndAvatars('user', interaction.user),
      });
      return interaction.editReply({ embeds: [theme.embed] });
    }

    if (subcommandGroup === 'user') {
      const id = interaction.options.getString('id');
      if (!/^\d{17,20}$/.test(id)) return interaction.editReply({ content: 'Gecerli bir kullanici ID girin (17-20 haneli sayi).' });
      if (subcommand === 'add') {
        const res = await addWhitelistItem(guildId, { type: 'members', id });
        return respondOk(res.success ? `✅ <@${id}> (\`${id}\`) basariyla guvenli kullanici listesine eklendi.` : `⚠️ ${res.message}`);
      }
      if (subcommand === 'remove') {
        const res = await removeWhitelistItem(guildId, { type: 'members', id });
        return respondOk(res.success ? `✅ <@${id}> (\`${id}\`) basariyla guvenli kullanici listesinden kaldirildi.` : `⚠️ ${res.message}`);
      }
    }

    if (subcommandGroup === 'role') {
      const id = interaction.options.getString('id');
      if (!/^\d{17,20}$/.test(id)) return interaction.editReply({ content: 'Gecerli bir rol ID girin (17-20 haneli sayi).' });
      if (subcommand === 'add') {
        const res = await addWhitelistItem(guildId, { type: 'roles', id });
        return respondOk(res.success ? `✅ <@&${id}> (\`${id}\`) basariyla guvenli rol listesine eklendi.` : `⚠️ ${res.message}`);
      }
      if (subcommand === 'remove') {
        const res = await removeWhitelistItem(guildId, { type: 'roles', id });
        return respondOk(res.success ? `✅ <@&${id}> (\`${id}\`) basariyla guvenli rol listesinden kaldirildi.` : `⚠️ ${res.message}`);
      }
    }

    if (subcommandGroup === 'settings') {
      if (subcommand === 'toggle') {
        const setting = interaction.options.getString('ayar');
        const durum = interaction.options.getBoolean('durum');
        const meta = BOOL_SETTINGS.find(s => s.key === setting);
        if (!meta) return interaction.editReply({ content: 'Gecersiz ayar.' });
        const res = await setBooleanSetting(guildId, { setting, value: durum });
        if (!res.success) return interaction.editReply({ content: res.message || 'Guncelleme basarisiz.' });
        const durumText = durum ? '✅ ACIK' : '❌ KAPALI';
        return respondOk(`**${meta.label} (${setting})** ayari basariyla **${durumText}** durumuna getirildi.`);
      }

      if (subcommand === 'list') {
        const cfg = await guildConfigFindById(guildId);
        if (!cfg.success) return interaction.editReply({ content: 'Ayarlar yuklenemedi.' });
        const data = cfg.data;
        const statusLine = (key, label) => {
          const val = data[key];
          return `${val ? '🟢' : '🔴'} **${label}** (\`${key}\`): **${val ? 'ACIK' : 'KAPALI'}**`;
        };
        const members = (data.members || []).map(id => `- <@${id}> \`${id}\``).join('\n') || '_Liste bos_';
        const roles = (data.roles || []).map(id => `- <@&${id}> \`${id}\``).join('\n') || '_Liste bos_';
        const description = [
          '**Ayarlar:**',
          statusLine('isAuthorityEnable', 'Whitelist Sistemi'),
          statusLine('isAuthorities', 'Yetki Bazli Kontrol'),
          '',
          '**Guvenli Kullanicilar (members):**',
          members,
          '',
          '**Guvenli Roller (roles):**',
          roles,
        ].join('\n');
        return respondList(description);
      }
    }
  },
};
