const env = process.env.NODE_ENV || 'development'
const config = require('../knexfile')
const pg = require ('pg')

module.exports = async (server) => {
  const connectionOptions = {
    transports: ['websocket'],
    pingInterval: 15000,
    pingTimeout: 30000
  }
  const io = require('socket.io')(server, connectionOptions)
  const pool = new pg.Pool({connectionString: config[env].connection})
  const db = await pool.connect()

  io.use(async  (socket, next) => {
    const caller_id = socket.handshake.query.token
    const caller = (await db.query('select * from callers where id = $1', [caller_id])).rows[0]
    if (!caller) return next(new Error('authentication error'))
    if (caller.status === 'complete') return next(new Error('caller complete'))
    next()
  })

  io.on('connection', async socket => {
    socket.join(`caller-${socket.handshake.query.token}`)
  })

  db.query('listen caller_event')
  db.on('notification', async notification => {
    if (notification.channel !== 'caller_event') return
    const event = JSON.parse(notification.payload)
    event.value = JSON.parse(event.value)
    if (event.name === 'answered' || event.name === 'caller_survey') {
      event.callee = (await db.query('select * from callees inner join calls on callee_id = callees.id where calls.id = $1', [event.call_id])).rows[0]
    }
    io.to(`caller-${event.caller_id}`).emit('event', event)
  })
}
