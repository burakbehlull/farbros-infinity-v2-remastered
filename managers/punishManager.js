import { penalties } from '#data'
export default class PunishManager {
    constructor(client, action, options) {
        this.client = client
		this.options = options 
		this.action = action
		this.guild = action.guild ?? action
	}
	
	async ban(userId, reason){
		try {
			const guild = this.guild
			
			if (!userId || !guild) {
				return {
					success: false,
					error: `Geçersiz parametreler: userId=${userId}, guild var mı: ${!!guild}`
				}
			}
			
			let member = guild.members.cache.get(userId)
			if (!member) {
				try {
					member = await guild.members.fetch(userId)
				} catch (fetchErr) {
					console.warn(`[punishManager / ban]: Kullanıcı (${userId}) fetch edilemedi, doğrudan guild ban deneniyor`)
					try {
						const result = await guild.bans.create(userId, { deleteMessageSeconds: 0, reason })
						return {
							success: true,
							data: result
						}
					} catch (banErr) {
						console.error(`[punishManager / ban]: Direkt guild ban da başarısız (${userId}): `, banErr)
						return {
							success: false,
							error: banErr
						}
					}
				}
			}
			
			if (!member || typeof member.ban !== 'function') {
				return {
					success: false,
					error: `Kullanıcı (${userId}) bulunamadı veya ban metodu mevcut değil`
				}
			}
			
			const result = await member.ban({reason})
			
			return {
				success: true,
				data: result
			}
		} catch(err){
			console.error("[punishManager / ban]: ", err)
			return {
				success: false,
				error: err
			}
		}
       
    }
	
	async kick(userId, reason){
		try {
			const guild = this.guild
			
			if (!userId || !guild) {
				return {
					success: false,
					error: `Geçersiz parametreler: userId=${userId}, guild var mı: ${!!guild}`
				}
			}
			
			let member = guild.members.cache.get(userId)
			if (!member) {
				try {
					member = await guild.members.fetch(userId)
				} catch (fetchErr) {
					console.error(`[punishManager / kick]: Kullanıcı (${userId}) bulunamadı`)
					return {
						success: false,
						error: `Kullanıcı sunucuda bulunmuyor`
					}
				}
			}
			
			if (!member || typeof member.kick !== 'function') {
				return {
					success: false,
					error: `Kullanıcı (${userId}) bulunamadı veya kick metodu mevcut değil`
				}
			}
			
			const result = await member.kick({reason})
			
			return {
				success: true,
				data: result
			}
		} catch(err){
			console.error("[punishManager / kick]: ", err)
			return {
				success: false,
				error: err
			}
		}
       
    }

    async deleteAuthorityRoles(userId, permissions){
		try {
			if (!userId || !this.guild) {
				return { success: false, error: 'Geçersiz parametreler' }
			}

			let member = this.guild.members.cache.get(userId)
			if (!member) {
				try {
					member = await this.guild.members.fetch(userId)
				} catch (fetchErr) {
					console.error('[punishManager / deleteAuthorityRoles]: Kullanıcı bulunamadı!')
					return { success: false, error: 'Kullanıcı bulunamadı' }
				}
			}

			if(!permissions || !Array.isArray(permissions)){
				console.error('Yetkiler tanımlanmamış!')
				return { success: false, error: 'Yetkiler tanımlanmamış' }
			}
		
			const rolesWithPermissions = []
		
			for (const role of member.roles.cache.values()) {
				const hasPermission = permissions.every(permission => role.permissions.has(permission))
				
				if (hasPermission) {
					rolesWithPermissions.push(role)
				}
			}
		
			if (rolesWithPermissions.length === 0) return { success: true }

            for (const role of rolesWithPermissions) {
                await member.roles.remove(role)
            }
			
			return {
				success: true
			}
		} catch(err){
			console.error("[punishManager / deleteAuthorityRoles]: ", err)
			return {
				success: false,
				error: err
			}
		}
       
    }

	async deleteUserRoles(userId) {
		try {
			if (!userId || !this.guild) {
				return { success: false, error: 'Geçersiz parametreler' }
			}

			let member = this.guild.members.cache.get(userId);
			if (!member) {
				try {
					member = await this.guild.members.fetch(userId)
				} catch (fetchErr) {
					return { success: false, error: 'Kullanıcı bulunamadı' };
				}
			}

			const roles = member.roles.cache.filter((r) => r.id !== this.guild.id);
			if (roles.size === 0) return { success: true };

			for (const role of roles.values()) {
				await member.roles.remove(role);
			}
			
			return {
				success: true
			}
		} catch (err) {
			console.error("[PunishManager / deleteUserRoles]:", err);
			return {
				success: false,
				error: err
			}
		}
	}
	
