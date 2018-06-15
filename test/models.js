const {Campaign, Callee, Caller, Audience} = require('../models');
const expect = require('expect.js');
const objection = require('objection');
const {dropFixtures} = require('./test_helper')

describe('Campaign', () => {
  beforeEach(async () => {
    await dropFixtures()
  });

  const expectInvalidQuestion = (questions, message) => {
    return async () => {
      const campaign = await Campaign.query().insert({name: 'test', questions});
      try{
        campaign.valid()
        throw 'should never reach'
      } catch (e) {
        expect(e.message).to.match(message)
      }
    }
  }

  describe('#valid', () => {
    context('with no disposition question', () => {
      it('should throw a validation error', expectInvalidQuestion({}, /disposition question required/))
    })
    context('with name', () => {
      it('should throw a validation error', expectInvalidQuestion({disposition: {}}, /disposition question requires answers/))
    })
    context('with answers missing', () => {
      it('should throw a validation error', expectInvalidQuestion({disposition: {}}, /disposition question requires answers/))
    })
    context('with an answer that is not betweeen 2-9', () => {
      it('should throw a validation error', expectInvalidQuestion({disposition: {name: 'test', answers: {'1': {value: 'test'}}}}, /answer 1 for disposition question is not valid/))
    });
    context('with an answer that is not betweeen 2-9', () => {
      it('should throw a validation error', expectInvalidQuestion({disposition: {name: 'test', answers: {'2': {oops: 'test'}}}}, /answer 2 for disposition question is missing value/))
    })
    context('with an answer with an invalid next', () => {
      it('should throw a validation error', expectInvalidQuestion({disposition: {name: 'test', answers: {'2': {value: 'test', next: 'fail'}}}}, /fail next for answer 2 in disposition question has invalid next/))
    })
    context('with a question that cannot be reached', () => {
      it('should throw a validation error', expectInvalidQuestion({disposition: {name: 'test', answers: {'2': {value: 'test'}}}, noreach: {name: 'no reach', answers: {'2': {value: 'test'}}}}, /no references to noreach/))
    })
  })
})
