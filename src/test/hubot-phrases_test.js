/* eslint-env mocha */
process.env.PORT = 0; // pick a random port for this test
process.env.HUBOT_URL = 'http://localhost/';

const Helper = require('hubot-test-helper');
// helper loads all scripts passed a directory
const helper = new Helper('../scripts');
const co = require('co');
const request = require('supertest-as-promised');

let prefixed = function () { return `${this.room.robot.name}: `; };
let unprefixed = function () { return ''; };

function setupBrain (room, done) {
  room.robot.brain.data.phrases = {
    dammit: {
      readonly: false,
      tidbits: [{ tidbit: 'takes a quarter from $who and places it in the swear jar.', verb: '<action>' }]
    },
    single_action: {
      readonly: false,
      tidbits: [{ tidbit: 'takes a quarter from $who and places it in the swear jar.', verb: '<action>' }]
    },
    readonly: {
      readonly: true,
      tidbits: [{ tidbit: 'readonly.', verb: '<action>' }]
    },
    single: {
      readonly: false,
      tidbits: [{ tidbit: 'takes a quarter from $who and places it in the swear jar.', verb: '<action>' }]
    },
    multiple: {
      readonly: false,
      tidbits: [
        { tidbit: 'response 1.', verb: '<action>' },
        { tidbit: 'response 2.', verb: '<reply>' }
      ]
    },
    large: {
      readonly: false,
      tidbits: Array(11).fill(null).map((elm, idx) => { return { tidbit: `response ${idx}.`, verb: '<action>' }; })
    },
    rofl: {
      readonly: false,
      tidbits: [{ tidbit: 'I am also amused', verb: '<reply>' }]
    },
    lolalias: { readonly: false, alias: 'rofl' }
  };
  room.robot.brain.once('finished_loading_phrases', done);
  room.robot.brain.emit('loaded', room.robot.brain.data);
}

