import { getPrefixCommands, getSlashCommands, getEvents, 
	deploySlashCommands, eventExecuter, commandExecuter } from '#helpers'

class Base {
    constructor(client, token, botId){
		this.client = client
		this.token = token
		this.botId = botId
	}
	
	async loaders() {
	  const client = this.client;
	  console.log('🚀 Loaderlar başlatılıyor...');

	  let prefixCommands = [];
	  try {
  	  prefixCommands = await getPrefixCommands()
  	  console.log(`📢 Prefix komutları tamamlandı. (${prefixCommands.length})`);
	  } catch (err) {
	    console.error('❌ Prefix komutları yüklenirken hata:', err.message);
	    console.error(err.stack?.split('\n')?.slice(0,5)?.join('\n'));
  	}

  	let slashCommands = [];
  	try {
  	  slashCommands = await getSlashCommands()
  	  console.log(`⚡ Slash komutları tamamlandı. (${slashCommands.length})`);
  	} catch (err) {
  	  console.error('❌ Slash komutları yüklenirken hata:', err.message);
  	  console.error(err.stack?.split('\n')?.slice(0,8)?.join('\n'));
  	}

  	let events = [];
  	try {
	    events = await getEvents()
	    console.log(`🎯 Eventler tamamlandı. (${events.length})`);
	  } catch (err) {
	    console.error('❌ Eventler yüklenirken hata:', err.message);
	    console.error(err.stack?.split('\n')?.slice(0,5)?.join('\n'));
  	}

  	try {
  	  await commandExecuter(client, slashCommands, prefixCommands)
  	  console.log('✅ commandExecuter tamamlandı.');
  	} catch (err) {
  	  console.error('❌ commandExecuter hatası:', err.message);
  	}

  	try {
  	  console.log('☁️  deploySlashCommands Discord APIye gönderiliyor...');
	    const res = await deploySlashCommands(this.token, this.botId, slashCommands)
	    console.log('✅ deploySlashCommands sonucu:', JSON.stringify(res));
	  } catch (err) {
	    console.error('❌ deploySlashCommands hatası:', err.message);
	    console.error('   Stack (ilk 10 satır):', err.stack?.split('\n')?.slice(0,10)?.join('\n'));
  	}

  	try {
	    await eventExecuter(client, events)
	    console.log('✅ eventExecuter tamamlandı.');
	  } catch (err) {
	    console.error('❌ eventExecuter hatası:', err.message);
  	}

  	console.log('🚀 Loaderlar tamamlandı, bot bağlantısı bekleniyor...');
	}
	
	connect(){
		const connected = this.client.login(this.token);
		return connected
	}
}

export default Base