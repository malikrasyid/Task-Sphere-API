const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;
// Use JWT_SECRET from process.env or the hardcoded value from server.js as a fallback
const JWT_SECRET = process.env.JWT_SECRET || '89b87cb3a2ba8d76a580c4a96293ce612d215f4462dbc8729022ae9b4bdeb92250c19d1388bc25bf7789afc329f89292bb6ea379d27a3939de29ef9e80cbdcc6d2bcc5230fd6bb5df0a93230660b0d8112067bd5b3d4646da95f63cf091c75d2144900accbed7caf2b0c30d831935762fc0e33b498b15307cfe310b558da724559376f4a2691759f6fc0ac2ae60540a34ab6254cbb6c49fc7d584e90e59e5e69fe10febd8e56b25e9ff44b9144e6b8ce18ee72ffe522e25501f109032dc228e56b9bbf12c273080c4e73cff40fcb18134d75de00a8f5b9964e41a4eb259a6b3e3e7ffa4cfe00bc86a2d20c0956573f23e6f753c4bc372e31c25af6539d37c9c8'; 

function generateToken(user) {
  return jwt.sign(
    { userId: user.userId, email: user.email },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  generateToken,
  hashPassword,
  comparePassword,
  JWT_SECRET,
};