describe('#Commands', function () {
  [['Addressed', prefixed], ['Not Addressed', unprefixed]].forEach(type =>
    describe(type[0], function () {
      describe('#Randoms', function () {
        let room = null;
        before(done => {
          room = helper.createRoom();
          room.robot.brain.data.phrases = {
            dammit: {
              readonly: false,
              tidbits: [{
                tidbit: 'takes a quarter from $who' +
                        ' and places it in the swear jar.',
                verb: '<action>'
              }]
            }
          };
          room.robot.brain.once('finished_loading_phrases', done);
          room.robot.brain.emit('loaded', room.robot.brain.data);
        });

        after(function () {
          room.destroy();
          room = null;
        });

        describe('#something random', function () {
          before(function () { return room.user.say('halkeye', 'something random'); });

          it('#outputs text', function () { room.messages.should.not.be.empty; });
          it('#outputs quarter', () =>
            room.messages.slice(-2).should.eql([
              [ 'halkeye', 'something random' ],
              [ 'hubot', 'takes a quarter from $who and places it in the swear jar.' ]
            ])
          );
        });

        describe('#do something', function () {
          before(function () { return room.user.say('halkeye', 'do something'); });
          it('#outputs text', function () { return room.messages.should.not.be.empty; });
          it('#outputs quarter', () =>
            room.messages.slice(-2).should.eql([
              [ 'halkeye', 'do something' ],
              [ 'hubot', 'takes a quarter from $who and places it in the swear jar.' ]
            ])
          );
        });
        describe('#do something addressed', function () {
          before(function () { return room.user.say('halkeye', 'hubot do something'); });
          it('#outputs text', function () { room.messages.should.not.be.empty; });
          it('#outputs quarter', () =>
            room.messages.slice(-2).should.eql([
              [ 'halkeye', 'hubot do something' ],
              [ 'hubot', 'takes a quarter from $who and places it in the swear jar.' ]
            ])
          );
        });
      });

      describe('#Adding', () =>
        ['is', 'are', 'is also'].forEach(isare => {
          return describe(`#${isare} something`, function () {
            after(function () { this.room.destroy(); });
            before(function () {
              this.room = helper.createRoom();
              this.room.robot.brain.data.phrases = {};
              let promise = new Promise(resolve => {
                this.room.robot.brain.once('finished_loading_phrases', resolve);
                return this.room.robot.brain.emit('loaded', this.room.robot.brain.data);
              });
              return promise.then(() => {
                return this.room.user.say(
                  'halkeye', `${type[1].call(this)}${isare}.something ${isare} moocow`
                );
              });
            });

            it('#outputs okay', function () {
              return this.room.messages.should.eql([
                ['halkeye', `${type[1].call(this)}${isare}.something ${isare} moocow`],
                ['hubot', '@halkeye Okay.']
              ]);
            });
            return it('#brain phrases updated', function () {
              this.room.robot.phrase.facts.should.not.be.empty;
              this.room.robot.phrase.facts[`${isare}.something`].name.should.be.eql(`${isare}.something`);
              this.room.robot.phrase.facts[`${isare}.something`].tidbits.should.be.eql([ { tidbit: 'moocow', verb: isare.replace(' also', '') } ]);
            });
          });
        })
      );
    })
  );
  describe('#literal', function () {
    afterEach(function () { this.room.destroy(); });
    beforeEach(function (done) {
      this.room = helper.createRoom();
      setupBrain(this.room, done);
    });
    describe('single_action', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot literal single_action');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot literal single_action'],
          ['hubot', '@halkeye single_action (1): <action> takes a quarter from $who and places it in the swear jar.']
        ]);
      });
    });
    describe('multiple', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot literal multiple');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot literal multiple'],
          ['hubot', '@halkeye multiple (2): <action> response 1.|<reply> response 2.']
        ]);
      });
    });
    describe('large', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot literal large');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot literal large'],
          ['hubot', '@halkeye http://localhost/hubot/phrase/large']
        ]);
      });
    });
  });

  describe('#What was that', function () {
    afterEach(function () { this.room.destroy(); });
    beforeEach(function (done) {
      this.room = helper.createRoom();
      setupBrain(this.room, done);
    });

    describe('#basic', function () {
      beforeEach(function () {
        this.room.robot.phrase.last_phrase = null;
        return this.room.user.say('halkeye', 'dammit').then(() => {
          return this.room.user.say('halkeye', `${this.room.robot.name}: what was that`);
        });
      });
      describe('', function () {
        it('responding to phrase', function () {
          return this.room.messages.slice(0, 2).should.eql([
            ['halkeye', 'dammit'],
            ['hubot', 'takes a quarter from $who and places it in the swear jar.']
          ]);
        });
        return it('responding to "what was that"', function () {
          return this.room.messages.slice(-2).should.eql([
            ['halkeye', 'hubot: what was that'],
            ['hubot', '@halkeye That was \'dammit\' (#0): <action> takes a quarter from $who and places it in the swear jar.']
          ]);
        });
      });
    });

    describe('#something random', function () {
      beforeEach(function () {
        this.room.robot.phrase.last_phrase = null;
        return this.room.user.say('halkeye', 'something random').then(() => {
          return this.room.user.say('halkeye', `${this.room.robot.name}: what was that`);
        });
      });
      describe('', function () {
        it('responded at all', function () {
          return this.room.messages.should.not.be.empty;
        });
        return it('responding to "what was that"', function () {
          this.room.messages[3].should.not.be.empty;
          return this.room.messages[3][1].should.match(new RegExp('^@halkeye That was'));
        });
      });
    });

    describe('#alias', function () {
      beforeEach(function () {
        this.room.robot.phrase.last_phrase = null;
        return this.room.user.say('halkeye', 'lolalias').then(() => {
          return this.room.user.say('halkeye', `${this.room.robot.name}: what was that`);
        });
      });
      describe('', function () {
        it('responded at all', function () {
          return this.room.messages.should.not.be.empty;
        });
        it('responding to phrase', function () {
          return this.room.messages.slice(0, 2).should.eql([
            ['halkeye', 'lolalias'],
            ['hubot', 'I am also amused']
          ]);
        });
        it('responding to "what was that"', function () {
          this.room.messages[3].should.not.be.empty;
          return this.room.messages[3][1].should.eql("@halkeye That was 'lolalias' => 'rofl' (#0): <reply> I am also amused");
        });
      });
    });
  });
  describe('#forget', function () {
    afterEach(function () { this.room.destroy(); });
    beforeEach(function (done) {
      this.room = helper.createRoom();
      setupBrain(this.room, done);
    });
    describe('old delete syntax', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot forget #1');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot forget #1'],
          ['hubot', '@halkeye Sorry, syntax is now "forget <phrase>#<index from 0>" or "forget that"']
        ]);
      });
    });
    describe('deleting the only tidbit', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot forget single#1');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot forget single#1'],
          ['hubot', '@halkeye Deleted tidbit: <action>|takes a quarter from $who and places it in the swear jar.']
        ]);
        this.room.robot.brain.data.phrases.should.not.have.property('single');
      });
    });
    describe('deleting 0 based tidbit', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot forget single#0');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot forget single#0'],
          ['hubot', '@halkeye Sorry, you must provide a number greater than 0 (as this is 1 based)']
        ]);
      });
    });
    describe('deleting missing based tidbit', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot forget single#8');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot forget single#8'],
          ['hubot', "@halkeye Can't find tidbit #8"]
        ]);
      });
    });
    describe('deleting one of multiple tidbits', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot forget multiple#2');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot forget multiple#2'],
          ['hubot', '@halkeye Deleted tidbit: <reply>|response 2.']
        ]);
        this.room.robot.brain.data.phrases.should.have.property('multiple');
        this.room.robot.brain.data.phrases.multiple.should.have.property('tidbits');
      });
    });
    describe('delete missing phrase', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot forget doesnotexist#1');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot forget doesnotexist#1'],
          ['hubot', '@halkeye No such phrase']
        ]);
      });
    });
    describe('deleting non editable tidbit', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot forget readonly#2');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot forget readonly#2'],
          ['hubot', "@halkeye Sorry, you don't have permissions to edit 'readonly'."]
        ]);
        this.room.robot.brain.data.phrases.should.have.property('readonly');
        this.room.robot.brain.data.phrases.readonly.should.have.property('tidbits');
      });
    });
  });
  describe('#url', function () {
    afterEach(function () { this.room.destroy(); });
    beforeEach(function (done) {
      this.room = helper.createRoom();
      setupBrain(this.room, done);
    });
    it('lookup existing phrase', co.wrap(function *() {
      const res = yield request(this.room.robot.server)
        .get('/hubot/phrase/single');
      res.text.should.eql('Factoid: [single]\nProtected: false\n\nTidbits:\n<action>|takes a quarter from $who and places it in the swear jar.');
    }));
    it('lookup existing large', co.wrap(function *() {
      const res = yield request(this.room.robot.server)
        .get('/hubot/phrase/large');
      res.text.should.eql('Factoid: [large]\nProtected: false\n\nTidbits:\n<action>|response 0.\n<action>|response 1.\n<action>|response 2.\n<action>|response 3.\n<action>|response 4.\n<action>|response 5.\n<action>|response 6.\n<action>|response 7.\n<action>|response 8.\n<action>|response 9.\n<action>|response 10.');
    }));
    it('lookup missing phrase', co.wrap(function *() {
      const res = yield request(this.room.robot.server)
        .get('/hubot/phrase/missing');
      res.text.should.eql('Not Found');
    }));
  });
  describe('#alias', function () {
    afterEach(function () { this.room.destroy(); });
    beforeEach(function (done) {
      this.room = helper.createRoom();
      setupBrain(this.room, done);
    });
    describe('good clean alias', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot alias dammit2 => dammit');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot alias dammit2 => dammit'],
          ['hubot', '@halkeye Okay.']
        ]);
        this.room.robot.brain.data.phrases.should.have.property('dammit2');
      });
    });
    describe('trying to alias to existing', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot alias single_action => dammit');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot alias single_action => dammit'],
          ['hubot', "@halkeye Sorry, there is already a phrase for 'single_action'."]
        ]);
      });
    });
    describe('trying to alias to readonly', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot alias aliased_one => readonly');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot alias aliased_one => readonly'],
          ['hubot', '@halkeye Sorry, that phrase is protected']
        ]);
        this.room.robot.brain.data.phrases.should.not.have.property('aliased_one');
      });
    });
    describe('missing phrase', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot alias aliased_one => notaphrase');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot alias aliased_one => notaphrase'],
          ['hubot', "@halkeye Sorry, there is no phrase for the target 'notaphrase'."]
        ]);
        this.room.robot.brain.data.phrases.should.not.have.property('aliased_one');
      });
    });
  });
  describe('#protect', function () {
    afterEach(function () { this.room.destroy(); });
    beforeEach(function (done) {
      this.room = helper.createRoom();
      setupBrain(this.room, done);
    });
    describe('missing phrase', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot protect notaphrase');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot protect notaphrase'],
          ['hubot', '@halkeye No such phrase.']
        ]);
        this.room.robot.brain.data.phrases.readonly.should.have.property('readonly', true);
      });
    });
    describe('already protected', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot protect readonly');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot protect readonly'],
          ['hubot', '@halkeye I already had it that way.']
        ]);
        this.room.robot.brain.data.phrases.readonly.should.have.property('readonly', true);
      });
    });
    describe('protecting item', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot protect dammit');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot protect dammit'],
          ['hubot', '@halkeye Okay.']
        ]);
        this.room.robot.brain.data.phrases.dammit.should.have.property('readonly', true);
      });
    });
  });
  describe('#unprotect', function () {
    afterEach(function () { this.room.destroy(); });
    beforeEach(function (done) {
      this.room = helper.createRoom();
      setupBrain(this.room, done);
    });
    describe('missing phrase', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot unprotect notaphrase');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot unprotect notaphrase'],
          ['hubot', '@halkeye No such phrase.']
        ]);
        this.room.robot.brain.data.phrases.readonly.should.have.property('readonly', true);
      });
    });
    describe('already unprotected', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot unprotect dammit');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot unprotect dammit'],
          ['hubot', '@halkeye I already had it that way.']
        ]);
        this.room.robot.brain.data.phrases.dammit.should.have.property('readonly', false);
      });
    });
    describe('unprotecting item', function () {
      beforeEach(function () {
        return this.room.user.say('halkeye', 'hubot unprotect readonly');
      });
      it('respond something', function () {
        this.room.messages.should.eql([
          ['halkeye', 'hubot unprotect readonly'],
          ['hubot', '@halkeye Okay.']
        ]);
        this.room.robot.brain.data.phrases.readonly.should.have.property('readonly', false);
      });
    });
  });
});

// halkeye: That was 'give me a weapon' (#863): <action> gives $weapon to $who;  vars used: { 'weapon' => [ 'a Biggoron Sword' ]};.
// robot.hear /^(.*?)\s+(<\w+(?:'t)?>)\s*(.*)()/i, robot.phrase.setAddressed
// robot.hear /^(.*?)(<'s>)\s+(.*)()/i, robot.phrase.setAdressed
// robot.hear /^(.*)\??$/, (msg) =>
// robot.respond /(?:do something|something random)$/, (msg) =>
// robot.respond /forget that$/, (msg) =>
// robot.respond /what was that\??$/, (msg) ->
// robot.respond /(.*?)\s+(<\w+(?:'t)?>)\s*(.*)()/i, robot.phrase.setAddressed
// robot.respond /(.*?)(<'s>)\s+(.*)()/i, robot.phrase.set
