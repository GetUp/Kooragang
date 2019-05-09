const app = require('express')();
const plivo = require('plivo');
const _ = require('lodash');
const { plivo_api } = require('../api/plivo');
const {
  sleep,
  extractCallerNumber,
  extractDialInNumber,
  sipHeaderPresent,
  authenticationNeeded,
  isValidCallerNumber,
  incomingCaller,
  sayPhoneNumber,
  sipFormatNumber,
} = require('../utils');
const { Call, Callee, Caller, Campaign, SurveyResult, Event, User, Team } = require('../models');
const { languageBlock } = require('../utils')

app.post('/connect', async ({ body, query }, res) => {
  if (body.CallStatus === 'completed') return res.sendStatus(200);
  const r = plivo.Response();
  const campaign = query.campaign_id && await Campaign.query().where({ id: query.campaign_id }).first();

  if (process.env.RECORD_CALLS === 'true') {
    r.addRecord({
      action: res.locals.appUrl('log'),
      maxLength: 60 * 60,
      recordSession: true,
      redirect: false
    });
  }

  if (!campaign) {
    r.addWait({ length: 2 });
    r.addSpeakI18n('error_unassociated_number');
    r.addWait({ length: 1 });
    r.addSpeakI18n('tech_staff_notified', { org_name: process.env.ORG_NAME || '' });
    return res.send(r.toXML());
  }

  const assessment = query.assessment ? query.assessment === "1" : false;
  const callback = query.callback ? query.callback === "1" : false;
  const authenticated = query.authenticated ? query.authenticated === "1" : false;
  const promptAuth = authenticationNeeded(callback, campaign.passcode, authenticated);

  if (campaign.isDown()) {
    r.addWait({ length: 2 })
    r.addSpeakI18n('welcome', { org_name: process.env.ORG_NAME || '' });
    r.addWait({ length: 1 })
    r.addSpeakI18n('error_tech_issues')
    return res.send(r.toXML())
  }

  if (!assessment && !campaign.isWithinDailyTimeOfOperation()) {
    r.addWait({ length: 2 });
    r.addSpeakI18n('welcome', { org_name: process.env.ORG_NAME || '' });
    r.addWait({ length: 1 });
    r.addSpeakI18n('campaign_outside_operating_hours', { campaign_name: campaign.name, campaign_daily_time_of_operation: campaign.dailyTimeOfOperationInWords() });
    return res.send(r.toXML());
  }

  const caller_number = extractCallerNumber(query, body);
  if (!isValidCallerNumber(caller_number)) {
    r.addWait({ length: 2 });
    r.addSpeakI18n('error_caller_id')
    return res.send(r.toXML());
  }

  const campaign_is_complete = await campaign.isComplete();
  if (!assessment && (campaign.isPaused() || campaign_is_complete) && campaign.next_campaign_id) {
    const next_campaign = await Campaign.query().where({ id: campaign.next_campaign_id }).first()
    if (next_campaign && (await next_campaign.isOperational())) {
      r.addWait({ length: 2 })
      r.addSpeakI18n('welcome', { org_name: process.env.ORG_NAME || '' });
      r.addWait({ length: 1 });
      const next_campaign_number = sayPhoneNumber(next_campaign.phone_number)
      const message = campaign_is_complete ? 'campaign_status_completed_with_next' : 'campaign_status_paused_with_next'
      _.times(4, () => {
        r.addSpeakI18n(message, { campaign_name: campaign.name, next_campaign_name: next_campaign.name, next_campaign_number });
        r.addWait({ length: 5 });
      })
      const smsVars = {
        next_campaign_name: next_campaign.name,
        next_campaign_number: next_campaign.phone_number.replace(/^61/, '0'),
      }
      const sms = languageBlock('campaign_completed_with_next_sms', smsVars)
      r.addMessage(sms, {
        src: process.env.NUMBER || '1111111111',
        dst: caller_number,
      })
      r.addHangup()
      return res.send(r.toXML());
    }
  }

  if (!assessment && campaign.isPaused()) {
    r.addWait({ length: 2 });
    r.addSpeakI18n('welcome', { org_name: process.env.ORG_NAME || '' });
    r.addWait({ length: 1 });
    r.addSpeakI18n('campaign_status_paused', { campaign_name: campaign.name });
    return res.send(r.toXML());
  }

  if (!assessment && await campaign.isComplete()) {
    r.addWait({ length: 2 });
    r.addSpeakI18n('welcome', { org_name: process.env.ORG_NAME || '' });
    r.addWait({ length: 1 });
    r.addSpeakI18n('campaign_status_completed', { campaign_name: campaign.name });
    return res.send(r.toXML());
  }

  //check number channel limit
  const dial_in_number = extractDialInNumber(body);
  const sip_header_present = sipHeaderPresent(body);
  const reached_dial_in_number_channel_limit = await campaign.reached_dial_in_number_channel_limit(dial_in_number, sip_header_present)
  if (body.Direction == 'inbound' && (campaign.revert_to_redundancy || reached_dial_in_number_channel_limit)) {
    r.addWait({ length: 2 })
    r.addSpeakI18n('welcome', { org_name: process.env.ORG_NAME || '' });
    r.addWait({ length: 1 })
    r.addSpeakI18n('hundreds_calling');
    r.addWait({ length: 1 })
    if (process.env.DISABLE_REDUNDANCY) {
      r.addSpeakI18n('lines_full');
      r.addHangup()
    } else {
      r.addSpeakI18n('lines_full_calling_back');
      r.addRedirect(res.locals.appUrl(`ready?campaign_id=${campaign.id}&caller_number=${caller_number}&start=1&force_callback=1`))
    }
    await Event.query().insert({
      name: 'reached_channel_limit', campaign_id: campaign.id, value: {
        log_id: query.log_id, caller_number, reached_dial_in_number_channel_limit,
        disable_redundancy: process.env.DISABLE_REDUNDANCY, sip_header_present, dial_in_number,
        revert_to_redundancy: campaign.revert_to_redundancy
      }
    })
    return res.send(r.toXML())
  }

  if (promptAuth) {
    r.addWait({ length: 2 });
    const passcodeAction = r.addGetDigits({
      action: res.locals.appUrl(`passcode?campaign_id=${query.campaign_id}`),
      timeout: 10,
      retries: 10,
      numDigits: campaign.passcode.length
    });
    passcodeAction.addSpeakI18n('campaign_passcode_entry')
    r.addRedirect(res.locals.appUrl('passcode'));
    return res.send(r.toXML());
  }

  if (campaign.teams && !query.team && !query.callback) {
    r.addWait({ length: 2 })
    const user = await User.query().where({ phone_number: body.From }).first()
    let valid_team_digits = ['2', '*']
    if (user && user.team_id) { valid_team_digits.push('1') }
    const teamAction = r.addGetDigits({
      action: res.locals.appUrl(`team?campaign_id=${query.campaign_id}&callback=${query.callback ? query.callback : 0}&authenticated=${query.authenticated ? '1' : '0'}&assessment=${query.assessment ? '1' : '0'}&number=${caller_number}`),
      timeout: 10,
      retries: 10,
      numDigits: 1,
      validDigits: valid_team_digits
    })
    if (user && user.team_id) {
      const team = await Team.query().where({ id: user.team_id }).first()
      teamAction.addSpeakI18n('campaign_team_resume_membership', { team_name: team.name });
      teamAction.addWait({ length: 1 })
      teamAction.addSpeakI18n('campaign_team_join_other');
    } else {
      teamAction.addSpeakI18n('campaign_team_join')
    }
    teamAction.addSpeakI18n('campaign_team_no_join')
    r.addSpeakI18n('error_no_key_pressed')
    return res.send(r.toXML())
  }

  r.addRedirect(res.locals.appUrl(`briefing?campaign_id=${campaign.id}&caller_number=${caller_number}&start=1&callback=${query.callback ? query.callback : 0}&authenticated=${query.authenticated ? '1' : '0'}&assessment=${query.assessment ? '1' : '0'}`));
  res.send(r.toXML())
});

