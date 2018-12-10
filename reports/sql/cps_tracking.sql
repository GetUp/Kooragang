WITH vals AS (
  SELECT (select max(created_at) - '2 hour'::interval from calls) AS frame_start
       , (select max(created_at) from calls) AS frame_end
       -- make sure the interval matches the divisor in lines 14-18
       , interval '5 min' AS t_interval
),   grid AS (
  SELECT start_time, lead(start_time, 1, frame_end) OVER (ORDER BY start_time) AS end_time
  FROM (
    SELECT generate_series(frame_start, frame_end, t_interval) AS start_time, frame_end FROM vals
  ) x
)

SELECT to_char(start_time AT TIME ZONE 'Australia/Sydney', 'YYYY-MM-DD HH24:MI') as window
     , round(count(distinct ce.id)/5.0,2) as call_attempts_per_minute
     , round(count(distinct c.id)/5.0,2) AS actual_calls_per_minute
     , round(sum(distinct case when c.dropped then 1 else 0 end)/5.0,2) AS dropped_calls_per_minute
     , round(count(distinct c.id)/(5*60.0),2) AS cps
     , date_trunc('second', avg(c.delay)) AS average_delay
     , round(sum(distinct case when c.status = 'completed' and c.result is null then 1 else 0 end)/5.0,2) AS completed_calls_without_outcome

FROM grid g
LEFT JOIN (
  select calls.id, dropped, calls.created_at, status, calls.created_at - last_called_at as delay, result  from calls
  join callees on callees.id = callee_id
  left join (
    select call_id, count(*) as result from survey_results group by 1
  ) result on result.call_id = calls.id
) c ON c.created_at >= g.start_time AND c.created_at <  g.end_time
LEFT JOIN callees ce ON ce.last_called_at >= g.start_time AND ce.last_called_at <  g.end_time
GROUP BY start_time
ORDER BY start_time
;