	async jail(userId) {
		const { guildConfigFindById } = await import("#services")
		
		try {
			if (!userId || !this.guild) {
				return { success: false, error: "Geçersiz parametreler" }
			}

			const guildId = this.guild.id
			const guildConfig = await guildConfigFindById(guildId) 
			const jailRoleId = guildConfig?.data?.jailRoleId
			
			if(!jailRoleId){
				console.warn("Jail role id is null")
				return { success: false, error: "Jail rolü tanımlanmamış" }
			}
			
			let member = this.guild.members.cache.get(userId);
			if (!member) {
				try {
					member = await this.guild.members.fetch(userId)
				} catch (fetchErr) {
					return { success: false, error: "Kullanıcı bulunamadı" }
				}
			}

			await member.roles.add(jailRoleId);
			
			return {
				success: true,
			}
		} catch (error) {
			console.error("[PunishManager / jail]:", error);
			return { success: false, error }
		}
	}

	async disableRoleAuthorities(permissionsToRemove = []) {
		try {
			if (!this.guild) {
				return { success: false, error: 'Guild tanımlı değil' }
			}

			const roles = this.guild.roles.cache;

			for (const [id, role] of roles) {
				if (role.managed || role.name === "@everyone") continue;

				const newPerms = role.permissions.remove(permissionsToRemove);

				await role.setPermissions(newPerms).catch(() => {});
			}

			return {
				success: true,
			}
		} catch (error) {
			console.error("[PunishManager / disableRoleAuthorities]:", error);
			return { success: false, error }
		}
	}

	async execute(userId, {permissions=[], reason=null, choose=null}={}){
		
		try {
			if (!userId || !this.guild) {
				console.warn(`[punishManager / execute]: Geçersiz parametreler - userId: ${userId}, guild var mı: ${!!this.guild}`)
				return { success: false, error: 'Geçersiz parametreler' }
			}

			const { guildConfigFindById, createGuildConfig } = await import("#services");
			
			const guildId = this.guild.id

			const guildConfig = await guildConfigFindById(guildId)
			
			if(!guildConfig.success) {
				console.warn(`[punishManager / execute - ${guildId}]: guild config, null.`)
				return { success: false, error: 'Guild config bulunamadı' }
			}
				
			const guildData = guildConfig.data
			
			if(!guildData?.enable) {
				console.warn(`[punishManager / execute - ${guildId}]: Enable, false.`)
				return { success: false, error: 'Koruma kapalı' }
			}

			const choice = choose ? choose : guildData.punishmentType
			
			let result;
			switch(choice){
				
				case penalties.noChoice:
					
				return { success: false }
				
				case penalties.ban:
					result = await this.ban(userId, reason)
				return { message: `<@${userId}> (${userId}) kullanıcı banlandı`, ...result }
				
				
				case penalties.kick:
					result = await this.kick(userId, reason)
				return { message: `<@${userId}> (${userId}) kullanıcı atıldı`, ...result }
				
				
				case penalties.jail:
					result = await this.jail(userId)
				return { message: `<@${userId}> (${userId}) kullanıcı jaile atıldı`, ...result }
				
				
				case penalties.removeRoles:
					result = await this.deleteUserRoles(userId)
				return { message: `<@${userId}> (${userId}) kullanıcı'nın rolleri alındı`, ...result }
				
				
				case penalties.removeAuthorities:
					result = await this.deleteAuthorityRoles(userId, permissions)
				return { message: `<@${userId}> (${userId}) kullanıcı'nın yetkileri alındı`, ...result }
				
				case penalties.disableRoleAuthorities:
					result = await this.disableRoleAuthorities(permissions)
				return { message: `<@${userId}> (${userId}), değişiklik yaptığı için **sunucudaki yetkiler kapatıldı**.`, ...result }
				
				case penalties.banAndDisableGuildAuthorities:
					const banResult = await this.ban(userId, reason)
					await this.disableRoleAuthorities(permissions)
				return { message: `<@${userId}> (${userId}) kullanıcı banlandı ve sunucu yetkileri kapatıldı`, success: banResult.success }
				
				
				case penalties.removeAuthoritiesAndRolesGiveJail:
					await this.jail(userId)
					await this.deleteUserRoles(userId)
					const authResult = await this.deleteAuthorityRoles(userId, permissions)
				return { message: `<@${userId}> (${userId}) kullanıcı jaile atılıp, yetki ve rolleri alındı`, success: authResult.success }
				

				default: 
					console.warn("[punishManager / execute]: Penalties is undefined")
				return { success: false }
			}
		} catch (err) {
			console.error("[punishManager / execute]: Beklenmeyen hata:", err)
			return { success: false, error: err }
		}
	}
}