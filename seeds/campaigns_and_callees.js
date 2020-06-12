const questions_json = require('./questions.example.json');
const more_info_json = require('./more_info.example.json');
exports.seed = function(knex, Promise) {
  return Promise.join(
    knex('calls').del(),
    knex('callees').del(),
    knex('events').del(),
    knex('callers').del(),
    knex('campaigns').del(),
  ).then(() => {
    return Promise.join(
      knex('campaigns').insert({
        id: 1,
        name: 'Power Dialler Test',
        phone_number: '61285994346',
        status: 'active',
        ratio: 1,
        max_ratio: 1,
        questions: questions_json,
        more_info: more_info_json,
        script_url: "https://www.getup.org.au",
      }),
      knex('campaigns').insert({
        id: 2,
        name: 'Predictive Dialler Test',
        phone_number: '61285994346',
        status: 'active',
        ratio: 1,
        max_ratio: 2,
        questions: questions_json,
        more_info: more_info_json,
        script_url: "https://www.getup.org.au",
        callers_remaining: 37,
      })
    )
  }).then(() => {
    return Promise.join(
      knex('callees').insert([
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Robin', phone_number: '61285994347', campaign_id: 2},
        {first_name: 'Chris', phone_number: '61285994347', campaign_id: 2},
      ]),
    );
  });
};