app.post('/connect_sms', async ({ body, query }, res) => {
  const r = plivo.Response()
  const shortcode = _.lowerCase(_.trim(body.Text))
  const campaign = shortcode && await Campaign.query().where({ shortcode: shortcode }).first()
  if (!campaign) {
    const content = languageBlock('error_sms_connect_message_not_found')
    r.addMessage(`${content}`, {
      src: body.To,
      dst: body.From
    })
    return res.send(r.toXML())
  }

  if (campaign.isPaused()) {
    let content = languageBlock('error_sms_connect_message_not_found')
    content += languageBlock('campaign_status_paused', { campaign_name: campaign.name })
    r.addMessage(`${content}`, {
      src: body.To,
      dst: body.From
    })
    return res.send(r.toXML())
  }

  if (campaign.isDown()) {
    let content = languageBlock('welcome', { org_name: process.env.ORG_NAME || '' })
    content += languageBlock('error_tech_issues')
    r.addMessage(`${content}`, {
      src: body.To,
      dst: body.From
    })
    return res.send(r.toXML())
  }

  if (!campaign.isWithinDailyTimeOfOperation()) {
    let content = languageBlock('welcome', { org_name: process.env.ORG_NAME || '' })
    content += languageBlock('campaign_outside_operating_hours', { campaign_name: campaign.name, campaign_daily_time_of_operation: campaign.dailyTimeOfOperationInWords() })
    r.addMessage(`${content}`, {
      src: body.To,
      dst: body.From
    })
    return res.send(r.toXML())
  }

  if (await campaign.isComplete()) {
    let content = languageBlock('welcome', { org_name: process.env.ORG_NAME || '' })
    content += languageBlock('campaign_status_completed', { campaign_name: campaign.name })
    r.addMessage(`${content}`, {
      src: body.To,
      dst: body.From
    })
    return res.send(r.toXML())
  }

  const caller_number = extractCallerNumber(query, body);
  const params = {
    to: sipFormatNumber(caller_number),
    from: campaign.phone_number || process.env.NUMBER || '1111111111',
    answer_url: res.locals.appUrl(`connect?campaign_id=${campaign.id}&sms_callback=1&number=${caller_number}`),
    hangup_url: res.locals.appUrl(`call_ended?campaign_id=${campaign.id}&sms_callback=1&number=${caller_number}`),
    ring_timeout: process.env.RING_TIMEOUT || 30
  };
  if (process.env.SIP_HEADERS && params.to.match(/^sip:/)) params.sip_headers = process.env.SIP_HEADERS

  if (process.env.NODE_ENV === 'development') console.error('CALLING', params)
  try {
    await Event.query().insert({ campaign_id: campaign.id, name: 'sms_connect', value: { caller_number: caller_number } })
    await plivo_api('make_call', params)
  } catch (e) {
    await Event.query().insert({ campaign_id: campaign.id, name: 'api_error', value: { error: e } })
  }
  return res.send(r.toXML())
})

