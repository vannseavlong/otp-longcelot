const dotenv = require('dotenv');
dotenv.config();

const client = process.env.DATABASE_CLIENT || 'sqlite3';
const connection = process.env.DATABASE_URL || './data/dev.sqlite';

module.exports = {
  development: {
    client,
    connection,
    useNullAsDefault: client === 'sqlite3',
    migrations: {
      directory: './migrations'
    }
  },
  production: {
    client,
    connection,
    useNullAsDefault: client === 'sqlite3',
    migrations: {
      directory: './migrations'
    }
  }
};
