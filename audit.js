const {sleep, error_exit} = require('./utils')
const period = process.env.AUDIT_PERIOD || 60000
const env = process.env.NODE_ENV || 'development'
const promisify = require('es6-promisify')
const config = require('./knexfile_read_only')
const pg = require ('pg')
const alert_window = process.env.ALERT_IF_WAIT_MORE_THAN || 180
const IncomingWebhook = require('@slack/client').IncomingWebhook
const webhook = new IncomingWebhook(process.env.ALERT_IF_WAIT_MORE_THAN_URL)
const webhookp = promisify(webhook.send.bind(webhook))

const query = `select ca.id, ca.phone_number, cam.name as campaign, cam.ratio, cam.calls_in_progress, (now() - ca.updated_at)::interval::text as time_waiting
      from callers ca
      inner join campaigns cam on cam.id = ca.campaign_id
      where ca.status = 'available'
      and now() - ca.updated_at > '${alert_window} seconds'::interval
      order by 5 desc`
let time_since_last_alert

const work = async () => {
  const db = await pg.connect(config[env].connection)
  while (true) {
    console.error('checking')
    const callers = (await db.query(query)).rows
    const now = new Date()
    if (callers.length && (!time_since_last_alert || now - time_since_last_alert > 300000)) {
      time_since_last_alert = now
      let text = `*${callers.length} callers waiting more than ${alert_window} seconds:*\n`
      text += callers.map(c => {
        const waiting = c.time_waiting.replace(/\..*/, '')
        return `  ID: ${c.id} - ${waiting}s (<tel:${c.phone_number}>) [_${c.campaign}_ with ratio ${c.ratio} & calls_in_progress ${c.calls_in_progress}]`
      }).join("\n")
      text += `\nSQL:\n\`\`\`\n${query}\n\`\`\`\n`
      text += '[Next alert in 5 minutes]'
      console.error(text)
      await webhookp({text})
    }
    await sleep(period);
  }
}

work().catch(error_exit)
