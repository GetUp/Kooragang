### Setup

`npm i`

`createdb kooragang`
`createdb kooragang_test`
`knex migrate:latest`
`knex migrate:latest --env test`
`knex seed:run`

### Tijuana data export

    SET @caller := '61300000000';
    SET @postcode := '3000';
    SELECT
    --   count(uae.id),
      u.id AS external_id,
      u.first_name,
      coalesce(nullif(u.mobile_number, ''), nullif(u.home_number, '')) AS phone_number,
      coalesce(nullif(u.suburb, ''), @postcode) AS location,
      @caller AS caller
    FROM users u
    JOIN postcodes p ON u.postcode_id = p.id AND p.number = @postcode
    JOIN user_activity_events uae ON u.id = uae.user_id
    LEFT OUTER JOIN taggings t ON u.id = t.taggable_id
      AND t.taggable_type = 'USER' AND t.tag_id = 2911 -- "gettogethers_RSVP_sync" tag
    WHERE u.deleted_at IS NULL
      AND u.is_member = TRUE
      AND (nullif(u.mobile_number, '') IS NOT NULL OR nullif(u.home_number, '') IS NOT NULL)
      AND uae.created_at > '2015-09-01'  -- arbitrarily ~6 months ago
    GROUP BY u.id
    HAVING count(uae.id) > 10 -- <========================================= TWEAK HERE
    ORDER BY count(uae.id) DESC;

### Heroku data import

#### Callers

```
psql `heroku config:get DATABASE_URL`?ssl=true -c "\copy callers (first_name, phone_number, location) FROM 'tmp/gt/callers.csv' CSV HEADER;"
```

#### Callees

```
psql `heroku config:get DATABASE_URL`?ssl=true -c "\copy callees (external_id, first_name, phone_number, location, caller) FROM 'tmp/gt/callees.csv' CSV HEADER;"

#### TODO

* web interface with script
* have two digit answer codes followed by hash
* allow entering 2 or 2# during call to hangup
* error where person is sent to conference that no longer exists, perhaps reset member record or do api check?
* model calls by replaying real call data from callfire
* look at hanging calls when there is not agent available
