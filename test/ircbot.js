'use strict';

const assert = require('assert');
const sinon = require('sinon');
const net = require('net');
const tls = require('tls');
const ircbot = require('../lib/ircbot');


describe('ircbot.IRCBot', function() {
    before(function() {
        this.consoleLogStub = sinon.stub(console, "log");
        this.netConnectStub = sinon.stub(net, "connect");
        this.tlsConnectStub = sinon.stub(tls, "connect");
    });
    after(function() {
        this.consoleLogStub.restore();
        this.netConnectStub.restore();
        this.tlsConnectStub.restore();
    });

    describe('#constructor', function() {
        it('should return a properly instantiated instance of IRCBot', function() {
            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            assert.equal(bot.host, 'host');
            assert.equal(bot.port, 123);
            assert.equal(bot.secure, false);
            assert.equal(bot.nick, 'nick');
            assert.equal(bot.channel, '#channel');
            assert.equal(bot._networkModule, net);
            assert.equal(bot._sentNick, false);
            assert.equal(bot._joinedChannel, false);

            bot = new ircbot.IRCBot('host', 123, true, 'nick', '#channel');
            assert.equal(bot._networkModule, tls);
        });
    });
    describe('#connect', function() {
        it('should create insecure connection', function() {
            let client = {
                on: sinon.spy()
            };
            this.netConnectStub.returns(client);
            this.netConnectStub.callsArg(2);

            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            bot.processMessage = sinon.spy();
            bot.connect();
            assert.ok(this.consoleLogStub.calledWithExactly('-- Connected to host:123'));

            assert.ok(client.on.calledTwice);
            assert.equal(client.on.firstCall.args[0], 'data');
            // force function call to verify we have the correct function hooked up
            client.on.firstCall.args[1].call(bot, 'test');
            assert.ok(bot.processMessage.calledOnceWithExactly('test'));

            assert.equal(client.on.secondCall.args[0], 'close');
            client.on.secondCall.args[1].call(bot, false);
            assert.ok(this.consoleLogStub.calledWithExactly('-- Exiting'));
        });
        it('should create secure connection', function() {
            let client = {
                on: sinon.spy()
            };
            this.tlsConnectStub.returns(client);
            this.tlsConnectStub.callsArg(2);

            let bot = new ircbot.IRCBot('host', 123, true, 'nick', '#channel');
            bot.processMessage = sinon.spy();
            bot.connect();
            assert.ok(this.consoleLogStub.calledWithExactly('-- Securely connected to host:123'));

            assert.ok(client.on.calledTwice);
            assert.equal(client.on.firstCall.args[0], 'data');
            // force function call to verify we have the correct function hooked up
            client.on.firstCall.args[1].call(bot, 'test');
            assert.ok(bot.processMessage.calledOnceWithExactly('test'));

            assert.equal(client.on.secondCall.args[0], 'close');
            client.on.secondCall.args[1].call(bot, true);
            assert.ok(this.consoleLogStub.calledWithExactly('-- Exiting due to transmission error.'));
        });
    });
});
