const request = require('request');
const NodeCache = require( "node-cache" );
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Discord = require('discord.js');
const client = new Discord.Client();

require('log-timestamp');
require('dotenv').config();

const RECEIVERS = process.env.RECEIVERS;

const cache = new NodeCache();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_ADDR,
        pass: process.env.MAIL_PASSWD
    }
});

client.on('ready', () => {
    console.log('Discord bot connected');
});
client.login(process.env.DISCORD_TOKEN);

const urls = {
    login: "https://oasis.polytech.universite-paris-saclay.fr/prod/bo/core/Router/Ajax/ajax.php?targetProject=oasis_polytech_paris&route=BO\\Connection\\User::login",
    marks: "https://oasis.polytech.universite-paris-saclay.fr/prod/bo/core/Router/Ajax/ajax.php?targetProject=oasis_polytech_paris&route=BO\\Layout\\MainContent::load&codepage=MYMARKS"
}

cache.set("nbMarks", null);
console.log("Starting server. Updates every 15 min between 6am. and 9pm. on weekdays");
console.log("It will notify " + process.env.RECEIVERS);
console.log("NOTE: On start it cannot know if a new marks has been added as it does not have a reference.");
makeRequest();
cron.schedule('*/15 6-21 * * 1-5', makeRequest);

function makeRequest() {
    console.log("Logging in...")
    request.post(urls.login, {
        form: {
            login: process.env.OASIS_LOGIN,
            password: process.env.OASIS_PASSWD
        }
    }, afterLogin);
}

function afterLogin(error, response, body) {
    console.log("Logged in");
    const cookies = parseCookiesFromHeaders(response.headers);

    request.get(urls.marks, {
        headers: {
            Cookie: cookiesToString(cookies)
        }
    }, afterGetMarks);
}

function notifyAboutNewMarks(number) {
    sendMailAboutMarks(number);
    sendDiscordMessage(number);
}

function sendMailAboutMarks(number) {
    console.log(number + " new mark(s).")
    transporter.sendMail({
        from: process.env.MAIL_ADDR,
        to: RECEIVERS,
        subject: number + " nouvelles notes !",
        html: '<a href="https://oasis.polytech.universite-paris-saclay.fr/#codepage=MYMARKS">Accéder à Oasis</a>'
    },  (error, info) => {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

function sendDiscordMessage(number) {
    const channel = client.channels.cache.find(i => i.name === process.env.CHANNEL_ID);
    channel.send(`${number} nouvelles notes 🎉🎉🎉\n🔗 : https://oasis.polytech.universite-paris-saclay.fr/#codepage=MYMARKS`);
}

function afterGetMarks(error, response, body) {
    const oldNbMarks = parseInt(cache.get("nbMarks"));
    const newNbMarks = getNumberOfMarks(body);
    if(oldNbMarks && oldNbMarks !== newNbMarks) {
        notifyAboutNewMarks(newNbMarks - oldNbMarks);
    } else {
        console.log("No new marks. Still " + newNbMarks + " marks.");
    }
    console.log("=============");
    cache.set("nbMarks", newNbMarks);
}

function getNumberOfMarks(body) {
    let sum = 0;
    Array.from(body.matchAll(/<a.*>Épreuves \((.*)\)<\/a>/g)).forEach(match => sum += parseInt(match[1]));
    return sum;
}

function parseCookiesFromHeaders(headers) {
    const cookies = {};
    headers["set-cookie"].forEach(cookie => {
        if(cookie.startsWith("PHPSESSID=")) {
            cookies["PHPSESSID"] = cookie.match(/PHPSESSID=([a-z0-9]+);/)[1];
        } else if (cookie.startsWith("bo_oasis_polytech_parisyear=") && !cookies["bo_oasis_polytech_parisyear"]) {
            cookies["bo_oasis_polytech_parisyear"] = cookie.match(/bo_oasis_polytech_parisyear=(20[0-9]{2});/)[1];
        }
    });
    return cookies;
}

function cookiesToString(cookies) {
    let cookie = "";
    for (let [key, value] of Object.entries(cookies)) {
        cookie += `${key}=${value}; `
    }
    return cookie;
}