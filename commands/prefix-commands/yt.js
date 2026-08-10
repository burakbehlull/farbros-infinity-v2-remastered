import { PermissionFlagsBits } from 'discord.js';
import { AuthorityManager } from '#managers';

const DANGEROUS_FLAGS = [
  ['Administrator', PermissionFlagsBits.Administrator],
  ['ManageGuild', PermissionFlagsBits.ManageGuild],
  ['ManageRoles', PermissionFlagsBits.ManageRoles],
  ['ManageChannels', PermissionFlagsBits.ManageChannels],
  ['ManageWebhooks', PermissionFlagsBits.ManageWebhooks],
  ['ManageEmojisAndStickers', PermissionFlagsBits.ManageEmojisAndStickers],
  ['ManageNicknames', PermissionFlagsBits.ManageNicknames],
  ['KickMembers', PermissionFlagsBits.KickMembers],
  ['BanMembers', PermissionFlagsBits.BanMembers],
  ['ModerateMembers', PermissionFlagsBits.ModerateMembers],
  ['ManageMessages', PermissionFlagsBits.ManageMessages],
  ['MentionEveryone', PermissionFlagsBits.MentionEveryone],
  ['ViewAuditLog', PermissionFlagsBits.ViewAuditLog],
  ['ViewGuildInsights', PermissionFlagsBits.ViewGuildInsights],
  ['SendTTSMessages', PermissionFlagsBits.SendTTSMessages],
  ['DeafenMembers', PermissionFlagsBits.DeafenMembers],
  ['MoveMembers', PermissionFlagsBits.MoveMembers],
  ['PrioritySpeaker', PermissionFlagsBits.PrioritySpeaker],
];

const DANGEROUS_BITFIELD = DANGEROUS_FLAGS.reduce((acc, [, v]) => acc | v, 0n);

function flagsInCommon(permsBitfield) {
  const set = [];
  for (const [name, bit] of DANGEROUS_FLAGS) {
    if ((BigInt(permsBitfield) & BigInt(bit)) === BigInt(bit)) set.push(name);
  }
  return set;
}

