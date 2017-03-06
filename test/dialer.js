const expect = require('expect.js');
const nock = require('nock');
const dialer = require('../dialer');
const moment = require('moment');
const _ = require('lodash');

const { Callee, Caller, Call, Campaign, Event } = require('../models');

const dropAll = async () => {
  await Event.query().delete();
  await Call.query().delete();
  await Callee.query().delete();
  await Campaign.query().delete();
  await Caller.query().delete();
}

describe('.dial', () => {
  let callee, invalidCallee, campaign;
  const testUrl = 'http://test'
  beforeEach(dropAll);
  beforeEach(async () => {
    campaign = await Campaign.query().insert({name: 'test'});
    invalidCallee = await Callee.query().insert({phone_number: '9', campaign_id: campaign.id});
    callee = await Callee.query().insert({phone_number: '123456789', campaign_id: campaign.id});
  });

  context('with available callees', () => {
    it('should call the first one with a valid number', async () => {
      mockedApiCall = nock('https://api.plivo.com')
        .post(/Call/, body => body.to === callee.phone_number)
        .query(true)
        .reply(200);
      await dialer.dial(testUrl, campaign);
      mockedApiCall.done();
    });
  });

  context('with a predictive ratio dialer campaign', () => {
    let mockedApiCall;
    beforeEach(async () => {
      campaign = await Campaign.query().patchAndFetchById(campaign.id, {dialer: 'ratio'});
    });
    beforeEach(() => {
      mockedApiCall = nock('https://api.plivo.com')
        .post(/Call/, body => body.to === callee.phone_number)
        .query(true)
        .reply(200);
    });

    context('with no drops in the last 10 minutes', () => {
      it('should increase the calling ratio by 1', async () => {
        await dialer.dial(testUrl, campaign)
        const updatedCampaign = await Campaign.query().where({id: campaign.id}).first();
        expect(updatedCampaign.ratio).to.be(1);
      });

      context('with the calling ratio at the max', () => {
        beforeEach(async () => {
          campaign = await Campaign.query().patchAndFetchById(campaign.id, {ratio: campaign.max_ratio});
        });
        it('should not increase the calling ratio', async () => {
          await dialer.dial(testUrl, campaign);
          const updatedCampaign = await Campaign.query().where({id: campaign.id}).first();
          expect(updatedCampaign.ratio).to.be(1);
        });
      });
    });

    context('drops in the last 10 minutes over an acceptable ratio', () => {
      beforeEach(async () => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          ratio: campaign.max_ratio
        });
      });
      beforeEach(async () => {
        await Call.query().insert({callee_id: callee.id, dropped: true, ended_at: new Date()})
      });
      it('should decrease the calling ratio', async () => {
        await dialer.dial(testUrl, campaign)
        const updatedCampaign = await Campaign.query().where({id: campaign.id}).first();
        expect(updatedCampaign.ratio).to.be(campaign.max_ratio - 1);
      });
    });

    context('drops in the last 10 minutes under an acceptable ratio', () => {
      beforeEach(async () => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          ratio: campaign.max_ratio - 1
        });
      });
      beforeEach(async () => {
        await Call.query().insert({callee_id: callee.id, dropped: true, ended_at: new Date()})
        const inserts = _.range(100).map(() => Call.query().insert({callee_id: callee.id, status: 'completed', ended_at: new Date()}));
        await Promise.all(inserts);
      });
      it('should increase the calling ratio', async () => {
        await dialer.dial(testUrl, campaign)
        const updatedCampaign = await Campaign.query().where({id: campaign.id}).first();
        expect(updatedCampaign.ratio).to.be(campaign.max_ratio);
      });

      it('should create an event', async () => {
        await dialer.dial(testUrl, campaign)
        const event = await Event.query().where({campaign_id: campaign.id, name: 'ratio', value: campaign.max_ratio}).first();
        expect(event).to.be.an(Event);
      });
    });

    context('with a recent adjustment to the dialer in the last 3 mins', () => {
      beforeEach(async () => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          ratio: campaign.max_ratio - 1,
          last_checked_ratio_at: moment().subtract(2, 'minutes').toDate()
        });
      });
      it('should make no further adjustments', async () => {
        await dialer.dial(testUrl, campaign)
        const updatedCampaign = await Campaign.query().where({id: campaign.id}).first();
        expect(updatedCampaign.ratio).to.be(campaign.max_ratio - 1);
      });
    });

    context('with 2 available agents and ratio of 2', () => {
      beforeEach(async () => {
        await Promise.all(_.range(2).map(() => Caller.query().insert({phone_number: '1', status: 'available'})));
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          ratio: 3, max_ratio: 4, last_checked_ratio_at: new Date()
        });
      });
      beforeEach(async () => {
        const inserts = _.range(4).map(() => Callee.query().insert({phone_number: '61411111111', campaign_id: campaign.id}));
        await Promise.all(inserts);
      });
      it('should initiate available agents * ratio calls', async () => {
        mockedApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => body.to === '61411111111')
          .query(true)
          .times(4)
          .reply(200);
        await dialer.dial(testUrl, campaign)
        mockedApiCall.done()
      });
    });
  });
});

describe('.isComplete', () => {
  let campaign;
  beforeEach(dropAll);
  beforeEach(async () => {
    campaign = await Campaign.query().insert({name: 'test'});
  });

  context('with no available callees', () => {
    beforeEach(async () => Callee.query().insert({phone_number: '123456789', last_called_at: new Date(), campaign_id: campaign.id}));
    it('should return true', async () => expect(await dialer.isComplete()).to.be(true));
  });
  context('with available callees', () => {
    beforeEach(async () => Callee.query().insert({phone_number: '123456789', campaign_id: campaign.id}));
    it('should return false', async () => expect(await dialer.isComplete()).to.be(false));
  });
});
