const leancloudStorage = require('leancloud-storage');

async function init(appId, appKey) {
    leancloudStorage.init({ appId, appKey, serverURL: 'https://avoscloud.com' });
}

async function getResourceList() {
    return (await new leancloudStorage.Query('resourceList').find())
        .map(value => value.attributes);
}

module.exports = (appId, appKey) => {
    init(appId, appKey);
    return getResourceList;
};