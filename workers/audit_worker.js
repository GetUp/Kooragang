/* eslint no-constant-condition: 0 */

const {sleep, error_exit} = require('../utils')
const period = process.env.AUDIT_PERIOD || 60000
const env = process.env.NODE_ENV || 'development'
const promisify = require('es6-promisify')
const config = require('../knexfile_read_only')
const pg = require ('pg')
const delay_interval = '20 minutes'
const IncomingWebhook = require('@slack/client').IncomingWebhook
const webhook = new IncomingWebhook(process.env.ALERT_IF_WAIT_MORE_THAN_URL)
const webhookp = promisify(webhook.send.bind(webhook))

const query = `select qc.*, ca.phone_number, cp.name as name from queued_calls qc
inner join callees ca on ca.id = qc.callee_id
inner join campaigns cp on cp.id = ca.campaign_id
where qc.created_at < now() - '${delay_interval}'::interval`
let time_since_last_alert

const work = async () => {
  const pool = new pg.Pool({connectionString: config[env].connection})
  while (true) {
    const queued_calls = (await pool.query(query)).rows
    const now = new Date()
    if (queued_calls.length && (!time_since_last_alert || now - time_since_last_alert > 300000)) {
      time_since_last_alert = now
      let text = `*Queued calls delayed more than 20 minutes:*\n\n`
      text += queued_calls.map(c => {
        return `  ID: ${c.id} - ${c.created_at} with ${c.status} - ${JSON.stringify(c.response)} with callee ${c.callee_id} (${c.phone_number}) on ${c.name}`
      }).join("\n")
      text += `\nSQL:\n\`\`\`\n${query}\n\`\`\`\n`
      text += '[Next alert in 5 minutes]'
      await webhookp({text})
    }
    await sleep(period)
  }
}

work().catch(error_exit)
