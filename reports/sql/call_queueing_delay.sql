select e.created_at, c.created_at
  , round(date_part('second', c.created_at::time - e.created_at::time)) as potential_plivo_lag
from events e
join calls c on c.callee_id = ((e.value::json)->>'callee_id')::integer
  and date_part('day', e.created_at) = date_part('day', c.created_at)
where true
  and e.name = 'call_initiated'
  and e.created_at >= '2017-10-25'
order by e.created_at desc
limit 100
;
