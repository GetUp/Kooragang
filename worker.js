/* eslint no-constant-condition: 0, no-await-in-loop: 0, no-restricted-syntax: 0 */
const { dial, calledEveryone, notifyAgents } = require('./dialer')
const { sleep } = require('./utils')
const { Campaign } = require('./models')

const host = process.env.BASE_URL
if (!host) throw new Error('BASE_URL must be set')
const period = process.env.DIALER_PERIOD || 1000

const isPausing = campaign => campaign.status === 'pausing'

const work = async () => {
  while (true) {
    const runningCampaigns = await Campaign.query().whereIn('status', ['active', 'pausing'])
    for (const campaign of runningCampaigns) {
      if (await calledEveryone(campaign) || isPausing(campaign)) {
        await notifyAgents(campaign)
        // TODO: callees being actively called at the time of pausing
        // this does not handle callees being actively called at the time of pausing
        // these callees will subsequently be dropped
        if (isPausing(campaign)) await campaign.$query().patch({ status: 'paused' })
      } else {
        await dial(host, campaign)
      }
    }
    await sleep(period)
  }
}

work()
