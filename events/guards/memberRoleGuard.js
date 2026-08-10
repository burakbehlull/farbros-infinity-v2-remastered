import Manager from "#managers";
import { themes, penalties } from "#data";
import { PermissionFlagsBits } from 'discord.js';

const DANGEROUS_FLAGS = [
  ['Administrator', PermissionFlagsBits.Administrator],
  ['ManageGuild', PermissionFlagsBits.ManageGuild],
  ['ManageRoles', PermissionFlagsBits.ManageRoles],
  ['ManageChannels', PermissionFlagsBits.ManageChannels],
  ['ManageWebhooks', PermissionFlagsBits.ManageWebhooks],
  ['KickMembers', PermissionFlagsBits.KickMembers],
  ['BanMembers', PermissionFlagsBits.BanMembers],
  ['ModerateMembers', PermissionFlagsBits.ModerateMembers],
  ['ManageMessages', PermissionFlagsBits.ManageMessages],
  ['MentionEveryone', PermissionFlagsBits.MentionEveryone],
];
const DANGEROUS_BITFIELD = DANGEROUS_FLAGS.reduce((acc, [, v]) => acc | BigInt(v), 0n);

function roleHasDangerous(role) {
  if (!role?.permissions) return { has: false, names: [] };
  const p = BigInt(role.permissions.bitfield);
  const names = [];
  for (const [name, bit] of DANGEROUS_FLAGS) {
    if ((p & BigInt(bit)) === BigInt(bit)) names.push(name);
  }
  return { has: names.length > 0, names };
}

export default {
	name: "guildMemberUpdate",
	async execute(client, oldMember, newMember) {
		try {
			
		  const { authority, theme: tb, audit, punish, flags } = new Manager(client, {
			action: oldMember,
		  })

		  const isEnable = await authority.isEnable("memberRoleGuard")
		  if (!isEnable) return;

		  if (!oldMember || !newMember || !oldMember.guild) return;
		  if (oldMember.user?.bot) return;

		  const oldRoles = oldMember.roles.cache
		  const newRoles = newMember.roles.cache

		  const addedRoles = newRoles.filter((r) => !oldRoles.has(r.id))
		  const removedRoles = oldRoles.filter((r) => !newRoles.has(r.id))
		  
		  if (addedRoles.size === 0 && removedRoles.size === 0) return;

		  let dangerousAdded = { has: false, rolesAndPerms: [] };
		  for (const [rid, role] of addedRoles) {
			const info = roleHasDangerous(role);
			if (info.has) {
			  dangerousAdded.has = true;
			  dangerousAdded.rolesAndPerms.push(`- @${role.name} (\`${rid}\`): \`${info.names.join(', ')}\``);
			}
		  }

		  const control = await authority.control({
			audit: audit.MemberRoleUpdate,
			levels: dangerousAdded.has ? ["high", "mid", "low"] : ["mid"],
		  });
		  
		  if (control.status) return;

		  const userId = control.userId;
		  if (!userId) return;

		  await newMember.roles.set([...oldRoles.keys()]).catch((e) => {
		    console.warn(`[memberRoleGuard] rol geri alma başarısız (${newMember.id}):`, e.message);
		  })

		  let punishment;
		  if (dangerousAdded.has) {
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
			})
		  } else {
			punishment = await punish.execute(userId, {
			  choose: penalties.removeAuthorities,
			  permissions: [flags.Administrator, flags.ManageRoles, flags.ManageGuild, 
				flags.ManageChannels, flags.KickMembers, flags.BanMembers]
			})
		  }

		  const user = await tb.getUser(userId);
		  const target = oldMember?.user ? `${oldMember.user.tag} (\`${oldMember.id}\`)` : `${oldMember}`;
		  const detailLine = dangerousAdded.has
			? `**Kullanıcıya tehlikeli yetkili rol(ler) verildi:**\n${dangerousAdded.rolesAndPerms.join('\n')}\n→ Rolleri geri alındı, yapan kişinin yetkileri silindi.`
			: `Üyenin rolleri geri alındı.`;

		  const theme = await tb.embedThemeBuilder(themes.success, {
			action: true,
			title: dangerousAdded.has ? "Authority Guard -> Tehlikeli Rol Ekleme!" : "Authority Guard -> Member Update",
			author: tb.getNameAndAvatars("guild"),
			description: `${user} kullanıcısı, **${target}** adlı üyenin rollerini değiştirdi. ${detailLine} ${punishment?.success ? punishment?.message : ""}`,
			footer: tb.getNameAndAvatars("user", user),
		  })

		  await theme.log()
	} catch (error) {
		console.error("Error handling member update:", error);
	  }
	},
}
