-- Report compares two days - the earlier with ring timeout 15s. The latter with 35s.
-- * ring time is time between api call and pickup. there may be delay in the queue but it didn't see to be occur in the data i looked at as it would have seen intervals longer than 15s and 35s.
-- * using hard coded call counts for these days

select cr.name
, cr.calling_date
, cr.calls
, cr.callers
-- , round(cr.meaningful_conversations::numeric / cr.callers::numeric,1) as meaningful_per_caller
-- , round(cr.non_meaningful_conversations::numeric / cr.callers::numeric,1) as non_meaningful_per_caller
-- , round(cr.answering_machine::numeric / cr.callers::numeric,1) as answering_machine_per_caller
, case when cr.connections = 0 then 0 else round(cr.answering_machine::numeric / cr.connections::numeric * 100,0) end as answering_machine_per_connection_pc
--, round(cr.meaningful_conversations::numeric / cr.conversations::numeric * 100,1) as meaningful_per_conversation_pc
--  , sl.avg_length_of_shift as avg_minutes_per_shift
--   , sl.total_minutes_calling
-- , round(cr.meaningful_conversations::numeric / sl.total_minutes_calling::numeric * 60,1) as meaningful_per_hour
, cr.meaningful_conversations
, cr.conversations
, cr.answering_machine
, cr.no_answer
, connections
, round(connections / calls::decimal * 100, 2) connection_rate
, round(conversations / calls::decimal * 100, 2) conversation_rate
, case when connections = 0 then 0 else round(meaningful_conversations / connections::decimal * 100, 2) end meaningful_by_connection_rate 
, case when conversations = 0 then 0 else round(meaningful_conversations / conversations::decimal * 100, 2) end meaningful_by_converstations_rate 
, average_wait_time
, round(cr.meaningful_conversations / cr.calls::decimal * 100, 2) as meaningfuls_by_callees_rate
from (
  select date(c.created_at at time zone 'Australia/Sydney') as calling_date
  , campaigns.name
  , count(distinct ca.phone_number) as callers
  , count(distinct c.id) as calls
  , sum(case when disposition ~* 'meaningful' then 1 else 0 end) as meaningful_conversations
  , sum(case when disposition in ('wrong number','not interested','do not call','call back later') then 1 else 0 end) as non_meaningful_conversations
  , sum(case when disposition is not null then 1 else 0 end) as connections
  , sum(case when disposition ~* 'answering machine' then 1 else 0 end) as answering_machine
  , sum(case when c.status = 'no-answer' then 1 else 0 end) as no_answer
  , sum(case when disposition in ('wrong number','not interested','do not call','call back later','meaningful conversation') then 1 else 0 end) as conversations
  from callees ce
  join calls c on c.callee_id = ce.id
  join campaigns on campaigns.id = ce.campaign_id
  left join callers ca on c.caller_id = ca.id
  left join (
    select call_id, max(disposition) as disposition
    from crosstab(
      $$
      select call_id::integer, question, answer
      from survey_results sr
      join calls c on c.id = sr.call_id::integer
      join callees ce on ce.id = c.callee_id
      join campaigns on campaigns.id = ce.campaign_id
      $$,
      $$ select 'disposition' as question $$
    ) as (call_id integer, disposition text)
    where call_id in (
      select calls.id
      from campaigns
      join callees on callees.campaign_id = campaigns.id
      join calls on calls.callee_id = callees.id
      where true
    )
    group by 1
  ) answers on answers.call_id = c.id
  where true
  group by 1,2
) cr
join (
  select date(e.created_at at time zone 'Australia/Sydney') as calling_date
  , campaigns.name
  , round(avg(((value::json)->>'seconds_waiting')::decimal)) as average_wait_time
  from events e
  join campaigns on campaign_id = campaigns.id
  where e.name in ('caller_complete', 'answered')
  group by 1,2
) wait on wait.name = cr.name and wait.calling_date = cr.calling_date

where  cr.calling_date > now() - '3 weeks'::interval
order by 1
,2 desc
;

