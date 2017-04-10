const port = process.env.PORT || 8070;
const app = require('./reports');
app.use(require('./campaigns/dashboard'));
app.listen(port, () => console.log('App running on port', port));
