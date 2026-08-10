import { Collection } from 'discord.js';

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { REST, Routes } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getFilesRecursively(dir) {
  let results = [];

  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of list) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      const subDirFiles = await getFilesRecursively(fullPath);
      results = results.concat(subDirFiles);
    } else if (file.name.endsWith(".js") || file.name.endsWith(".ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

async function getPrefixCommands() {
  const prefixCommands = []
  const commandsPath = path.join(__dirname, "../commands/prefix-commands");
  const commandFiles = await getFilesRecursively(commandsPath);

  for (const filePath of commandFiles) {
    const baseName = path.basename(filePath);
    console.log(`📢 Prefix komutu yükleniyor: ${baseName}`);
    try {
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error(`Prefix komutu yükleme timeout (45sn)`)), 45000));
      const mod = await Promise.race([
        import(`file://${filePath}`),
        timeout,
      ]);
      const command = mod.default;
      if (!command?.name) continue;

      prefixCommands.push({...command, type: 'prefix'});
      console.log(`📢 Prefix komutu yüklendi: ${command.name}`);
    } catch (err) {
      console.error(`❌ Prefix komutu yüklenemedi (${baseName}): ${err.message}`);
      console.error('   Stack:', err.stack?.split('\n')?.slice(0, 5)?.join('\n'));
    }
  }
  return prefixCommands
}

async function getSlashCommands() {
  const slashCommands = []
  const commandsPath = path.join(__dirname, "../commands/slash-commands");
  const commandFiles = await getFilesRecursively(commandsPath);

  for (const filePath of commandFiles) {
    const baseName = path.basename(filePath);
    console.log(`⏳ Slash komutu yükleniyor: ${baseName}`);
    try {
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error(`Import timeout (45sn)`)), 45000));
      const mod = await Promise.race([import(`file://${filePath}`), timeout]);
      const command = mod.default;
      if (!command?.data) {
        console.warn(`⚠️  Slash komutunda data eksik, atlanıyor: ${baseName}`);
        continue;
      }

      slashCommands.push({...command, name: command.data.name, type: 'slash'});
      console.log(`⚡ Slash komutu yüklendi: ${command.data.name}`);
    } catch (err) {
      console.error(`❌ Slash komutu yüklenemedi (${baseName}):`, err.message);
      if (err.message.includes('timeout')) {
        console.error('   Not: Import çok uzun sürdü, muhtemelen MongoDB bağlantısı bekleniyor. Devam ediliyor...');
      } else {
        console.error('   Stack:', err.stack?.split('\n')?.slice(0, 5)?.join('\n'));
      }
    }
  }
  return slashCommands
}

async function getEvents() {
  const events = [];
  const eventsPath = path.join(__dirname, "../events");
  const eventFiles = await getFilesRecursively(eventsPath);
  
  for (const filePath of eventFiles) {
    try {
      const event = (await import(`file://${filePath}`)).default;

      if (!event?.name) continue;
        
      events.push(event);
      console.log(`🎯 Event yüklendi: ${event.name}`);
    } catch (err) {
      console.error(`❌ Event yüklenemedi (${path.basename(filePath)}):`, err.message);
    }
  }

  return events;
}

async function deploySlashCommands(token, botId, commands) {
  const slashCommands = []
  for (const c of commands) {
    slashCommands.push(c.data.toJSON())
  }


  const rest = new REST().setToken(token);
    try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationCommands(botId),
      { body: slashCommands },
    );

      console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
      return {
        success: true,
        message: "Successfully reloaded ${data.length} application (/) commands.",
        count: data.length || 0
      }
    } catch (error) {
      console.error('❌ Failed to refresh commands:', error);
      return {
        success: false,
        message: 'Failed to refresh commands:', error
      }
    }
}

async function eventExecuter(client, events){
	for (const event of events) {
		if (event.once) {
		    client.once(event.name, async (...args) => event.execute(client, ...args));
		} else {
		    client.on(event.name, async (...args) => event.execute(client, ...args));
		}
	}
}

async function commandExecuter(client, slashCommands, prefixCommands){
	
	client.prefixCommands = new Collection();
	client.slashCommands = new Collection();
	
	if(prefixCommands.length > 0){
		for (const pc of prefixCommands) {
			client.prefixCommands.set(pc.name, pc.execute);
		}	
	}
	
	if(slashCommands.length > 0){
		for (const sc of slashCommands) {
			client.slashCommands.set(sc.name, sc.execute);
		}
	}
}

export {
    getPrefixCommands,
    getSlashCommands,
    getEvents,
	
    eventExecuter,
    commandExecuter,
    
    deploySlashCommands
}