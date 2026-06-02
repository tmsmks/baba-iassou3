// Config Metro enveloppée par Sentry pour permettre l'upload des source maps
// (stack traces lisibles dans Sentry au lieu de code minifié).
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = config;
