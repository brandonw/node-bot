'use strict';

const assert = require('assert');
const ircbot = require('../lib/ircbot');


describe('irc Bot', function() {
    describe('constructor', function() {
        it('should return a properly instantiated instance of IRCBot', function() {
            let bot = ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            assert.equal(bot.host, 'host');
            assert.equal(bot.port, 123);
            assert.equal(bot.secure, false);
            assert.equal(bot.nick, 'nick');
            assert.equal(bot.channel, 'channel');
        });
    });
});
