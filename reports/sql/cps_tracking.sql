-- enter the start and end window in the top rows; use AEST/AEDT but leave the double 'AT TIME ZONE'
-- make sure the interval on line 7 matches the divisor in lines 16-18

WITH vals AS (
  SELECT TIMESTAMP '2017-08-31 18:00:00' AT TIME ZONE 'Australia/Sydney' AT TIME ZONE 'UTC' AS frame_start
       , TIMESTAMP '2017-08-31 20:30:00' AT TIME ZONE 'Australia/Sydney' AT TIME ZONE 'UTC'  AS frame_end
       , interval '5 min' AS t_interval
),   grid AS (
  SELECT start_time, lead(start_time, 1, frame_end) OVER (ORDER BY start_time) AS end_time
  FROM (
    SELECT generate_series(frame_start, frame_end, t_interval) AS start_time, frame_end FROM vals
  ) x
)

SELECT to_char(start_time, 'YYYY-MM-DD HH24:MI') as window
     , count(distinct ce.id)/5 as call_attempts_per_minute
     , count(distinct c.id)/5 AS actual_calls_per_minute
     , round(count(distinct c.id)/(5*60.0),2) AS cps

FROM grid g
LEFT JOIN calls c ON c.created_at >= g.start_time AND c.created_at <  g.end_time
LEFT JOIN callees ce ON ce.last_called_at >= g.start_time AND ce.last_called_at <  g.end_time
GROUP BY start_time
ORDER BY start_time
;
