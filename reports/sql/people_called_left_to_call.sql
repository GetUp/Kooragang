-- this query will return a summary the amount of people called and people remaining to call

select name, case when last_called_at is not null then 'called' else 'can be called' end as status, count(*) from callees ca
inner join campaigns c on c.id = ca.campaign_id
where name !~* 'test'
-- uncomment the following link and add in the desired campaign name to return its 
-- and name = 'Banks Adani'
group by 1,2
order by 1,2;