const request = require('request');
const path = require('path');

const webhooks = (process.env.WEBHOOKS || '').split(',')
console.error(`using webhooks ${webhooks.join(', ')}`);

module.exports = (endpoint, data) => {
  webhooks.forEach( webhook => {
    request.patch({ url: `${webhook}/${endpoint}.json`, body: data, json: true }, (err, response, body) => {
      if (response.statusCode !== 200) return console.error('Webhook response ', response.statusCode, body)
      if (err) return console.error('Error on webhook', err);
    });
  });
};
