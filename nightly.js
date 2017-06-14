const { knex } = require('./models');
const { recycle_all } = require('./dialer/recycle')
recycle_all().then(async() => knex.destroy())
