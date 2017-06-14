module.exports = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL || 'postgres://localhost:5432/kooragang'
  },
  test: {
    client: 'pg',
    connection: process.env.TEST_DATABASE_URL || 'postgres://localhost:5432/kooragang_test'
  },
  staging: {
    client: 'pg',
    connection: process.env.DATABASE_URL
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL
  },
  read_only: {
    development: {
      client: 'pg',
      connection: process.env.READ_ONLY_DATABASE_URL || 'postgres://localhost:5432/kooragang'
    },
    test: {
      client: 'pg',
      connection: process.env.TEST_DATABASE_URL || 'postgres://localhost:5432/kooragang_test'
    },
    staging: {
      client: 'pg',
      connection: process.env.READ_ONLY_DATABASE_URL
    },
    production: {
      client: 'pg',
      connection: process.env.READ_ONLY_DATABASE_URL
    }    
  }
};
