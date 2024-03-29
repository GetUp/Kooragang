const _ = require('lodash')
const expect = require('expect.js')
const nock = require('nock')
const proxyquire = require('proxyquire')
const moment = require('moment')
const ivrCaller = proxyquire('../../ivr/caller', {
  '../dialer': {
    dial: async (_) => { }
  }
})
const ivrCallerAssessment = require('../../ivr/caller_assessment')
const app = require('../../ivr/common')
app.use(ivrCaller)
app.use(ivrCallerAssessment)
const request = require('supertest')(app)

const { dropFixtures } = require('../test_helper')
const {
  Call,
  Callee,
  Caller,
  Campaign,
  Event,
  SurveyResult,
  Team,
  User
} = require('../../models')

const hours_of_operation_full = require('../../seeds/hours_of_operation_full.example.json')
const hours_of_operation_null = require('../../seeds/hours_of_operation_null.example.json')
const more_info = require('../../seeds/more_info.example.json')
const questions = require('../../seeds/questions.example.json')
const multiple_questions = require('../../seeds/questions_multiple.example.json')
const malformed_questions = require('../../seeds/questions_malformed.example.json')

const campaign_template = Object.assign({
  more_info: more_info,
  hours_of_operation: hours_of_operation_full
}, require('../../seeds/default_campaign.example.json'))
const defaultCampaign = Object.assign({ id: 1, questions: questions }, campaign_template)
const malformedCampaign = Object.assign({ questions: malformed_questions }, campaign_template)
const multipleCampaign = Object.assign({ id: 1, questions: multiple_questions }, campaign_template)
const activeCampaign = Object.assign({ status: 'active' }, defaultCampaign)
const pausedCampaign = Object.assign({ status: 'paused' }, defaultCampaign)
const pausedNextCampaign = Object.assign({ status: 'paused', callers_remaining: 9, next_campaign_id: 2 }, defaultCampaign)
const downCampaign = Object.assign({ status: 'down' }, defaultCampaign)
const inactiveCampaign = Object.assign({ status: 'inactive' }, defaultCampaign)
const inactiveNextCampaign = Object.assign({ status: 'inactive', next_campaign_id: 2 }, defaultCampaign)
const nextCampaign = Object.assign({ status: 'active', callers_remaining: 9 }, defaultCampaign, { id: 2, name: 'Inactive Test', phone_number: '61291234567' })
const statuslessCampaign = Object.assign({ status: null }, defaultCampaign)
const redundancyCampaign = Object.assign({ revert_to_redundancy: true }, activeCampaign)
const amdCampaign = Object.assign({ status: 'active', detect_answering_machine: true }, defaultCampaign)
const operationalWindowCampaign = Object.assign({}, activeCampaign, { hours_of_operation: hours_of_operation_null })
const teamsCampaign = Object.assign({ status: 'active', teams: true }, defaultCampaign)
const authCampaign = Object.assign({ status: 'active', passcode: '1234' }, defaultCampaign)
const holdMusicCampaign = Object.assign({}, activeCampaign, { hold_music: '{"stevie_wonder_classic.mp3"}' })

const CallUUID = '111'
let campaign
let caller = {
  first_name: 'bob',
  phone_number: '61288888888',
  location: 'balmain',
  campaign_id: 1
}
const associatedCallee = {
  first_name: 'chris',
  phone_number: '61277777777',
  location: 'rozelle',
  caller: '61288888888',
  campaign_id: 1
}

const associatedTargetedCallee = Object.assign({}, associatedCallee, { target_number: '098765' })
const associatedCaller = Object.assign({}, caller)

beforeEach(async () => {
  await dropFixtures()
  campaign = await Campaign.query().insert(activeCampaign)
})

