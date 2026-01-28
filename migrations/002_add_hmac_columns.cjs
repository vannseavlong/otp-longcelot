module.exports.up = async function up(knex) {
  // Add token_hmac to link_tokens and code_hmac to recovery_codes for deterministic lookup
  const hasLink = await knex.schema.hasTable('link_tokens');
  if (hasLink) {
    const hasCol = await knex.schema.hasColumn('link_tokens', 'token_hmac');
    if (!hasCol) {
      await knex.schema.table('link_tokens', (table) => {
        table.string('token_hmac').index();
      });
    }
  }

  const hasRec = await knex.schema.hasTable('recovery_codes');
  if (hasRec) {
    const hasCol = await knex.schema.hasColumn('recovery_codes', 'code_hmac');
    if (!hasCol) {
      await knex.schema.table('recovery_codes', (table) => {
        table.string('code_hmac').index();
      });
    }
  }
};

module.exports.down = async function down(knex) {
  const hasLink = await knex.schema.hasTable('link_tokens');
  if (hasLink) {
    const hasCol = await knex.schema.hasColumn('link_tokens', 'token_hmac');
    if (hasCol) {
      await knex.schema.table('link_tokens', (table) => {
        table.dropColumn('token_hmac');
      });
    }
  }

  const hasRec = await knex.schema.hasTable('recovery_codes');
  if (hasRec) {
    const hasCol = await knex.schema.hasColumn('recovery_codes', 'code_hmac');
    if (hasCol) {
      await knex.schema.table('recovery_codes', (table) => {
        table.dropColumn('code_hmac');
      });
    }
  }
};
