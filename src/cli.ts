import {option} from 'yargs';
import NuttyTilez from './index';

const args = option('email', {
  alias: 'e',
  desc: 'Sign-in email',
  type: 'string',
})
  .option('password', {
    alias: 'p',
    desc: 'Sign-in password',
    type: 'string',
  })
  .option('jwt', {
    alias: 'j',
    desc: 'JWT from Nutty Tilez',
    type: 'string',
  })
  .option('delay', {
    alias: 'D',
    desc: 'Answer delay in milliseconds',
    type: 'number',
    default: 10,
  })
  .option('dante', {
    alias: 'd',
    desc: 'Fight Demon Dante',
    type: 'boolean',
  })
  .option('timeout', {
    alias: 't',
    desc: 'Lobby timeout in seconds',
    type: 'number',
    default: 10,
  })
  .option('language', {
    alias: 'l',
    desc: 'Language',
    type: 'string',
  })
  .option('level', {
    alias: 'L',
    desc: 'Level number',
    type: 'number',
  }).argv;

const nut = new NuttyTilez(
  {
    jwt: args.jwt,
    password: args.password,
    email: args.email,
  },
  1,
  'SPANISH',
  false
);
