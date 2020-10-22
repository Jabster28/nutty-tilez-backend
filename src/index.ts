/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as io from 'socket.io-client';
import getJWT from './utils/jwt';
import colors from './utils/colors';
import levels from './utils/levels';
type Language = 'GERMAN' | 'FRENCH' | 'SPANISH';

/**
 * Class that holds all of the information for the Nutty Tilez session.
 */
class NuttyTilez {
  /**
   * JWT Token from Nutty Tilez
   */
  jwt: string;
  /**
   * Level number to complete
   */
  level: number;
  /**
   * Language to choose
   */
  language: Language;
  /**
   * Whether to fight Demon Dante or not
   */
  dante: boolean;
  /**
   * Socket that connects to Nutty Tilez' servers
   */
  socket: SocketIOClient.Socket;
  /**
   * List of objects w/ all words that the level will give you
   */
  levelWords: any[];
  /**
   * List of question IDs
   */
  questionIds: number[];
  /**
   * Lobby timeout for initial connection
   */
  timeout: number;
  /**
   * Delay after question is answered
   */
  delay: number;
  /**
   * Whether the game has been completed or not
   */
  completedGame: boolean;
  /**
   * Whether the program is currently in a lobby
   */
  joinedLobby: boolean;
  /**
   * List of lobby players w/ UUIDs
   */
  lobbyPlayers: any[];
  /**
   * Internal ID for Nutty Tilez Level
   */
  gameId: number;

  constructor(
    auth: {
      jwt?: string;
      email?: string;
      password?: string;
    },
    level: number,
    language: Language,
    dante?: boolean,
    timeout?: number,
    delay?: number
  ) {
    this.language = language;
    this.dante = dante || false;
    this.jwt = '';
    this.levelWords = [];
    this.questionIds = [];
    this.lobbyPlayers = [];
    this.completedGame = false;
    this.timeout = timeout || 30000;
    this.delay = delay || 20;
    this.joinedLobby = false;
    this.level = level;
    this.gameId =
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      levels[this.language.toUpperCase()].min + Number(this.level) - 1;

    this.socket = io('wss://nutty.thisislanguage.com/nutty-tilez', {
      timeout: 50000,
      transports: ['websocket', 'polling'],
    });
    this.socket.on('authenticated', () => this.onAuthenticated());
    // @ts-ignore
    this.socket.on('level:words', w => this.onLevelWords(w));
    // @ts-ignore
    this.socket.on('room:joined', w => this.onRoomJoined(w));
    // @ts-ignore
    this.socket.on('game:start', () => this.onGameStart());
    // @ts-ignore
    // this.socket.on('players:online', () => this.onpla());
    // @ts-ignore
    this.socket.on('player:status', (w, e) => this.onPlayerStatus(w, e));
    // @ts-ignore
    this.socket.on('game:over', w => this.onGameOver(w));
    // @ts-ignore
    this.socket.on('game:countdown', w => this.onGameCountDown(w));
    // @ts-ignore
    this.socket.on('lobby:joined', w => this.onLobbyJoined(w));
    // @ts-ignore
    this.socket.on('lobby:players', w => this.onLobbyPlayers(w));
    // @ts-ignore

    console.log(`${colors.fgBlue}Connecting...${colors.reset}`);

    if (auth.jwt) {
      this.jwt = auth.jwt;
      this.onConnect();
    } else {
      if (!auth.email || !auth.password) {
        throw new Error('No email and/or password');
      }

      getJWT(auth.email, auth.password).then(jwt => {
        this.jwt = jwt;
        this.onConnect();
      });
    }
  }

  /**
   * Handler that is triggered on initial socket connection
   */
  onConnect() {
    console.log(`${colors.fgGreen}Connected${colors.reset}`);

    this.socket.emit('authenticate', {
      token: this.jwt,
    });
  }