describe('/connect', () => {
  context('with no campaign id specified', () => {
    const payload = { From: caller.phone_number }
    it('plays the briefing message', () => {
      return request.post('/connect')
        .type('form')
        .send(payload)
        .expect(/error/)
    })
  })

  describe('the language of the robo voice', () => {
    context('with no environment variable set', () => {
      it('should default to en-GB man', () => {
        return request.post('/connect')
          .type('form')
          .send({ From: caller.phone_number })
          .expect(/en-GB/)
          .expect(/voice="MAN"/)
      })
    })

    context('with VOICE_LANGUAGE and VOICE_GENDER set', () => {
      beforeEach(() => {
        process.env.VOICE_LANGUAGE = 'en-US'
        process.env.VOICE_GENDER = 'WOMAN'
      })
      afterEach(() => {
        delete process.env.VOICE_LANGUAGE
        delete process.env.VOICE_GENDER
      })

      it('should change the voice', () => {
        return request.post('/connect')
          .type('form')
          .send({ From: caller.phone_number })
          .expect(new RegExp(process.env.VOICE_LANGUAGE))
          .expect(new RegExp(`voice="${process.env.VOICE_GENDER}"`))
      })
    })
  })

  context('with a sip number', () => {
    beforeEach(async () => { await Callee.query().insert(associatedCallee) })
    beforeEach(async () => campaign.recalculateCallersRemaining())
    it('should strip out sip details for caller number', async () => {
      await request.post(`/connect?campaign_id=${campaign.id}`)
        .type('form')
        .send({ From: 'sip:alice123@phone.plivo.com' })
        .expect(/caller_number=alice123&amp;start=1/)
    })
  })

  context('with a private number', () => {
    beforeEach(async () => { await Callee.query().insert(associatedCallee) })
    beforeEach(async () => campaign.recalculateCallersRemaining())
    const payload = { From: '' }
    it('directs them to enable caller id', () => {
      return request.post(`/connect?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
        .expect(/caller ID/)
    })
  })

  context('with a private number', () => {
    beforeEach(async () => { await Callee.query().insert(associatedCallee) })
    beforeEach(async () => campaign.recalculateCallersRemaining())
    const payload = { From: 'anonymous' }
    it('directs them to enable caller id', () => {
      return request.post(`/connect?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
        .expect(/caller ID/)
    })
  })

  context('with a private number', () => {
    beforeEach(async () => { await Callee.query().insert(associatedCallee) })
    beforeEach(async () => campaign.recalculateCallersRemaining())
    const payload = { From: 'undefined' }
    it('directs them to enable caller id', () => {
      return request.post(`/connect?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
        .expect(/caller ID/)
    })
  })

  context('with a callback', () => {
    const payload = { From: '33333' }
    beforeEach(async () => { await Callee.query().insert(associatedCallee) })
    beforeEach(async () => campaign.recalculateCallersRemaining())
    it('should use the number passed in the number parameter', () => {
      return request.post(`/connect?campaign_id=${campaign.id}&callback=1&number=${caller.phone_number}`)
        .type('form')
        .send(payload)
        .expect(/<Redirect/)
        .expect(/briefing/)
        .expect(new RegExp(caller.phone_number))
    })
  })

  context('with a paused campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(pausedCampaign))
    beforeEach(async () => campaign.recalculateCallersRemaining())
    const payload = { From: caller.phone_number }
    it('plays the paused briefing message ', () => {
      return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
        .type('form')
        .send(payload)
        .expect(/currently paused/)
    })
  })

  context('with a down campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(downCampaign))
    beforeEach(async () => campaign.recalculateCallersRemaining())
    const payload = { From: caller.phone_number }
    it('plays the down briefing message ', () => {
      return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
        .type('form')
        .send(payload)
        .expect(/technical/)
    })
  })

  context('with a statusless campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(statuslessCampaign))
    const payload = { From: caller.phone_number }
    it('plays the paused briefing message ', () => {
      return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
        .type('form')
        .send(payload)
        .expect(/currently paused/)
    })
  })

  context('with a paused campaign with a next campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(pausedNextCampaign))
    beforeEach(async () => await Campaign.query().insert(nextCampaign))
    const nextAssociatedCallee = Object.assign({}, associatedCallee, { campaign_id: 2 })
    beforeEach(async () => { await Callee.query().insert(nextAssociatedCallee) })
    const payload = { From: caller.phone_number }

    it('plays the next campaign name and number, sends an sms, and hangs up', () => {
      return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
        .type('form')
        .send(payload)
        .expect(/currently paused/)
        .expect(/0, 2, 9, 1, 2, 3, 4, 5, 6, 7/)
        .expect(new RegExp(nextCampaign.name))
        .expect(/<Message/)
        .expect(/Please call 0291234567./)
        .expect(/hangup/)
    })
  })

  context('with a inactive campaign with a next campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(inactiveNextCampaign))
    beforeEach(async () => await Campaign.query().insert(nextCampaign))
    const nextAssociatedCallee = Object.assign({}, associatedCallee, { campaign_id: 2 })
    beforeEach(async () => { await Callee.query().insert(nextAssociatedCallee) })
    const payload = { From: caller.phone_number }

    it('plays the next campaign name and number, sends an sms, and hangs up', () => {
      return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
        .type('form')
        .send(payload)
        .expect(/completed/)
        .expect(/0, 2, 9, 1, 2, 3, 4, 5, 6, 7/)
        .expect(new RegExp(nextCampaign.name))
        .expect(/<Message/)
        .expect(/Please call 0291234567./)
        .expect(/hangup/)
    })
  })

  context('with a inactive campaign', () => {
    context('without an assessment session', () => {
      beforeEach(async () => { await Campaign.query().delete() })
      beforeEach(async () => campaign = await Campaign.query().insert(inactiveCampaign))
      const payload = { From: caller.phone_number }
      it('plays the outside operational window briefing message', () => {
        return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
          .type('form')
          .send(payload)
          .expect(/has been completed/)
      })
    })
    context('with an assessment session', () => {
      beforeEach(async () => { await Campaign.query().delete() })
      beforeEach(async () => campaign = await Campaign.query().insert(inactiveCampaign))
      const payload = { From: caller.phone_number }
      it('should redirect to briefing', () => {
        return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}&assessment=1`)
          .type('form')
          .send(payload)
          .expect(/<Redirect/)
          .expect(/briefing/)
      })
    })
  })

  context('with an operational window campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(operationalWindowCampaign))
    beforeEach(async () => { await Callee.query().insert(associatedCallee) })
    const payload = { From: caller.phone_number }
    it('plays the operational window briefing message', () => {
      return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
        .type('form')
        .send(payload)
        .expect(/hours of operation/)
    })
  })

  context('with an revert_to_redundancy campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(redundancyCampaign))
    beforeEach(async () => { await Callee.query().insert(associatedCallee) })
    beforeEach(async () => campaign.recalculateCallersRemaining())
    context('when direction is inbound', () => {
      const payload = { From: caller.phone_number, Direction: 'inbound' }
      it('informs user of high traffic', async () => {
        await request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
          .type('form')
          .send(payload)
          .expect(/hundreds of people/)
          .expect(/handle this traffic/)
      })

      it('should log an event', async () => {
        await request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
          .type('form')
          .send(payload)
        expect(await Event.query().where({ name: 'reached_channel_limit', campaign_id: campaign.id }).first()).to.be.a(Event)
      })
    })
    context('when direction is outbound', () => {
      const payload = { From: caller.phone_number, Direction: 'outbound' }
      it('should continue to briefing', async () => {
        await request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
          .type('form')
          .send(payload)
          .expect(/briefing/)
      })
    })
    context('when DISABLE_REDUNDANCY=1', () => {
      const payload = { From: caller.phone_number, Direction: 'inbound' }
      beforeEach(() => process.env.DISABLE_REDUNDANCY = 1)
      afterEach(() => delete process.env.DISABLE_REDUNDANCY)

      it('informs user of high traffic and hangsup', async () => {
        await request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
          .type('form')
          .send(payload)
          .expect(/hundreds of people/)
          .expect(/all our lines are full/)
          .expect(/hangup/i)
      })
    })
  })

  context('with revert_to_redundancy set', () => {
    beforeEach(async () => { await Callee.query().insert(associatedCallee) })
    beforeEach(async () => campaign.recalculateCallersRemaining())

    context('dialing into a didlogic number', () => {
      const didlogic_number = '1111111'
      const payload = { Direction: 'inbound', From: caller.phone_number, 'SIP-H-To': `<sip:38092489203840928@app.plivo.com;phone=${didlogic_number}>` }

      context('under the channel limit', () => {
        it('should continue to briefing', async () => {
          await request.post(`/connect?campaign_id=${campaign.id}`)
            .type('form')
            .send(payload)
            .expect(/briefing/)
        })
      })
      context('over the channel limit', () => {
        beforeEach(() => {
          process.env.DID_NUMBER_CHANNEL_LIMIT = 10
          process.env.CHANNEL_LIMIT_PADDING = 8
        })
        afterEach(() => delete process.env.DID_NUMBER_CHANNEL_LIMIT)
        afterEach(() => delete process.env.CHANNEL_LIMIT_PADDING)
        beforeEach(async () => {
          await Caller.query().insert({
            phone_number: '1234', inbound_sip: true, inbound_phone_number: didlogic_number,
            created_from_incoming: true, campaign_id: campaign.id
          })
          await Caller.query().insert({
            phone_number: '1234', inbound_sip: true, inbound_phone_number: didlogic_number,
            created_from_incoming: true, campaign_id: campaign.id
          })
        })

        it('should tell them it will call them back', async () => {
          await request.post(`/connect?campaign_id=${campaign.id}`)
            .type('form')
            .send(payload)
            .expect(/handle this traffic/)
            .expect(new RegExp(`ready.*campaign_id=${campaign.id}.*caller_number=${caller.phone_number}.*start=1.*force_callback=1`))
        })
      })
    })
  })

  context('with revert_to_redundancy set', () => {
    beforeEach(async () => { await Callee.query().insert(associatedCallee) })
    beforeEach(async () => campaign.recalculateCallersRemaining())

    context('dialing into a plivo number', () => {
      const plivo_number = '61200001111'
      const payload = { Direction: 'inbound', From: caller.phone_number, To: plivo_number }

      context('under the channel limit', () => {
        it('should continue to briefing', async () => {
          await request.post(`/connect?campaign_id=${campaign.id}`)
            .type('form')
            .send(payload)
            .expect(/briefing/)
        })
      })
      context('over the channel limit', () => {
        beforeEach(() => {
          process.env.PLIVO_ACCOUNT_CHANNEL_LIMIT = 10
          process.env.CHANNEL_LIMIT_PADDING = 8
        })
        afterEach(() => delete process.env.PLIVO_ACCOUNT_CHANNEL_LIMIT)
        afterEach(() => delete process.env.CHANNEL_LIMIT_PADDING)
        beforeEach(async () => {
          await Caller.query().insert({
            phone_number: '1234', inbound_sip: false, inbound_phone_number: plivo_number,
            created_from_incoming: true, campaign_id: campaign.id
          })
          await Caller.query().insert({
            phone_number: '1234', inbound_sip: false, inbound_phone_number: '61222223333',
            created_from_incoming: true, campaign_id: campaign.id
          })
        })

        it('should tell them it will call them back', async () => {
          await request.post(`/connect?campaign_id=${campaign.id}`)
            .type('form')
            .send(payload)
            .expect(/handle this traffic/)
            .expect(new RegExp(`ready.*campaign_id=${campaign.id}.*caller_number=${caller.phone_number}.*start=1.*force_callback=1`))
        })
      })
    })
  })

  context('with teams active campaign', () => {
    let team
    beforeEach(async () => {
      await Campaign.query().delete()
      await User.query().delete()
      await Team.query().delete()
    })
    beforeEach(async () => campaign = await Campaign.query().insert(teamsCampaign))
    beforeEach(async () => team = await Team.query().insert({ name: 'planet savers', passcode: '1234' }))
    beforeEach(async () => await User.query().insert({ phone_number: '098765', team_id: team.id }))
    beforeEach(async () => { await Callee.query().insert(associatedCallee) })
    beforeEach(async () => campaign.recalculateCallersRemaining())
    const payload = { From: '098765' }

    context('with existing user and team', () => {
      it('should announce the team input options', () => {
        return request.post(`/connect?campaign_id=${campaign.id}`)
          .type('form')
          .send(payload)
          .expect(/membership/)
          .expect(/joining a new team/)
          .expect(/without a team/)
      })

      it('should hangup if no input', () => {
        return request.post(`/connect?campaign_id=${campaign.id}`)
          .type('form')
          .send(payload)
          .expect(/No key pressed. Hanging up now/)
      })
    })
    context('with no existing user or team', () => {
      beforeEach(async () => {
        await User.query().delete()
        await Team.query().delete()
      })
      it('should announce the team input options', () => {
        return request.post(`/connect?campaign_id=${campaign.id}`)
          .type('form')
          .send(payload)
          .expect(/member of a calling/)
          .expect(/without a team/)
      })

      it('should hangup if no input', () => {
        return request.post(`/connect?campaign_id=${campaign.id}`)
          .type('form')
          .send(payload)
          .expect(/No key pressed. Hanging up now/)
      })
    })
    context('with team param passed in connect url', () => {
      it('should redirect to briefing', () => {
        return request.post(`/connect?campaign_id=${campaign.id}&team=1`)
          .type('form')
          .send(payload)
          .expect(/<Redirect/)
          .expect(/briefing/)
      })
    })
    context('with a callback', () => {
      const payload = { From: '33333', caller_number: '098765' }
      it('should ignore the team input options and announce welcome back', () => {
        return request.post(`/connect?campaign_id=${campaign.id}&callback=1&number=${caller.phone_number}`)
          .type('form')
          .send(payload)
          .expect(/<Redirect/)
          .expect(/briefing/)
      })
    })
  })

  context('with an authenticated campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(authCampaign))
    beforeEach(async () => { await Callee.query().insert(associatedCallee) })
    beforeEach(async () => campaign.recalculateCallersRemaining())
    const payload = { From: caller.phone_number }
    context('with a callback and authenticated false', () => {
      it('should be prompted to enter passcode', () => {
        return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
          .type('form')
          .send(payload)
          .expect(/Please enter the campaign passcode/)
      })
    })
    context('with a callback true', () => {
      it('should redirect to briefing', () => {
        return request.post(`/connect?campaign_id=${campaign.id}&callback=1&number=${caller.phone_number}`)
          .type('form')
          .send(payload)
          .expect(/<Redirect/)
          .expect(/briefing/)
      })
    })
    context('with a authenticed true', () => {
      it('should redirect to briefing', () => {
        return request.post(`/connect?campaign_id=${campaign.id}&authenticated=1&number=${caller.phone_number}`)
          .type('form')
          .send(payload)
          .expect(/<Redirect/)
          .expect(/briefing/)
      })
    })
    context('with a correct passcode entered', () => {
      it('should redirect to briefing', () => {
        return request.post(`/connect?campaign_id=${campaign.id}&callback=1&number=${caller.phone_number}`)
          .type('form')
          .send(payload)
          .expect(/<Redirect/)
          .expect(/briefing/)
      })
    })
    context('with an incorrect passcode entered', () => {
      it('should ignore the team input options and announce welcome back', () => {
        return request.post(`/connect?campaign_id=${campaign.id}&callback=1&number=${caller.phone_number}`)
          .type('form')
          .send(payload)
          .expect(/<Redirect/)
          .expect(/briefing/)
      })
    })
  })


  context('with ', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(activeCampaign))
    beforeEach(async () => { await Callee.query().insert(associatedCallee) })
    const payload = { From: caller.phone_number }

    context('with no language, voice language, nor voice gender set', () => {
      it('say welcome in english in a man\'s voice', () => {
        return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
          .type('form')
          .send(payload)
          .expect(/Welcome/)
          .expect(/en-GB/)
          .expect(/MAN/)
      })
    })

    context('with german language, voice language gender set', () => {
      it('say welcome in english in a mans voice', () => {
        process.env.LANGUAGE = 'de'
        process.env.VOICE_LANGUAGE = 'de-DE'
        return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
          .type('form')
          .send(payload)
          .expect(/Willkommen/)
          .expect(/de-DE/)
      })
      afterEach(() => {
        delete process.env.VOICE_LANGUAGE
        delete process.env.LANGUAGE
      })
    })

    context('with english language, voice language and female voice gender set', () => {
      it('say welcome in english in a mans voice', () => {
        process.env.LANGUAGE = 'en'
        process.env.VOICE_LANGUAGE = 'en-GB'
        process.env.VOICE_GENDER = 'WOMAN'
        return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
          .type('form')
          .send(payload)
          .expect(/Welcome/)
          .expect(/en-GB/)
          .expect(/WOMAN/)
      })
      afterEach(() => {
        delete process.env.VOICE_GENDER
        delete process.env.VOICE_LANGUAGE
        delete process.env.LANGUAGE
      })
    })

    context('with english language, voice language and female voice gender set', () => {
      it('say welcome in english in a mans voice', () => {
        process.env.LANGUAGE = 'en'
        process.env.VOICE_LANGUAGE = 'en-GB'
        process.env.VOICE_GENDER = 'MAN'
        return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
          .type('form')
          .send(payload)
          .expect(/Welcome/)
          .expect(/en-GB/)
          .expect(/MAN/)
      })
      afterEach(() => {
        delete process.env.VOICE_GENDER
        delete process.env.VOICE_LANGUAGE
        delete process.env.LANGUAGE
      })
    })
  })
})

