-- plivo bring your own carrier rates: $0.004 https://www.plivo.com/blog/plivo-launches-bring-your-own-carrier/
-- DIDLogic at 0.065
select body->>'Direction' as direction,
count(*) as "# of calls",
round(avg((body->>'Duration')::integer)) as "average duration",
sum(case when (body->>'Duration')::integer < 30 then 1 else 0 end) as "# of sub 30 sec calls",
round(sum((body->>'TotalCost')::decimal)) as "plivo $",
round(sum(round(case when body->>'Direction' = 'outbound' and body->>'BillRate' = '0.065' then (0.065 + 0.004) else (0.0165 + 0.004) end * (body->>'Duration')::decimal / 60, 4))) as "didlogic $",

round(sum(round(case when body->>'Direction' = 'outbound' and body->>'BillRate' = '0.065' then 0.034 else 0.015 end * (body->>'BillDuration')::decimal / 60, 4))) as "callhub $",

round(sum((body->>'TotalCost')::decimal *  case when (body->>'Duration')::integer < 30 then 1 else 0 end)) as "plivo $ (sub 30 secs)",
round(sum(round(case when body->>'Direction' = 'outbound' and body->>'BillRate' = '0.065' then (0.065 + 0.004) else (0.0165 + 0.004) end * (body->>'Duration')::decimal / 60, 4)  *  case when (body->>'Duration')::integer < 30 then 1 else 0 end)) as "didlogic $ (sub 30 secs)",
round(sum(round(case when body->>'Direction' = 'outbound' and body->>'BillRate' = '0.065' then (0.065 + 0.004) else (0.0165 + 0.004) end * (body->>'Duration')::decimal / 60, 4))) as "didlogic $",
round(sum(round(case when body->>'Direction' = 'outbound' and body->>'BillRate' = '0.065' then 0.017 else 0.0075 end * (body->>'BillDuration')::decimal / 30, 4)  *  case when (body->>'Duration')::integer < 30 then 1 else 0 end)) as "callhub $ (sub 30 secs)"
from logs
where true
and body->>'BillDuration' is not null
and body->>'BillDuration' <> '0'
and created_at > now() - '2 months'::interval
group by 1
;
