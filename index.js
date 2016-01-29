'use strict';

let server = require('./dialer');
let port = process.env.PORT || 8080;

server.listen(port, () => console.log('App running on port', port));
