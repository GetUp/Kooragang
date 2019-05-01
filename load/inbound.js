const port = process.env.PORT || 4080;
const express = require('express');
const plivo = require('plivo');
const moment = require('moment');
const bodyParser = require('body-parser');
const app = express();
const _ = require('lodash');
const plivo_api = plivo.RestAPI({ authId: process.env.PLIVO_API_ID, authToken: process.env.PLIVO_API_TOKEN });
const readline = require('readline');
const promisfy = require('es6-promisify');
const targets = process.env.TARGET.split(',');
console.log(targets)
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

app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.set('Content-Type', 'text/xml');
  next();
});

const host = process.env.BASE_URL;
const appUrl = endpoint => endpoint ? `${host}/${endpoint}` : host;

app.get('/', (req, res) => res.send('<_-.-_>let\'s test.</_-.-_>'));

app.all('/answer', async (req, res) => {
  if (debug) console.error(`Agent ${req.query.agent} connected. with CallUUID: ${req.body.CallUUID}`)
  state[req.query.agent] = 'joined';
  const r = plivo.Response();
  r.addWait({ length: 30 });
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
  r.addWait({ length: (30 + _.random(4)) });
  r.addRedirect(appUrl(`cycle?agent=${req.query.agent}`));
  return res.send(r.toXML());
});

const report = async () => {
  const summary = _.invertBy(state);
  const statuses = Object.keys(summary).map((status) => `${status} = ${summary[status].length}`);
  console.log(moment().format('h:mm:ss a ⇨ '), `initiated = ${agentIds.length}`, statuses.length ? statuses.join(', ') : 'joined: 0');
};

const addAgent = async (count) => {
  console.log(`Adding ${count} agents; wait until all added before adding more`);
  const range = _.range(count)
  for (let _step of range) {
    const agent = 61100000001 + agents++
    agentIds.push(agent)
    const params = {
      to: selectTarget(),
      from: agent,
      answer_url: appUrl(`answer?agent=${agent}`),
      hangup_url: appUrl(`hangup?agent=${agent}`),
      time_limit: 60 * 10
    };
    try {
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
      if (wrap) {
        console.error('Hanging up all agents; press P again to resume once all disconnected')
      } else {
        agentIds = []
        state = {}
        console.error('OK to resume')
      }
    } else if (key.sequence === '*') {
      await addAgent(100);
    } else if (key.name.match(/[1-9]/)) {
      await addAgent(parseInt(key.name, 10));
    }
  });
  console.log('Press a number to add that many agents and p to pause/resume the simulation');
});