  /**
   * Handler that is triggered after onConnect
   */
  onAuthenticated() {
    console.log(`${colors.fgGreen}Authenticated${colors.reset}`);
    setTimeout(() => {
      this.socket.emit('level:words', this.level);
      this.socket.emit('level:play', this.gameId, this.dante);

      setTimeout(() => {
        if (!this.joinedLobby) {
          throw Error(
            `${colors.bright + colors.fgRed}Lobby connection timed out${
              colors.reset
            }`
          );
        }
      }, this.timeout);
    }, 100);
  }

  /**
   * Handler that is triggered when the words are sent from the server
   * @param words Words as a list as objects
   */
  onLevelWords(words: any[]) {
    console.log(words);
    console.log(`${colors.fgGreen}Received words${colors.reset}`);
    this.levelWords = words;
  }

  /**
   * Handler for room joining, generates list of questions needed
   * @param questionIds List of all question IDs, as numbers
   */
  onRoomJoined(questionIds: number[]) {
    console.log(`${colors.fgGreen}Joined room${colors.reset}`);
    const questionsNeeded = 60000 / this.delay;
    for (let i = 0; i < Math.ceil(questionsNeeded / questionIds.length); i++) {
      questionIds = questionIds.concat(questionIds);
    }
    this.questionIds = questionIds;
  }

  /**
   * Handler that is triggered when a player object updates in a lobby
   * @param playerId Player ID
   * @param status New player state
   */
  onPlayerStatus(playerId: any, status: any) {
    console.log(playerId);
    console.log(status);
    if (status.isDead) {
      console.log(
        `${colors.fgRed}Player Died, Score: ${status.score}${colors.reset}`
      );
    }
  }

  /**
   * Handler that triggers when a game starts, creates an interval that answers questions indefinitely
   */
  onGameStart() {
    console.log(`${colors.fgGreen}Game Start${colors.reset}`);

    for (let i = 0; i < this.questionIds.length; i++) {
      setTimeout(() => {
        if (!this.completedGame) {
          this.socket.emit('translation:correct', this.questionIds[i]);
          console.log(this.levelWords);
          const word = this.levelWords.find(y => y.id === this.questionIds[i]);
          console.log(
            `${colors.fgGreen}Question Answered: ${word.name || ''}${
              word.description ? ` (${word.description})` : ''
            } - ${word.translation || ''}${colors.reset}`
          );
        }
      }, i * this.delay);
    }
  }

  /**
   * Handler that triggers once the game ends
   * @param status Status sent from Nutty Tilez, holding game data
   */
  onGameOver(status: {type: string}) {
    if (status.type === 'Win') {
      console.log(`${colors.fgGreen + colors.bright}Win!${colors.reset}`);
    } else if (status.type === 'Timeout') {
      console.log((colors.fgRed = `${colors.bright}Timeout!${colors.reset}`));
    } else if (status.type === 'Dead') {
      console.log((colors.fgRed = `${colors.bright}Dead!${colors.reset}`));
    }

    this.completedGame = true;
  }

  /**
   * Handler for rendering countdown text
   * @param x String sent from Nutty Tilez
   */
  onGameCountDown(x: string) {
    console.log(`${colors.fgBlue}Game Countdown: ${x}${colors.reset}`);
  }

  /**
   * Handler that is triggered when a player enters the lobby
   * @param player Player object that joined
   */
  onLobbyJoined(player: any) {
    console.log(
      `${colors.fgBlue}Player Joined: ${player.firstName} ${player.lastName} (${player.playerId})${colors.reset}`
    );
    this.lobbyPlayers.push(player);
  }

  /**
   * Handler that triggers when you initially join a lobby
   * @param players List of players in lobby as of when you join
   */
  onLobbyPlayers(players: any[]) {
    players.forEach(player => {
      console.log(
        `${colors.fgBlue}Player Joined: ${player.firstName} ${player.lastName} (${player.playerId})${colors.reset}`
      );
      this.lobbyPlayers.push(player);
    });
  }
}

export default NuttyTilez;
