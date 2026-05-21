// Centralise les `require()` d'images statiques.
// Les chemins sont résolus au moment du bundling — il faut donc des littéraux.

export const assets = {
  mascot: require('../../assets/mascot.png'),
  logo: require('../../assets/logo.png'),
} as const;
