const env = process.env.NODE_ENV || 'development';

const pg = require('pg');
pg.types.setTypeParser(1700, 'text', parseFloat)
const config = require('../knexfile');
const knex = require('knex')(config[env]);
const objection = require('objection');
const Model = objection.Model;
const transaction = objection.transaction;
Model.knex(knex);

module.exports = {
	Model,
	transaction
}