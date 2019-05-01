const app = require('express')();
const plivo = require('plivo');

app.post('/test_conference', async ({ body }, res) => {
  const r = plivo.Response();
  const params = {
    // callbackUrl: res.locals.appUrl(`test_conference_event?caller=${body.From}`),
    timeLimit: 60 * 10,
  }
  r.addConference(`conference-${body.From}`, params);
  res.send(r.toXML());
});

app.post('/test_conference_event', async ({ body }, res) => {
  console.log(`${body.From} in conference`)
  res.sendStatus(200);
});

app.post('/test_hangup', async ({ body }, res) => {
  console.log(`${body.From} finished`)
  res.sendStatus(200);
});


module.exports = app;
