const bcrypt = require('bcryptjs');

async function generarHash() {
  const hash = await bcrypt.hash('123456', 10);
  console.log('Hash generado:', hash);
  return hash;
}

generarHash();

