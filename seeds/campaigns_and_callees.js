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
        phone_number: '14158557799',
        status: 'active',
        ratio: 1,
        max_ratio: 1,
        questions: questions_json,
        more_info: more_info_json,
        script_url: "https://docs.google.com/document/d/1_2uhubfXoW8zokuhKXdRAdz8_WMH7R0wAQM5YWZii-4/pub?embedded=true",
      }),
      knex('campaigns').insert({
        id: 2,
        name: 'Predictive Dialler Test',
        phone_number: '14158557799',
        status: 'active',
        ratio: 1,
        max_ratio: 2,
        questions: questions_json,
        more_info: more_info_json,
        script_url: "https://docs.google.com/document/d/1_2uhubfXoW8zokuhKXdRAdz8_WMH7R0wAQM5YWZii-4/pub?embedded=true",
        callers_remaining: 37,
      })
    )
  }).then(() => {
    return Promise.join(
      knex('callees').insert([
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Robin', phone_number: '14158557799', campaign_id: 2},
        {first_name: 'Chris', phone_number: '14158557799', campaign_id: 2},
      ]),
    );
  });
};
