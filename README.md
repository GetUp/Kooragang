# Kooragang

Kooragang is a phonebanking tool for running large-scale distributed volunteer calling campaigns.

Existing third-party phonebanking tools are typically designed for a centralised environment such as a call centre. They require stable internet and secondary devices. They also require training. These requirements are challenging in a distributed campaign where people are calling from community centres, house-parties and by themselves at home. These environments have unstable internet and rarely is there enough devices to go around. These challenges limited the speed at which a distributed campaign can scale.

Kooragang was designed to overcome these challenges by only requiring a volunteer caller to have a phone that can make normal phone calls (i.e. not a smart phone). 

Kooragang uses a predictive dialer to speed up calling. The aggressiveness of the predictive dialer can be configured to stay within acceptable drop rates. 


### FAQ

*Where's the admin interface?*

GetUp is working on this and will be releasing something soon. In the meantime, almost everything can be configured through fields on `campaigns` recoreds.

*How much does it cost?*

This depends greatly on pickup rates, the lengths of the calls and your local Plivo rates. An an estimate tho, Kooragang can attempt to call around 10,000 people for $400 USD.


### Development setup

`npm i`

`createdb kooragang`
`createdb kooragang_test`
`knex migrate:latest`
`knex migrate:latest --env test`
`knex seed:run`
