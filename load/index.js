const port = process.env.PORT || 4080;
const express = require('express');
const plivo = require('plivo');
const moment = require('moment');
const bodyParser = require('body-parser');
const app = express();
const _ = require('lodash');
const api = plivo.RestAPI({ authId: process.env.API_ID, authToken: process.env.API_TOKEN});
const readline = require('readline');
const knex = require('knex')({client: 'pg', connection: process.env.DATABASE_URL});
const objection = require('objection');
const Model = objection.Model;
const promisfy = require('es6-promisify');
Model.knex(knex);
const target = process.env.TARGET;
const debug = process.env.DEBUG;

let state = {};

class Caller extends Model {
  static get tableName() { return 'callers' }
}

app.use(bodyParser.urlencoded({extended: true}));
app.use((req, res, next) => {
  res.set('Content-Type', 'text/xml');
  next();
});

const host = process.env.BASE_URL;
const appUrl = endpoint => endpoint ? `${host}/${endpoint}` : host;

app.get('/', (req, res) => res.send('<_-.-_>let\'s test.</_-.-_>'));

app.all('/answer', async (req, res, next) => {
  if (debug) console.error(`Agent ${req.query.agent} connected.`)
  state[req.query.agent] = 'joining';
  const r = plivo.Response();
  r.addWait({length: 8});
  r.addDTMF(1);
  r.addWait({length: 25});
  r.addRedirect(appUrl(`cycle?agent=${req.query.agent}`));
  return res.send(r.toXML());
});
app.all('/hangup', async (req, res, next) => {
  if (debug) console.error(`Agent ${req.query.agent} disconnected.`)
  state[req.query.agent] = 'disconnected';
  return res.sendStatus(200);
});

app.all('/cycle', async (req, res, next) => {
  const caller = await Caller.query().orderBy('created_at', 'desc').where({phone_number: req.query.agent}).first();
  const r = plivo.Response();
  if (debug) console.error(`Agent ${caller.phone_number} has status ${caller.status}`);
  if (caller.status === 'in-call') {
    if (debug) console.error(`Agent ${caller.phone_number} is on a call. Setting disposition.`);
    r.addDTMF(2);
    r.addWait({length: 5});
    r.addDTMF(1);
  } else {
    if (debug) console.error(`Agent ${caller.phone_number} is waiting`);
  }
  state[req.query.agent] = caller.status;
  r.addWait({length: (15 + _.random(4))});
  r.addRedirect(appUrl(`cycle?agent=${req.query.agent}`));
  return res.send(r.toXML());
});

app.listen(port, () => {
  console.log('Load tester running on port', port);
  console.log('Press a to add an agent');
  const report = () => {
    const summary = _.invertBy(state);
    const statuses = Object.keys(summary).map((status) => `${status} = ${summary[status].length}`);
    console.log(moment().format('h:mm:ss a ⇨ '), statuses.length ? statuses.join(', ') : 'connected: 0');
  };
  report();
  setInterval(report, process.env.INTERVAL || 10000)
  readline.emitKeypressEvents(process.stdin);
  let agents = 0;
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', async (str, key) => {
    if (key.ctrl && key.name === 'c') {
      console.error('exiting..')
      process.exit();
    } else if (key.name === 'a'){
      agents++;
      console.log(`Adding agent ${agents}`);
      const params = {
        to: target,
        from : agents,
        answer_url : appUrl(`answer?agent=${agents}`),
        hangup_url : appUrl(`hangup?agent=${agents}`),
        time_limit: 10 * 60
      };
      try{
        await promisfy(api.make_call.bind(api))(params);
      } catch (e) {
        console.error(`Agent ${agents} could not connect - `, e)
      }
    }
  });
});