app.post('/briefing', async ({ query }, res) => {
  const r = plivo.Response();
  const campaign = await Campaign.query().where({ id: (query.campaign_id || "") }).first();
  let valid_briefing_digits = ['1', '2', '3', '4'];
  const assessment = query.assessment ? query.assessment === "1" : false;

  if (Object.keys(campaign.more_info).length > 0) {
    let more_info_digits = Object.keys(campaign.more_info);
    valid_briefing_digits = valid_briefing_digits.concat(more_info_digits);
  }
  if (assessment) {
    valid_briefing_digits = valid_briefing_digits.concat('*');
  }

  const briefing = r.addGetDigits({
    action: res.locals.appUrl(`ready?campaign_id=${campaign.id}&caller_number=${query.caller_number}&start=1&authenticated=${query.authenticated ? '1' : '0'}&assessment=${query.assessment ? '1' : '0'}`),
    method: 'POST',
    timeout: 5,
    numDigits: 1,
    retries: 10,
    validDigits: valid_briefing_digits
  });

  briefing.addWait({ length: 2 });
  if (query.entry !== 'more_info') {
    if (query.callback === '1') {
      briefing.addSpeakI18n('welcome_back');
    } else {
      briefing.addSpeakI18n('welcome', { org_name: process.env.ORG_NAME || '' });
      briefing.addSpeakI18n('calling_for', { campaign_name: campaign.name });
      briefing.addWait({ length: 1 });
      briefing.addSpeakI18n('recieve_callback');
    }
  }
  briefing.addWait({ length: 1 });
  briefing.addSpeakI18n('sheets');
  briefing.addWait({ length: 1 });
  briefing.addSpeakI18n('recieve_sheets');
  briefing.addWait({ length: 1 });

  if (query.entry_key != "4") {
    briefing.addSpeakI18n('tool_information');
    briefing.addWait({ length: 1 });
  }

  for (let key in campaign.more_info) {
    if (query.entry_key != key) {
      let info_item = campaign.more_info[key];
      briefing.addSpeakI18n('more_information', { info_item_title: info_item.title, key });
      briefing.addWait({ length: 1 });
    }
  }

  if (assessment) {
    briefing.addSpeakI18n('campaign_assessment_intro');
  }

  briefing.addSpeakI18n('get_started');
  briefing.addWait({ length: 8 });
  briefing.addSpeakI18n('message_repeat');
  res.send(r.toXML());
});

