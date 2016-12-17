/* eslint-env mocha */
process.env.PORT = 0; // pick a random port for this test
const Helper = require('hubot-test-helper');
// helper loads all scripts passed a directory
let helper = new Helper('../scripts');

let prefixed = () => `${this.room.robot.name}: `;
let unprefixed = () => '';

describe('#Commands', () => {
  [['Addressed', prefixed], ['Not Addressed', unprefixed]].forEach(type =>
    describe(type[0], () => {
      describe('#Randoms', () => {
        let room = null;
        before(done => {
          room = helper.createRoom();
          room.robot.brain.data.factoids = {
            dammit: {
              readonly: false,
              tidbits: [{
                tidbit: 'takes a quarter from $who' +
                        ' and places it in the swear jar.',
                verb: '<action>'
              }]
            }
          };
          room.robot.brain.once('finished_loading_factoids', done);
          room.robot.brain.emit('loaded', room.robot.brain.data);
        });

        after(() => {
          room.destroy();
          room = null;
        });

        describe('#something random', () => {
          before(() => room.user.say('halkeye', 'something random'));

          it('#outputs text', () => room.messages.should.not.be.empty);
          it('#outputs quarter', () =>
            room.messages.slice(-2).should.eql([
              [ 'halkeye', 'something random' ],
              [ 'hubot', 'takes a quarter from $who and places it in the swear jar.' ]
            ])
          );
        });

        describe('#do something', () => {
          before(() => room.user.say('halkeye', 'do something'));
          it('#outputs text', () => room.messages.should.not.be.empty);
          it('#outputs quarter', () =>
            room.messages.slice(-2).should.eql([
              [ 'halkeye', 'do something' ],
              [ 'hubot', 'takes a quarter from $who and places it in the swear jar.' ]
            ])
          );
        });
      });

      describe('#Adding', () =>
        ['is', 'are', 'is also'].forEach(isare => {
          return describe(`#${isare} something`, () => {
            after(() => this.room.destroy());
            before(() => {
              this.room = helper.createRoom();
              this.room.robot.brain.data.factoids = {};
              let promise = new Promise(resolve => {
                this.room.robot.brain.once('finished_loading_factoids', resolve);
                return this.room.robot.brain.emit('loaded', this.room.robot.brain.data);
              });
              return promise.then(() => {
                return this.room.user.say(
                  'halkeye', `${type[1].call(this)}${isare}.something ${isare} moocow`
                );
              });
            });

            it('#outputs okay', () => {
              return this.room.messages.should.eql([
                ['halkeye', `${type[1].call(this)}${isare}.something ${isare} moocow`],
                ['hubot', '@halkeye Okay.']
              ]);
            });
            return it('#brain factoids updated', () => {
              this.room.robot.factoid.facts.should.not.be.empty;
              this.room.robot.factoid.facts[`${isare}.something`].name.should.be.eql(`${isare}.something`);
              this.room.robot.factoid.facts[`${isare}.something`].tidbits.should.be.eql([ { tidbit: 'moocow', verb: isare.replace(' also', '') } ]);
            });
          });
        })
      );
    })
  );

  return describe('#What was that', () => {
    afterEach(() => {
      return this.room.destroy();
    }
    );
    beforeEach(done => {
      this.room = helper.createRoom();
      this.room.robot.brain.data.factoids = {
        dammit: {
          readonly: false,
          tidbits: [{
            tidbit: 'takes a quarter from $who and places it in the swear jar.',
            verb: '<action>'
          }
          ]
        },
        rofl: {
          readonly: false,
          tidbits: [{
            tidbit: 'I am also amused',
            verb: '<reply>'
          }
          ]
        },
        lolalias: {
          readonly: false,
          alias: 'rofl'
        }
      };
      this.room.robot.brain.once('finished_loading_factoids', done);
      return this.room.robot.brain.emit('loaded', this.room.robot.brain.data);
    }
    );

    describe('#basic', () => {
      beforeEach(() => {
        this.room.robot.factoid.last_factoid = null;
        return this.room.user.say('halkeye', 'dammit').then(() => {
          return this.room.user.say('halkeye', `${this.room.robot.name}: what was that`);
        }
        );
      }
      );
      return describe('', () => {
        it('responding to factoid', () => {
          return this.room.messages.slice(0, 2).should.eql([
            ['halkeye', 'dammit'],
            ['hubot', 'takes a quarter from $who and places it in the swear jar.']
          ]);
        }
        );
        return it('responding to "what was that"', () => {
          return this.room.messages.slice(-2).should.eql([
            ['halkeye', 'hubot: what was that'],
            ['hubot', '@halkeye That was \'dammit\' (#0): <action> takes a quarter from $who and places it in the swear jar.']
          ]);
        });
      });
    });

    describe('#something random', () => {
      beforeEach(() => {
        this.room.robot.factoid.last_factoid = null;
        return this.room.user.say('halkeye', 'something random').then(() => {
          return this.room.user.say('halkeye', `${this.room.robot.name}: what was that`);
        });
      });
      return describe('', () => {
        it('responded at all', () => {
          return this.room.messages.should.not.be.empty;
        });
        return it('responding to "what was that"', () => {
          this.room.messages[3].should.not.be.empty;
          return this.room.messages[3][1].should.match(new RegExp('^@halkeye That was'));
        });
      });
    });

    return describe('#alias', () => {
      beforeEach(() => {
        this.room.robot.factoid.last_factoid = null;
        return this.room.user.say('halkeye', 'lolalias').then(() => {
          return this.room.user.say('halkeye', `${this.room.robot.name}: what was that`);
        });
      });
      return describe('', () => {
        it('responded at all', () => {
          return this.room.messages.should.not.be.empty;
        });
        it('responding to factoid', () => {
          return this.room.messages.slice(0, 2).should.eql([
            ['halkeye', 'lolalias'],
            ['hubot', 'I am also amused']
          ]);
        });
        return it('responding to "what was that"', () => {
          this.room.messages[3].should.not.be.empty;
          return this.room.messages[3][1].should.eql("@halkeye That was 'lolalias' => 'rofl' (#0): <reply> I am also amused");
        });
      });
    });
  });
});

// halkeye: That was 'give me a weapon' (#863): <action> gives $weapon to $who;  vars used: { 'weapon' => [ 'a Biggoron Sword' ]};.
// robot.hear /^(.*?)\s+(<\w+(?:'t)?>)\s*(.*)()/i, robot.factoid.setAddressed
// robot.hear /^(.*?)(<'s>)\s+(.*)()/i, robot.factoid.setAdressed
// robot.hear /^(.*)\??$/, (msg) =>
// robot.respond /(?:do something|something random)$/, (msg) =>
// robot.respond /(un)?protect\s*(.*)$/, (msg) =>
// robot.respond /alias (.*?) => (.*?)$/, robot.factoid.alias
// robot.respond /literal(?:\[([*\d]+)\])?\s+(.*)$/, (msg) =>
// robot.respond /forget #(\d+)$/, (msg) =>
// robot.respond /forget that$/, (msg) =>
// robot.respond /forget (.*)#(\d+)$/, (msg) =>
// robot.respond /what was that\??$/, (msg) ->
// robot.respond /(.*?)\s+(<\w+(?:'t)?>)\s*(.*)()/i, robot.factoid.setAddressed
// robot.respond /(.*?)(<'s>)\s+(.*)()/i, robot.factoid.set
// robot.router.get '/#{@room.robot.name}/factoid/:factoid', (req, res) ->