-- this query will return a detailed summary the amount of callers, calls made, and outcomes of the calls, for each campaign on each date

select calling_results.*, actual_calls_to_mp from (
select c.created_at::date as date, cp.name, count(distinct ca.phone_number) as callers, count(c.id) as calls,
sum(case when disposition !~* '(no answer|machine|meaningful)' then 1 else 0 end) as non_meaningful_conversations,
sum(case when disposition ~* 'meaningful' then 1 else 0 end) as meaningful_conversations,
sum(case when action !~* 'not' then 1 else 0 end) as actions,
sum(case when loan_support ~* 'supports' then 1 else 0 end) as supports_loan,
sum(case when loan_support ~* 'unsure' then 1 else 0 end) as unsure_of_support,
sum(case when loan_support ~* 'does not support' then 1 else 0 end) as does_not_support
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
) as (call_id integer, action text, coalition_support text, disposition text, loan_support text, preferred_spending text, voter_id text)
) answers on answers.call_id = c.id
where cp.name !~* 'test'
-- uncomment the following link and add in the desired campaign name to return its
-- and name = 'Banks Adani'
group by 1,2
) calling_results
left outer join (
	select redirects.created_at::date as date, name,
	count(distinct(redirects.phone_number)) as actual_calls_to_mp
	from redirects
	inner join campaigns on campaigns.id = redirects.campaign_id
	group by 1,2
) conversions on (conversions.date - '1 day'::interval = calling_results.date) and calling_results.name = conversions.name
