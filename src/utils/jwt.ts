import axios from 'axios';

const getJWT = (email: string, password: string) => {
  return axios
    .post('https://api.thisislanguage.com/api/v1/auth/login', {
      body: JSON.stringify({
        fingerPrint: 'fingerPrint',
        password: password,
        username: email,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(({data}) => {
      if (!data) {
        throw Error('Invalid login details');
      }
      const JWT = data.token.slice(4);
      return JWT;
    })
    .catch(() => {
      throw new Error('Email and password combination incorrect');
    });
};

export default getJWT;
