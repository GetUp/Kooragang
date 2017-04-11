const {Campaign, Callee} = require('../models');

module.exports = async() => {
  const campaignsWithRecycling = await Campaign.query().where('max_call_attempts', '>', 1);
  for (let campaign of campaignsWithRecycling) {
    await Callee.raw(
      `update callees
       set last_called_at = null, last_recycled_at = now()
       from (select callee_id from calls
         where status in ('busy', 'no-answer')
         group by 1 having count(*) < ${campaign.max_call_attempts}
       ) as calls_made
       where callee_id = callees.id
       and last_called_at < now() - '4 hours'::interval
       and campaign_id = ${campaign.id}`
    );
  }
};