select * from callers where status <> 'complete' and created_at > now() - '4 ::hours'::interval;

select * from calls c
join callees ce on ce.id = c.callee_id and campaign_id = 79
order by c.created_at desc limit 10;


select *
from events e
join campaigns on campaign_id = campaigns.id
where (value::json)->>'seconds_waiting' is not null
limit 1000;


select 
(c.created_at at time zone 'Australia/Sydney')::date as date
, ce.phone_number ~* '^614' as mobile 
, count(*), min(duration), max(duration), avg(duration)
, min(c.created_at - ce.last_called_at), max(c.created_at - ce.last_called_at), avg(c.created_at - ce.last_called_at), round( 100 * count(*) / ((case when (c.created_at at time zone 'Australia/Sydney')::date = '2019-03-19' then 4590 else 2550 end)::decimal), 2) as answering_machine_pc
, sum(case when EXTRACT(epoch FROM (c.created_at - ce.last_called_at)) between 0 and 5 then 1 else null end)  / (case when (c.created_at at time zone 'Australia/Sydney')::date = '2019-03-19' then 4590 else 2550 end)::decimal * 100 as less_5_secs
, sum(case when EXTRACT(epoch FROM (c.created_at - ce.last_called_at)) between 6 and 10 then 1 else null end)  / (case when (c.created_at at time zone 'Australia/Sydney')::date = '2019-03-19' then 4590 else 2550 end)::decimal  * 100 as less_10_secs
, sum(case when EXTRACT(epoch FROM (c.created_at - ce.last_called_at)) between 11 and 15 then 1 else null end) / (case when (c.created_at at time zone 'Australia/Sydney')::date = '2019-03-19' then 4590 else 2550 end)::decimal  * 100  as less_15_secs
, sum(case when EXTRACT(epoch FROM (c.created_at - ce.last_called_at)) between 16 and 20 then 1 else null end) / (case when (c.created_at at time zone 'Australia/Sydney')::date = '2019-03-19' then 4590 else 2550 end)::decimal  * 100  as less_20_secs
, sum(case when EXTRACT(epoch FROM (c.created_at - ce.last_called_at)) between 21 and 25 then 1 else null end) / (case when (c.created_at at time zone 'Australia/Sydney')::date = '2019-03-19' then 4590 else 2550 end)::decimal  * 100  as less_25_secs
, sum(case when EXTRACT(epoch FROM (c.created_at - ce.last_called_at)) between 26 and 30 then 1 else null end) / (case when (c.created_at at time zone 'Australia/Sydney')::date = '2019-03-19' then 4590 else 2550 end)::decimal  * 100  as less_30_secs
, sum(case when EXTRACT(epoch FROM (c.created_at - ce.last_called_at)) > 30 then 1 else null end) / (case when (c.created_at at time zone 'Australia/Sydney')::date = '2019-03-19' then 4590 else 2550 end)::decimal  * 100 as less_35_secs
from callees ce
join calls c on c.callee_id = ce.id
join campaigns on campaigns.id = ce.campaign_id
left join callers ca on c.caller_id = ca.id
left join (
  select call_id, max(disposition) as disposition
  from crosstab(
    $$
    select call_id::integer, question, answer
    from survey_results sr
    join calls c on c.id = sr.call_id::integer
    join callees ce on ce.id = c.callee_id
    join campaigns on campaigns.id = ce.campaign_id
    $$,
    $$ select 'disposition' as question $$
  ) as (call_id integer, disposition text)
  where call_id in (
    select calls.id
    from campaigns
    join callees on callees.campaign_id = campaigns.id
    join calls on calls.callee_id = callees.id
    where true
  )
  group by 1
) answers on answers.call_id = c.id
where true and (c.created_at at time zone 'Australia/Sydney')::date >= '2019-03-18' 
and disposition = 'answering machine'
group by 1,2
order by 1,2;


                                                                                                                                                                                                                                                                                                                                                                          4590