app.post('/ready', async ({ body, query }, res) => {
  const r = plivo.Response();
  const campaign = await Campaign.query().where({ id: query.campaign_id }).first();
  let caller_id, caller, caller_params
  const assessment = query.assessment ? query.assessment === "1" : false

  if (query.start) {
    if (body.Digits === '3') {
      let content = languageBlock('script_message', { campaign_script_url: _.escape(campaign.script_url) })
      r.addMessage(content, {
        src: process.env.NUMBER || '1111111111', dst: query.caller_number
      });
      r.addSpeakI18n('sms_instruction');
      return res.send(r.toXML());
    }

    caller = await Caller.query().where({ call_uuid: body.CallUUID }).first()
    if (!caller) {
      caller_params = {
        phone_number: query.caller_number,
        inbound_phone_number: extractDialInNumber(body),
        inbound_sip: sipHeaderPresent(body),
        call_uuid: body.CallUUID,
        campaign_id: query.campaign_id,
        created_from_incoming: incomingCaller(body)
      }
      if (body.caller_number) {
        const user = await User.query().where({ phone_number: body.caller_number }).first();
        if (user && user.team_id) {
          caller_params.team_id = user.team_id
        }
      }
      caller = await Caller.query().insert(caller_params);
    }
    caller_id = caller.id;
  } else {
    caller_id = query.caller_id;
  }

  if (!assessment && await campaign.isComplete()) {
    r.addSpeakI18n('campaign_status_completed_short');
    r.addRedirect(res.locals.appUrl('disconnect?completed=1'));
    return res.send(r.toXML());
  }

  if (body.Digits === '8' && query.call_id) {
    await Event.query().insert({ name: 'undo', campaign_id: campaign.id, caller_id, call_id: query.call_id, value: { log_id: query.log_id } })
    await SurveyResult.query().where({ call_id: query.call_id }).delete();
    r.addRedirect(res.locals.appUrl(`survey?q=disposition&caller_id=${caller_id}&campaign_id=${campaign.id}&undo=1&call_id=${query.call_id}`))
    return res.send(r.toXML());
  } else if (body.Digits === '7' && query.call_id) {
    const reference_code = query.call_id.toString().split('').join(' ')
    r.addSpeakI18n('call_reference_code', { reference_code });
    r.addRedirect(res.locals.appUrl(`call_again?caller_id=${caller_id}&campaign_id=${query.campaign_id}&call_id=${query.call_id}&heard_reference_code=1`));
    return res.send(r.toXML());
  } else if (body.Digits === '9' && query.call_id) {
    await Event.query().insert({ name: 'technical_issue_reported', campaign_id: campaign.id, caller_id, call_id: query.call_id, value: { query: query, body: body } })
    r.addSpeakI18n('tech_issue_reported');
    r.addRedirect(res.locals.appUrl(`call_again?caller_id=${caller_id}&campaign_id=${query.campaign_id}&tech_issue_reported=1&call_id=${query.call_id}`));
    return res.send(r.toXML());
  } else if (body.Digits === '0') {
    r.addRedirect(res.locals.appUrl('disconnect'));
    return res.send(r.toXML());
  } else if (body.Digits === '2' || query.force_callback) {
    await Caller.query().where({ id: caller_id }).patch({ callback: true });
    r.addSpeakI18n('immediate_callback');
    return res.send(r.toXML());
  } else if (body.Digits === '4') {
    r.addSpeakI18n('dialer_tool_explainer', { org_name: process.env.ORG_NAME || '' });
    r.addRedirect(res.locals.appUrl(`briefing?campaign_id=${campaign.id}&caller_number=${query.caller_number}&entry=more_info&entry_key=4&authenticated=${query.authenticated}`));
    return res.send(r.toXML());
  } else if (body.Digits === '*') {
    r.addSpeakI18n('assessment_redirection');
    r.addRedirect(res.locals.appUrl(`survey_assessment?q=disposition&caller_id=${caller_id}&campaign_id=${query.campaign_id}&assessment=${query.assessment ? '1' : '0'}`));
    return res.send(r.toXML());
  }

  if (Object.keys(campaign.more_info).length > 0 && Object.keys(campaign.more_info).includes(body.Digits)) {
    r.addSpeakI18n('_transparent', { var: campaign.more_info[body.Digits].content })
    r.addRedirect(res.locals.appUrl(`briefing?campaign_id=${campaign.id}&caller_number=${query.caller_number}&entry=more_info&entry_key=${body.Digits}&authenticated=${query.authenticated}`));
    return res.send(r.toXML());
  }

  if (query.start && !process.env.DISABLE_CALL_RESUME) {
    const last_call = await caller.last_call_today_with_no_survey_result()
    if (last_call) {
      const resumeIVR = r.addGetDigits({
        action: res.locals.appUrl(`resume_survey?caller_id=${caller_id}&last_call_id=${last_call.id}&campaign_id=${query.campaign_id}`),
        redirect: true,
        retries: 10,
        numDigits: 1,
        timeout: 10,
        validDigits: [1, 2],
      });
      resumeIVR.addSpeakI18n('last_call_ended_without_outcome')
      return res.send(r.toXML());
    }
  }

  if ((query.start || query.resumed) && campaign.hud) {
    const code = caller_id.toString().split('').join(' ');
    r.addSpeakI18n('hud_code', { code })
    const sessionCodePause = r.addGetDigits({
      retries: 4,
      numDigits: 1,
      timeout: 30,
      validDigits: [1],
    })
    sessionCodePause.addSpeakI18n('resume_paused_session')
  }

  if (query.start || body.Digits === '1') {
    r.addSpeakI18n('within_call_queue')
    if (!campaign.isWithinOptimalCallingTimes()) {
      r.addWait({ length: 1 });
      r.addSpeakI18n('long_wait_time_daytime');
      r.addWait({ length: 1 });
    } else if (!(await campaign.isRatioDialing())) {
      r.addWait({ length: 1 });
      r.addSpeakI18n('long_wait_time_caller_number');
      r.addWait({ length: 1 });
    }
  } else {
    r.addSpeakI18n('back_in_call_queue')
  }

  let callbackUrl = `conference_event/caller?caller_id=${caller_id}&campaign_id=${query.campaign_id}`;
  if (query.start) {
    r.addSpeakI18n('call_connect_shortly')
    r.addWait({ length: 1 });
    r.addSpeakI18n('final_calling_instructions');
    callbackUrl += '&start=1';
  }

  let params = {
    waitSound: res.locals.appUrl(`hold_music?campaign_id=${query.campaign_id}`),
    maxMembers: 2,
    timeLimit: 60 * 120,
    callbackUrl: res.locals.appUrl(callbackUrl),
    hangupOnStar: 'true',
    stayAlone: false,
    endConferenceOnExit: true,
    action: res.locals.appUrl(`survey?q=disposition&caller_id=${caller_id}&campaign_id=${query.campaign_id}`)
  }
  if (process.env.ENABLE_ANSWER_MACHINE_SHORTCUT) params.digitsMatch = ['3']
  if (campaign.transfer_to_target) params.digitsMatch = (params.digitsMatch || []).concat('9')
  r.addConference(`conference-${caller_id}`, params);
  res.send(r.toXML());
});

