/* eslint no-constant-condition: 'off' */
const { sleep, error_exit } = require('../utils')
const { plivo_setup_campaigns } = require('../campaigns/plivo_setup')

const work = async () => {
  console.log('Robotargeter SETUP WORKER running')
  while (true) {
    await plivo_setup_campaigns()
    await sleep(5000)
  }
}

work().catch(error_exit)
