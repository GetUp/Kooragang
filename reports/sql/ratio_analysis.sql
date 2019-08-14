-- show ratio and callers average in 10 minute intervals
select to_timestamp(floor((extract('epoch' from created_at) / 600 )) * 600) at time zone 'Australia/Sydney' as min
, round(avg((((value::json)->>'ratio')::decimal)),1) as avg_ratio
, round(avg(((value::json)->>'incall')::integer + ((value::json)->>'callers')::integer)) as avg_callers
from
events where campaign_id = 80 and (created_at at time zone 'Australia/Sydney')::date = '2019-04-23'
and name = 'calling' group by 1
order by 1 desc
;
