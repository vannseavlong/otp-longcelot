import knexLib from 'knex';
import { config } from '../config.js';

export const knex = knexLib({
  client: config.db.client,
  connection: config.db.connection,
  useNullAsDefault: config.db.client === 'sqlite3'
});
