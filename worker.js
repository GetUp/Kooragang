/* eslint no-constant-condition: 0 */

const {dial, notifyAgents} = require('./dialer');
const {sleep, error_exit} = require('./utils');
const {Campaign} = require('./models');
const host = process.env.BASE_URL;
if (!host) throw `BASE_URL must be set`;
const period = process.env.DIALER_PERIOD || 1000;

const work = async () => {
  while (true) {
    const runningCampaigns = await Campaign.query().whereIn('status', ['active', 'pausing']);
    for (let campaign of runningCampaigns) {
      if (await campaign.calledEveryone() || campaign.isPausing()) {
        await notifyAgents(campaign);
        // TODO: callees being actively called at the time of pausing
        // this does not handle callees being actively called at the time of pausing
        // these callees will subsequently be dropped
        if (campaign.isPausing()) await campaign.$query().patch({status: 'paused'});
      } else {
        await dial(host, campaign);
      }
    }
    await sleep(period);
  }
}

work().catch(error_exit)
