// 引入 qq 机器人框架
const { Bot, Middleware, Message } = require('mirai-js');

const config = JSON.parse(require('fs').readFileSync('./config.json'));

// 拿到从 leanCloud 获取数据的接口
const getResourceList = require('./db')(config.appId, config.appKey);

// 机器人配置
const qq = 3437394484;
const baseUrl = 'http://localhost:9999';
const authKey = config.authKey;
const bot = new Bot();

// 在异步包装中实现机器人逻辑
(async () => {
    // 从 leanCloud 读数据
    let dataArr = await getResourceList();
    let dataMap = dataArr.reduce((map, currData) => {
        map[currData.keywords] = {
            resource: currData.resource,
            companion: currData.companion,
        };
        return map;
    }, {});

    // 创建一个机器人
    await bot.open({
        baseUrl,
        authKey,
        qq,
    });

    // 监听群组消息
    bot.on('GroupMessage',
        new Middleware().groupFilter([574769906, 535602904, 1128368714])
            // 添加错误处理
            .catch(error => console.log(new Date().toLocaleString(), error))
            // 过滤掉未 @ 机器人的消息                  处理文本信息
            .atFilter([qq], true).textProcessor()
            // 空消息拦截中间件
            .use(async (data, next) => {
                // 如果搜索内容为空，则不处理
                if (data.text.trim() == '') {
                    return;
                }
                next();
            })
            // 数据热更新功能中间件
            .use(async (data, next) => {
                // 数据热更新指令
                if (/^\/reload$/.test(data.text.trim())) {
                    dataArr = await getResourceList();
                    dataMap = dataArr.reduce((map, currData) => {
                        map[currData.keywords] = {
                            resource: currData.resource,
                            companion: currData.companion,
                        };
                        return map;
                    }, {});

                    bot.sendMessage({
                        group: data.sender.group.id,
                        message: new Message().addAt(data.sender.id).addText('已重新加载数据'),
                    });
                    return;
                }
                next();
            })
            // 判断是否仅搜索同伴中间件
            .use(async (data, next) => {
                // 正则表达式匹配
                const companionRegext = new RegExp('(.*)同伴$');
                const matchResult = data.text.trim().match(companionRegext);
                if (matchResult) {
                    // 如果符合仅搜索同伴的格式，置一个标志位
                    data.onlySendCompanion = true;
                    data.text = data.text.replace(/同伴$/, '');
                }
                next();
            })
            // 精确匹配中间件
            .use(async (data, next) => {
                const exactMatchingResult = dataMap[data.text.trim()];
                if (exactMatchingResult) {
                    await bot.sendMessage({
                        group: data.sender.group.id,
                        message: new Message().addAt(data.sender.id).addText(exactMatchingResult.companion),
                    });
                    // 通过上一个中间件的标志位判断是否仅发送同伴消息
                    if (!data.onlySendCompanion) {
                        await bot.sendMessage({
                            group: data.sender.group.id,
                            message: new Message().addAt(data.sender.id).addText(exactMatchingResult.resource),
                        });
                    }
                    return;
                }
                next();
            })
            // 模糊匹配中间件
            .done(async data => {
                const keywordsRegexp = new RegExp(data.text.trim(), 'i');
                const result = dataArr.filter(value => keywordsRegexp.test(value.keywords));
                if (result.length == 0) {
                    // 如果未匹配到
                    bot.sendMessage({
                        group: data.sender.group.id,
                        message: new Message().addAt(data.sender.id).addText('未匹配到有效资源'),
                    });
                } else {
                    // 如果匹配到多条数据，发送所有可能的关键字，以提示用户
                    bot.sendMessage({
                        group: data.sender.group.id,
                        message: new Message().addAt(data.sender.id)
                            .addText(`你要找的是这些资源吗:\n${result.reduce((text, currData, index) => text += currData.keywords + (index == result.length - 1 ? '' : '、'), '')}`),
                    });
                }
            }));
})();