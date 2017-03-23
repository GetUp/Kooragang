const seq = require('promise-sequential');
exports.seed = function(knex, Promise) {
  return Promise.join(
      knex('calls').del(),
      knex('callees').del(),
      knex('campaigns').del()
    ).then(() => {
      return Promise.join(
        knex('campaigns').insert({
          id: 1, name: 'Power Dialler Test', phone_number: '61285994346', dialer: 'power',
          questions: {"disposition":{"name":"Disposition","answers":{"2":{"value":"answering machine"},"3":{"value":"no answer"},"4":{"value":"not interested"},"5":{"value":"do not call"},"6":{"value":"wrong number"},"7":{"value":"meaningful conversation","next":"loan_support"}}},"loan_support":{"name":"Loan Support","answers":{"2":{"value":"supports the loan"},"3":{"value":"does not support the loan"},"4":{"value":"unsure about support for the loan","next":"coalition_support"}}},"coalition_support":{"name":"Coalition Support","answers":{"2":{"value":"would influence their support for the coalition","next":"voter_id"},"3":{"value":"would not influence their support for the coalition","next":"voter_id"},"4":{"value":"may influence their support for the coalition","next":"voter_id"},"5":{"value":"would not say","next":"voter_id"}}},"voter_id":{"name":"Voter ID","answers":{"2":{"value":"liberal or national party","next":"action"},"3":{"value":"australian labor party","next":"action"},"4":{"value":"the greens party","next":"action"},"5":{"value":"one nation party","next":"action"},"6":{"value":"other","next":"action"},"7":{"value":"did not say","next":"action"}}},"action":{"name":"Action","answers":{"2":{"value":"will call member of parliament"},"3":{"value":"would write to local paper or make facebook post"},"4":{"value":"will not take action"}}}},
          script_url: "https://docs.google.com/document/d/1_2uhubfXoW8zokuhKXdRAdz8_WMH7R0wAQM5YWZii-4/pub?embedded=true",
        }),
        knex('campaigns').insert({
          id: 2, name: 'Predictive Dialler Test', phone_number: '61285994346', dialer: 'ratio', status: 'active', ratio: 1, max_ratio: 1,
          questions: {"disposition":{"name":"Disposition","answers":{"2":{"value":"answering machine"},"3":{"value":"no answer"},"4":{"value":"not interested"},"5":{"value":"do not call"},"6":{"value":"wrong number"},"7":{"value":"meaningful conversation","next":"loan_support"}}},"loan_support":{"name":"Loan Support","answers":{"2":{"value":"supports the loan"},"3":{"value":"does not support the loan"},"4":{"value":"unsure about support for the loan","next":"coalition_support"}}},"coalition_support":{"name":"Coalition Support","answers":{"2":{"value":"would influence their support for the coalition","next":"voter_id"},"3":{"value":"would not influence their support for the coalition","next":"voter_id"},"4":{"value":"may influence their support for the coalition","next":"voter_id"},"5":{"value":"would not say","next":"voter_id"}}},"voter_id":{"name":"Voter ID","answers":{"2":{"value":"liberal or national party","next":"action"},"3":{"value":"australian labor party","next":"action"},"4":{"value":"the greens party","next":"action"},"5":{"value":"one nation party","next":"action"},"6":{"value":"other","next":"action"},"7":{"value":"did not say","next":"action"}}},"action":{"name":"Action","answers":{"2":{"value":"will call member of parliament"},"3":{"value":"would write to local paper or make facebook post"},"4":{"value":"will not take action"}}}},
          script_url: "https://docs.google.com/document/d/1_2uhubfXoW8zokuhKXdRAdz8_WMH7R0wAQM5YWZii-4/pub?embedded=true",
        })
      );
    }).then(() => {
      return Promise.join(
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2})
      );
    });
};