app.post('/resume_survey', async ({ query, body }, res) => {
  const r = plivo.Response()
  if (body.Digits === '1' && query.last_call_id) {
    const call = await Call.query().where({ id: query.last_call_id }).first()
    const original_caller_id = call.caller_id
    await call.$query().patch({ caller_id: query.caller_id })
    r.addSpeakI18n('last_call_outcome')
    r.addRedirect(res.locals.appUrl(`survey?call_id=${call.id}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}&q=disposition&undo=1`));
    await Event.query().insert({ name: 'resume calling', campaign_id: query.campaign_id, caller_id: query.caller_id, call_id: call.id, value: { original_caller_id } })
  } else {
    r.addSpeakI18n('continuing_calling')
    r.addRedirect(res.locals.appUrl(`ready?caller_id=${query.caller_id}&campaign_id=${query.campaign_id}&resumed=1`));
  }
  res.send(r.toXML());
});

app.all('/hold_music', async ({ query }, res) => {
  const r = plivo.Response();
  const campaign = await Campaign.query().where({ id: query.campaign_id }).first()
  if (campaign && campaign.hold_music) {
    _.shuffle(campaign.hold_music).forEach(filename => r.addPlay(`http://d1bm7er3ouf1yi.cloudfront.net/kooragang-hold-music/${filename}`))
  } else {
    [1, 2].forEach(i => r.addPlay(`http://d1bm7er3ouf1yi.cloudfront.net/kooragang-hold-music/welcome-pack-${i}.mp3`))
  }
  res.send(r.toXML());
});

app.post('/conference_event/caller', async ({ query, body }, res) => {
  const conference_member_id = body.ConferenceMemberID;
  if (body.ConferenceAction === 'enter') {
    const caller = await Caller.query().where({ id: query.caller_id })
      .patch({ status: 'available', conference_member_id, updated_at: new Date() })
      .returning('*').first()
    let campaign = await Campaign.query().where({ id: query.campaign_id }).first();
    const calls_in_progress = campaign.calls_in_progress;
    if (query.start) {
      await Event.query().insert({ name: 'join', campaign_id: campaign.id, caller_id: caller.id, value: { calls_in_progress } })
    } else {
      await Event.query().insert({ name: 'available', campaign_id: campaign.id, caller_id: caller.id, value: { calls_in_progress, updated_calls_in_progress: campaign.calls_in_progress } })
    }
  } else if (body.ConferenceAction === 'digits' && ['3', '9'].includes(body.ConferenceDigitsMatch)) {
    const call = await Call.query().where({ conference_uuid: body.ConferenceUUID }).first();
    if (call) {
      const params = body.ConferenceDigitsMatch === '3' ? {
        call_uuid: body.CallUUID,
        aleg_url: res.locals.appUrl(`survey_result?q=disposition&caller_id=${query.caller_id}&call_id=${call.id}&campaign_id=${query.campaign_id}&digit=3`),
      } : {
          call_uuid: call.callee_call_uuid,
          aleg_url: res.locals.appUrl(`transfer_to_target?call_id=${call.id}&campaign_id=${query.campaign_id}`)
        }
      try {
        await plivo_api('transfer_call', params);
      } catch (e) {
        await Event.query().insert({ campaign_id: query.campaign_id, name: 'failed_transfer', value: { params, call_id: call.id, error: e, call_uuid: body.CallUUID, conference_uuid: body.ConferenceUUID } });
      }
    }
  } else if (body.ConferenceAction === 'exit') {
    const old_call = await Call.query()
      .where({ conference_uuid: body.ConferenceUUID })
      .whereRaw("ended_at < now() - '30 seconds'::interval")
      .first();
    if (old_call) {
      await Event.query().insert({ campaign_id: query.campaign_id, caller_id: query.caller_id, name: 'conference_exit_error', value: { call_id: old_call.id, call_uuid: body.CallUUID, conference_uuid: body.ConferenceUUID } });
    }
  }
  res.sendStatus(200);
});

