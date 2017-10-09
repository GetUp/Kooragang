exports.up = knex => (
  knex.raw(`
    -- allow dupes in the test campaign from seeds
    CREATE UNIQUE INDEX "callees_phone_number_campaign_id_idx"
      ON "callees"("phone_number","campaign_id") WHERE campaign_id <> 2;
  `)
)

exports.down = knex => (
  knex.raw(`
    DROP INDEX "callees_phone_number_campaign_id_idx";
  `)
)
