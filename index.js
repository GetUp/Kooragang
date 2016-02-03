const server = require('./dialer');
const port = process.env.PORT || 8080;

server.listen(port, () => console.log('App running on port', port));