app.post('/transfer_to_target', async ({ query, body }, res) => {
  const r = plivo.Response();
  const campaign = await Campaign.query().where({ id: query.campaign_id }).first();
  const call = await Call.query().where({ id: query.call_id }).first();
  const callee = await Callee.query().where({ id: call.callee_id }).first();
  const campaign_target_number = _.isArray(campaign.target_numbers) ? _.sample(campaign.target_numbers) : campaign.target_numbers
  const target_number = callee.target_number ? callee.target_number : campaign_target_number
  r.addDial().addNumber(target_number);
  await Event.query().insert({ campaign_id: query.campaign_id, call_id: call.id, caller_id: call.caller_id, name: 'transfer_to_target', value: { callee_id: callee.id, call_uuid: body.CallUUID, target_number: target_number, target_origin: (callee.target_number ? 'callee' : 'campaign') } });
  return res.send(r.toXML());
});

app.post('/survey', async ({ query, body }, res) => {
  let call;
  const r = plivo.Response();
  const campaign = await Campaign.query().where({ id: query.campaign_id }).first();
  const questions = campaign.questions;
  const question = query.q;
  const caller_id = query.caller_id;
  const questionData = questions[question];
  if (query.call_id) {
    call = await Call.query().where({ id: query.call_id }).first();
  } else {
    call = await Call.query().where({ conference_uuid: (body.ConferenceUUID || "") }).first();
  }
  const caller = await Caller.query().where({ id: caller_id }).first()
  if (caller) {
    await caller.$query().patch({ status: 'in-survey' })
  }
  if (!call) {
    r.addSpeakI18n('left_call_queue')
    await Event.query().insert({ campaign_id: query.campaign_id, name: 'left queue without call', value: body, caller_id })
    r.addRedirect(res.locals.appUrl(`call_again?caller_id=${caller_id}&campaign_id=${query.campaign_id}`));
    return res.send(r.toXML());
  }
  if (call.status === 'machine_detection') {
    r.addSpeakI18n('answering_machine_detected')
    r.addRedirect(res.locals.appUrl(`ready?caller_id=${query.caller_id}&campaign_id=${query.campaign_id}`));
    return res.send(r.toXML());
  }
  const surveyResponse = r.addGetDigits({
    action: res.locals.appUrl(`survey_result?q=${question}&caller_id=${caller_id}&call_id=${call.id}&campaign_id=${query.campaign_id}`),
    redirect: true,
    retries: 10,
    numDigits: 1,
    timeout: 10,
    validDigits: Object.keys(questionData.answers),
  });
  if (question === 'disposition' && !query.undo) {
    surveyResponse.addSpeakI18n('call_ended');
  }
  surveyResponse.addSpeakI18n('_transparent', { var: questionData.name });
  surveyResponse.addWait({ length: 5 });
  surveyResponse.addSpeakI18n('survey_iphone_help');
  res.send(r.toXML());
});

