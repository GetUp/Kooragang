-- this query will return a full list summary the amount of callers, statuses, duration, and outcomes of each calls, for specified date and specified campaign within the specified date range

select c.id as call_id, c.created_at as date, ce.phone_number as callee, ca.phone_number as caller, c.status, c.dropped,
c.duration as duration_in_seconds, disposition, loan_support, voter_id, coalition_support, action
from callees ce
inner join campaigns cam on cam.id = ce.campaign_id
inner join calls c on c.callee_id = ce.id
left outer join callers ca on c.caller_id = ca.id
left outer join (
select * from crosstab(
'select call_id::integer, question, answer from survey_results sr
inner join calls c on c.id = sr.call_id::integer
inner join callees ce on ce.id = c.callee_id',
'select distinct question from survey_results sr
inner join calls c on c.id = sr.call_id::integer
inner join callees ce on ce.id = c.callee_id
order by 1'
) as (call_id integer, action text, coalition_support text, disposition text, loan_support text, prefered_spending_priority text, voter_id text)
) answers on answers.call_id = c.id
where
-- Change this name if you want stats for a different campaign or remove it
-- if you want results from all campaigns.
cam.name = 'Dunkley Adani'
-- This line filters results to only show calls in the last day. You can days to
-- go back further in time e.g. '8 days'. Otherwise, you can remove to return all
-- calls for the campaign
and c.created_at > now() - '1 day'::interval
order by 1