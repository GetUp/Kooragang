---- this query will return a detailed summary the amount of callers, calls made, and outcomes of the calls, for each campaign on each date
--
select c.created_at::date as date, cp.name, count(distinct ca.phone_number) as callers, count(c.id) as calls
  ,sum(case when disposition = 'is voting' then 1 else 0 end) as voting
  ,sum(case when disposition = 'is not voting' then 1 else 0 end) as not_voting
  ,sum(case when disposition = 'undecided' then 1 else 0 end) as undecided
from callees ce
inner join calls c on c.callee_id = ce.id
inner join campaigns cp on cp.id = ce.campaign_id
left outer join callers ca on c.caller_id = ca.id
left outer join (
select * from crosstab(
'select call_id::integer, question, answer from survey_results sr
inner join calls c on c.id = sr.call_id::integer
inner join callees ce on ce.id = c.callee_id
inner join campaigns cp on cp.id = ce.campaign_id
where  cp.name !~* ''test''',
'select distinct question from survey_results sr
inner join calls c on c.id = sr.call_id::integer
inner join callees ce on ce.id = c.callee_id
inner join campaigns cp on cp.id = ce.campaign_id
where  cp.name !~* ''test'' order by question'
) as (call_id integer, disposition text, voter_intention text)
) answers on answers.call_id = c.id
where cp.name !~* 'test'
-- uncomment the following link and add in the desired campaign name to return its 
-- and name = 'Banks Adani'
group by 1,2;
