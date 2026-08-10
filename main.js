import 'dotenv/config'

import startBot from '#botBase'

import { db } from '#config'

console.log('🔌 MongoDB bağlantısı bekleniyor...');
try {
  await db();
  console.log('✅ MongoDB bağlantısı onaylandı, bot başlatılıyor.');
} catch (err) {
  console.error('❌ MongoDB bağlantısı başarısız, yine de bot başlatılacak. Hata:', err.message);
}

const bot = await startBot()

export default bot


