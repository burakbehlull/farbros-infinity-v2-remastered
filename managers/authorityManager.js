export default class AuthorityManager {
    constructor(client, action, options) {
        this.client = client
		this.options = options
		this.action = action
		this.guild = action.guild ?? action
		this._configCache = null
		this._configCacheTime = 0
    }
	
    async info(type){
		try {
			const action = this.guild
			if (!action || typeof action.fetchAuditLogs !== 'function') {
				return null
			}
			const log = await action.fetchAuditLogs({limit:1, type: type})
			const entry = log.entries.first();
			
			return entry
		} catch (err) {
			console.warn('[authorityManager / info]: Audit log çekilemedi:', err.message)
			return null
		}
    }
	
    async isAuthorities(userId, authorities){
		const action = this.guild
        let member = action.members.cache.get(userId)
		
		if (!member) {
			try {
				member = await action.members.fetch(userId)
			} catch (err) {
				return false
			}
		}

		if (!member || !member.permissions) return false

        const result = authorities.map((authority)=> {
            const isHasAuthority = member.permissions.has(authority)
            if(isHasAuthority){
                return true
            }
            return false
        })

		return result.includes(true) 
    }

    async isRoles(userId, roles){
		
		const action = this.guild
        let member = action.members.cache.get(userId)
        
		if (!member) {
			try {
				member = await action.members.fetch(userId)
			} catch (err) {
				return false
			}
		}

		if (!member || !member.roles) return false

		const statusPromises = roles.map((role) => {
			const hasRole = member.roles.cache.has(role)
			return hasRole
		})

		const status = await Promise.all(statusPromises)
		
		const hasRoleStatus = status.includes(true)

		return hasRoleStatus
    }

    isMembers(userId, members){  
		const result = members.includes(userId)
		return result
    }

	async isGuildOwner(userId) {
		const result = this.guild.ownerId === userId;
		return result
	}
	
	async _loadConfig() {
		try {
			const now = Date.now();
			if (this._configCache && (now - this._configCacheTime) < 5000) {
				return this._configCache;
			}

			const fs = await import('fs');
			const path = await import('path');
			const configPath = path.join(process.cwd(), 'config.json');
			const configData = fs.readFileSync(configPath, 'utf-8');
			const config = JSON.parse(configData);
			
			this._configCache = config;
			this._configCacheTime = now;
			
			return config;
		} catch (err) {
			console.warn('[authorityManager / _loadConfig]: config.json okunamadı:', err.message);
			return { botOwnerIds: [] };
		}
	}
	
	async isBotOwner(userId) {
		try {
			const config = await this._loadConfig();
			const botOwnerIds = config.botOwnerIds || [];
			return botOwnerIds.includes(String(userId));
		} catch (err) {
			console.warn('[authorityManager / isBotOwner]: Hata:', err.message);
			return false;
		}
	}
	
	async isGuildOwnerOrBotOwner(userId, guild) {
		const checkGuild = guild ?? this.guild;
		if (!userId) return false;
		
		if (await this.isBotOwner(userId)) return true;
		
		if (checkGuild && String(checkGuild.ownerId) === String(userId)) return true;
		
		return false;
	}
	
	async selectGuildMember(userId, members=[]) {
		
		const result = members.includes(userId)
		return result
	}
	
	async control({audit, users, newUserId}){
		
		const { guildConfigFindById, 
			createGuildConfig } = await import("#services");

		const info = audit ? await this.info(audit) : null
		const userId = audit ? info?.executorId : newUserId

		if (!userId) {
			return {
				userId: null,
				guildId: this.guild?.id,
				status: false
			}
		}
		
		if (await this.isBotOwner(userId)) {
			return {
				userId,
				guildId: this.guild?.id,
				status: true,
				reason: 'bot_owner'
			};
		}
		
		const guildId = this.guild.id
		
		const guildConfig = await guildConfigFindById(guildId)
		
		if(!guildConfig.success) await createGuildConfig(guildId)
		
		const guildData = guildConfig.data
		
		const roles = guildData.roles || []
		const authorities = guildData.authorities || []
		const members = guildData.members || []
		
		let checks = []
		
		const isRoles = await this.isRoles(userId, roles)
		const isAuthorities = await this.isAuthorities(userId, authorities)
		const isMembers = this.isMembers(userId, members)
		
		const owner = await this.isGuildOwner(userId)
		const selectedMembers = await this.selectGuildMember(userId, users)
		
		checks.push(isRoles)
		checks.push(isAuthorities)
		checks.push(isMembers)
		checks.push(owner)
		checks.push(selectedMembers)
		
		if (userId == process.env.BOT_ID) checks.push(true)
		
		if (await this.isBotOwner(userId)) checks.push(true)

		const check = checks.includes(true)
		
		return { 
			userId: userId, 
			guildId: guildId,
			status: check
		}
	}

	async isEnable(type){
		try {
			const { guildConfigFindById } = await import("#services");
			
			const guildId = this.guild?.id 
			if (!guildId) return false

			const guildConfig = await guildConfigFindById(guildId)
			
			if(!guildConfig?.success) return false
			
			const guildData = guildConfig?.data
			
			
			if(!guildData?.enable) return false

			const control = guildData[type] || false
			
			return control
		} catch (err) {
			console.error('[authorityManager / isEnable]: Hata:', err)
			return false
		}
	}
	
	async getKickBanLimit(userId) {
	  try {
		  const { guildConfigFindById } = await import("#services");
		  const { User } = await import("#models");

		  const guildId = this.guild?.id;
		  if (!guildId || !userId) return false;

		  const guildConfig = await guildConfigFindById(guildId);
		  
		  const kickBanLimitGuard = guildConfig?.data?.kickBanLimitGuard
		  
		  if (!guildConfig?.success || !kickBanLimitGuard) return false;

		  const limit = guildConfig?.data?.limit || 3;

		  const user = await User.findOne({ guildId, userId });
		  const userLimit = user?.limit ?? 0;
		  
		  if (userLimit >= limit) return false;
		  
		  const updatedUser = await User.findOneAndUpdate(
			{ guildId, userId },
			{ $inc: { limit: 1 } },
			{ new: true, upsert: true }
		  )
		  
		  return true;
	  } catch (err) {
		  console.error('[authorityManager / getKickBanLimit]: Hata:', err)
		  return false
	  }
	}


}