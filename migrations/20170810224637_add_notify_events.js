exports.up = function(knex) {
  return knex.schema.raw(`
    CREATE OR REPLACE FUNCTION emit_caller_event() RETURNS trigger AS $$
    BEGIN
      IF NEW.caller_id is not null THEN
        PERFORM pg_notify('caller_event', row_to_json(NEW)::text);
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER events_notify_insert
    AFTER INSERT ON events
    FOR EACH ROW EXECUTE PROCEDURE emit_caller_event();
  `)
};

exports.down = function(knex) {
  return knex.schema.raw(`
    DROP TRIGGER events_notify_insert ON events;
    DROP FUNCTION emit_caller_event;
 `)
};
