module.exports = () => {
  return {
    language: process.env.VOICE_LANG || 'en-GB',
    voice: process.env.VOICE_GENDER || 'MAN'
  }
}
