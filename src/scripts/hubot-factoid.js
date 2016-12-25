// Description:
//   factoid (responses) support for hubot
//
// Dependencies:
//   None
//
// Configuration:
//   HUBOT_URL - Base url instead of hostname:port, ex: "http://hubot.kodekoan.com"
//
// URLS:
//   /hubot/factoid/:factoid
//
// Commands:
//   hubot literal <factoid> - Outputs information about a factoid. Right now only the url
//   hubot do something - see something random
//   hubot something random - see somethin random
//   do something - see something random
//   something random - Outputs a random factoid
//   hubot forget <factoid>#<num> - Deletes the <num>th response of <factoid>
//   hubot forget that - Deletes the last used response
//   hubot what was that - Outputs what the last factoid was
//   <factoid> - Outputs a random reply that matches <factoid>
//
// Notes:
//   Copyright (c) 2013 Gavin Mogan
//   Licensed under the MIT license.
//
// Author:
//   halkeye

const util = require('util');
const os = require('os');

module.exports = function Plugin (robot) {
  class Factoid {
    constructor (name, data) {
      if (!data) {
        data = {};
      }
      this.name = name;
      this.tidbits = [];
      this.alias = false;
      this.readonly = true;
      if ((data.readonly != null) && data.readonly === false) {
        this.readonly = false;
      }
      if (data.alias) {
        this.alias = data.alias;
      } else if (data.tidbits) {
        for (let tid of data.tidbits) {
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
        if (user.roles.includes('edit_factoids')) {
          return true;
        }
        if (user.roles.includes(`edit_factoid_${this.name}`)) {
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
    addTidbit (tidbit, verb) {
      // FIXME - add validation
      return this.tidbits.push({
        tidbit,
        verb
      });
    }

    toObj () {
      if (this.alias) {
        return {
          alias: this.alias,
          readonly: this.readonly
        };
      }
      return {
        readonly: this.readonly,
        tidbits: this.tidbits
      };
    }
    save () {
      robot.brain.data.factoids[this.name] = this.toObj();
      if (!robot.brain.data.factoids[this.name].tidbits.length) {
        delete robot.brain.data.factoids[this.name];
      }
    }
  }

  class FactoidHandler {
    constructor () {
      this.alias = this.alias.bind(this);
      this.setAddressed = this.setAddressed.bind(this);
      this.set = this.set.bind(this);
      this.stats = {};
      this.facts = {};
      this.last_factoid = {};
      robot.brain.on('loaded', data => {
        this.facts = {};
        if (robot.brain.data.factoids) {
          robot.logger.info('Loading saved factoids');
          let keys = Object.keys(data.factoids);
          for (let key of keys) {
            this.facts[key] = new Factoid(key, data.factoids[key]);
          }
        }
        return robot.brain.emit('finished_loading_factoids');
      }
      );
    }
    hasFacts () {
      return Object.keys(this.facts).length;
    }
    get (str, history) {
      if (!this.hasFacts()) { return; }
      let factoid = this.facts[str];
      if (!factoid) { return; }
      robot.logger.debug(util.inspect(factoid));
      if (history) { history.push(factoid); }
      if (factoid.alias) { return this.get(factoid.alias, history); }
      return factoid;
    }
    random (history) {
      if (!this.hasFacts()) { return; }
      let keys = Object.keys(this.facts);
      let factoid = keys[Math.floor(Math.random() * keys.length)];
      return this.get(factoid, history);
    }
    output (msg, factoid, history) {
      let tidbit = factoid.tidbit();
      let outputHistory = { factoid, tidbit };
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
      } else if (tidbit.verb === 'is' && factoid.name.toLowerCase() === robot.name.toLowerCase()) {
        return msg.send(`I am ${output}`);
      } else {
        return msg.send([factoid.name, tidbit.verb, output].join(' '));
      }
    }
    alias (msg) {
      let srcName = msg.match[1].trim();
      let targetName = msg.match[2].trim();
      let src = robot.factoid.get(srcName);
      if (src) {
        msg.reply(`Sorry, there is already a factoid for '${srcName}'.`);
        return;
      }
      let target = robot.factoid.get(targetName);
      if (!target) {
        msg.reply(`Sorry, there is no factoid for the target '${targetName}'.`);
        return;
      }
      if (!target.canAlias(msg.message.user)) {
        robot.logger.debug(`${factoid} that factoid is protected`);
        msg.reply('Sorry, that factoid is protected');
        return;
      }
      msg.finish();
      robot.logger.info(`${msg.message.user.name} aliased '${srcName}' to '${targetName}'`);
      var factoid = this.facts[srcName] = new Factoid(srcName);
      factoid.alias = targetName;
      factoid.save();
      return msg.reply('Okay.');
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
      let forced = !!msg.match[4];
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
      let matches = tidbit.match(/^<(action|reply)>\s*(.*)/);
      var also;
      if (matches) {
        verb = `<${matches[1]}>`;
        tidbit = matches[2];
      } else if (verb === 'is also') {
        also = 1;
        verb = 'is';
      } else if (forced) {
        if (verb !== '<action>' && verb !== '<reply>') {
          verb = verb.replace(/^<|>$/, '');
        }
        if (/\sis\salso$/.test(fact)) {
          also = 1;
        } else {
          fact.replace(/\sis$/, '');
        }
      }

      if (verb.toLowerCase === '<alias>') {
        msg.reply("please use the 'alias' command.");
        return;
      }

      fact = fact.trim();
      robot.logger.debug(`Learning ${fact} ${verb} ${tidbit}`);

      if (fact.toLowerCase() === msg.message.user.name.toLowerCase() || fact.toLowerCase() === msg.message.user.name.toLowerCase() + ' quotes') {
        robot.logger.debug(`Not allowing ${msg.message.user.name} to edit his own factoid`);
        msg.reply("Please don't edit your own factoids.");
        return;
      }

      let factoid = this.get(fact);
      if (!factoid) {
        factoid = this.facts[fact] = new Factoid(fact);
      } else if (!factoid.canEdit(msg.message.user)) {
        robot.logger.debug(`${factoid} that factoid is protected`);
        msg.reply('Sorry, that factoid is protected');
        return;
      }

      for (let t of factoid.tidbits) {
        if (tidbit.toLowerCase() === t.tidbit.toLowerCase()) {
          msg.reply('I already had it that way');
          return;
        }
      }

      factoid.addTidbit(tidbit, verb);
      factoid.tidbits.push;
      factoid.save();
      robot.logger.debug(`${msg.message.user.name} taught in ${msg.message.user.room} ${factoid.tidbits.length} '${fact}', '${verb}' '${tidbit}'`);
      return msg.reply('Okay.');
    }
    handlerLiteral (msg) {
      // page - http://wiki.xkcd.com/irc/bucket#Listing_factoids
      let page = msg.match[1];
      let factoidName = msg.match[2].trim();
      let factoid = robot.factoid.get(factoidName);
      if (!factoid) {
        msg.reply('No such factoid');
        return;
      }
      msg.finish();
      if (factoid.tidbits.length > 10) {
        let baseurl = (process.env.HUBOT_URL || (`http://${os.hostname()}:${robot.server.address().port}`)).replace(/\/+$/, '');
        msg.reply(baseurl + '/' + robot.name + '/factoid/' + encodeURIComponent(factoidName));
        return;
      }
      let response = [];
      factoid.tidbits.forEach(tidbit => response.push(`${tidbit.verb} ${tidbit.tidbit}`));
      return msg.reply(`${factoid.name} (${factoid.tidbits.length}): ${response.join('|')}`);
    }
  }

  robot.factoid = new FactoidHandler();
  robot.factoid.last_factoid = null;

  robot.respond(/(?:do something|something random)$/, msg => {
    let history = [];
    let factoid = robot.factoid.random(history);
    robot.factoid.output(msg, factoid, history);
    if (history.length > 0) { robot.factoid.last_factoid = history; }
  });

  robot.hear(/^(?:do something|something random)$/, msg => {
    let history = [];
    let factoid = robot.factoid.random(history);
    robot.factoid.output(msg, factoid, history);
    if (history.length > 0) { robot.factoid.last_factoid = history; }
  });

  robot.respond(/(un)?protect\s*(.*)$/, msg => {
    let protect = !msg.match[1];
    let factoidName = msg.match[2].trim();
    let factoid = robot.factoid.get(factoidName);
    if (!factoid) {
      msg.reply('No such factoid');
      return;
    }
    msg.finish();
    if (factoid.readonly === protect) {
      msg.reply('I already had it that way');
      return;
    }
    factoid.readonly = protect;
    factoid.save();
    return msg.reply('Okay.');
  }
  );

  robot.respond(/alias (.*?) => (.*?)$/, robot.factoid.alias);

  robot.router.get(`/${robot.name}/factoid/:factoid`, function (req, res) {
    let factoidName = req.params.factoid;
    let factoid = robot.factoid.get(factoidName);
    if (!factoid) { return res.status(404).send('Not Found'); }
    res.setHeader('content-type', 'text/plain');
    let content = [];
    content.push(`Factoid: [${factoidName}]`);
    content.push(`Protected: ${factoid.readonly ? 'true' : 'false'}`);
    content.push('');
    content.push('Tidbits:');
    for (let tidbit of factoid.tidbits) {
      content.push(tidbit.verb + '|' + tidbit.tidbit);
    }
    res.send(content.join('\n'));
    return res.end;
  });
    // res.send require('util').inspect(req.params)

  robot.respond(/literal(?:\[([*\d]+)])?\s+(.*)$/, robot.factoid.handlerLiteral);
  robot.hear(/^literal(?:\[([*\d]+)])?\s+(.*)$/, robot.factoid.handlerLiteral);

  robot.respond(/forget #(\d+)$/, msg => {
    return msg.reply('Sorry, syntax is now "forget <factoid>#<index from 0>" or "forget that"');
  });

  robot.respond(/forget that$/, msg => {
    return msg.reply('FIXME - not implemented yet');
  });

  robot.respond(/forget (.+)#(\d+)$/, msg => {
    let factoidName = msg.match[1].trim();
    let tid = parseInt(msg.match[2], 10) - 1;
    let factoid = robot.factoid.get(factoidName);
    if (!factoid) {
      msg.reply('No such factoid');
      return;
    }
    if (!factoid.canEdit(msg.message.user)) {
      msg.reply(`Sorry, you don't have permissions to edit '${factoid.name}'.`);
      return;
    }
    if (tid < 0) {
      msg.reply('Sorry, you must provide a number greater than 0 (as this is 1 based)');
      return;
    }
    if (!factoid.tidbits[tid]) {
      msg.reply(`Can't find tidbit #${tid + 1}`);
      return;
    }
    let tidbit = factoid.tidbits.splice(tid, 1);
    msg.reply(`Deleted tidbit: ${tidbit[0].verb}|${tidbit[0].tidbit}`);
    return factoid.save();
  });

  robot.respond(/what was that\??$/, function (msg) {
    // FIXME this should be per room
    if (!robot.factoid.last_factoid) { return; }
    msg.finish();
    // halkeye: That was 'rofl' (#315): <reply> I am also amused
    // halkeye: That was 'that's what she said' => 'thats what she said' (#65): <reply> No, that's what HE said.
    // halkeye: That was 'give me a weapon' (#863): <action> gives $weapon to $who;  vars used: { 'weapon' => [ 'a Biggoron Sword' ]};.
    let lf = robot.factoid.last_factoid.slice(-1)[0];
    let { name } = lf.factoid;
    let { tidbit } = lf;
    let idx = lf.factoid.tidbits.map(tid => tid.tidbit).indexOf(tidbit.tidbit);

    let response = [];
    response.push('That was');
    if (robot.factoid.last_factoid.length > 2) {
      robot.factoid.last_factoid.slice(0, -2).forEach(fact => response.push(`'${fact.name}' =>`));
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

  robot.respond(/(.*?)\s+(<\w+(?:'t)?>)\s*(.*)()/i, robot.factoid.setAddressed);
  robot.respond(/(.*?)(<'s>)\s+(.*)()/i, robot.factoid.setAddressed);
  robot.respond(/(.*?)\s+(is(?: also)?|are)\s+(.*)/i, robot.factoid.setAddressed);
  robot.hear(/^(.*?)\s+(<\w+(?:'t)?>)\s*(.*)()/i, robot.factoid.set);
  robot.hear(/^(.*?)(<'s>)\s+(.*)()/i, robot.factoid.set);
  robot.hear(/^(.*?)\s+(is(?: also)?|are)\s+(.*)/i, robot.factoid.set);

  // # FIXME, make these loaded once brain is loaded so it doesn't need to do wildcard match
  return robot.hear(/^(.*)\??$/, msg => {
    let factoidName = msg.match[1].trim();
    // FIXME this should be per room
    let history = [];
    let factoid = robot.factoid.get(factoidName, history);
    if (!factoid) { return; }
    robot.factoid.output(msg, factoid, history);
    if (history.length > 0) { robot.factoid.last_factoid = history; }
  });
};