export default {
  name: 'yt',
  description: 'Tüm rollerdeki tehlikeli yetkileri kapat / yedeği geri aç (.yt kapat | .yt aç)',
  async execute(client, message, args) {
    try {
      if (!message.guild) return message.reply('Bu komut sadece sunucularda çalışır.');
      if (!message.member) return;

      const authority = new AuthorityManager(client, message.guild);
      const allowed = await authority.isGuildOwnerOrBotOwner(message.author.id, message.guild);
      if (!allowed) {
        return message.reply('❌ Bu komutu **sadece sunucu sahibi** veya **bot sahibi** kullanabilir.');
      }

      const botMember = message.guild.members.me;
      if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply('❌ Botun Rolleri Yönet (ManageRoles) yetkisi yok. Önce bunu ver.');
      }

      const action = (args[0] || '').toLowerCase();

      const { saveRoleBackup, getRoleBackup, clearRoleBackup } = await import('#services');
      const { themes } = await import('#data');
      const { themeBuilder } = await import('#libs');
      const tb = new themeBuilder(message);

      if (action === 'kapat') {
        const roles = [...message.guild.roles.cache.values()]
          .filter(r => !r.managed && r.id !== message.guild.id)
          .sort((a, b) => b.position - a.position);

        const rolePermissionsMap = {};
        let touchedRoles = 0;
        let totalFlagsRemoved = 0;
        const failed = [];

        for (const role of roles) {
          const oldPerms = BigInt(role.permissions.bitfield);
          const riskyBits = oldPerms & BigInt(DANGEROUS_BITFIELD);
          if (riskyBits === 0n) continue;

          const flagsPresent = flagsInCommon(oldPerms);
          rolePermissionsMap[role.id] = {
            name: role.name,
            removed: flagsPresent,
            bitfield: String(riskyBits),
          };

          const newBitfield = oldPerms & ~BigInt(DANGEROUS_BITFIELD);
          try {
            await role.setPermissions(newBitfield.toString(), `YT KAPAT - ${message.author.tag} (${message.author.id})`);
            touchedRoles += 1;
            totalFlagsRemoved += flagsPresent.length;
          } catch (err) {
            failed.push(`- ${role.name} (\`${role.id}\`): ${err.message?.slice(0, 100) ?? err}`);
            delete rolePermissionsMap[role.id];
          }
        }

        saveRoleBackup(message.guild.id, String(DANGEROUS_BITFIELD), rolePermissionsMap);

        const summary = [
          `**${touchedRoles}** rol üzerinde **${totalFlagsRemoved}** adet tehlikeli yetki kapatıldı.`,
          touchedRoles > 0
            ? `Yedek kaydedildi: \`${Object.keys(rolePermissionsMap).length}\` rol. Geri getirmek için: \`.yt aç\``
            : 'Kapatılacak yetki içeren rol bulunamadı.',
        ];
        if (failed.length) summary.push('', `**Hata veren roller (${failed.length}):**`, ...failed);

        const theme = await tb.embedThemeBuilder(themes.success, {
          action: false,
          author: tb.getNameAndAvatars('guild', message),
          title: '🛡️Yetkiler Kapatıldı',
          description: summary.join('\n'),
          footer: tb.getNameAndAvatars('user', message),
        });
        return message.reply({ embeds: [theme] });
      }

      if (action === 'aç' || action === 'ac') {
        const backup = getRoleBackup(message.guild.id);
        if (!backup) {
          return message.reply('❌ Bu sunucu için kayıtlı bir YT yedeği yok. Önce `.yt kapat` çalıştırmalısın.');
        }

        const roleEntries = Object.entries(backup.roles || {});
        let restoredRoles = 0;
        let restoredFlags = 0;
        const skipped = [];
        const failed = [];

        for (const [roleId, info] of roleEntries) {
          const role = message.guild.roles.cache.get(roleId);
          if (!role) {
            skipped.push(`- Rol silinmiş: \`${roleId}\` (eskiden adı: **${info.name}**)`);
            continue;
          }
          try {
            const current = BigInt(role.permissions.bitfield);
            const toAdd = BigInt(info.bitfield);
            const merged = (current | toAdd).toString();
            await role.setPermissions(merged, `YT AÇ - ${message.author.tag} (${message.author.id})`);
            restoredRoles += 1;
            restoredFlags += (info.removed?.length ?? 0);
          } catch (err) {
            failed.push(`- ${role.name} (\`${role.id}\`): ${err.message?.slice(0, 100) ?? err}`);
          }
        }

        const summary = [
          `**${restoredRoles}** role **${restoredFlags}** adet yetki geri verildi.`,
        ];
        if (skipped.length) summary.push('', `**Atlanan (${skipped.length}):**`, ...skipped);
        if (failed.length) summary.push('', `**Hata veren (${failed.length}):**`, ...failed);
        summary.push('', `_Not: Yedek silinmedi. Tekrar açmak istersen tekrar \`.yt aç\` çalıştır. Sıfırlamak için \`.yt reset\`._`);

        const theme = await tb.embedThemeBuilder(themes.success, {
          action: false,
          author: tb.getNameAndAvatars('guild', message),
          title: 'Yetkiler Geri Açıldı',
          description: summary.join('\n'),
          footer: tb.getNameAndAvatars('user', message),
        });
        return message.reply({ embeds: [theme] });
      }

      if (action === 'reset' || action === 'sifirla') {
        const cleared = clearRoleBackup(message.guild.id);
        return message.reply(cleared
          ? '✅ YT yedeği sıfırlandı.'
          : '⚠️ Zaten kayıtlı bir YT yedeği yoktu.');
      }

      const theme = await tb.embedThemeBuilder(themes.classic, {
        action: false,
        author: tb.getNameAndAvatars('guild', message),
        title: 'Yetki Komutu',
        description: [
          '**Kullanım:**',
          '- `.yt kapat` → Tüm rollerdeki tehlikeli yetkileri sıfırlar, yedeğini alır.',
          '- `.yt aç` → `.yt kapat` ile alınan yedeğe göre **tam olarak aynı** rollere aynı yetkileri geri verir.',
          '- `.yt reset` → Kayıtlı yedeği siler.',
          '',
          `**Dikkat edilen yetkiler (${DANGEROUS_FLAGS.length}):**`,
          DANGEROUS_FLAGS.map(([n]) => `\`${n}\``).join(', '),
        ].join('\n'),
        footer: tb.getNameAndAvatars('user', message),
      });
      return message.reply({ embeds: [theme] });

    } catch (err) {
      console.error('❌ yt command error:', err);
      return message.reply('❌ Komut çalıştırılırken bir hata oluştu: ' + (err.message?.slice(0, 200) ?? err));
    }
  },
};
