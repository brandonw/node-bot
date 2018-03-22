'use strict';

const tls = require('tls');
const net = require('net');

exports.IRCBot = IRCBot;


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
    this._sentNick = false;
    this._joinedChannel = false;
    this._networkModule = secure ? tls : net;
}


/**
 * Connects to the IRC server via the host and port specified.
 */
IRCBot.prototype.connect = function connect() {
    this.client = this._networkModule.connect(this.port, this.host, () => this.connected());
    this.client.on('data', data => this.processMessage(data));
    this.client.on('close', (had_error) => {
        let error = had_error ? ' due to transmission error.' : '';
        console.log(`-- Exiting${error}`);
    });
};


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
    lines = lines.filter(line => line !== "");
    for (let line of lines) {
        console.log(`<< ${line}`);
        let parsedMessage = this._parseMessage(line);
        this.handleMessage(parsedMessage);
    }
};


/**
 * Processes a message received from the server.
 * @param {Object} message - A message returned from parseMessage.
 */
IRCBot.prototype.handleMessage = function handleMessage(message) {
    if (message.command === "NOTICE" && !this._sentNick) {
        this.sendMessage(this.createMessage(null, "NICK", this.nick));
        this.sendMessage(this.createMessage(null, "USER", `${this.nick} 0 * :nodebot`));
        this._sentNick = true;
    }
    if (message.command === "001" && !this._joinedChannel) {
        this.sendMessage(this.createMessage(null, "JOIN", this.channel));
        this._joinedChannel = true;
    }
    if (message.command === "PING") {
        this.sendMessage(this.createMessage(null, "PONG", message.params));
    }
    if (message.command === "PRIVMSG") {
        let args = message.params.split(' ');
        let src = message.prefix.slice(1);
        let dest = args.shift();
        let cmd = args.shift().slice(1);
        this.handlePrivateMessage(src, dest, cmd, args);
    }
};


/**
 * Handles a private message.
 * @param {string} source - The IDENT the message originated from.
 * @param {string} dest - The recipient of the message.
 * @param {string} command - The command of the message. This is the token prior to the first
 * @param {string} args - The command args of the message. This is the space delimited tokens
 * following the first.
 */
IRCBot.prototype.handlePrivateMessage = function handlePrivateMessage(source, dest, command, args) {
    if (dest == this.nick) {
        // Private Message
    } else if (dest == this.channel) {
        // Public Message
        if (command === "!QUIT") {
            this.sendMessage(this.createMessage(null, "QUIT", args ? ':' + args.join(' ') : ''));
        }
    }
};


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
};


/**
 * Creates a message ready to be sent to the server.
 * @param {string} prefix - Optional prefix component of the message.
 * @param {string} command - Required command component of the message.
 * @param {string} params - Optional params component of the message.
 * @return {string} A message ready to be sent.
 */
IRCBot.prototype.createMessage = function CreateMessage(prefix, command, params) {
    prefix = prefix ? `${prefix} ` : '';
    params = params ? ` ${params}` : '';
    let message = `${prefix}${command}${params}\r\n`;
    return message;
};


/**
 * Sends a message to the IRC server.
 * @param {string} message - A message to be sent to the IRC server.
 */
IRCBot.prototype.sendMessage = function sendMessage(message) {
    let lines = message.split('\r\n');
    lines = lines.filter(line => line !== "");
    let formattedMessage = lines.join('\r\n>> ');
    console.log(`>> ${formattedMessage}`);
    this.client.write(message);
};
