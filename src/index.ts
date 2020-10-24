/* eslint-disable no-process-exit */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-console */
import * as io from 'socket.io-client';
import getJWT from './utils/jwt';
import colors from './utils/colors';
import levels from './utils/levels';

const getJWTProxy = (email?: string, password?: string, jwt?: string) => {
  if (jwt) return Promise.resolve(jwt);
  return getJWT(email || '', password || '');
};

interface NuttyTilezGameProps {
  email?: string;
  password?: string;
  jwt?: string;
  delay?: number;
  demonDante?: boolean;
  timeout?: number;
  language: 'GERMAN' | 'SPANISH' | 'FRENCH';
  level: number;
}

type levelWordType = {
  name: string;
  description: string;
  translation: string;
  id: number;
};

export class NuttyTilezGame {
  public answerDelay: number;
  public demonDante: boolean;
  public lobbyTimeout: number;
  public language: 'GERMAN' | 'SPANISH' | 'FRENCH';
  public level: number;
  public gameId: number;
  public levelWords: levelWordType[];
  public questionIds: number[];
  public lobbyPlayers: object[];
  public completedGame: boolean;
  public joinedLobby: boolean;
  public socket: SocketIOClient.Socket;
  public jwt: string;

  constructor({
    email,
    password,
    jwt,
    delay,
    demonDante,
    timeout,
    language,
    level,
  }: NuttyTilezGameProps) {
    this.answerDelay = delay || 2;
    this.demonDante = demonDante || false;
    this.lobbyTimeout = (timeout || 30) * 1000;
    this.jwt = '';
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.language = language.toUpperCase();
    this.level = level;
    this.gameId = levels[this.language].min + Number(level) - 1;
    console.log(levels);
    console.log(language);
    this.levelWords = [];
    this.questionIds = [];
    this.lobbyPlayers = [];
    this.completedGame = false;
    this.joinedLobby = false;

    this.socket = io('wss://nutty.thisislanguage.com/nutty-tilez', {
      timeout: 2000,
      transports: ['websocket', 'polling'],
    });

    console.log(`${colors.fgBlue}Connecting...${colors.reset}`);
    this.socket.on('connect', () => this.onConnect());
    // @ts-ignore
    this.socket.on('authenticated', () => this.onAuthenticated());
    // @ts-ignore
    this.socket.on('level:words', w => this.onLevelWords(w));
    // @ts-ignore
    this.socket.on('room:joined', w => this.onRoomJoined(w));
    // @ts-ignore
    this.socket.on('game:start', () => this.onGameStart());
    // @ts-ignore
    // @ts-ignore
    this.socket.on('player:status', (w, e) => this.onPlayerStatus(w, e));
    // @ts-ignore
    this.socket.on('game:over', w => this.onGameOver(w));
    // @ts-ignore
    this.socket.on('game:countdown', w => this.onGameCountdown(w));
    // @ts-ignore
    this.socket.on('lobby:joined', w => this.onLobbyJoined(w));
    // @ts-ignore
    this.socket.on('lobby:players', w => this.onLobbyPlayers(w));
    // @ts-ignore

    getJWTProxy(email, password, jwt).then(jwt => {
      this.jwt = jwt;
    });
  }

  onConnect() {
    console.log(`${colors.fgGreen}Connected${colors.reset}`);
    this.socket.emit('authenticate', {
      token: this.jwt,
    });
  }

  onAuthenticated() {
    console.log(`${colors.fgGreen}Authenticated${colors.reset}`);
    setTimeout(() => {
      this.socket.emit('level:words', this.gameId);
      this.socket.emit('level:play', this.gameId, this.demonDante);

      setTimeout(() => {
        if (!this.joinedLobby) {
          console.log(
            `${colors.bright + colors.fgRed}Lobby connection timed out${
              colors.reset
            }`
          );
          this.completedGame = true;
        }
      }, this.lobbyTimeout);
    }, 100);
  }

  onLevelWords(x: levelWordType[]) {
    console.log(`${colors.fgGreen}Received words${colors.reset}`);
    this.levelWords = x;
  }

  onRoomJoined(x: number[]) {
    this.joinedLobby = true;

    console.log(`${colors.fgGreen}Joined room${colors.reset}`);
    const questionsNeeded = 60000 / this.answerDelay;
    for (let i = 0; i < Math.ceil(questionsNeeded / x.length); i++) {
      this.questionIds = this.questionIds.concat(x);
    }
  }

  onPlayerStatus(
    x: number,
    y: {
      isDead: boolean;
    }
  ) {
    // @ts-ignore
    const player = this.lobbyPlayers.find(z => z.playerId === x);
    if (player && y.isDead) {
      console.log(
        // @ts-ignore
        `${colors.fgRed}Player Died: ${player.firstName || ''} ${
          // @ts-ignore
          player.lastName || ''
          // @ts-ignore
        }, Score: ${y.score}${colors.reset}`
      );
    }
  }

  onGameStart() {
    console.log(`${colors.fgGreen}Game Start${colors.reset}`);

    console.log(this.gameId);

    for (let i = 0; i < this.questionIds.length; i++) {
      setTimeout(() => {
        if (!this.completedGame) {
          this.socket.emit('translation:correct', this.questionIds[i]);
          const word: levelWordType = this.levelWords.find(
            y => y.id === this.questionIds[i]
          ) || {
            name: '',
            description: '',
            translation: '',
            id: 0,
          };
          console.log(
            `${colors.fgGreen}Question Answered: ${word.name || ''}${
              word.description ? ` (${word.description})` : ''
            } - ${word.translation || ''}${colors.reset}`
          );
        }
      }, i * this.answerDelay);
    }
  }

  onGameOver(x: any) {
    if (x.type === 'Win') {
      console.log(`${colors.fgGreen + colors.bright}Win!${colors.reset}`);
      process.exit(0);
    } else if (x.type === 'Timeout') {
      console.log(`${colors.fgRed + colors.bright}Timeout!${colors.reset}`);
      process.exit(0);
    } else if (x.type === 'Dead') {
      console.log(`${colors.fgRed + colors.bright}Dead!${colors.reset}`);
      process.exit(0);
    }
    this.completedGame = true;
  }

  onGameCountdown(x: string) {
    console.log(
      `${colors.fgBlue}Game Countdown: ${x.toString()}`,
      colors.reset
    );
  }

  onLobbyJoined(x: any) {
    console.log(
      `${colors.fgBlue}Player Joined: ${x.firstName} ${x.lastName} (${x.playerId})${colors.reset}`
    );
    this.lobbyPlayers.push(x);
  }

  onLobbyPlayers(x: any[]) {
    x.forEach(y => {
      console.log(
        `${colors.fgBlue}Player Joined: ${y.firstName} ${y.lastName} (${y.playerId})${colors.reset}`
      );
      this.lobbyPlayers.push(y);
    });
  }
}

export default NuttyTilezGame;
