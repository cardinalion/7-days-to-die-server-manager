const Commando = require('discord.js-commando');

class Stats extends Commando.Command {
  constructor(client) {
    super(client, {
      name: 'stats',
      group: 'meta',
      memberName: 'stats',
      description: '',
      details: "Show system stats",
    });
  }

  async run(msg, args) {

    let statsInfo = await sails.helpers.meta.loadSystemStatsAndInfo();

    let embed = new this.client.customEmbed()

    embed.setTitle(`CSMM stats`)
      .addField(`7DTD Servers`, statsInfo.servers, true)
      .addField(`7DTD Players`, statsInfo.players, true)
      .addField(`Discord guilds: ${statsInfo.guilds}`, `Users: ${statsInfo.users}`, true)
      .addField(`Uptime`, statsInfo.uptime, true)
      .addField('Modules', `Discord chat bridges: ${statsInfo.chatBridges}
Country ban modules: ${statsInfo.countryBans}
MOTD handlers: ${statsInfo.sdtdMotds}
Ingame command handlers: ${statsInfo.sdtdMotds}`)

    msg.channel.send(embed)

  }

}


module.exports = Stats;