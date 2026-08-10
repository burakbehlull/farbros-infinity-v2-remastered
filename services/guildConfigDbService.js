import { GuildConfig } from "#models"

async function getGuildConfig(values){
	const { guildId } = values.params
	let data;
	data = await GuildConfig.findOne({guildId})

	if(!data) {
		const created = await createGuildConfig(guildId)
		return {
			success: true,
			message: 'Böyle bir guild yok, yeni döküman oluşturuldu.',
			data: created.data.toJSON()
		}
	}

	return {
		code: 200,
		success: true,
		message: 'Döküman çekildi.',
		data: data.toJSON()
	}
}

async function createGuildConfig(guildId){
	const exist = await GuildConfig.findOne({guildId})
	if(exist) return {
		success: false,
		message: 'Aynı guild var!'
	}
	const guildConfig = await GuildConfig.create({guildId})
	
	return {
		code: 200,
		success: true,
		message: 'Döküman yaratıldı.',
		data: guildConfig.toJSON()
	}
	
}

async function guildConfigFindById(guildId){
	const data = await GuildConfig.findOne({guildId})
	if (!data) return {
		success: false,
		message: 'Böyle bir guild yok'	
	}
	return {
		success: true,
		code: 200,
		message: 'Döküman çekildi.',
		data: data.toJSON()
	}	
}

async function guildConfigUpdate(guildId, data){
	let guildConfig = await GuildConfig.findOne({guildId})
	if(!guildConfig) {
		guildConfig = await GuildConfig.create({ guildId })
	}
	
	if (typeof data.enable !== 'undefined') guildConfig.enable = data.enable;
	if (typeof data.prefix !== 'undefined') guildConfig.prefix = data.prefix;
	if (typeof data.logChannelId !== 'undefined') guildConfig.logChannelId = data.logChannelId;
	if (typeof data.jailRoleId !== 'undefined') guildConfig.jailRoleId = data.jailRoleId;
	if (typeof data.punishmentType !== 'undefined') guildConfig.punishmentType = data.punishmentType;
	if (typeof data.limit !== 'undefined') guildConfig.limit = Number(data.limit);
	
	if (typeof data.isAuthorityEnable !== 'undefined') guildConfig.isAuthorityEnable = data.isAuthorityEnable;
	if (typeof data.isAuthorities !== 'undefined') guildConfig.isAuthorities = data.isAuthorities;
	if (Array.isArray(data.authorities)) guildConfig.authorities = data.authorities;
	if (Array.isArray(data.members)) guildConfig.members = data.members;
	if (Array.isArray(data.roles)) guildConfig.roles = data.roles;
	
	const guardFields = [
		"roleDeleteGuard", "roleUpdateGuard", "channelDeleteGuard", 
		"channelUpdateGuard", "botAddGuard", "webGuard", "memberRoleGuard",
		"guildUrlGuard", "guildUpdateGuard", "kickGuard", "banGuard", 
		"kickBanLimitGuard", "messageCommandExecuter", "slashCommandExecuter"
	];
	
	guardFields.forEach(field => {
		if (typeof data[field] !== 'undefined') {
			guildConfig[field] = data[field];
		}
	});
	
	const levelFields = ["high", "mid", "low"];
	levelFields.forEach(level => {
		if (data[level]) {
			const levelData = data[level];
			if (guildConfig[level]) {
				if (typeof levelData.enable !== 'undefined') guildConfig[level].enable = levelData.enable;
				if (typeof levelData.isAuthorities !== 'undefined') guildConfig[level].isAuthorities = levelData.isAuthorities;
				if (Array.isArray(levelData.authorities)) guildConfig[level].authorities = levelData.authorities;
				if (Array.isArray(levelData.members)) guildConfig[level].members = levelData.members;
				if (Array.isArray(levelData.roles)) guildConfig[level].roles = levelData.roles;
			}
		}
	});

	const result = await guildConfig.save();
	
	return {
		success: true,
		message: 'Döküman güncellendi.',
		data: result.toJSON()
	};	
}

async function addItemToGuildConfig(guildId, {level, type, data}){
	
	let guildConfig = await GuildConfig.findOne({ guildId });
	if (!guildConfig) {
	  guildConfig = new GuildConfig({ guildId });
	}

	const mode = guildConfig[level]
	if (!mode) {
		return {
			success: false,
			message: `Böyle bir seviye bulunamadı: ${level}`
		}
	}
	const result = mode[type]
	
	switch(type){
		case 'members':
			if(result.includes(data)) return {
				success: false,
				message: 'Bu üye zaten var!'	
			}
			result.push(data)
			const savedMembers = await guildConfig.save()
			return {
				success: true,
				message: 'Üye eklendi.',
				data: savedMembers.toJSON()
			}
		case 'authorities':
			if(result.includes(data)) return {
				success: false,
				message: 'Bu yetki zaten tanımlanmış!'	
			}
			result.push(data)
			const savedAuthorities = await guildConfig.save()
			return {
				success: true,
				message: 'Yetki eklendi.',
				data: savedAuthorities.toJSON()
			}
		case 'roles':
			if(result.includes(data)) return {
				success: false,
				message: 'Bu rol zaten var!'	
			}
			result.push(data)
			const savedRoles = await guildConfig.save()
			return {
				success: true,
				message: 'Rol eklendi.',
				data: savedRoles.toJSON()
			}
		case 'enable':
			mode.enable = data
			const savedEnable = await guildConfig.save()
			return {
				success: true,
				message: 'Enable güncellendi',
				data: savedEnable.toJSON()
			}
		case 'isAuthorities':
			mode.isAuthorities = data
			const savedIsAuth = await guildConfig.save()
			return {
				success: true,
				message: 'Authority enable güncellendi',
				data: savedIsAuth.toJSON()
			}
		default:
			return {
				success: false,
				message: 'Geçersiz tür belirtildi.'
			}
	}
}

