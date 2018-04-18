module.exports = {

  friendlyName: 'Settings',

  description: 'Show the settings for a server view',

  inputs: {
    serverId: {
      description: 'The ID of the server',
      type: 'number',
      required: true
    }
  },

  exits: {
    success: {
      responseType: 'view',
      viewTemplatePath: 'sdtdServer/settings'
    },
    notFound: {
      description: 'No server with the specified ID was found in the database.',
      responseType: 'notFound'
    }
  },

  /**
   * @memberof SdtdServer
   * @name settings
   * @method
   * @description Serves the settings view
   * @param {number} serverId ID of the server
   */

  fn: async function (inputs, exits) {



    try {
      let server = await SdtdServer.findOne(inputs.serverId);
      let serverConfig = await SdtdConfig.findOne({ server: server.id });
      let user = await User.findOne(this.req.session.userId);
      let customCommands = await CustomCommand.find({
        server: server.id,
      })
      sails.log.info(`VIEW - SdtdServer:settings - Showing settings for ${server.name} to user ${user.username}`);
      return exits.success({
        server: server,
        config: serverConfig,
        user: user,
        customCommands: customCommands
      });
    } catch (error) {
      sails.log.error(`VIEW - SdtdServer:settings - ${error}`);
      throw 'notFound';
    }


  }
};