app.post('/survey_result', async ({ query, body }, res) => {
  const r = plivo.Response();
  const campaign = await Campaign.query().where({ id: query.campaign_id }).first();
  const questions = campaign.questions;
  const question = questions[query.q];
  const call = await Call.query().where({ id: query.call_id }).eager('callee').first();
  const answers = question.answers
  const multiple = query.multiple === '1'

  if (multiple && (body.Digits === '*' || query.digit === '*')) {
    if (question.next) {
      r.addRedirect(res.locals.appUrl(`survey?q=${question.next}&call_id=${query.call_id}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}`));
    } else {
      r.addRedirect(res.locals.appUrl(`call_again?caller_id=${query.caller_id}&campaign_id=${query.campaign_id}&call_id=${query.call_id}`));
    }
    return res.send(r.toXML());
  }
  const disposition = question.answers[body.Digits || query.digit].value;
  const next = question.answers[body.Digits || query.digit].next;

  r.addSpeakI18n('_transparent', { var: disposition });

  const type = question.type;
  const deliver = question.answers[body.Digits || query.digit].deliver;
  if (type === 'SMS' && deliver) {
    const content = question.answers[body.Digits || query.digit].content;
    r.addMessage(`${content}`, {
      src: campaign.sms_number || process.env.NUMBER || '1111111111',
      dst: call.callee.phone_number
    });
  }

  const data = {
    log_id: res.locals.log_id,
    call_id: query.call_id,
    question: query.q,
    answer: disposition,
  }
  const survey_result = await SurveyResult.query().insert(data);
  const current_survey_results = await SurveyResult.query().where({ call_id: query.call_id, question: query.q })
  const all_possible_responses_entered = current_survey_results.length >= Object.keys(answers).length

  await call.$query().patch({ updated_at: new Date() })
  if (data.question === 'disposition') {
    await call.callee.trigger_callable_recalculation(call, survey_result.answer)
  }

  if (data.question != 'disposition' && question.multiple && !all_possible_responses_entered) {
    r.addRedirect(res.locals.appUrl(`survey_multiple?q=${query.q}&call_id=${query.call_id}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}`));
    return res.send(r.toXML())
  } else if (query.q != 'disposition' && question.multiple && all_possible_responses_entered) {
    r.addSpeakI18n('survey_multiple_all_possible_entered', { question: question.name })
  }

  if (next) {
    r.addRedirect(res.locals.appUrl(`survey?q=${next}&call_id=${query.call_id}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}`));
  } else {
    r.addRedirect(res.locals.appUrl(`call_again?caller_id=${query.caller_id}&campaign_id=${query.campaign_id}&call_id=${query.call_id}`));
  }
  res.send(r.toXML());
});

app.post('/survey_multiple', async ({ query }, res) => {
  const r = plivo.Response();
  const call = await Call.query().where({ id: query.call_id }).eager('callee').first();
  const campaign = await Campaign.query().where({ id: query.campaign_id }).first();
  const questions = campaign.questions;
  const question = query.q;
  const questionData = questions[question];
  const previous_survey_results = await SurveyResult.query().where({ call_id: query.call_id, question })
  const previous_survey_result_answers = _.map(previous_survey_results, (survey_result) => survey_result.answer);
  const matched_previous_response_keys = _.remove(_.map(questionData.answers, (answer, key) => _.includes(previous_survey_result_answers, answer.value) ? key : null), null);
  let validDigits = Object.keys(questionData.answers)
  _.remove(validDigits, (digit) => _.includes(matched_previous_response_keys, digit))
  if (previous_survey_results.length > 0) { validDigits.push('*') }
  const surveyResponse = r.addGetDigits({
    action: res.locals.appUrl(`survey_result?q=${question}&caller_id=${query.caller_id}&call_id=${call.id}&campaign_id=${query.campaign_id}&multiple=1`),
    redirect: true,
    retries: 10,
    numDigits: 1,
    timeout: 10,
    validDigits: validDigits,
  });
  surveyResponse.addSpeakI18n('survey_multiple_others');
  surveyResponse.addWait({ length: 1 });
  surveyResponse.addSpeakI18n('survey_multiple_others_next');
  res.send(r.toXML());
});

app.post('/call_again', async ({ query }, res) => {
  const r = plivo.Response();
  const campaign = await Campaign.query().where({ id: query.campaign_id }).first();

  if ((await campaign.isComplete()) && campaign.next_campaign_id) {
    const next_campaign = await Campaign.query().where({ id: campaign.next_campaign_id }).first()
    if (next_campaign && (await next_campaign.isOperational())) {
      r.addWait({ length: 1 });
      const next_campaign_number = sayPhoneNumber(next_campaign.phone_number)
      r.addSpeakI18n('campaign_status_completed_with_next', { campaign_name: campaign.name, next_campaign_name: next_campaign.name, next_campaign_number });
      r.addRedirect(res.locals.appUrl(`connect?campaign_id=${next_campaign.id}`));
      return res.send(r.toXML());
    }
  }

  if (!(await campaign.areCallsInProgress())) {
    if (!campaign.isWithinDailyTimeOfOperation()) {
      r.addWait({ length: 1 });
      r.addSpeakI18n('campaign_outside_operating_hours_in_session', { campaign_name: campaign.name, campaign_daily_time_of_operation: campaign.dailyTimeOfOperationInWords() });
      return res.send(r.toXML());
    } else if (campaign.status === 'paused' || campaign.status === null) {
      r.addWait({ length: 1 });
      r.addSpeakI18n('campaign_status_paused', { campaign_name: campaign.name });
      return res.send(r.toXML());
    } else if (campaign.status === 'inactive') {
      r.addWait({ length: 1 });
      r.addSpeakI18n('campaign_status_completed', { campaign_name: campaign.name });
      return res.send(r.toXML());
    }
  }
  const validDigits = ['1', '0'];
  let message = ''
  if (query.call_id && campaign.use_reference_codes) {
    validDigits.push('7')
    if (query.heard_reference_code) {
      message += languageBlock('hear_reference_code_repeat');
    } else {
      message += languageBlock('hear_reference_code');
    }
  }
  message += languageBlock('continue_or_end_session');
  if (query.call_id) {
    validDigits.push('8')
    message += languageBlock('correct_entry');
  }
  if (!query.tech_issue_reported) {
    validDigits.push('9')
    message += languageBlock('report_tech_issue');
  }

  let readyUrl = `ready?caller_id=${query.caller_id}&campaign_id=${query.campaign_id}`
  if (query.call_id) readyUrl += `&call_id=${query.call_id}`
  const callAgain = r.addGetDigits({
    action: res.locals.appUrl(readyUrl),
    timeout: 10,
    retries: 10,
    numDigits: 1,
    validDigits
  });
  callAgain.addSpeakLanguage(message);
  r.addRedirect(res.locals.appUrl('disconnect'));
  res.send(r.toXML());
});