describe('/briefing', () => {
  context('with a briefing path', () => {
    context('without an assessment session', () => {
      let briefingPath
      beforeEach(() => briefingPath = `/briefing?campaign_id=${campaign.id}&caller_number=${caller.phone_number}&start=1`)
      const payload = { CallUUID: '1231', From: '1231' }
      it('gives the option to assess the survey', async () => {
        await request.post(briefingPath)
          .type('form')
          .send(payload)
          .expect(/<GetDigits/)
          .expect(/1,2,3,4,5,6,7,8/)
      })
    })

    context('with an assessment session', () => {
      let briefingPath
      beforeEach(() => briefingPath = `/briefing?campaign_id=${campaign.id}&caller_number=${caller.phone_number}&start=1&assessment=1`)
      const payload = { CallUUID: '1231', From: '1231' }
      it('gives the option to assess the survey', async () => {
        await request.post(briefingPath)
          .type('form')
          .send(payload)
          .expect(/<GetDigits/)
          .expect(/1,2,3,4,5,6,7,8,*/)
          .expect(/As you are assessing the campaign setup/i)
      })
    })
  })
})

describe('/ready', () => {
  beforeEach(async () => { await Callee.query().insert(associatedCallee) })
  beforeEach(async () => campaign.recalculateCallersRemaining())

  context('with a ready path', () => {
    let readyPath
    beforeEach(() => readyPath = `/ready?campaign_id=${campaign.id}&caller_number=${caller.phone_number}&start=1`)

    context('with an unknown number', () => {
      const payload = { CallUUID: '1231', From: '1231' }
      it('creates a record', async () => {
        await request.post(readyPath)
          .type('form')
          .send(payload)
          .expect(/call queue/i)
        const foundCaller = await Caller.query().where({ phone_number: caller.phone_number }).first()
        expect(foundCaller).to.be.a(Caller)
      })
      it('records the campaign id', async () => {
        await request.post(readyPath)
          .type('form')
          .send(payload)
          .expect(/call queue/i)
        const foundCaller = await Caller.query().where({ campaign_id: campaign.id }).first()
        expect(foundCaller.campaign_id).to.be(campaign.id)
      })
      it('records the call uuid', async () => {
        await request.post(readyPath)
          .type('form')
          .send(payload)
          .expect(/call queue/i)
        const foundCaller = await Caller.query().where({ call_uuid: payload.CallUUID }).first()
        expect(foundCaller.call_uuid).to.be(payload.CallUUID)
      })
    })

    context('with an existing number', () => {
      const payload = { From: caller.phone_number, CallUUID: '1' }
      beforeEach(async () => caller = await Caller.query().insert(caller))

      it('creates a new record', async () => {
        await request.post(readyPath)
          .type('form')
          .send(payload)
          .expect(/call queue/i)
        const callers = await Caller.query().where({ phone_number: caller.phone_number })
        expect(callers.length).to.be(2)
      })
      it('records the campaign id', async () => {
        await request.post(readyPath)
          .type('form')
          .send(payload)
          .expect(/call queue/i)
        const foundCaller = await Caller.query().where({ campaign_id: campaign.id }).first()
        expect(foundCaller.campaign_id).to.be(campaign.id)
      })
      it('records the call uuid', async () => {
        await request.post(readyPath)
          .type('form')
          .send(payload)
          .expect(/call queue/i)
        const foundCaller = await Caller.query().where({ call_uuid: payload.CallUUID }).first()
        expect(foundCaller.call_uuid).to.be(payload.CallUUID)
      })
    })

    context('with a number of non sip origin', () => {
      beforeEach(async () => { await Caller.query().delete() })
      context('inbound', () => {
        const payload = { CallUUID: '1231', From: '1231', To: '8667', Direction: 'inbound' }
        it('records the number details', async () => {
          await request.post(readyPath)
            .type('form')
            .send(payload)
            .expect(/call queue/i)
          const foundCaller = await Caller.query().where({ phone_number: caller.phone_number }).first()
          expect(foundCaller.phone_number).to.be(_.toString(caller.phone_number))
          expect(foundCaller.inbound_phone_number).to.be(_.toString(payload['To']))
          expect(foundCaller.inbound_sip).to.be(false)
          expect(foundCaller.created_from_incoming).to.be(true)
        })
      })
      context('outbound', () => {
        const payload = { CallUUID: '1231', From: '1231', To: '8667', Direction: 'outbound' }
        it('records the number details', async () => {
          await request.post(readyPath)
            .type('form')
            .send(payload)
            .expect(/call queue/i)
          const foundCaller = await Caller.query().where({ phone_number: caller.phone_number }).first()
          expect(foundCaller.phone_number).to.be(_.toString(caller.phone_number))
          expect(foundCaller.inbound_phone_number).to.be(_.toString(payload['From']))
          expect(foundCaller.inbound_sip).to.be(false)
          expect(foundCaller.created_from_incoming).to.be(false)
        })
      })
    })

    context('with an existing caller with matching CallUUID', () => {
      const payload = { CallUUID: '1231', From: '1231' }
      beforeEach(() => Caller.query().insert({ phone_number: '1234', call_uuid: payload.CallUUID, campaign_id: campaign.id }))
      it('creates a record', async () => {
        await request.post(readyPath)
          .type('form')
          .send(payload)
          .expect(/call queue/i)
        const foundCallers = await Caller.query().where({ call_uuid: payload.CallUUID })
        expect(foundCallers.length).to.be(1)
      })
    })

    context('with a number of sip origin', () => {
      beforeEach(async () => { await Caller.query().delete() })
      context('inbound', () => {
        const payload = { CallUUID: '1231', From: 'sip:61481222333@119.9.12.222', To: 'sip:2342352352352@app.plivo.com', Direction: 'inbound', 'SIP-H-To': '<sip:38092489203840928@app.plivo.com;phone=99999>' }
        it('records the number details', async () => {
          await request.post(readyPath)
            .type('form')
            .send(payload)
            .expect(/call queue/i)
          const foundCaller = await Caller.query().where({ phone_number: caller.phone_number }).first()
          expect(foundCaller.phone_number).to.be(_.toString(caller.phone_number))
          expect(foundCaller.inbound_phone_number).to.be('99999')
          expect(foundCaller.inbound_sip).to.be(true)
          expect(foundCaller.created_from_incoming).to.be(true)
        })
      })
      context('outbound', () => {
        const payload = { CallUUID: '1231', From: 'sip:61481222333@119.9.12.222', To: 'sip:2342352352352@app.plivo.com', Direction: 'outbound', 'SIP-H-To': '<sip:38092489203840928@app.plivo.com;phone=99999>' }
        it('records the number details', async () => {
          await request.post(readyPath)
            .type('form')
            .send(payload)
            .expect(/call queue/i)
          const foundCaller = await Caller.query().where({ phone_number: caller.phone_number }).first()
          expect(foundCaller.phone_number).to.be(_.toString(caller.phone_number))
          expect(foundCaller.inbound_phone_number).to.be('99999')
          expect(foundCaller.inbound_sip).to.be(true)
          expect(foundCaller.created_from_incoming).to.be(false)
        })
      })
    })

    it('should give extra instructions',
      () => request.post(`/ready?caller_number=12333&start=1&campaign_id=${campaign.id}`).type('form').send({ CallUUID: '1' }).expect(/press star/i))

    context('with the last call that on the same campaign and phone number that has no survey result', () => {
      let previous_caller, previous_call, last_caller
      beforeEach(async () => {
        previous_caller = await Caller.query().insert({ phone_number: '1234', campaign_id: campaign.id })
        previous_call = await Call.query().insert({ status: 'answered', caller_id: previous_caller.id })
        last_caller = await Caller.query().insert({ phone_number: '1234', campaign_id: campaign.id })
      })

      it('should ask if they want to resume', async () => {
        await request.post(`/ready?caller_number=${last_caller.phone_number}&campaign_id=${campaign.id}&start=1`)
          .type('form').send({ CallUUID: '1' })
          .expect(new RegExp(`resume_survey.*caller_id=.*last_call_id=${previous_call.id}.*campaign_id=${campaign.id}`))
      })
    })

    context('with a previous call that on the same campaign and phone number that has no survey result', () => {
      let previous_caller, last_caller
      beforeEach(async () => {
        previous_caller = await Caller.query().insert({ phone_number: '1234', campaign_id: campaign.id })
        await Call.query().insert({ status: 'answered', caller_id: previous_caller.id })
        last_caller = await Caller.query().insert({ phone_number: '1234', campaign_id: campaign.id })
        const last_call = await Call.query().insert({ status: 'answered', caller_id: previous_caller.id })
        await SurveyResult.query().insert({ call_id: last_call.id, question: 'test', answer: 'test' })
      })

      it('should not ask if they want to resume', async () => {
        await request.post(`/ready?caller_number=${last_caller.phone_number}&campaign_id=${campaign.id}&start=1`)
          .type('form').send({ CallUUID: '1' })
          .expect(/call queue/i)
      })
    })
  })

  it('should put them in a conference',
    () => request.post(`/ready?caller_id=${caller.id}&campaign_id=${campaign.id}`).type('form').send({ CallUUID: '1' }).expect(/<Conference/i))

  it('should use the caller number as the conference name',
    () => request.post(`/ready?caller_id=${caller.id}&campaign_id=${campaign.id}`).type('form').send({ CallUUID: '1' }).expect(new RegExp(caller.id)))

  context('with redirect_to_target set for the campaign', () => {
    beforeEach(async () => campaign = await campaign.$query().patchAndFetch({ transfer_to_target: true, target_numbers: ['1'] }))

    it('should enable 9 as a digit to press', () => {
      return request.post(`/ready?caller_id=${caller.id}&campaign_id=${campaign.id}`).type('form').send({ CallUUID: '1' }).expect(/digitsMatch="9"/i)
    })
  })

  context('with 1 pressed inside work hours', () => {
    it('should inform me about wait times during the day', async () => {
      process.env.OPTIMAL_CALLING_PERIOD_START = '24:00:00'
      process.env.OPTIMAL_CALLING_DAYS = _.lowerCase(moment.tz(campaign.timezone()).add(1, 'day').format('dddd'))
      await request.post(`/ready?caller_number=1111&campaign_id=${campaign.id}&start=1`)
        .type('form').send({ CallUUID: '1' })
        .expect(/wait times/)
        .expect(/day/)
      delete process.env.OPTIMAL_CALLING_DAYS
      delete process.env.OPTIMAL_CALLING_PERIOD_START
    })
  })

  context('with 1 pressed without minimum callers for ratio', () => {
    it('should inform me about wait times during small vollie engagement', async () => {
      process.env.OPTIMAL_CALLING_PERIOD_START = '00:00:00'
      await request.post(`/ready?caller_number=1111&campaign_id=${campaign.id}&start=1`)
        .type('form').send({ CallUUID: '1' })
        .expect(/wait times/)
        .expect(/few/)
      delete process.env.OPTIMAL_CALLING_PERIOD_START
    })
  })

  context('with 1 pressed and a campaign with hud enabled', () => {
    beforeEach(async () => campaign = await campaign.$query().patchAndFetch({ hud: true }))

    it('should let them know their session id', async () => {
      await request.post(`/ready?caller_number=1111&campaign_id=${campaign.id}&start=1`)
        .type('form').send({ CallUUID: '1' })
        .expect(/session code is \d+/)
    })
  })

  context('with 0 pressed', () => {
    it('should redirect them to disconnect', () => {
      return request.post(`/ready?caller_id=${caller.id}&start=1&campaign_id=${campaign.id}`)
        .type('form').send({ Digits: '0', CallUUID: '1' })
        .expect(/disconnect/i)
    })
    it('should allow a user to leave audio recording as feedback if config variable set to true', () => {
      process.env.ALLOW_USER_AUDIO_FEEDBACK = 'true'
      return request.post(`/disconnect?completed=1`)
        .type('form').send({ CallUUID: '1' })
        .expect(/Thank you/)
        .expect(/volunteer/)
        .expect(/feedback/)
    })
    it('should not allow a user to leave audio recording as feedback if config variable set to false', () => {
      process.env.ALLOW_USER_AUDIO_FEEDBACK = 'false'
      return request.post(`/disconnect?completed=1`)
        .type('form').send({ CallUUID: '1' })
        .expect(/Thank you/)
        .expect(/volunteer/)
        .expect(/^((?!feedback).)*$/)
    })
    afterEach(() => { delete process.env.ALLOW_USER_AUDIO_FEEDBACK })
  })

  context('with 2 pressed', () => {
    it('should set a boolean for a call back', async () => {
      await request.post(`/ready?caller_number=${caller.phone_number}&start=1&campaign_id=${campaign.id}`)
        .type('form').send({ Digits: '2', CallUUID: '1234' })
        .expect(/hang up now/i)
      const updatedCaller = await Caller.query().where({ call_uuid: '1234' }).first()
      return expect(updatedCaller.callback).to.be(true)
    })
  })

  context('with 3 pressed', () => {
    it('should send an sms to their number with the script_url', async () => {
      await campaign.$query().patch({ script_url: 'http://test.com/script' })
      await request.post(`/ready?caller_number=${caller.phone_number}&start=1&campaign_id=${campaign.id}`)
        .type('form').send({ Digits: '3' })
        .expect(/message/i)
        .expect(/test.com/i)
    })
  })

  context('with 7 pressed', () => {
    let call, url
    beforeEach(async () => {
      call = await Call.query().insert({ status: 'answered' })
      url = `/ready?caller_id=4&campaign_id=${campaign.id}&call_id=${call.id}`
    })
    it('announce the reference code', async () => {
      await request.post(url)
        .type('form').send({ Digits: '7' })
        .expect(/reference code for this call is/)
    })
    it('should redirect to call again', async () => {
      await request.post(url)
        .type('form').send({ Digits: '7' })
        .expect(/call_again/)
        .expect(/heard_reference_code/)
    })
  })

  context('with 9 pressed', () => {
    let call, url
    beforeEach(async () => {
      call = await Call.query().insert({ status: 'answered' })
      url = `/ready?caller_id=4&campaign_id=${campaign.id}&call_id=${call.id}`
    })
    it('announce tech issue it noted', async () => {
      await request.post(url)
        .type('form').send({ Digits: '9' })
        .expect(/The technical issue has been reported/)
    })
    it('should redirect to call again', async () => {
      await request.post(url)
        .type('form').send({ Digits: '9' })
        .expect(/call_again/)
        .expect(/tech_issue_reported=1/)
    })
    it('should log an event', async () => {
      await request.post(url)
        .type('form').send({ Digits: '9' })
        .expect(200)
      expect(await Event.query().where({ name: 'technical_issue_reported', call_id: call.id, campaign_id: campaign.id, caller_id: 4 }).first()).to.be.a(Event)
    })
  })

  context('with 8 pressed', () => {
    let call, url
    beforeEach(async () => {
      call = await Call.query().insert({ status: 'answered' })
      await SurveyResult.query().delete()
      await SurveyResult.query().insert({ call_id: call.id, question: 'disposition', answer: 'answering machine' })
      url = `/ready?caller_id=4&campaign_id=${campaign.id}&call_id=${call.id}`
    })
    it('should delete the survey results', async () => {
      await request.post(url)
        .type('form').send({ Digits: '8' })
        .expect(200)
      expect((await SurveyResult.query()).length).to.be(0)
    })
    it('should redirect to survey results with disposition question', async () => {
      await request.post(url)
        .type('form').send({ Digits: '8' })
        .expect(new RegExp(`survey.*q=disposition.*caller_id=4.*campaign_id=${campaign.id}.*undo=1.*call_id=${call.id}`))
    })
    it('should log an event', async () => {
      await request.post(url)
        .type('form').send({ Digits: '8' })
        .expect(200)
      expect(await Event.query().where({ name: 'undo', call_id: call.id, campaign_id: campaign.id, caller_id: 4 }).first()).to.be.a(Event)
    })
  })

  context('with 4 pressed', () => {
    it('should give the caller information on the dialing tool', async () => {
      return request.post(`/ready?caller_number=${caller.phone_number}&start=1&campaign_id=${campaign.id}`)
        .type('form').send({ Digits: '4', CallUUID: '1333' })
        .expect(/system works/i)
        .expect(new RegExp(`briefing.*caller_number=${caller.phone_number}`))
    })
  })

  context('with more info key pressed', () => {
    it('should give the caller information on the campaign', async () => {
      const more_info_item_key = Object.keys(campaign.more_info)[0]
      const more_info_item_content = campaign.more_info[more_info_item_key]
      const regexp = new RegExp(more_info_item_content, "i")
      return request.post(`/ready?caller_number=${caller.phone_number}&start=1&campaign_id=${campaign.id}`)
        .type('form').send({ Digits: more_info_item_key, CallUUID: '1333' })
        .expect(regexp)
        .expect(new RegExp(`briefing.*caller_number=${caller.phone_number}`))
    })
  })

  context('with existing user and team', () => {
    let team
    beforeEach(async () => {
      await Callee.query().delete()
      await Campaign.query().delete()
      await User.query().delete()
      await Team.query().delete()
    })
    beforeEach(async () => campaign = await Campaign.query().insert(teamsCampaign))
    beforeEach(async () => team = await Team.query().insert({ name: 'planet savers', passcode: '1234' }))
    beforeEach(async () => await User.query().insert({ phone_number: '098765', team_id: team.id }))
    const payload = {
      CallUUID,
      From: '098765',
      caller_number: '098765'
    }
    it('should update caller creation params to include team id', async () => {
      await request.post(`/ready?campaign_id=${campaign.id}&start=1&caller_number=${caller.phone_number}`)
        .type('form')
        .send(payload)
      const new_caller = await Caller.query().where({
        phone_number: caller.phone_number, campaign_id: campaign.id
      }).first()
      expect(new_caller.team_id).to.be(team.id)
    })
    it('on callbacks, it should update caller creation params to include team id', async () => {
      payload.From = '333333'
      await request.post(`/ready?campaign_id=${campaign.id}&start=1&caller_number=${caller.phone_number}`)
        .type('form')
        .send(payload)
      const new_caller = await Caller.query().where({
        phone_number: caller.phone_number, campaign_id: campaign.id
      }).first()
      expect(new_caller.team_id).to.be(team.id)
    })
  })

  context('with force_callback set to true', () => {
    it('should set a boolean for a call back', async () => {
      await request.post(`/ready?caller_number=${caller.phone_number}&start=1&campaign_id=${campaign.id}&force_callback=1`)
        .type('form').send({ CallUUID: '1234' })
        .expect(/hang up now/i)
      const updatedCaller = await Caller.query().where({ call_uuid: '1234' }).first()
      return expect(updatedCaller.callback).to.be(true)
    })
  })

  context('with assessment key pressed', () => {
    it('should redirect the user to the survey assessment path', async () => {
      return request.post(`/ready?caller_number=${caller.phone_number}&start=1&campaign_id=${campaign.id}`)
        .type('form').send({ Digits: '*', CallUUID: '1333' })
        .expect(/Ok, we'll take you to assess the survey now/i)
        .expect(/survey_assessment\?q=disposition/)
    })
  })
})

describe('/transfer_to_target', () => {
  beforeEach(async () => campaign = await campaign.$query().patchAndFetch({ transfer_to_target: true, target_numbers: ['1234'] }))
  describe('with a callee that has a target number', () => {
    let call
    beforeEach(async () => {
      const callee = await Callee.query().insert(associatedTargetedCallee)
      const caller = await Caller.query().insert(associatedCaller)
      call = await Call.query().insert({ status: 'answered', caller_id: caller.id, callee_id: callee.id })
    })
    it('should dial the callee target number', async () => {
      await request.post(`/transfer_to_target?campaign_id=${campaign.id}&call_id=${call.id}`)
        .type('form').send({ CallUUID })
        .expect(/Number>098765<\/Number/)
    })
    it('should record an event', async () => {
      await request.post(`/transfer_to_target?campaign_id=${campaign.id}&call_id=${call.id}`)
        .type('form').send({ CallUUID })
        .expect(200)
      expect(await Event.query().where({ name: 'transfer_to_target' }).first()).to.be.a(Event)
    })
  })
  describe('with a callee that has no target number', () => {
    let call
    beforeEach(async () => {
      const callee = await Callee.query().insert(associatedCallee)
      const caller = await Caller.query().insert(associatedCaller)
      call = await Call.query().insert({ status: 'answered', caller_id: caller.id, callee_id: callee.id })
    })
    it('should dial the campaign target number', async () => {
      await request.post(`/transfer_to_target?campaign_id=${campaign.id}&call_id=${call.id}`)
        .type('form').send({ CallUUID })
        .expect(/Number>1234<\/Number/)
    })
    it('should record an event', async () => {
      await request.post(`/transfer_to_target?campaign_id=${campaign.id}&call_id=${call.id}`)
        .type('form').send({ CallUUID })
        .expect(200)
      expect(await Event.query().where({ name: 'transfer_to_target' }).first()).to.be.a(Event)
    })
  })
})

describe('/call_ended', () => {
  context('with no matching caller', () => {
    it('should record an event', async () => {
      await request.post(`/call_ended?campaign_id=${campaign.id}`)
        .type('form').send({ CallUUID })
        .expect(200)
      expect(await Event.query().where({ name: 'caller ended without entering queue' }).first()).to.be.a(Event)
    })
  })

  context('with callback not set to true', () => {
    beforeEach(async () =>
      await Caller.query().insert({ callback: null, call_uuid: CallUUID, campaign_id: campaign.id })
    )
    it('should not call them back', () => {
      return request.post(`/call_ended?campaign_id=${campaign.id}`)
        .type('form').send({ CallUUID })
    })
  })

  context('with callback set to true', () => {
    let caller
    beforeEach(async () => caller = await Caller.query().insert({ callback: true, call_uuid: CallUUID, campaign_id: campaign.id, phone_number: '1234' }))
    it('should call them back', async () => {
      const mockedApiCall = nock('https://api.plivo.com')
        .post(/Call/, body => {
          return body.to === caller.phone_number && body.from === campaign.phone_number
            && body.answer_url.match(/connect/)
            && body.answer_url.match(/callback=1/)
            && body.answer_url.match(/campaign_id=1/)
        })
        .query(true)
        .reply(200)
      return request.post(`/call_ended?campaign_id=${campaign.id}`)
        .type('form').send({ CallUUID })
        .then(() => mockedApiCall.done())
    })
  })

  context('with a caller with status "in-call"', () => {
    beforeEach(async () => caller = await Caller.query().insert({ status: 'in-call', call_uuid: CallUUID, campaign_id: campaign.id }))
    it('should unset the "in-call" status', async () => {
      await request.post(`/call_ended?campaign_id=${campaign.id}`)
        .type('form').send({ CallUUID })
      expect((await caller.$query()).status).to.be('complete')
    })

    it('should create a caller_complete event', async () => {
      await request.post(`/call_ended?campaign_id=${campaign.id}`)
        .type('form').send({ CallUUID })
      expect(await Event.query().where({ name: 'caller_complete' }).first()).to.be.a(Event)
    })
  })

  context('with a caller with status "available"', () => {
    beforeEach(async () => caller = await Caller.query().insert({ status: 'available', call_uuid: CallUUID, updated_at: moment().subtract(1, 'seconds').toDate(), seconds_waiting: 4, campaign_id: campaign.id }))
    it('should update their seconds_waiting', async () => {
      await request.post(`/call_ended?campaign_id=${campaign.id}`)
        .type('form').send({ CallUUID })
      caller = await caller.$query()
      expect(caller.seconds_waiting).to.be(5)
      expect(caller.status).to.be('complete')
    })
  })
})

describe('/resume_survey', () => {
  let call, caller
  beforeEach(async () => {
    const original_caller = await Caller.query().insert({ campaign_id: campaign.id })
    caller = await Caller.query().insert({ campaign_id: campaign.id })
    call = await Call.query().insert({ caller_id: original_caller.id })
  })

  context('with 1 pressed', () => {
    it('update the callee on the record', async () => {
      await request.post(`/resume_survey?last_call_id=${call.id}&caller_id=${caller.id}&campaign_id=${campaign.id}`)
        .type('form')
        .send({ Digits: '1' })
        .expect(200)
      const updated_call = await call.$query()
      expect(updated_call.caller_id).to.be(caller.id)
    })

    it('redirect to survey with undo set', async () => {
      await request.post(`/resume_survey?last_call_id=${call.id}&caller_id=${caller.id}&campaign_id=${campaign.id}`)
        .type('form')
        .send({ Digits: '1' })
        .expect(new RegExp(`survey.*call_id=${call.id}.*caller_id=${caller.id}.*campaign_id=${campaign.id}.*q=disposition.*undo=1`))
    })

    it('should record an event', async () => {
      await request.post(`/resume_survey?last_call_id=${call.id}&caller_id=${caller.id}&campaign_id=${campaign.id}`)
        .type('form')
        .send({ Digits: '1' })
        .expect(200)
      const event = await Event.query().where({ name: 'resume calling', campaign_id: campaign.id, call_id: call.id, caller_id: caller.id }).first()
      expect(event).to.be.an(Event)
    })
  })

  context('with 2 pressed', () => {
    it('should redirect back to call queue', async () => {
      await request.post(`/resume_survey?last_call_id=${call.id}&caller_id=${caller.id}&campaign_id=${campaign.id}`)
        .type('form')
        .send({ Digits: '2' })
        .expect(new RegExp(`ready.*caller_id=${caller.id}.*campaign_id=${campaign.id}`))
    })
  })
})

describe('/hold_music', () => {
  beforeEach(async () => {
    await Campaign.query().delete()
  })
  describe('without a specified hold music array against the campaign', () => {
    beforeEach(async () => campaign = await Campaign.query().insert(activeCampaign))
    it('should return a default list of mp3', () => {
      return request.post(`/hold_music?campaign_id=${campaign.id}`).expect(/cloudfront.*welcome-pack-2.mp3/i)
    })
  })
  describe('with a specified hold music array against the campaign', () => {
    beforeEach(async () => campaign = await Campaign.query().insert(holdMusicCampaign))
    it('should return a list of mp3', () => {
      return request.post(`/hold_music?campaign_id=${campaign.id}`).expect(/cloudfront.*stevie_wonder_classic.mp3/i)
    })
  })
})

describe('/conference_event/caller', () => {
  beforeEach(async () => {
    await Event.query().delete()
    await Call.query().delete()
    await Callee.query().delete()
    await Caller.query().delete()
    await Campaign.query().delete()
  })
  beforeEach(async () => {
    campaign = await Campaign.query().insert({ id: 1, name: 'test', status: 'active' })
    await Caller.query().insert(caller)
  })

  context('with caller entering the conference', () => {
    it('should update the caller to be available and recorder the conference_member_id', async () => {
      await request.post(`/conference_event/caller?caller_id=${caller.id}&campaign_id=${campaign.id}`)
        .type('form')
        .send({ ConferenceAction: 'enter', ConferenceFirstMember: 'true', ConferenceMemberID: '11' })
      let updatedCaller = await Caller.query().first()
      expect(updatedCaller.status).to.be('available')
      expect(updatedCaller.conference_member_id).to.be('11')
    })
  })

  context('with 3 pressed during the conference', () => {
    const CallUUID = '1'
    const ConferenceUUID = '2'

    it('should make a transfer api call', async () => {
      await Call.query().insert({ conference_uuid: ConferenceUUID })
      const mockedApiCall = nock('https://api.plivo.com')
        .post(/\/Call\/1\//, (body) => {
          return body.aleg_url.match(/survey_result/)
            && body.aleg_url.match(/digit=3/)
            && body.aleg_url.match(/incall=1/)
        })
        .query(true)
        .reply(200)
      await request.post(`/conference_event/caller?caller_id=${caller.id}`)
        .type('form')
        .send({ ConferenceAction: 'digits', ConferenceDigitsMatch: '3', CallUUID, ConferenceUUID })
        .expect(200)
      mockedApiCall.done()
    })
  })

  context('with 9 pressed during the conference', () => {
    const CallUUID = '1'
    const ConferenceUUID = '2'
    const callee_call_uuid = '3'

    it('should make a transfer api call', async () => {
      await Call.query().insert({ conference_uuid: ConferenceUUID, callee_call_uuid })
      const mockedApiCall = nock('https://api.plivo.com')
        .post(new RegExp(`/Call/${callee_call_uuid}/`), (body) => {
          return body.aleg_url.match(/transfer_to_target/)
            && body.aleg_url.match(new RegExp(`campaign_id=${campaign.id}`))
        })
        .query(true)
        .reply(200)
      await request.post(`/conference_event/caller?caller_id=${caller.id}&campaign_id=${campaign.id}`)
        .type('form')
        .send({ ConferenceAction: 'digits', ConferenceDigitsMatch: '9', CallUUID, ConferenceUUID })
        .expect(200)
      mockedApiCall.done()
    })
  })

  context('with caller leaving the conference and with a call that ended more than 30 seconds ago', () => {
    it('should record an event', async () => {
      const ConferenceUUID = '60996fca-70a7-11e9-a736-175f2f49f057'
      await Call.query().insert({ ended_at: moment(new Date()).subtract(40, 'seconds'), conference_uuid: ConferenceUUID, status: 'answered' })
      await request.post(`/conference_event/caller?caller_id=1234&campaign_id=${campaign.id}`)
        .type('form')
        .send({ ConferenceAction: 'exit', ConferenceUUID })
      const event = await Event.query().where({ campaign_id: campaign.id, name: 'conference_exit_error' }).first()
      expect(JSON.parse(event.value)['conference_uuid']).to.be(ConferenceUUID)
      expect(event.caller_id).to.be(1234)
    })
  })
})

