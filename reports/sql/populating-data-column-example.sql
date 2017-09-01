
insert into callees(phone_number, campaign_id, first_name, data)
select phone_number, CHANGE_TO_CAMPAIGN_ID as campaign_id, first_name,
json_build_object('name', name, 'electorate', electorate, 'email', email, 'description', description) as data
from (
select regexp_replace(regexp_replace(number, '[^\d]', '', 'g'), '^0*([24])', '61\1') as phone_number,
first_name,
concat(first_name, ' ', surname) as name,
email_address as email,
electorate,
call_description as description
from sources.powerup_engagement
group by 1,2,3,4,5,6
) tocall 
where length(phone_number) = 11
;
