module.exports = () => {
  return {
    language: process.env.VOICE_LANGUAGE || 'en-GB',
    voice: process.env.VOICE_GENDER || 'MAN'
  }
}
