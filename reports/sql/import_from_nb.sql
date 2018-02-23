-- Example import from a NationBuilder export uploaded to sources.nb_export
insert into callees (campaign_id, phone_number, external_id, first_name)
select campaign_id, phone_number, max(external_id) as external_id, max(first_name) as first_name  from (
select external_id, first_name, campaign_id, case when mobile_number ~* '[0-9]{10}' then mobile_number else phone_number end as phone_number from (
select nationbuilder_id as external_id, first_name
, regexp_replace(regexp_replace(regexp_replace(regexp_replace(mobile_number, '[^0-9]', '', 'g'), '^0', ''), '^61', ''), '^([0-9])', '61\1') as mobile_number
, regexp_replace(regexp_replace(regexp_replace(regexp_replace(phone_number, '[^0-9]', '', 'g'), '^0', ''), '^61', ''), '^([0-9])', '61\1') as phone_number

-- UPDATE THE CAMPAIGN ID HERE
, 0 as campaign_id from sources.nb_export) cleaned
) best_phone_number where length(phone_number) = 11 
and phone_number not in (select phone_number from callees join calls on calls.callee_id = callees.id and status = 'completed' where campaign_id = 58)
group by 1,2 order by 3 desc;