describe('/survey', () => {
  const conference_uuid = '222'
  let call, callerInCall, campaign
  beforeEach(async () => {
    await Call.query().delete()
    await Campaign.query().delete()
    await SurveyResult.query().delete()
  })
  beforeEach(async () => {
    campaign = await Campaign.query().insert(activeCampaign)
    call = await Call.query().insert({ callee_call_uuid: CallUUID, conference_uuid, status: 'answered' })
    callerInCall = await Caller.query().insert(Object.assign(caller, { status: 'in-call', campaign_id: campaign.id }))
  })

  context('after the first question', () => {
    it('should return the question specified by the q param', () => {
      const question = 'action'
      return request.post(`/survey?q=${question}&call_id=${call.id}&campaign_id=${campaign.id}&caller_id=${callerInCall.id}`)
        .expect(new RegExp(`q=${question}`))
        .expect(new RegExp(`${question}`, 'i'))
    })

    it("should set the caller's status to in-survey", async () => {
      await request.post(`/survey?q=disposition&call_id=${call.id}&campaign_id=${campaign.id}&caller_id=${callerInCall.id}`)
      const updatedCaller = await caller.$query().first()
      expect(updatedCaller.status).to.be('in-survey')
    })
  })

  context('after undoing a question', () => {
    it('should return not mention that the call has ended', () => {
      return request.post(`/survey?q=disposition&call_id=${call.id}&campaign_id=${campaign.id}&undo=1&caller_id=${callerInCall.id}`)
        .expect(/7,8"><Speak language="en-GB" voice="MAN">What was the Overall/)
    })
  })

  context('with invalid xml characters', () => {
    let malformed_campaign
    beforeEach(async () => {
      await Caller.query().delete()
      await Campaign.query().delete()
    })
    beforeEach(async () => malformed_campaign = await Campaign.query().insert(malformedCampaign))
    it('should be spripped out to valid xml', async () => {
      const question = 'disposition'
      return request.post(`/survey?q=${question}&call_id=${call.id}&campaign_id=${malformed_campaign.id}&caller_id=${callerInCall.id}`)
        .expect(new RegExp('testing', 'i'))
    })
  })

  context('without a call record (* pressed while in the queue)', () => {
    beforeEach(async () => await Call.query().delete())
    it('prompts to re-enter the queue', () => {
      return request.post(`/survey?q=disposition&caller_id=1&campaign_id=${campaign.id}`)
        .expect(/have left the call queue/)
        .expect(/call_again\?caller_id=1/)
    })
    it('records an event', async () => {
      await request.post(`/survey?q=disposition&caller_id=1&campaign_id=${campaign.id}`)
        .type('form')
        .send({ CallUUID })
        .expect(200)
      const event = await Event.query().where({ campaign_id: campaign.id, name: 'left queue without call' }).first()
      expect(event.value).to.be(`{"CallUUID":"${CallUUID}"}`)
      expect(event.caller_id).to.be(1)
    })
  })

  context('without a call record (* pressed while in the queue)', () => {
    beforeEach(async () => await Call.query().delete())
    it('prompts to re-enter the queue', () => {
      return request.post(`/survey?q=disposition&caller_id=1&campaign_id=${campaign.id}`)
        .expect(/have left the call queue/)
        .expect(/call_again\?caller_id=1/)
    })
  })

  context('with a call that has status of machine_detection', () => {
    beforeEach(async () => call = await Call.query().patchAndFetchById(call.id, { status: 'machine_detection' }))
    it('re-enters the queue', () => {
      return request.post(`/survey?q=disposition&call_id=${call.id}&caller_id=1&campaign_id=${campaign.id}`)
        .expect(/Answering machine detected/)
        .expect(/ready\?caller_id=1/)
    })
  })

  context('after any question', () => {
    it('should wait and play a help message', async () => {
      const question = 'action'
      return request.post(`/survey?q=${question}&call_id=${call.id}&campaign_id=${campaign.id}&caller_id=${callerInCall.id}`)
        .expect(/<Wait length="5"\/><Speak language="en-GB" voice="MAN">.+<\/Speak>/)
    })
  })

  context('with no matching call based on conference uuid', () => {
    it('should wait and play a help message', async () => {
      const question = 'action'
      await Call.query().delete()
      await request.post(`/survey?q=${question}&call_id=${call.id}&campaign_id=${campaign.id}&caller_id=${callerInCall.id}`)
        .expect(/left the call queue/)
        .expect(200)
    })
  })
})

describe('/survey_result', () => {
  const payload = { Digits: '2', To: '614000100' }
  let call, callee
  beforeEach(async () => {
    callee = await Callee.query().insert({ phone_number: '6133242342', campaign_id: campaign.id })
    call = await Call.query().insert({ status: 'answered', updated_at: new Date(), callee_id: callee.id })
  })

  it('stores the result', () => {
    return request.post(`/survey_result?q=disposition&campaign_id=1&call_id=${call.id}`)
      .type('form').send(payload)
      .then(async () => {
        const result = await SurveyResult.query()
          .where({ question: 'disposition', call_id: call.id })
          .first()
        expect(result.answer).to.be('answering machine')
      })
  })

  it('updates the updated_at on the call', async () => {
    await request.post(`/survey_result?q=disposition&campaign_id=1&call_id=${call.id}`)
      .type('form').send(payload)
      .expect(200)
    const updated_call = await call.$query()
    expect(updated_call.updated_at).to.not.eql(call.updated_at)
  })

  context('with a non-meaningful disposition', () => {
    const payload = { Digits: '3', To: '614000100' }
    it('should announce the result & redirect to call_again', () => {
      return request.post(`/survey_result?q=disposition&campaign_id=1&call_id=${call.id}`)
        .type('form').send(payload)
        .expect(/call_again/)
    })
  })

  context('with a meaningful disposition', () => {
    const payload = { Digits: '4', To: '614000100' }
    it('should announce the result & redirect to the next question', () => {
      return request.post(`/survey_result?q=disposition&campaign_id=1&call_id=${call.id}`)
        .type('form').send(payload)
        .expect(/meaningful/)
        .expect(/survey\?q=/)
    })
  })

  context('with a disposition question', () => {
    const payload = { Digits: '4', To: '614000100' }
    it('should call calee.trigger_callable_recalculation', async () => {
      await request.post(`/survey_result?q=disposition&campaign_id=1&call_id=${call.id}`)
        .type('form').send(payload)
      const updated_callee = await callee.$query()
      expect(updated_callee.callable_recalculated_at).to.not.be(null)
    })
  })

  context('with invalid xml characters', () => {
    beforeEach(async () => {
      campaign = await Campaign.query().insert(malformedCampaign)
    })
    const payload = { Digits: '2', To: '614000100' }
    it('should be spripped out to valid xml', async () => {
      return request.post(`/survey_result?q=disposition&campaign_id=${campaign.id}&call_id=${call.id}`)
        .type('form').send(payload)
        .expect(new RegExp('answering &amp; machine', 'i'))
    })
  })

  context('with a callee that wants more info', () => {
    const payload = { Digits: '2', To: '614000100' }
    let callee, call
    beforeEach(async () => {
      callee = await Callee.query().insert(associatedCallee)
      call = await Call.query().insert({ callee_id: callee.id })
    })
    it('should receive an sms', () => {
      return request.post(`/survey_result?q=action&campaign_id=1&call_id=${call.id}`)
        .type('form').send(payload)
        .expect(/call/i)
    })
    it('should receive an sms from the number set on the campaign', () => {
      return request.post(`/survey_result?q=action&campaign_id=1&call_id=${call.id}`)
        .type('form').send(payload)
        .expect(new RegExp(campaign.sms_number))
    })
    it("should send the sms to the callee's number", () => {
      return request.post(`/survey_result?q=action&campaign_id=1&call_id=${call.id}`)
        .type('form').send(payload)
        .expect(new RegExp(callee.phone_number.replace(/[^0-9]/g, '')))
    })
  })

  context('with an incall disposition', () => {
    const payload = { Digits: '2', To: '614000100' }
    let callee, call
    beforeEach(async () => {
      callee = await Callee.query().insert(associatedCallee)
      call = await Call.query().insert({ callee_id: callee.id })
    })

    it('should put them back into the calling queue', () => {
      return request.post(`/survey_result?q=disposition&campaign_id=1&call_id=${call.id}&incall=1`)
        .type('form').send(payload)
        .expect(/ready/i)
    })
  })

  context('with a question with multiple responses', () => {
    let callee, call
    const payload = { Digits: '2', To: '614000100' }
    const skip_payload = { Digits: '*', To: '614000100' }
    beforeEach(async () => {
      await SurveyResult.query().delete()
      await Call.query().delete()
      await Callee.query().delete()
      await Campaign.query().delete()
      campaign = await Campaign.query().insert(multipleCampaign)
      callee = await Callee.query().insert(associatedCallee)
      call = await Call.query().insert({ callee_id: callee.id })
    })
    context('with a valid question digit', () => {
      context('with no current responses', () => {
        it('should announce the result & redirect to multiple survey', () => {
          return request.post(`/survey_result?q=event_rsvp&campaign_id=1&call_id=${call.id}&multiple=1`)
            .type('form').send(payload)
            .expect(/September/)
            .expect(/survey_multiple\?q=/)
        })
      })
      context('with responses less than number of options', () => {
        beforeEach(async () => {
          await SurveyResult.query().insert({ call_id: call.id, question: 'event_rsvp', answer: 'September 19' })
        })
        it('should announce the result & redirect to multiple survey', () => {
          return request.post(`/survey_result?q=event_rsvp&campaign_id=1&call_id=${call.id}&multiple=1`)
            .type('form').send(payload)
            .expect(/September/)
            .expect(/survey_multiple\?q=/)
        })
      })
      context('with responses as many number of options', () => {
        beforeEach(async () => {
          await SurveyResult.query().insert({ call_id: call.id, question: 'event_rsvp', answer: 'September 19' })
          await SurveyResult.query().insert({ call_id: call.id, question: 'event_rsvp', answer: 'September 22' })
        })
        it('should announce the result & redirect to next question', () => {
          return request.post(`/survey_result?q=event_rsvp&campaign_id=1&call_id=${call.id}&multiple=1`)
            .type('form').send(payload)
            .expect(/lift_needed/)
        })
      })
    })
    context('with the skip current question response given', () => {
      context('on a question with a next present', () => {
        it('should announce the result & redirect to survey', () => {
          return request.post(`/survey_result?q=event_rsvp&campaign_id=1&call_id=${call.id}&multiple=1`)
            .type('form').send(skip_payload)
            .expect(/survey\?q=/)
        })
      })
      context('on a question with no next present', () => {
        beforeEach(async () => {
          await SurveyResult.query().insert({ call_id: call.id, question: 'event_rsvp', answer: 'September 19' })
        })
        it('should announce the result & redirect to call_again', () => {
          return request.post(`/survey_result?q=calling&campaign_id=1&call_id=${call.id}&multiple=1`)
            .type('form').send(skip_payload)
            .expect(/call_again\?/)
        })
      })
    })
  })
})

describe('/survey_multiple', () => {
  context('with a question with multiple responses', () => {
    const payload = { To: '614000100' }
    let callee, call
    beforeEach(async () => {
      await SurveyResult.query().delete()
      await Call.query().delete()
      await Callee.query().delete()
      await Campaign.query().delete()
      campaign = await Campaign.query().insert(multipleCampaign)
      callee = await Callee.query().insert(associatedCallee)
      call = await Call.query().insert({ callee_id: callee.id })
    })
    context('with a valid question digit', () => {
      context('with no current responses', () => {
        it('should ask if there are any other survey results', () => {
          return request.post(`/survey_multiple?q=event_rsvp&campaign_id=1&call_id=${call.id}`)
            .type('form').send(payload)
            .expect(/2,3,4/)
            .expect(/any other responses/)
        })
      })
    })
    context('with the skip current question response given', () => {
      context('with no current responses', () => {
        beforeEach(async () => {
          await SurveyResult.query().insert({ call_id: call.id, question: 'event_rsvp', answer: 'September 19' })
        })
        it('should ask if there are any other survey results', () => {
          return request.post(`/survey_multiple?q=event_rsvp&campaign_id=1&call_id=${call.id}`)
            .type('form').send(payload)
            .expect(/2,4,*/)
            .expect(/any other responses/)
        })
      })
    })
  })
})

describe('/fallback', () => {
  it('stores a caller fallback event', async () => {
    await request.post('/fallback?campaign_id=1')
      .type('form').send({ CallUUID })
      .expect(/call back/)
    const event = await Event.query().where({ campaign_id: 1, name: 'caller fallback' }).first()
    expect(event.value).to.be(`{"CallUUID":"${CallUUID}"}`)
  })
})

describe('/call_again', () => {
  context('with an operational window campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(operationalWindowCampaign))
    beforeEach(async () => { await Callee.query().insert(associatedCallee) })
    const payload = { From: caller.phone_number }
    it('plays the operational window briefing message', () => {
      return request.post(`/call_again?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
        .expect(/finished for the day/)
    })
  })
  context('with a paused campaign', async () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(pausedCampaign))
    const payload = { Digits: '2' }
    it('should announce the result, notify user that campaign is currently paused', () => {
      return request.post(`/call_again?campaign_id=${campaign.id}`)
        .type('form').send(payload)
        .expect(/currently paused/)
    })
  })
  context('with a statusless campaign', async () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(statuslessCampaign))
    it('should announce the result, notify user that campaign is currently paused', () => {
      return request.post(`/call_again?campaign_id=${campaign.id}`)
        .type('form').send()
        .expect(/currently paused/)
    })
  })

  context('with an inactive campaign', async () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(inactiveCampaign))
    it('should announce the result, notify user that campaign is currently completed', () => {
      return request.post(`/call_again?campaign_id=${campaign.id}`)
        .type('form').send()
        .expect(/has been completed/)
    })
  })

  context('with no call_id passed', async () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(activeCampaign))

    it('should let the user press 9 to report an issue', () => {
      return request.post(`/call_again?caller_id=1&campaign_id=${campaign.id}`)
        .type('form').send()
        .expect(/9/)
        .expect(/campaign_id=\d+"/)
        .expect(/or 9 to report a technical issue/i)
    })
  })

  context('with a call_id passed', async () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(activeCampaign))

    it('should let the user press 8 to correct', () => {
      return request.post(`/call_again?campaign_id=${campaign.id}&call_id=1`)
        .type('form').send()
        .expect(/8/)
        .expect(/call_id=1/)
        .expect(/Press, 8 to correct your entry/i)
    })

    context('with a campaign with use_reference_codes enabled', async () => {
      beforeEach(async () => await campaign.$query().patch({ use_reference_codes: true }))

      it('should let the user press 7 to hear a reference code', () => {
        return request.post(`/call_again?campaign_id=${campaign.id}&call_id=1`)
          .type('form').send()
          .expect(/7/)
          .expect(/call_id=1/)
          .expect(/press 7 to hear a reference code/i)
      })

      it('should use the work repeat if they reference code was listened to', () => {
        return request.post(`/call_again?campaign_id=${campaign.id}&call_id=1&heard_reference_code=1`)
          .type('form').send()
          .expect(/7/)
          .expect(/call_id=1/)
          .expect(/press 7 to repeat the reference code/i)
      })
    })
  })

  context('with a completed campaign with a next campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(inactiveNextCampaign))
    beforeEach(async () => await Campaign.query().insert(nextCampaign))
    const nextAssociatedCallee = Object.assign({}, associatedCallee, { campaign_id: 2 })
    beforeEach(async () => { await Callee.query().insert(nextAssociatedCallee) })
    const payload = { From: caller.phone_number }

    it('plays the next campaign name and number and hangs up', () => {
      return request.post(`/call_again?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
        .expect(/completed/)
        .expect(/0, 2, 9, 1, 2, 3, 4, 5, 6, 7/)
        .expect(new RegExp(nextCampaign.name))
        .expect(/hangup/)
    })
  })
})

describe('/machine_detection', () => {
  const callee_call_uuid = '111'
  const conference_uuid = '222'
  const payload = { CallUUID: callee_call_uuid }
  let call, campaign

  beforeEach(async () => {
    await Campaign.query().delete()
    await Call.query().delete()
    await Caller.query().delete()
    campaign = await Campaign.query().insert(amdCampaign)
    call = await Call.query().insert({ callee_call_uuid, conference_uuid })
  })

  context('with an existing call', () => {
    it('hangs up on the callee', async () => {
      const mockedApiCall = nock('https://api.plivo.com')
        .delete(/\/Call\/111\//)
        .reply(200)
      await request.post(`/machine_detection?campaign_id=${campaign.id}`)
        .type('form').send(payload)
        .expect(200)
      mockedApiCall.done()
    })

    it('patches call status to machine_detection', async () => {
      nock('https://api.plivo.com')
        .delete(/\/Call\/111\//)
        .reply(200)
      await request.post(`/machine_detection?campaign_id=${campaign.id}`)
        .type('form').send(payload)
        .expect(200)
      const updatedCall = await Call.query().where({ id: call.id }).first()
      expect(updatedCall.status).to.be('machine_detection')
    })
  })

  context('without an existing call', () => {
    it('create error event', async () => {
      await request.post(`/machine_detection?campaign_id=${campaign.id}`)
        .type('form').send()
      const event = await Event.query().where({ name: 'failed_post_machine_callee_transfer', campaign_id: campaign.id }).first()
      expect(event).to.be.an(Event)
    })
  })
})

describe('/connect_sms', () => {
  beforeEach(async () => {
    await Campaign.query().delete()
    campaign = await Campaign.query().insert(activeCampaign)
  })
  context('with shortcode attributed to no campaign', () => {
    const payload = { From: caller.phone_number, To: '61481565877', Text: 'blerg' }
    it('plays the briefing message', () => {
      return request.post('/connect_sms')
        .type('form')
        .send(payload)
        .expect(new RegExp("Sorry we cannot find the campaign"))
    })
  })
  context('with a paused campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(pausedCampaign))
    const payload = { From: caller.phone_number, To: '61481565877', Text: 'test' }
    it('plays the paused briefing message ', () => {
      return request.post('/connect_sms')
        .type('form')
        .send(payload)
        .expect(/currently paused/)
    })
  })

  context('with a statusless campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(statuslessCampaign))
    const payload = { From: caller.phone_number, To: '61481565877', Text: 'test' }
    it('plays the paused briefing message ', () => {
      return request.post('/connect_sms')
        .type('form')
        .send(payload)
        .expect(/currently paused/)
    })
  })

  context('with a inactive campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(inactiveCampaign))
    const payload = { From: caller.phone_number, To: '61481565877', Text: 'test' }
    it('plays the outside operational window briefing message', () => {
      return request.post(`/connect_sms`)
        .type('form')
        .send(payload)
        .expect(/has been completed/)
    })
  })

  context('with an operational window campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(operationalWindowCampaign))
    beforeEach(async () => { await Callee.query().insert(associatedCallee) })
    beforeEach(async () => campaign.recalculateCallersRemaining())
    const payload = { From: caller.phone_number, To: '61481565877', Text: 'test' }
    it('plays the operational window briefing message', () => {
      return request.post(`/connect_sms`)
        .type('form')
        .send(payload)
        .expect(/hours of operation/)
    })
  })

  context('with an active campaign and a valid shortcode', () => {
    beforeEach(async () => { await Campaign.query().delete() })
    beforeEach(async () => campaign = await Campaign.query().insert(activeCampaign))
    beforeEach(async () => { await Callee.query().insert(associatedCallee) })
    beforeEach(async () => campaign.recalculateCallersRemaining())
    const payload = { From: caller.phone_number, To: '61481565877', Text: 'test' }
    it('does respond with empty xml response', () => {
      return request.post(`/connect_sms`)
        .type('form')
        .send(payload)
        .expect(/<Response\/>/)
    })
    it('creates an event', async () => {
      await request.post(`/connect_sms`)
        .type('form')
        .send(payload)
        .expect(200)
      const event = await Event.query().where({ name: 'sms_connect', campaign_id: campaign.id }).first()
      expect(event).to.be.an(Event)
    })

    it('successfully queries the call plivo api endpoint', async () => {
      const mockedApiCall = nock('https://api.plivo.com')
        .post(/Call/, body => {
          return body.to === '61288888888'
            && body.from === campaign.phone_number
            && body.answer_url.match(/connect/)
            && body.answer_url.match(/sms_callback=1/)
            && body.answer_url.match(/campaign_id=1/)
        })
        .query(true)
        .reply(200)
      await request.post(`/connect_sms`)
        .type('form')
        .send(payload)
        .expect(200)
      mockedApiCall.done()
    })
  })
})

