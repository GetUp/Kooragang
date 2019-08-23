# Kooragang

Kooragang is a tool for running large-scale distributed volunteer phone banking campaigns.

Existing third-party phone banking tools are typically designed for a centralised environment such as a call centre. They require stable internet and secondary computers or tablets. They also require training. These requirements are challenging in a distributed campaign where people are calling from community centres, house-parties and by themselves at home. These environments have unstable internet and rarely is there enough devices to go around. There is also little time at such events to run training on new technology. These challenges limit the speed at which a distributed campaign can scale.

Kooragang was designed to overcome these challenges by only requiring a volunteer caller to have a phone that can make normal phone calls (i.e. not a smart phone).

Kooragang uses a predictive dialer algorithm to speed up calling. The ratio of the algorithm can be configured to stay within acceptable drop rates. This can reduce the wait times for volunteers to as low as under 10 seconds.

### Development setup

`npm i`
`createdb kooragang`
`createdb kooragang_test`
`knex migrate:latest`
`knex migrate:latest --env test`
`knex seed:run`

`cp .env.example .env` & add your Plivo credentials

`npm run start` to boot the app

`npm test` to run tests

See `package.json` for further commands.

### FAQ

*How do volunteers know who they are calling?*

Kooragang can be configured to read out the first name of the person being called at the start of the call. Other than that, no additional information is given to the caller. This is a trade off to allow the system to be simple as possible. We've found that this has not been a significant limitation in large scale campaigns - especially if you have a good script with an engaging opening question. So much so, that we don't even bother reading out first names anymore.

*..but I really want volunteers to see a screen of details about the person they're calling*

See above. We do have a separate tool that can show additional details in a web browser. Contact us if you're interested. At this point tho, you're reintroducing additional devices, necessary training, and reliable internet. You might just want to use existing telemarketing software like CallHub or GetThru.

*What do I need to make this work?*

At minimum, it'll require a developer to set it up on Heroku and to load data into the Postgres database.

*Who can use this?*

This software is for progressive non-commercial projects. If this is not you, you won't get any support from the community and it'll be difficult to setup and maintain. Contact us if you have any questions. See also the software license.


*How much does it cost?*

This depends greatly on pickup rates, the lengths of the calls and your local Plivo rates. As an estimate tho, Kooragang can attempt to call around 10,000 Australian numbers for $400 USD. In the U.S. or Canada, this would be much cheaper. It usually works out cheaper than any commercial alternative.

*Where's the admin interface?*

GetUp is working on this and will be releasing something soon. In the meantime, you'll need to upload contacts into the `callees` table. Almost everything can be configured through fields on `campaigns` records.

*Who are Plivo?*

Plivo are a telephony provider and a competitor to Twilio. There are a lot of similarities between the two. It is generally cheaper than Twilio tho. When Kooragang was initially written, it had better performance than Twilio in Australia. CallHub use Plivo.

*Is it production ready?*

Yes. It has been used to make millions of calls and has handled nights with 300 simultaneous callers. GetUp have used this software for election campaigns and it was the calling tool for the yes.org.au Marriage Equality campaign. We recommend a single production dyno and a `standard-0` database with a follower for running analytics on.

*Why is the etymology of Kooragang*

GetUp uses place names as internal code words for projects. Some of the developers live in Newcastle, Australia and chose Kooragang as the code name. Kooragang is part of the worlds largest coal export terminal. One day we hope they'll be a just transition for this region and this will no longer be the case. Learn more about Kooragang at https://en.wikipedia.org/wiki/Kooragang. Kooragang also refers to a place where birds gather in the Awabakal language. Triva: ControlShift's platform once upon a time was a GetUp project. It's internal codeword is Agra, which is still referenced throughout the codebase.

*I have more questions!*

This documentation is still a work in progress. Please either raise a github issue or send us a mail at tech@getup.org.au.
