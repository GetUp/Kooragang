const app = require('express')();
const _ = require('lodash');
const {Campaign} = require('../models');
app.set('view engine', 'ejs');
app.set('views', `${__dirname}/views`);

app.get('/dashboard', async ({body, params}, res) => {
  res.set('Content-Type', 'text/html');
  const campaigns = await Campaign.query();
  let campaignsArray = [];
  if (!campaigns) res.sendStatus(404);
  const generateReport = async () => {
    for(var i = 0; i < campaigns.length; i++) {
        let campaign = campaigns[i];
        const data = {
            id: campaign.id,
            name: campaign.name,
            phone_number: campaign.phone_number,
            status: campaign.status
        }
        campaignsArray.push(data);
    }
  };
  await generateReport();
  return res.render('dashboard.ejs', {campaignsArray})
});


module.exports = app
