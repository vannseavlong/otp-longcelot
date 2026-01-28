module.exports.up = async function up(knex) {
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('email').notNullable().unique();
    table.string('username').notNullable().unique();
    table.text('password_hash').notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('telegram_credentials', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('users.id').onDelete('CASCADE');
    table.string('telegram_chat_id').unique();
    table.string('telegram_username');
    table.boolean('is_verified').notNullable().defaultTo(false);
    table.timestamp('linked_at');
  });

  await knex.schema.createTable('otp_requests', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('users.id').onDelete('CASCADE');
    table.text('otp_hash').notNullable();
    table.timestamp('expires_at').notNullable();
    table.boolean('used').notNullable().defaultTo(false);
    table.string('context').notNullable().defaultTo('login'); // e.g., 'login', 'sensitive', 'telegram_change'
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('recovery_codes', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('users.id').onDelete('CASCADE');
    table.text('code_hash').notNullable();
    table.boolean('used').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('link_tokens', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('users.id').onDelete('CASCADE');
    table.text('token_hash').notNullable();
    table.timestamp('expires_at').notNullable();
    table.boolean('used').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

module.exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('link_tokens');
  await knex.schema.dropTableIfExists('recovery_codes');
  await knex.schema.dropTableIfExists('otp_requests');
  await knex.schema.dropTableIfExists('telegram_credentials');
  await knex.schema.dropTableIfExists('users');
};
