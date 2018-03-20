'use strict';

const tls = require('tls');
const net = require('net');


/**
 * Instantiates an IRC bot.
 * @constructor
 * @param {string} host - The hostname to connect to.
 * @param {number} port - The port number to connect to.
 * @param {boolean} secure - Whether to connect securely or not.
 * @param {string} nick - The nick to use when connected (also used as the
 * name).
 * @param {string} channel - The channel to join.
 */
function IRCBot(host, port, secure, nick, channel) {
    this.host = host;
    this.port = port;
    this.secure = secure;
    this.nick = nick;
    this.channel = channel;
    this.client = null;
}


/**
 * Connects to the IRC server via the host and port specified.
 */
IRCBot.prototype.connect = function connect() {
    if (this.secure)
        this.client = tls.connect(this.port, this.host, () => this.connected());
    else
        this.client = net.connect(this.port, this.host, () => this.connected());

    this.client.on('data', data => this.processMessage(data));
    this.client.on('end', (chunk) => {
        console.log('-- Exiting');
        server.close();
    });
}


/**
 * Performs logging in the event that the connection to the host was
 * successfully established.
 */
IRCBot.prototype.connected = function connected() {
    let prefix = this.secure ? 'Securely connected' : 'Connected';
    console.log(`-- ${prefix} to ${this.host}:${this.port}`);
};


/**
 * Processes a message received from the server.
 * @param {(Buffer|String)} data - The data received from the server.
 */
IRCBot.prototype.processMessage = function processMessage(data) {
    let message = data.toString();
    let lines = message.split('\r\n');
    let formattedMessage = lines.join('\r\n<< ');
    console.log(`<< ${formattedMessage}`);
    let components = this._parseMessage(message);
}


/**
 * Parses a message into its components.
 * @param {string} message - The message that is to be parsed.
 * @return {Object} Object containing `prefix`, `command`, and `params`.
 */
IRCBot.prototype._parseMessage = function _parseMessage(message) {
    let prefix = null;
    let command = null;
    let params = null;
    let pieces = message.split(' ');
    if (pieces[0][0] === ':') {
        prefix = pieces.shift();
        command = pieces.shift();
        params = pieces.join(' ');
    }
    else {
        command = pieces.shift();
        params = pieces.join(' ');
    }
    return {prefix, command, params};
}


let bot = new IRCBot('irc.esper.net', 6697, true, 'nodebottest', '#channel');
bot.connect();
