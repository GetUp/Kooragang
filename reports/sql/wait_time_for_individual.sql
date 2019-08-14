-- all dispostions for a phone number
select c.created_at, c.status, c.duration, ce.first_name, ce.data, sr.answer, ce.phone_number from callees ce
join calls c on c.callee_id = ce.id
join callers ce on ce.id = c.caller_id and phone_number in ('61432050000') and ce.created_at > now() - '5 hours'::interval;
join survey_results sr on sr.call_id = c.id and question = 'disposition'
order by c.created_at;

-- wait time
select to_timestamp(floor((extract('epoch' from created_at) / 600 )) * 600) at time zone 'Australia/Sydney' as interval_alias
, round(avg(((value::json)->>'seconds_waiting')::decimal)) as wait_time_in_seconds
from events where caller_id in (54225, 54112) and name = 'answered'
group by 1 order by 1;
