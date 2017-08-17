select body->>'Direction' as direction,
round(sum((body->>'TotalCost')::decimal)) as "plivo $", 
round(sum(round(case when body->>'Direction' = 'outbound' and body->>'BillRate' = '0.065' then 0.075 else 0.0165 end * (body->>'Duration')::decimal / 60, 4))) as "didlogic $"
from logs
where true
and body->>'BillDuration' is not null
and body->>'BillDuration' <> '0'
and created_at > now() - '2 months'::interval
group by 1
;


select body->>'BillDuration', body->>'Duration', body->>'BillRate',  body->>'Direction',  body->>'TotalCost', 
case when body->>'Direction' = 'outbound' and body->>'BillRate' = '0.065' then 0.075 else 0.0165 end as didlogic_rate,
round(case when body->>'Direction' = 'outbound' and body->>'BillRate' = '0.065' then 0.075 else 0.0165 end * (body->>'Duration')::decimal / 60, 4) as did_logic_1s
from logs
where true
and body->>'BillDuration' is not null
and body->>'BillDuration' <> '0'
and created_at > '2017-08-01'
limit 100
;