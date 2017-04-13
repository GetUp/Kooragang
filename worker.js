const {dial, calledEveryone, notifyAgents} = require('./dialer');
const {sleep} = require('./ivr/utils');
const {Campaign, Caller} = require('./models');
const host = process.env.BASE_URL;
if (!host) throw `BASE_URL must be set`;
const period = process.env.DIALER_PERIOD || 1000;

const isPausing = async campaign => campaign.status === "pausing"

const work = async () => {
  while (true) {
    const runningCampaigns = await Campaign.query().whereIn('status', ['active', 'pausing']);
    for (let campaign of runningCampaigns) {
      if (await calledEveryone(campaign) || isPausing(campaign)) {
        await notifyAgents(campaign);
        // TODO: callees being actively called at the time of pausing
        // this does not handle callees being actively called at the time of pausing
        // these callees will subsequently be dropped
        if (isPausing(campaign)) await campaign.$query().patch({status: 'paused'});
      } else {
        await dial(host, campaign);
      }
    };
    await sleep(period);
  }
}

work()
