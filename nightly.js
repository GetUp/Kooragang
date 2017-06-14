const {knex} = require('./models');
require('./dialer/recycle')().then(async() => knex.destroy());
