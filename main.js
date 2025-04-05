const fs = require('fs');
const https = require('https');
const moment = require('moment');
const path = require('path');
const process = require('process');

// Read save path from path.txt
const savePath = fs.readFileSync('path.txt', 'utf8').trim();

// Parse cookies.txt (Netscape format)
function loadCookies(domain) {
  const lines = fs.readFileSync('cookies.txt', 'utf8').split('\n');
  const cookies = lines
    .filter(line => !line.startsWith('#') && line.trim() !== '')
    .map(line => line.split('\t'))
    .filter(parts => parts.length >= 7 && parts[0].includes(domain))
    .map(parts => `${parts[5]}=${parts[6]}`);
  return cookies.join('; ');
}

const nytCookies = loadCookies('nytimes.com');

function getNYTC(date) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      protocol: 'https:',
      host: 'www.nytimes.com',
      path: `/svc/crosswords/v2/puzzle/print/${moment(date).format('MMMDDYY')}.pdf`,
      method: 'GET',
      headers: {
        Referer: 'https://www.nytimes.com/crosswords/archive/daily',
        Cookie: nytCookies,
      },
    }, (res) => {
      if (res.statusCode === 200) {
        const data = [];
        res.on('error', (err) => reject(err));
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => resolve(Buffer.concat(data)));
      } else {
        reject(`HTTP ${res.statusCode}`);
      }
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function nytc(date) {
  console.log(`Checking ${moment(date).format('YYYY-MM-DD')}'s crossword.`);
  try {
    await getNYTC(date);
    console.log(`Successfully checked ${moment(date).format('YYYY-MM-DD')}'s crossword.`);
  } catch (error) {
    console.log(`NYT cookie likely expired or invalid. Error: ${error}`);
    process.exit(1);
  }

  date.setDate(date.getDate() + 1);
  console.log(`Downloading ${moment(date).format('YYYY-MM-DD')}'s crossword.`);
  let data;
  try {
    data = await getNYTC(date);
    console.log(`Successfully downloaded ${moment(date).format('YYYY-MM-DD')}'s crossword.`);
  } catch (error) {
    console.log(`${moment(date).format('YYYY-MM-DD')}'s crossword is not yet released.`);
    return;
  }

  const filename = `${moment(date).format('YYYY-MM-DD-ddd')}-crossword.pdf`;
  const filePath = path.join(savePath, filename);

  if (fs.existsSync(filePath)) {
    console.log(`File already exists.`);
    return;
  }

  console.log(`Saving file locally.`);
  fs.writeFileSync(filePath, data);
  console.log(`Successfully saved ${filename}.`);
}

function getWSJC(date) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      protocol: 'https:',
      host: 's.wsj.net',
      path: `/public/resources/documents/${moment(date).format('[XWD]MMDDYYYY')}.pdf`,
      method: 'GET',
    }, (res) => {
      if (res.statusCode === 200) {
        const data = [];
        res.on('error', (err) => reject(err));
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => resolve(Buffer.concat(data)));
      } else {
        reject(`HTTP ${res.statusCode}`);
      }
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function wsjc(date) {
  date.setDate(date.getDate() + 1);
  console.log(`Downloading ${moment(date).format('YYYY-MM-DD')}'s crossword.`);
  let data;
  try {
    data = await getWSJC(date);
    console.log(`Successfully downloaded ${moment(date).format('YYYY-MM-DD')}'s crossword.`);
  } catch (error) {
    console.log(`${moment(date).format('YYYY-MM-DD')}'s crossword is not yet released.`);
    return;
  }

  const filename = `${moment(date).format('YYYY-MM-DD-ddd')}-crossword.pdf`;
  const filePath = path.join(savePath, filename);

  if (fs.existsSync(filePath)) {
    console.log(`File already exists.`);
    return;
  }

  console.log(`Saving file locally.`);
  fs.writeFileSync(filePath, data);
  console.log(`Successfully saved ${filename}.`);
}

async function download(date) {
  console.log(`NYTC Block`);
  await nytc(new Date(date.getTime()));
  console.log(`WSJC Block`);
  await wsjc(new Date(date.getTime()));
}

async function main() {
  const date = new Date((new Date()).toLocaleString('en-US', { timeZone: 'America/New_York' }));
  for (let i = 0; i < 14; i++) {
    await download(date);
    date.setDate(date.getDate() - 1);
  }
}

main().then(() => process.exit(0));

