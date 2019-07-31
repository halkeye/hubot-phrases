// Description:
//   phrase (responses) support for hubot
//
// Dependencies:
//   None
//
// Configuration:
//   HUBOT_URL - Base url instead of hostname:port, ex: "http://hubot.kodekoan.com"
//
// URLS:
//   /hubot/phrase/:phrase
//
// Commands:
//    hubot literal <phrase> - Outputs information about a phrase. if greater than 10 tidbits, then output a url instead
//    hubot do something|something random - output a random phrase
//    hubot forget <phrase>#<num> - Deletes the <num>th response of <phrase>
//    hubot forget that - Deletes the last used response
//    hubot what was that - Outputs what the last phrase was
//    hubot X <reply>|<action>|is Y - Sets a response for X to be Y
//    <phrase> - Outputs a random tidbit/reply that matches <phrase>
//
// Notes:
//   Copyright (c) 2013,2016 Gavin Mogan
//   Licensed under the MIT license.
//
// Author:
//   halkeye

const util = require('util');
const os = require('os');
const assert = require('assert');

function cleanPhraseName (name) {
  return (name || '').trim().replace(/[?.,/#!$%^&*;:{}=_`~()-]/g, '').toLowerCase();
}

module.exports = function Plugin (robot) {
  class Factoid {
    constructor (name, data) {
      if (!data) {
        data = {};
      }
      this.name = name;
      assert.ok(name);
      this.fact = data.fact || name;
      this.tidbits = [];
      this.alias = false;
      this.readonly = false;
      if (data.readonly === true) {
        this.readonly = data.readonly;
      }
      if (data.alias) {
        this.alias = data.alias;
      } else if (data.tidbits) {
        for (const tid of data.tidbits) {
          this.tidbits.push(tid);
        }
      }
    }

    canAlias (user) {
      // FIXME - op only commands according to bucket
      return this.canEdit(user);
    }

    canEdit (user) {
      if (user.roles) {
        if (user.roles.includes('edit_phrases')) {
          return true;
        }
        if (user.roles.includes(`edit_phrase_${this.name}`)) {
          return true;
        }
      }
      if (this.readonly) {
        return false;
      }
      return true;
    }

    tidbit () {
      return this.tidbits[Math.floor(Math.random() * this.tidbits.length)];
    }

    toObj () {
      if (this.alias) {
        return {
          alias: this.alias,
          fact: this.fact,
          readonly: this.readonly
        };
      }
      return {
        fact: this.fact,
        readonly: this.readonly,
        tidbits: this.tidbits
      };
    }

    save () {
      const phrases = robot.brain.get('phrases') || {};
      const phrase = phrases[this.name] = this.toObj();
      if (!phrase.alias && !phrase.tidbits.length) {
        delete phrases[this.name];
      }
      robot.brain.set('phrases', phrases);
    }
  }

  class FactoidHandler {
    constructor () {
      this.alias = this.alias.bind(this);
      this.setAddressed = this.setAddressed.bind(this);
      this.set = this.set.bind(this);
      this.handlerGetAddressed = this.handlerGetAddressed.bind(this);
      this.handlerGet = this.handlerGet.bind(this);

      this.stats = {};
      this.last_phrase = {};
      robot.brain.on('loaded', (data = { _private: {} }) => {
        robot.brain.emit('finished_loading_phrases');
      });
    }

    hasFacts () {
      return Object.keys(robot.brain.get('phrases') || {}).length;
    }

    get (str, history) {
      if (!this.hasFacts()) { return; }
      const phrases = robot.brain.get('phrases');
      if (!phrases || !phrases[str]) { return; }
      const phrase = new Factoid(str, phrases[str]);
      if (!phrase) { return; }
      robot.logger.debug(util.inspect(phrase));
      if (history) { history.push(phrase); }
      if (phrase.alias) { return this.get(phrase.alias, history); }
      return phrase;
    }

    random (history) {
      if (!this.hasFacts()) { return; }
      const keys = Object.keys(robot.brain.get('phrases'));
      const phrase = keys[Math.floor(Math.random() * keys.length)];
      return this.get(phrase, history);
    }

    output (msg, phrase, history) {
      const tidbit = phrase.tidbit();
      const outputHistory = { phrase, tidbit };
      // FIXME this should be per room
      if (history) { history.push(outputHistory); }
      let output = tidbit.tidbit;
      if (robot.variables != null) {
        output = robot.variables.process(output, msg.message.user, outputHistory);
      }
      if (tidbit.verb === '<reply>') {
        return msg.send(output);
      } else if (tidbit.verb === '<action>') {
        if (msg.emote != null) {
          return msg.emote(output);
        } else {
          return msg.send(`/me ${output}`);
        }
      } else if (tidbit.verb === 'is' && phrase.name.toLowerCase() === robot.name.toLowerCase()) {
        return msg.send(`I am ${output}`);
      } else {
        return msg.send([phrase.fact, tidbit.verb, output].join(' '));
      }
    }

    alias (msg) {
      const srcName = cleanPhraseName(msg.match[1]);
      const targetName = cleanPhraseName(msg.match[2]);
      const src = robot.phrase.get(srcName);
      if (src) {
        msg.reply(`Sorry, there is already a phrase for '${srcName}'.`);
        return;
      }
      const target = robot.phrase.get(targetName);
      if (!target) {
        msg.reply(`Sorry, there is no phrase for the target '${targetName}'.`);
        return;
      }
      if (!target.canAlias(msg.message.user)) {
        robot.logger.debug(`${src} is a protected phrase`);
        msg.reply('Sorry, that phrase is protected');
        return;
      }
      msg.finish();
      robot.logger.info(`${msg.message.user.name} aliased '${srcName}' to '${targetName}'`);
      var phrase = new Factoid(srcName);
      phrase.creator = msg.message.user.name;
      phrase.room = msg.message.user.room;
      phrase.alias = targetName;
      phrase.save();
      msg.reply('Okay.');
    }

    setAddressed (msg) {
      msg.message.addressed = true;
      return this.set(msg);
    }

    set (msg) {
      msg.finish(); // we are adding a message, so ignore any other handler type
      let fact = msg.match[1].trim();
      let verb = msg.match[2].trim();
      let tidbit = msg.match[3].trim();
      const forced = !!msg.match[4];
      if (!msg.message.addressed && /^[^a-zA-Z]*<.?\S+>/.test(fact)) {
        robot.logger.debug('Not learning from what seems to be an IRC quote: $fact');
        return;
      }
      if (!msg.message.addressed && !forced && /=~/.test(fact)) {
        robot.logger.debug('Not learning what looks like a botched =~ query');
        msg.reply('Fix your =~ command.');
        return;
      }

      if (fact === 'you' && verb === 'are') {
        fact = robot.name;
        verb = 'is';
      } else if (fact === 'I' && verb === 'am') {
        fact = msg.message.user.name;
        verb = 'is';
      }

      this.stats.learn++;
      const matches = tidbit.match(/^<(action|reply)>\s*(.*)/);
      if (matches) {
        verb = `<${matches[1]}>`;
        tidbit = matches[2];
      } else if (verb === 'is also') {
        verb = 'is';
      } else if (forced) {
        if (verb !== '<action>' && verb !== '<reply>') {
          verb = verb.replace(/^<|>$/, '');
        }
        if (!/\sis\salso$/.test(fact)) {
          fact.replace(/\sis$/, '');
        }
      }

      if (verb.toLowerCase === '<alias>') {
        msg.reply("please use the 'alias' command.");
        return;
      }

      const originalFactName = fact.trim();
      fact = cleanPhraseName(fact);
      robot.logger.debug(`Learning ${fact} ${verb} ${tidbit}`);

      if (fact.toLowerCase() === msg.message.user.name.toLowerCase() || fact.toLowerCase() === msg.message.user.name.toLowerCase() + ' quotes') {
        robot.logger.debug(`Not allowing ${msg.message.user.name} to edit his own phrase`);
        msg.reply("Please don't edit your own phrases.");
        return;
      }

      let phrase = this.get(fact);
      if (!phrase) {
        phrase = new Factoid(fact);
        phrase.fact = originalFactName;
        phrase.creator = msg.message.user.name;
        phrase.room = msg.message.user.room;
      } else if (!phrase.canEdit(msg.message.user)) {
        robot.logger.debug(`${phrase} that phrase is protected`);
        msg.reply('Sorry, that phrase is protected');
        return;
      }

      for (const t of phrase.tidbits) {
        if (tidbit.toLowerCase() === t.tidbit.toLowerCase()) {
          msg.reply('I already had it that way');
          return;
        }
      }

      phrase.tidbits.push({
        tidbit: tidbit,
        verb: verb,
        creator: msg.message.user.name,
        room: msg.message.user.room
      });
      phrase.save();
      robot.logger.debug(`${msg.message.user.name} taught in ${msg.message.user.room} ${phrase.tidbits.length} '${fact}', '${verb}' '${tidbit}'`);
      if (msg.message.addressed) {
        return msg.reply('Okay.');
      }
    }

    handlerLiteral (msg) {
      // page - http://wiki.xkcd.com/irc/bucket#Listing_phrases
      const phraseName = cleanPhraseName(msg.match[2]);
      const phrase = robot.phrase.get(phraseName);
      if (!phrase) {
        msg.reply('No such phrase');
        return;
      }
      msg.finish();
      if (phrase.tidbits.length > 10) {
        const baseurl = (process.env.HUBOT_URL || (`http://${os.hostname()}:${robot.server.address().port}`)).replace(/\/+$/, '');
        msg.reply(baseurl + '/' + robot.name + '/phrase/' + encodeURIComponent(phraseName));
        return;
      }
      const response = [];
      phrase.tidbits.forEach(tidbit => response.push(`${tidbit.verb} ${tidbit.tidbit}`));
      return msg.reply(`${phrase.name} (${phrase.tidbits.length}): ${response.join('|')}`);
    }

    handlerGetAddressed (msg) {
      msg.message.addressed = true;
      return this.handlerGet(msg);
    }

    handlerGet (msg) {
      const phraseName = cleanPhraseName(msg.match[1]);
      // FIXME this should be per room
      const history = [];
      const phrase = robot.phrase.get(phraseName, history);
      if (!phrase) { return; }
      robot.phrase.output(msg, phrase, history);
      msg.finish();
      if (history.length > 0) {
        robot.phrase.last_phrase = history;
      }
    }
  }

  robot.phrase = new FactoidHandler();
  robot.phrase.last_phrase = null;

  robot.respond(/(?:do something|something random)$/, msg => {
    const history = [];
    const phrase = robot.phrase.random(history);
    robot.phrase.output(msg, phrase, history);
    if (history.length > 0) { robot.phrase.last_phrase = history; }
  });

  robot.hear(/^(?:do something|something random)$/, msg => {
    const history = [];
    const phrase = robot.phrase.random(history);
    robot.phrase.output(msg, phrase, history);
    if (history.length > 0) { robot.phrase.last_phrase = history; }
  });

  robot.respond(/(un)?protect\s*(.*)$/, msg => {
    const protect = !msg.match[1];
    const phraseName = cleanPhraseName(msg.match[2]);
    const phrase = robot.phrase.get(phraseName);
    if (!phrase) {
      msg.reply('No such phrase.');
      return;
    }
    msg.finish();
    if (phrase.readonly === protect) {
      msg.reply('I already had it that way.');
      return;
    }
    phrase.readonly = protect;
    phrase.save();
    return msg.reply('Okay.');
  });

  robot.respond(/alias (.*?) => (.*?)$/, robot.phrase.alias);

  robot.router.get(`/${robot.name}/phrase/:phrase`, function (req, res) {
    const phraseName = req.params.phrase;
    const phrase = robot.phrase.get(phraseName);
    if (!phrase) { return res.status(404).send('Not Found'); }
    res.setHeader('content-type', 'text/plain');
    const content = [];
    content.push(`Factoid: [${phraseName}]`);
    content.push(`Protected: ${phrase.readonly ? 'true' : 'false'}`);
    content.push('');
    content.push('Tidbits:');
    for (const tidbit of phrase.tidbits) {
      content.push(tidbit.verb + '|' + tidbit.tidbit);
    }
    res.send(content.join('\n'));
    return res.end;
  });
  // res.send require('util').inspect(req.params)

  robot.respond(/literal(?:\[([*\d]+)])?\s+(.*)$/, robot.phrase.handlerLiteral);
  robot.hear(/^literal(?:\[([*\d]+)])?\s+(.*)$/, robot.phrase.handlerLiteral);

  robot.respond(/forget #(\d+)$/, msg => {
    return msg.reply('Sorry, syntax is now "forget <phrase>#<index from 0>" or "forget that"');
  });

  robot.respond(/forget that$/, msg => {
    return msg.reply('FIXME - not implemented yet');
  });

  robot.respond(/forget (.+)#(\d+)$/, msg => {
    const phraseName = cleanPhraseName(msg.match[1]);
    const tid = parseInt(msg.match[2], 10) - 1;
    const phrase = robot.phrase.get(phraseName);
    if (!phrase) {
      msg.reply('No such phrase');
      return;
    }
    if (!phrase.canEdit(msg.message.user)) {
      msg.reply(`Sorry, you don't have permissions to edit '${phrase.name}'.`);
      return;
    }
    if (tid < 0) {
      msg.reply('Sorry, you must provide a number greater than 0 (as this is 1 based)');
      return;
    }
    if (!phrase.tidbits[tid]) {
      msg.reply(`Can't find tidbit #${tid + 1}`);
      return;
    }
    const tidbit = phrase.tidbits.splice(tid, 1);
    msg.reply(`Deleted tidbit: ${tidbit[0].verb}|${tidbit[0].tidbit}`);
    return phrase.save();
  });

  robot.respond(/what was that\??$/, function (msg) {
    // FIXME this should be per room
    if (!robot.phrase.last_phrase) { return; }
    msg.finish();
    // halkeye: That was 'rofl' (#315): <reply> I am also amused
    // halkeye: That was 'that's what she said' => 'thats what she said' (#65): <reply> No, that's what HE said.
    // halkeye: That was 'give me a weapon' (#863): <action> gives $weapon to $who;  vars used: { 'weapon' => [ 'a Biggoron Sword' ]};.
    const lf = robot.phrase.last_phrase.slice(-1)[0];
    const { name } = lf.phrase;
    const { tidbit } = lf;
    const idx = lf.phrase.tidbits.map(tid => tid.tidbit).indexOf(tidbit.tidbit);

    const response = [];
    response.push('That was');
    if (robot.phrase.last_phrase.length > 2) {
      robot.phrase.last_phrase.slice(0, -2).forEach(fact => response.push(`'${fact.name}' =>`));
    }
    response.push(`'${name}'`);
    response.push(`(#${idx}):`);
    response.push(tidbit.verb);
    response.push(tidbit.tidbit);
    if (lf.vars) {
      response.push(';');
      response.push('vars used:');
      response.push(util.inspect(lf.vars, { depth: null }));
    }
    return msg.reply(response.join(' '));
  });

  robot.respond(/(.*?)\s+(<\w+(?:'t)?>)\s*(.*)()/i, robot.phrase.setAddressed);
  robot.respond(/(.*?)(<'s>)\s+(.*)()/i, robot.phrase.setAddressed);
  robot.respond(/(.*?)\s+(is(?: also)?|are)\s+(.*)/i, robot.phrase.setAddressed);
  robot.hear(/^(.*?)\s+(<\w+(?:'t)?>)\s*(.*)()/i, robot.phrase.set);
  robot.hear(/^(.*?)(<'s>)\s+(.*)()/i, robot.phrase.set);
  robot.hear(/^(.*?)\s+(is(?: also)?|are)\s+(.*)/i, robot.phrase.set);

  // # FIXME, make these loaded once brain is loaded so it doesn't need to do wildcard match
  robot.respond(/(.{3,})$/, robot.phrase.handlerGetAddressed);
  robot.hear(/(.{3,})$/, robot.phrase.handlerGet);
};
module.exports.cleanPhraseName = cleanPhraseName;
