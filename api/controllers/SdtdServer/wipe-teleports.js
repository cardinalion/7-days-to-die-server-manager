module.exports = {

    friendlyName: 'Wipe teleports',

    description: '',

    inputs: {
        serverId: {
            description: 'The ID of the server',
            type: 'number',
            required: true
        },
    },

    exits: {

        badInput: {
            responseType: 'badRequest'
        }
    },

    fn: async function (inputs, exits) {

        const playersToDestroy = await Player.find({
            server: inputs.serverId
        }).populate('teleports');

        const server = await SdtdServer.findOne(inputs.serverId);

        const teleportsToDelete = playersToDestroy.map(_ => _.teleports.map(_ => _.id)).flat()

        await PlayerTeleport.destroy({ id: teleportsToDelete });

        sails.log.info(`Deleted all teleports for server ${server.name}`);

        return exits.success(playersToDestroy);
    }
};
