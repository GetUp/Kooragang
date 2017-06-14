const {Campaign, Callee} = require('../models')

const recycle_all = async() => {
  const campaignsWithRecycling = await Campaign.query().where('max_call_attempts', '>', 1);
  for (let campaign of campaignsWithRecycling) {
    await Callee.raw(
      `update callees
       set last_called_at = null, last_recycled_at = now()
       from (select callee_id from calls
         group by 1 having sum(case when status in ('busy', 'no-answer') then 1 else 0 end) < ${campaign.max_call_attempts}
         and sum(case when status not in ('busy', 'no-answer') then 1 else 0 end) = 0
       ) as calls_made
       where callee_id = callees.id
       and last_called_at < now() - '${campaign.no_call_window} minutes'::interval
       and campaign_id = ${campaign.id}`
    )
  }
  await Callee.raw(`
    update callees
    set call_attempts = (
      select count(calls.*) from calls
      where callees.id = calls.callee_id
    )
  `)
}

const recycle = async(campaign) => {
  await campaign.$query().patch({max_call_attempts: campaign.max_call_attempts+1})
  await Callee.raw(
    `update callees
     set last_called_at = null, last_recycled_at = now()
     from (select callee_id from calls
       group by 1 having sum(case when status in ('busy', 'no-answer') then 1 else 0 end) < ${campaign.max_call_attempts}
       and sum(case when status not in ('busy', 'no-answer') then 1 else 0 end) = 0
     ) as calls_made
     where callee_id = callees.id
     and last_called_at < now() - '${campaign.no_call_window} minutes'::interval
     and campaign_id = ${campaign.id}`
  )
  await Callee.raw(`
    update callees
    set call_attempts = (
      select count(calls.*) from calls
      where callees.id = calls.callee_id
    )
  `)
}

module.exports = {
  recycle_all,
  recycle
}