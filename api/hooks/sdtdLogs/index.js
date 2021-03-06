const LoggingObject = require('./LoggingObject');

/**
 * @module 7dtdLoggingHook
 * @description Detects events on a 7dtd server.
 */
module.exports = function sdtdLogs(sails) {

  /**
   * @var {Map} loggingInfoMap Keeps track of servers with logging activated
   * @private
   */

  let loggingInfoMap = new Map();

  return {
    /**
     * @name initialize
     * @memberof module:7dtdLoggingHook
     * @description Called on app launch, loads all servers which have logging enabled and creates logging objects for these
     * @method
     * @private
     */
    initialize: function (cb) {
      sails.after('hook:orm:loaded', async () => {
        sails.log.info('Initializing custom hook (`sdtdLogs`)');

        try {
          // Make sure there are no lingering jobs
          // TODO: Once we scale this to multiple processes, this should happen differently
          await sails.helpers.getQueueObject('logs').empty();
          let enabledServers = await SdtdConfig.find({ inactive: false });
          for (let config of enabledServers) {
            await this.start(config.server);
          }
          sails.log.debug(`HOOK: Sdtdlogs - Initialized ${loggingInfoMap.size} logging instances`);
          return cb();
        } catch (error) {
          sails.log.error(`HOOKS - sdtdLogs`, error);
        }
      });
    },

    /**
     * @name start
     * @memberof module:7dtdLoggingHook
     * @description Starts logging for a server
     * @param {number} serverID - Id of the server
     * @method
     */

    start: async function (serverID) {
      serverID = String(serverID);
      try {
        if (!loggingInfoMap.has(serverID)) {
          sails.log.debug(`HOOKS - sdtdLogs - starting logging for server ${serverID}`);
          let loggingObj = await createLogObject(serverID);
          loggingInfoMap.set(serverID, loggingObj);
          await sails.hooks.customdiscordnotification.start(serverID);
          return;
        } else {
          const loggingObj = loggingInfoMap.get(serverID);
          await loggingObj.init();
        }

      } catch (error) {
        sails.log.error(`HOOKS - sdtdLogs`, error);
      }
    },

    /**
     * @name stop
     * @memberof module:7dtdLoggingHook
     * @description Stops logging for a server
     * @param {number} serverID - Id of the server
     * @method
     */

    stop: function (serverID) {
      serverID = String(serverID);
      try {
        if (loggingInfoMap.has(serverID)) {
          sails.log.debug(`HOOKS - sdtdLogs - stopping logging for server ${serverID}`);
          let loggingObj = loggingInfoMap.get(serverID);
          loggingInfoMap.delete(serverID);
          loggingObj.destroy();
          return;
        }
      } catch (error) {
        sails.log.error(`HOOKS - sdtdLogs`, error);
      }


    },

    /**
     * @name getLoggingObject
     * @memberof module:7dtdLoggingHook
     * @description Gets the logging object for a server
     * @param {number} serverId - Id of the server
     * @method
     */

    getLoggingObject: async function (serverId) {
      let obj = loggingInfoMap.get(String(serverId));
      if (_.isUndefined(obj)) {
        sails.log.warn(`Tried to get a non-existing loggingObject, creating a new loggingObject for server ${serverId}.`);
        await this.start(serverId);
        const config = await SdtdConfig.findOne({ where: { server: serverId } });
        obj = loggingInfoMap.get(String(serverId));
        // If a server is set to inactive, the created loggingObject should not do anything
        if (config.inactive) {
          sails.log.warn(`Created new loggingObject but server ${serverId} was set to inactive, disabling loggingObject`);
          await obj.stop();
        }
      }
      return obj;
    },

    /**
     * @name getStatus
     * @memberof module:7dtdLoggingHook
     * @description Gets the logging status for a server
     * @param {number} serverId - Id of the server
     * @method
     */

    getStatus: function (serverId) {
      serverId = String(serverId);
      let status = loggingInfoMap.has(serverId);
      return status;
    }
  };

  /**
   * @name createLoggingObject
   * @memberof module:7dtdLoggingHook
   * @description Creates a logging object for a 7dtd server
   * @param {number} serverID - Id of the server
   * @method
   * @private
   */

  async function createLogObject(serverID) {

    let server = await SdtdServer.findOne(serverID).populate('config');

    let eventEmitter = new LoggingObject(server);

    sails.after('lifted', () => {
      if (!server.config[0].inactive) {
        eventEmitter.init();
      }
    });


    eventEmitter.on('logLine', function (logLine) {
      logLine.server = _.omit(server, 'authName', 'authToken');
      sails.sockets.broadcast(server.id, 'logLine', logLine);
    });

    eventEmitter.on('chatMessage', function (chatMessage) {
      chatMessage.server = _.omit(server, 'authName', 'authToken');
      chatMessage.player = _.omit(chatMessage.player, 'inventory');

      sails.sockets.broadcast(server.id, 'chatMessage', chatMessage);
      sails.log.verbose(`Detected a chat message`, chatMessage);
    });

    eventEmitter.on('playerConnected', async function (connectedMsg) {

      connectedMsg.server = _.omit(server, 'authName', 'authToken');
      await sails.hooks.discordnotifications.sendNotification({
        serverId: server.id,
        notificationType: 'playerConnected',
        player: connectedMsg.player
      });
      if (connectedMsg.country !== null && connectedMsg.steamId) {
        await Player.update({
          server: server.id,
          steamId: connectedMsg.steamId
        }, {
          country: connectedMsg.country
        });
      }
      sails.sockets.broadcast(server.id, 'playerConnected', connectedMsg);
      connectedMsg.player = _.omit(connectedMsg.player, 'inventory');
      sails.log.verbose(`Detected a player connected`, connectedMsg);
    });


    eventEmitter.on('playerJoined', async function (joinMsg) {
      joinMsg.server = _.omit(server, 'authName', 'authToken');
      joinMsg.player = _.omit(joinMsg.player, 'inventory');

      sails.sockets.broadcast(server.id, 'playerJoined', joinMsg);
      sails.log.verbose(`Detected a player joined`, joinMsg);
    });

    eventEmitter.on('playerDisconnected', async function (disconnectedMsg) {
      disconnectedMsg.server = _.omit(server, 'authName', 'authToken');
      await sails.hooks.discordnotifications.sendNotification({
        serverId: server.id,
        notificationType: 'playerDisconnected',
        player: disconnectedMsg.player
      });
      sails.sockets.broadcast(server.id, 'playerDisconnected', disconnectedMsg);
      disconnectedMsg.player = _.omit(disconnectedMsg.player, 'inventory');
      sails.log.verbose(`Detected a player disconnected`, disconnectedMsg);
    });

    eventEmitter.on('connectionLost', async function (eventMsg) {
      if (eventMsg) {
        eventMsg.server = _.omit(server, 'authName', 'authToken');;
      }

      sails.sockets.broadcast(server.id, 'connectionLost', eventMsg);
      await sails.hooks.discordnotifications.sendNotification({
        serverId: server.id,
        notificationType: 'connectionLost',
        msg: eventMsg
      });
      sails.log.debug(`Lost connection to server ${server.name}`);
    });

    eventEmitter.on('connected', async function (eventMsg) {
      if (eventMsg) {
        eventMsg.server = _.omit(server, 'authName', 'authToken');;
      }

      sails.sockets.broadcast(server.id, 'connected', eventMsg);
      await sails.hooks.discordnotifications.sendNotification({
        serverId: server.id,
        notificationType: 'connected'
      });

      sails.log.debug(`Connected to server ${server.name}`);
    });

    eventEmitter.on('playerDeath', function (deathMessage) {
      deathMessage.server = _.omit(server, 'authName', 'authToken');
      sails.sockets.broadcast(server.id, 'playerDeath', deathMessage);
    });

    eventEmitter.on('memUpdate', (memUpdate) => {
      memUpdate.server = _.omit(server, 'authName', 'authToken');
      sails.sockets.broadcast(server.id, 'memUpdate', memUpdate);
      sails.helpers.getQueueObject('playerTracking').add(server.id);
    });

    return eventEmitter;
  }


};
