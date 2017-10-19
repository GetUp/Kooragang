const port = process.env.PORT || 4080;
const express = require('express');
const plivo = require('plivo');
const moment = require('moment');
const bodyParser = require('body-parser');
const app = express();
const _ = require('lodash');
const plivo_api = plivo.RestAPI({ authId: process.env.PLIVO_API_ID, authToken: process.env.PLIVO_API_TOKEN});
const readline = require('readline');
const knex = require('knex')({client: 'pg', connection: process.env.LOADTEST_DATABASE_URL});
const objection = require('objection');
const Model = objection.Model;
const promisfy = require('es6-promisify');
Model.knex(knex);
const targets = process.env.TARGET.split(',');
console.error(targets)
const debug = process.env.DEBUG;
let wrap;

let state = {};
let agents = 0;
let agentIds = [];
let targetCount = 0

const selectTarget = () => {
  const target = targets[targetCount % targets.length]
  targetCount++
  return target
}

class Caller extends Model {
  static get tableName() { return 'callers' }
}

class Event extends Model {
  static get tableName() { return 'events' }
}

class Call extends Model {
  static get tableName() { return 'calls' }
}

app.use(bodyParser.urlencoded({extended: true}));
app.use((req, res, next) => {
  res.set('Content-Type', 'text/xml');
  next();
});

const host = process.env.BASE_URL;
const appUrl = endpoint => endpoint ? `${host}/${endpoint}` : host;

app.get('/', (req, res) => res.send('<_-.-_>let\'s test.</_-.-_>'));

app.all('/answer', async (req, res) => {
  if (debug) console.error(`Agent ${req.query.agent} connected. with CallUUID: ${req.body.CallUUID}`)
  state[req.query.agent] = 'joining';
  const r = plivo.Response();
  r.addWait({length: 10});
  r.addDTMF(1);
  r.addWait({length: 15});
  r.addRedirect(appUrl(`cycle?agent=${req.query.agent}`));
  return res.send(r.toXML());
});
app.all('/hangup', async (req, res) => {
  if (debug) console.error(`Agent ${req.query.agent} disconnected.`)
  if (debug) console.error(req.body)
  state[req.query.agent] = 'disconnected';
  return res.sendStatus(200);
});

app.all('/cycle', async (req, res) => {
  const r = plivo.Response();
  if (wrap) {
    r.addHangup();
    return res.send(r.toXML());
  }
  const caller = await Caller.query().orderBy('created_at', 'desc').where({phone_number: req.query.agent}).limit(1).first();
  if (!caller) {
    console.error(`Unable to find caller ${req.query.agent}. Hanging up`)
    r.addHangup()
    return res.send(r.toXML());
  }
  if (!agentIds.includes(caller.id)) agentIds.push(caller.id);
  if (debug) console.error(`Agent ${caller.phone_number} has status ${caller.status}`);
  if (caller.status === 'in-call') {
    if (debug) console.error(`Agent ${caller.phone_number} is on a call. Setting disposition.`);
    r.addDTMF(3);
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

const report = async () => {
  const summary = _.invertBy(state);
  const statuses = Object.keys(summary).map((status) => `${status} = ${summary[status].length}`);
  const statusCounts = await Call.knexQuery().select('dropped')
    .count('calls.id as count')
    .whereRaw("ended_at >= NOW() - INTERVAL '5 minutes'")
    .groupBy('dropped');
  const waitEvents = await Event.query()
    .whereIn('name', ['caller_complete', 'answered'])
    .whereRaw("created_at >= NOW() - INTERVAL '5 minutes'");
  const wait = waitEvents.length ? Math.round(_.sumBy(waitEvents, event => JSON.parse(event.value).seconds_waiting) / waitEvents.length) : 0;
  const total = _.sumBy(statusCounts, ({count}) => parseInt(count, 10));
  const dropStatus = _.find(statusCounts, ({dropped}) => dropped);
  const drops = dropStatus ? parseInt(dropStatus.count, 10) : 0;
  const rate = agents ? Math.round(total*12/agents) : 0;
  const dropRate = total ? Math.round(drops*100/total) : 0;
  console.log(moment().format('h:mm:ss a ⇨ '), statuses.length ? statuses.join(', ') : 'connected: 0', ` average wait: ${wait}s   [${rate}/agent hour with ${total} total, ${drops} drops at ${dropRate}% drop rate in last 5 mins ]`);
};

const addAgent = async (count) => {
  console.log(`Adding ${count} agents; wait until all added before adding more`);
  const range = _.range(count)
  for (let _step of range) {
    const agent = 61400000000 + agents++
    const params = {
      to: selectTarget(),
      from : agent,
      answer_url : appUrl(`answer?agent=${agent}`),
      hangup_url : appUrl(`hangup?agent=${agent}`),
      time_limit: 60 * 120
    };
    try{
      if (debug) console.error(`calling to ${params.to} from ${params.from}`)
      await promisfy(plivo_api.make_call.bind(plivo_api))(params);
    } catch (e) {
      console.error(`Agent ${agent} could not connect - `, e)
    }
  }
  console.log('All agents added, you may add more')
}

app.listen(port, () => {
  console.log('Load tester running on port', port);

  report();
  setInterval(report, process.env.INTERVAL || 10000);

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', async (str, key) => {
    if (key.ctrl && key.name === 'c') {
      console.error('All done!')
      process.exit();
    } else if (key.name === 'p') {
      wrap = !wrap;
      console.error(wrap ? 'Hanging up all agents' : 'OK to resume');
    } else if (key.sequence === '*'){
      await addAgent(100);
    } else if (key.name.match(/[1-9]/)){
      await addAgent(parseInt(key.name, 10));
    }
  });
  console.log('Press a number to add that many agents and p to pause/resume the simulation');
});
