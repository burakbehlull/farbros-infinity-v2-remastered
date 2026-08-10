import Manager from "#managers";
import { themes, penalties } from '#data'
import { PermissionFlagsBits } from 'discord.js';

const DANGEROUS_FLAGS = [
  ['Administrator', PermissionFlagsBits.Administrator],
  ['ManageGuild', PermissionFlagsBits.ManageGuild],
  ['ManageRoles', PermissionFlagsBits.ManageRoles],
  ['ManageChannels', PermissionFlagsBits.ManageChannels],
  ['ManageWebhooks', PermissionFlagsBits.ManageWebhooks],
  ['ManageEmojisAndStickers', PermissionFlagsBits.ManageEmojisAndStickers],
  ['KickMembers', PermissionFlagsBits.KickMembers],
  ['BanMembers', PermissionFlagsBits.BanMembers],
  ['ModerateMembers', PermissionFlagsBits.ModerateMembers],
  ['ManageMessages', PermissionFlagsBits.ManageMessages],
  ['MentionEveryone', PermissionFlagsBits.MentionEveryone],
  ['ViewAuditLog', PermissionFlagsBits.ViewAuditLog],
];
const DANGEROUS_BITFIELD = DANGEROUS_FLAGS.reduce((acc, [, v]) => acc | BigInt(v), 0n);

function addedDangerousPerms(oldBitfield, newBitfield) {
  const oldP = BigInt(oldBitfield ?? 0n);
  const newP = BigInt(newBitfield ?? 0n);
  const added = newP & ~oldP;
  const addedDangerous = added & DANGEROUS_BITFIELD;
  const names = [];
  for (const [name, bit] of DANGEROUS_FLAGS) {
    if ((addedDangerous & BigInt(bit)) === BigInt(bit)) names.push(name);
  }
  return { addedDangerous: addedDangerous !== 0n, names };
}

export default {
  name: "roleUpdate",
  async execute(client, oldRole, newRole) {
    try {
      const guild = oldRole?.guild ?? newRole?.guild;
      if (!guild || !oldRole || !newRole) return;
      if (oldRole.managed || newRole.managed) return;

      const { authority, theme: tb, audit, punish, flags } = new Manager(client, {
        action: oldRole
      });

      const isEnable = await authority.isEnable("roleUpdateGuard");
      if (!isEnable) return;

      const { addedDangerous, names: addedNames } = addedDangerousPerms(
        oldRole.permissions?.bitfield,
        newRole.permissions?.bitfield,
      );

      const control = await authority.control({
        audit: audit.RoleUpdate,
        levels: addedDangerous ? ["high", "mid", "low"] : ["low"],
      });

      if (control.status) return;

      const userId = control.userId;
      if (!userId) return;

      try {
        await newRole.edit({
          name: oldRole.name,
          color: oldRole.color,
          hoist: oldRole.hoist,
          mentionable: oldRole.mentionable,
          icon: oldRole.icon,
          unicodeEmoji: oldRole.unicodeEmoji,
          permissions: String(oldRole.permissions.bitfield),
          position: oldRole.position,
          reason: `Rol koruması: Geri alma - ${userId}`,
        });
      } catch (e) {
        console.warn(`[roleUpdateGuard] rol geri alma başarısız (${newRole.id}):`, e.message);
      }

      let punishment;
      if (addedDangerous) {
        punishment = await punish.execute(userId, {
          choose: penalties.removeAuthorities,
          permissions: [
            flags.Administrator,
            flags.ManageRoles,
            flags.ManageGuild,
            flags.ManageChannels,
            flags.ManageWebhooks,
            flags.ManageEmojisAndStickers,
            flags.KickMembers,
            flags.BanMembers,
            flags.ModerateMembers,
            flags.ManageMessages,
            flags.MentionEveryone,
            flags.ViewAuditLog,
          ]
        });
      } else {
        punishment = await punish.execute(userId);
      }

      const user = await tb.getUser(userId);
      const detailLine = addedDangerous
        ? `**Tehlikeli yetki eklendi:** \`${addedNames.join(', ')}\` → Yapılan kişinin yetkileri silindi.`
        : `Rol (ad/renk/ikon vb.) değişikliği geri alındı.`;

      const theme = await tb.embedThemeBuilder(themes.success, {
        action: true,
        title: addedDangerous ? 'Role Guard -> Tehlikeli Yetki Ekleme!' : 'Role Guard -> Role Update',
        author: tb.getNameAndAvatars("guild"),
        description: `${user} kullanıcı, **${oldRole.name}** (\`${oldRole.id}\`) rolünü güncelledi. ${detailLine} ${punishment?.success ? punishment?.message : ''}`,
        footer: tb.getNameAndAvatars("user", user)
      });

      await theme.log();

    } catch (error) {
      console.error('Error handling role update:', error);
    }
  },
};