async function removeItemFromGuildConfig(guildId, { level, type, data }) {
  let guildConfig = await GuildConfig.findOne({ guildId });
  if (!guildConfig) {
    return {
      success: false,
      message: 'Bu sunucu için bir yapılandırma bulunamadı!'
    };
  }

  const mode = guildConfig[level];
  if (!mode) {
	return {
		success: false,
		message: `Böyle bir seviye bulunamadı: ${level}`
	}
  }
  const result = mode[type];

  switch (type) {
    case 'members':
      if (!result.includes(data)) {
        return {
          success: false,
          message: 'Bu üye zaten listede değil!'
        };
      }
      mode.members = result.filter(item => item !== data);
      const savedRemoveMembers = await guildConfig.save();
      return {
        success: true,
        message: 'Üye kaldırıldı.',
		data: savedRemoveMembers.toJSON()
      };

    case 'authorities':
      if (!result.includes(data)) {
        return {
          success: false,
          message: 'Bu yetki zaten listede değil!'
        };
      }
      mode.authorities = result.filter(item => item !== data);
      const savedRemoveAuthorities = await guildConfig.save();
      return {
        success: true,
        message: 'Yetki kaldırıldı.',
		data: savedRemoveAuthorities.toJSON()
      };

    case 'roles':
      if (!result.includes(data)) {
        return {
          success: false,
          message: 'Bu rol zaten listede değil!'
        };
      }
      mode.roles = result.filter(item => item !== data);
      const savedRemoveRoles = await guildConfig.save();
      return {
        success: true,
        message: 'Rol kaldırıldı.',
		data: savedRemoveRoles.toJSON()
      };

    case 'enable':
      mode.enable = false;
      const savedDisableEnable = await guildConfig.save();
      return {
        success: true,
        message: 'Enable devre dışı bırakıldı.',
		data: savedDisableEnable.toJSON()
      };

    case 'isAuthorities':
      mode.isAuthorities = false;
      const savedDisableAuth = await guildConfig.save();
      return {
        success: true,
        message: 'Authority enable devre dışı bırakıldı.',
		data: savedDisableAuth.toJSON()
      };

    default:
      return {
        success: false,
        message: 'Geçersiz tür belirtildi.'
      };
  }
}

async function addWhitelistItem(guildId, { type, id }) {
	let guildConfig = await GuildConfig.findOne({ guildId });
	if (!guildConfig) {
		guildConfig = new GuildConfig({ guildId });
	}

	switch (type) {
		case 'members':
			if (!Array.isArray(guildConfig.members)) guildConfig.members = [];
			if (guildConfig.members.includes(id)) {
				return { success: false, message: 'Bu kullanıcı zaten güvenli listede!' };
			}
			guildConfig.members.push(id);
			break;
		case 'roles':
			if (!Array.isArray(guildConfig.roles)) guildConfig.roles = [];
			if (guildConfig.roles.includes(id)) {
				return { success: false, message: 'Bu rol zaten güvenli listede!' };
			}
			guildConfig.roles.push(id);
			break;
		default:
			return { success: false, message: 'Geçersiz tür belirtildi.' };
	}

	const saved = await guildConfig.save();
	return { success: true, message: 'Eklendi.', data: saved.toJSON() };
}

async function removeWhitelistItem(guildId, { type, id }) {
	let guildConfig = await GuildConfig.findOne({ guildId });
	if (!guildConfig) {
		return { success: false, message: 'Bu sunucu için bir yapılandırma bulunamadı!' };
	}

	switch (type) {
		case 'members':
			if (!Array.isArray(guildConfig.members) || !guildConfig.members.includes(id)) {
				return { success: false, message: 'Bu kullanıcı zaten listede değil!' };
			}
			guildConfig.members = guildConfig.members.filter(item => item !== id);
			break;
		case 'roles':
			if (!Array.isArray(guildConfig.roles) || !guildConfig.roles.includes(id)) {
				return { success: false, message: 'Bu rol zaten listede değil!' };
			}
			guildConfig.roles = guildConfig.roles.filter(item => item !== id);
			break;
		default:
			return { success: false, message: 'Geçersiz tür belirtildi.' };
	}

	const saved = await guildConfig.save();
	return { success: true, message: 'Kaldırıldı.', data: saved.toJSON() };
}

async function setBooleanSetting(guildId, { setting, value }) {
	let guildConfig = await GuildConfig.findOne({ guildId });
	if (!guildConfig) {
		guildConfig = new GuildConfig({ guildId });
	}

	const validBooleanSettings = [
		'isAuthorityEnable',
		'isAuthorities'
	];

	if (!validBooleanSettings.includes(setting)) {
		return { success: false, message: 'Geçersiz ayar adı.' };
	}

	guildConfig[setting] = Boolean(value);
	const saved = await guildConfig.save();
	return { success: true, message: 'Ayar güncellendi.', data: saved.toJSON() };
}


export {
	getGuildConfig,
	createGuildConfig,
	guildConfigFindById,
	addItemToGuildConfig,
	removeItemFromGuildConfig,
	guildConfigUpdate,
	addWhitelistItem,
	removeWhitelistItem,
	setBooleanSetting
}
