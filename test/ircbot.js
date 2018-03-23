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
    describe('#processMessage', function() {
        it('should create secure connection', function() {
            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            bot.handleMessage = sinon.stub();
            bot._parseMessage = sinon.stub();
            bot._parseMessage.returns('test');

            bot.processMessage('foobar\r\nbazbaff');
            assert.equal(bot.handleMessage.callCount, 2);
            assert.deepEqual(bot.handleMessage.firstCall.args, ['test']);
            assert.deepEqual(bot.handleMessage.secondCall.args, ['test']);

            assert.deepEqual(bot._parseMessage.firstCall.args, ['foobar']);
            assert.deepEqual(bot._parseMessage.secondCall.args, ['bazbaff']);

            assert.ok(this.consoleLogStub.calledWithExactly('<< foobar'));
            assert.ok(this.consoleLogStub.calledWithExactly('<< bazbaff'));
        });
    });
    describe('#handleMessage', function() {
        it('should ID itself if unidentified; should not ID itself if identified', function() {
            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            bot.sendMessage = sinon.stub();
            bot.createMessage = sinon.stub();

            bot.createMessage.returns('test');
            let message = {
                prefix: ':stormlight.esper.net',
                command: 'NOTICE',
                params: '* :*** Looking up your hostname...'
            };
            bot.handleMessage(message);
            assert.equal(bot.createMessage.callCount, 2);
            assert.deepEqual(bot.createMessage.firstCall.args, [null, 'NICK', 'nick']);
            assert.deepEqual(bot.createMessage.secondCall.args, [null, 'USER', 'nick 0 * :nodebot']);
            assert.equal(bot.sendMessage.callCount, 2);
            assert.deepEqual(bot.sendMessage.firstCall.args, ['test']);
            assert.deepEqual(bot.sendMessage.secondCall.args, ['test']);

            bot.sendMessage.resetHistory();
            bot.createMessage.resetHistory();
            message = {
                prefix: ':stormlight.esper.net',
                command: 'NOTICE',
                params: '* :*** Checking Ident'
            };
            bot.handleMessage(message);
            assert.ok(bot.createMessage.notCalled);
            assert.ok(bot.sendMessage.notCalled);
        });
        it('should join channel iff it has not yet joined', function() {
            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            bot.sendMessage = sinon.stub();
            bot.createMessage = sinon.stub();

            bot.createMessage.returns('test');
            let message = {
                prefix: ':stormlight.esper.net',
                command: '001',
                params: 'nodebot :Welcome to the EsperNet Internet Relay Chat Network nodebot'
            };
            bot.handleMessage(message);
            assert.equal(bot.createMessage.callCount, 1);
            assert.deepEqual(bot.createMessage.firstCall.args, [null, 'JOIN', '#channel']);
            assert.equal(bot.sendMessage.callCount, 1);
            assert.deepEqual(bot.sendMessage.firstCall.args, ['test']);

            bot.sendMessage.resetHistory();
            bot.createMessage.resetHistory();
            bot.handleMessage(message);
            assert.ok(bot.createMessage.notCalled);
            assert.ok(bot.sendMessage.notCalled);
        });
        it('should always pong if pinged', function() {
            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            bot.sendMessage = sinon.stub();
            bot.createMessage = sinon.stub();

            bot.createMessage.returns('test');
            let message = {
                prefix: null,
                command: 'PING',
                params: ':FFFFFFFF3E0E30F2'
            };
            bot.handleMessage(message);
            assert.equal(bot.createMessage.callCount, 1);
            assert.deepEqual(bot.createMessage.firstCall.args, [null, 'PONG', ':FFFFFFFF3E0E30F2']);
            assert.equal(bot.sendMessage.callCount, 1);
            assert.deepEqual(bot.sendMessage.firstCall.args, ['test']);

            bot.sendMessage.resetHistory();
            bot.createMessage.resetHistory();
            message = {
                prefix: null,
                command: 'PING',
                params: ':HOWDY'
            };
            bot.handleMessage(message);
            assert.equal(bot.createMessage.callCount, 1);
            assert.deepEqual(bot.createMessage.firstCall.args, [null, 'PONG', ':HOWDY']);
            assert.equal(bot.sendMessage.callCount, 1);
            assert.deepEqual(bot.sendMessage.firstCall.args, ['test']);
        });
        it('should handle private messages', function() {
            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            bot.sendMessage = sinon.stub();
            bot.handlePrivateMessage = sinon.stub();
            bot.createMessage = sinon.stub();

            bot.createMessage.returns('test');
            let message = {
                prefix: ':alias!~name@host.name.com',
                command: 'PRIVMSG',
                params: '#channel :!QUIT message here'
            };
            bot.handleMessage(message);
            assert.ok(bot.createMessage.notCalled);
            assert.ok(bot.sendMessage.notCalled);
            assert.equal(bot.handlePrivateMessage.callCount, 1);
            assert.deepEqual(
                bot.handlePrivateMessage.firstCall.args,
                ['alias!~name@host.name.com', '#channel', '!QUIT', ['message', 'here']]
            );
        });
    });
    describe('#handlePrivateMessage', function() {
        it('should handle QUIT command with args', function() {
            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            bot.sendMessage = sinon.stub();
            bot.createMessage = sinon.stub();

            bot.createMessage.returns('test');
            bot.handlePrivateMessage('alias!~name@host.name.com', '#channel',
                                     '!QUIT', ['message', 'here']);
            assert.equal(bot.createMessage.callCount, 1);
            assert.deepEqual(bot.createMessage.firstCall.args, [null, 'QUIT', ':message here']);
            assert.equal(bot.sendMessage.callCount, 1);
            assert.deepEqual(bot.sendMessage.firstCall.args, ['test']);
        });
        it('should handle QUIT command with no args', function() {
            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            bot.sendMessage = sinon.stub();
            bot.createMessage = sinon.stub();

            bot.createMessage.returns('test');
            bot.handlePrivateMessage('alias!~name@host.name.com', '#channel',
                                     '!QUIT', null);
            assert.equal(bot.createMessage.callCount, 1);
            assert.deepEqual(bot.createMessage.firstCall.args, [null, 'QUIT', ""]);
            assert.equal(bot.sendMessage.callCount, 1);
            assert.deepEqual(bot.sendMessage.firstCall.args, ['test']);
        });
        it('should ignore literally anything else', function() {
            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            bot.sendMessage = sinon.stub();
            bot.createMessage = sinon.stub();

            bot.createMessage.returns('test');
            bot.handlePrivateMessage('alias!~name@host.name.com', '#channel',
                                     'youve', ['won', 'the', 'lottery!']);
            assert.ok(bot.createMessage.notCalled);
            assert.ok(bot.sendMessage.notCalled);
        });
    });
    describe('#_parseMessage', function() {
        it('should properly parse a message with a prefix', function() {
            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            let message = bot._parseMessage(':stormlight.esper.net NOTICE * :*** ' +
                                            'Looking up your hostname...');
            assert.deepEqual(message, {prefix: ':stormlight.esper.net',
                                       command: 'NOTICE',
                                       params: '* :*** Looking up your hostname...'});
        });
        it('should properly parse a message with no prefix', function() {
            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            let message = bot._parseMessage('PING :FFFFFFFF3E0E30F2');
            assert.deepEqual(message, {prefix: null,
                                       command: 'PING',
                                       params: ':FFFFFFFF3E0E30F2'});
        });
    });
    describe('#_createMessage', function() {
        it('should properly create a message with a prefix', function() {
            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            let message = bot.createMessage(':prefix', 'CMD', 'param1 param2 foo bar');
            assert.equal(message, ':prefix CMD param1 param2 foo bar\r\n');
        });
        it('should properly create a message with no prefix', function() {
            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            let message = bot.createMessage(null, 'PONG', ':test');
            assert.equal(message, 'PONG :test\r\n');
        });
        it('should properly create a message with no params', function() {
            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            let message = bot.createMessage(null, '123', null);
            assert.equal(message, '123\r\n');
        });
    });
    describe('#sendMessage', function() {
        it('should handle sending message with multiple linebreaks', function() {
            let client = {
                on: sinon.spy(),
                write: sinon.spy()
            };
            this.netConnectStub.returns(client);

            let bot = new ircbot.IRCBot('host', 123, false, 'nick', '#channel');
            bot.connect();

            bot.sendMessage(':prefix CMD params\r\nfollowup\r\n');
            assert.ok(this.consoleLogStub.calledWithExactly('>> :prefix CMD params\r\n>> followup\r\n'));
        });
    });
});