app.post('/disconnect', (req, res) => {
  const r = plivo.Response();

  r.addSpeakI18n('thank_you_volunteer');

  const feedback = r.addGetDigits({
    action: res.locals.appUrl('feedback'),
    timeout: 5,
    retries: 2
  });
  feedback.addSpeakI18n('feedback_goodbye');

  res.send(r.toXML());
});

app.post('/feedback', (req, res) => {
  const r = plivo.Response();
  r.addSpeakI18n('feedback_instructions');
  r.addRecord({
    action: res.locals.appUrl('log'),
    maxLength: 60,
    redirect: false
  });
  r.addSpeakI18n('gave_feedback_goodbye');
  res.send(r.toXML());
});

app.post('/fallback', async ({ body, query }, res) => {
  await Event.query().insert({ campaign_id: query.campaign_id, name: 'caller fallback', value: body })
  const r = plivo.Response()
  r.addSpeakI18n('error_fallback')
  res.send(r.toXML())
});

app.post('/call_ended', async ({ body, query }, res) => {
  const campaign = await Campaign.query().where({ id: query.campaign_id }).first();
  const caller = await Caller.query().where({ call_uuid: body.CallUUID }).first();
  if (!caller) {
    await Event.query().insert({ name: 'caller ended without entering queue', campaign_id: campaign.id, value: body });
    return res.sendStatus(200);
  }

  const seconds_waiting = caller.status === 'available' ? Math.round((new Date() - caller.updated_at) / 1000) : 0;
  const cumulative_seconds_waiting = caller.seconds_waiting + seconds_waiting;
  await caller.$query().patch({ status: 'complete', seconds_waiting: cumulative_seconds_waiting });
  await Event.query().insert({ name: 'caller_complete', campaign_id: campaign.id, caller_id: caller.id, value: { seconds_waiting, cumulative_seconds_waiting } })

  if (caller.callback) {
    const params = {
      from: campaign.phone_number || '1111111111',
      to: sipFormatNumber(caller.phone_number),
      answer_url: res.locals.appUrl(`connect?campaign_id=${campaign.id}&callback=1&number=${caller.phone_number}`),
      hangup_url: res.locals.appUrl(`call_ended?campaign_id=${campaign.id}&callback=1&number=${caller.phone_number}`),
      ring_timeout: 30
    };
    if (process.env.SIP_HEADERS && params.to.match(/^sip:/)) params.sip_headers = process.env.SIP_HEADERS
    try {
      await sleep(5000);
      await plivo_api('make_call', params);
    } catch (e) {
      await Event.query().insert({ name: 'failed_callback', campaign_id: campaign.id, caller_id: caller.id, value: { error: e } })
    }
  }
  return res.sendStatus(200);
});

app.post('/machine_detection', async ({ body, query }, res) => {
  try {
    if (!body.CallUUID) { throw 'no CallUUID present machine_detection' }
    await Call.query().where({ callee_call_uuid: body.CallUUID }).patch({ status: 'machine_detection' });
    await plivo_api('hangup_call', { call_uuid: body.CallUUID });
  } catch (e) {
    const call = body.CallUUID && await Call.query().where({ callee_call_uuid: body.CallUUID }).first();
    await Event.query().insert({
      name: 'failed_post_machine_callee_transfer',
      campaign_id: query.campaign_id,
      caller_id: call && call.caller_id,
      call_id: call && call.id,
      value: { error: e }
    })
  }
  res.sendStatus(200);
});

module.exports = app;