describe('/survey_assessment', () => {
  const conference_uuid = '222'
  let call
  beforeEach(async () => {
    await Call.query().delete()
    await Campaign.query().delete()
    await SurveyResult.query().delete()
  })
  beforeEach(async () => call = await Call.query().insert({ callee_call_uuid: CallUUID, conference_uuid, status: 'answered' }))

  context('after the first question', () => {
    beforeEach(async () => campaign = await Campaign.query().insert(activeCampaign))
    it('should return the question specified by the q param', () => {
      const question = 'action'
      return request.post(`/survey_assessment?q=${question}&call_id=${call.id}&campaign_id=${campaign.id}`)
        .expect(new RegExp(`q=${question}`))
        .expect(new RegExp(`${question}`, 'i'))
    })
  })
})

describe('/survey_result_assessment', () => {
  const payload = { Digits: '2', To: '614000100' }
  let call, caller
  beforeEach(async () => {
    await dropFixtures()
    const campaign = await Campaign.query().insert(defaultCampaign)
    caller = await Caller.query().insert({ phone_number: '1234', campaign_id: campaign.id })
    const callee = await Callee.query().insert(associatedCallee)
    call = await Call.query().insert({ status: 'answered', updated_at: new Date(), callee_id: callee.id, caller_id: caller.id })
  })

  it('does not store the result', async () => {
    await request.post(`/survey_result_assessment?q=disposition&campaign_id=1&call_id=${call.id}&caller_id=${caller.id}`)
      .type('form').send(payload)
      .expect(200)
    const result = await SurveyResult.query()
      .where({ question: 'disposition', call_id: call.id }).first()
    expect(result).to.not.exist
  })

  context('with a meaningful disposition', () => {
    const payload = { Digits: '4', To: '614000100' }
    it('should announce the result & redirect to the next question assessment', () => {
      return request.post(`/survey_result_assessment?q=disposition&campaign_id=1&call_id=${call.id}&caller_id=${caller.id}`)
        .type('form').send(payload)
        .expect(/meaningful/)
        .expect(/survey_assessment\?q=/)
    })
  })

  context('with a response to the last question', () => {
    const payload = { Digits: '2', To: '614000100' }
    it('should redirect user back to briefing', () => {
      return request.post(`/survey_result_assessment?q=action&campaign_id=1&call_id=${call.id}&caller_id=${caller.id}`)
        .type('form').send(payload)
        .expect(/will call member of parliament/)
        .expect(/briefing\?campaign_id=\d+/)
    })
  })
})

describe('/survey_multiple_assessment', () => {
  context('with a question with multiple responses', () => {
    const payload = { Digits: '2', To: '614000100' }
    let callee, call, caller
    beforeEach(async () => {
      await SurveyResult.query().delete()
      await Call.query().delete()
      await Callee.query().delete()
      await Campaign.query().delete()
      campaign = await Campaign.query().insert(multipleCampaign)
      callee = await Callee.query().insert(associatedCallee)
      call = await Call.query().insert({ callee_id: callee.id })
      caller = await Caller.query().insert(associatedCaller)
    })
    context('with no current responses', () => {
      it('should ask if there are any other survey results', () => {
        return request.post(`/survey_multiple_assessment?q=event_rsvp&campaign_id=1&call_id=${call.id}&caller_id=${caller.id}`)
          .type('form').send(payload)
          .expect(/any other responses/)
      })
    })
  })
})
