const port = process.env.PORT || 8080
const app = require('express')()
if (process.env.IVR) {
  app.use(require('./ivr'))
}
if (process.env.API) {
  app.use(require('./api'))
}
app.get('/blerg', async (req, res) => {
    return res.json({yada: "blerg"})
})
app.listen(port, (err) => {
  if (err) { console.log(err); return; }
  console.log('App running on port', port)
});
