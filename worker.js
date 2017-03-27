const dialer = require('./dialer');
const {sleep} = require('./utils');
const {Campaign} = require('./models');
const host = process.env.BASE_URL;
if (!host) throw `BASE_URL must be set`;
const period = process.env.DIALER_PERIOD || 1000;

const work = async () => {
  while (true) {
    const activeCampaigns = await Campaign.query().where({status: 'active'});
    activeCampaigns.forEach(async campaign => {
      await dialer.dial(host, campaign);
    });
    await sleep(period);
  }
}

work()

