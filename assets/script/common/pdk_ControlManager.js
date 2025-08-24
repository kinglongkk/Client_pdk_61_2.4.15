/*
    控制器管理器
*/
var app = require("pdk_app");

var pdk_ControlManager = app.BaseClass.extend({

    Init:function(){
        this.JS_Name = app["subGameName"] + "_ControlManager";
        
        cc.game.on(cc.game.EVENT_HIDE,  this.OnEventHide.bind(this));
        cc.game.on(cc.game.EVENT_SHOW,  this.OnEventShow.bind(this));

        this.catchDataDict = {};
        // bundle 缓存（仅使用真实分包名 'pdk'，禁用备用名避免 404 请求 pdk_bundle/config.json）
        this.subBundleName = app.subGameName; // 'pdk'
        this.subBundleAltName = ""; // 禁用备用名，防止请求 pdk_bundle/config.json
        // 仅尝试获取主 bundle 引用
        this.subBundle = cc.assetManager.getBundle(this.subBundleName) || null;
        if (this.subBundle && this.subBundle._config && this.subBundle._config.name) {
            // 记录引擎实际 bundle 名（通常是 'pdk'）
            this.subBundleName = this.subBundle._config.name;
        }
    },

    //--------------回掉函数---------------
    //应用切入后台
    OnEventHide:function(){
        app[app.subGameName + "Client"].OnEventHide();
        
    },

    //应用显示
    OnEventShow:function(){
        app[app.subGameName + "Client"].OnEventShow();
    },

    //---------------加载资源-----------------

    //创建异步下载资源对象
    CreateLoadPromise:function(resPath, resType=""){
        let that = this;
        // 如果已经加载
        if (this.catchDataDict.hasOwnProperty(resPath)) {
            let loadData = this.catchDataDict[resPath];
            return app.bluebird.resolve(loadData)
        }

        // 创建异步函数
        let promisefunc = function (resolve, reject) {
            const finalResType = resType || undefined;
            const isGameRes = resPath && resPath.indexOf('game/') === 0;

            const onLoadedFromResources = function (error, loadData) {
                if (error) {
                    reject(error);
                    that.ErrLog("CreateLoadPromise failed (resources) resPath(%s) resType(%s), error:%s", resPath, resType, (error.stack || error));
                    return;
                }
                that.catchDataDict[resPath] = loadData;
                resolve(loadData);
            };

            const loadFromResources = function () {
                cc.resources.load(resPath, finalResType, onLoadedFromResources);
            };

            const tryLoadFromAltBundle = function () {
                // 非 game/* 资源不尝试备用 bundle，直接走 resources
                if (!isGameRes) {
                    return false;
                }
                if (!that.subBundleAltName || that.subBundleAltName === that.subBundleName) {
                    return false;
                }
                // 如果备用 bundle 已在内存，直接用
                let alt = cc.assetManager.getBundle(that.subBundleAltName);
                if (alt) {
                    that.subBundle = alt;
                    that.subBundleName = that.subBundleAltName;
                    loadFromBundle(alt);
                    return true;
                }
                cc.assetManager.loadBundle(that.subBundleAltName, function (err, bundle2) {
                    if (err || !bundle2) {
                        that.ErrLog("load alt bundle(%s) failed. err:%s", that.subBundleAltName, err && (err.stack || err));
                        // 尝试失败，不再递归
                        if (isGameRes) {
                            reject(err || new Error('load alt bundle failed'));
                        } else {
                            loadFromResources();
                        }
                        return;
                    }
                    that.subBundle = bundle2;
                    that.subBundleName = that.subBundleAltName;
                    loadFromBundle(bundle2);
                });
                return true;
            };

            const loadFromBundle = function (bundle) {
                try {
                    bundle.load(resPath, finalResType, function (error, loadData) {
                        if (error) {
                            // 分包里没有
                            that.Log("bundle.load failed, try alt or fallback. bundle(%s) resPath(%s) err:%s", that.subBundleName, resPath, (error.stack || error));
                            // 若路径形如 game/PDK/xxx，尝试自动映射为 game/xxx 再加载一次
                            if (isGameRes && resPath.indexOf('game/PDK/') === 0) {
                                const mappedPath = 'game/' + resPath.substring('game/PDK/'.length);
                                that.Log("try mapped game path: %s -> %s", resPath, mappedPath);
                                return bundle.load(mappedPath, finalResType, function(err2, data2){
                                    if (!err2 && data2) {
                                        // 命中映射路径，仍以原始 key 缓存与返回
                                        that.catchDataDict[resPath] = data2;
                                        return resolve(data2);
                                    }
                                    // 映射也失败，再走备用 bundle 或回退
                                    if (tryLoadFromAltBundle()) {
                                        return;
                                    }
                                    if (isGameRes) {
                                        return reject(err2 || error);
                                    }
                                    return loadFromResources();
                                });
                            }
                            // 优先尝试备用 bundle（例如在 pdk 中未找到，但在 pdk_bundle 中）
                            if (tryLoadFromAltBundle()) {
                                return;
                            }
                            // 对于子游戏专属资源(如 game/*)，应存在于分包中；若两 bundle 都失败，则报错
                            if (isGameRes) {
                                return reject(error);
                            }
                            // 非 game/* 公共资源，回退到 resources
                            return loadFromResources();
                        }
                        that.catchDataDict[resPath] = loadData;
                        resolve(loadData);
                    });
                } catch (e) {
                    // 意外异常：先试备用 bundle；若仍失败再决定是否回退
                    that.ErrLog("bundle.load exception. resPath(%s) err:%s", resPath, e.stack || e);
                    if (tryLoadFromAltBundle()) {
                        return;
                    }
                    if (isGameRes) {
                        return reject(e);
                    }
                    loadFromResources();
                }
            };

            // 仅 game/* 资源才优先走子游戏 bundle；其余资源直接从 resources 加载
            if (isGameRes) {
                if (that.subBundle) {
                    loadFromBundle(that.subBundle);
                } else {
                    cc.assetManager.loadBundle(that.subBundleName, function (err, bundle) {
                        if (err || !bundle) {
                            // 不再尝试备用 bundle，直接失败（避免对 pdk_bundle/config.json 的 404 请求）
                            that.ErrLog("loadBundle(%s) failed. err:%s", that.subBundleName, err && (err.stack || err));
                            return reject(err || new Error('loadBundle failed'));
                        }
                        that.subBundle = bundle;
                        that.subBundleName = that.subBundleName;
                        loadFromBundle(bundle);
                    });
                }
            } else {
                // 非 game/*
                loadFromResources();
            }
        };
        // 返回异步对象
        return new app.bluebird(promisefunc);
    },

    //加载JSON文件 cc.url.raw('resources/json/' + jsonFileName + ".json");
    CreateLoadPromiseByUrl:function(resPath){
        let that = this;

        //创建异步函数
        let promisefunc = function(resolve, reject){
            //加载资源
            cc.assetManager.loadRemote(resPath, function (error, loadData) {

                if(error){
                    reject(error);
                    return
                }

                resolve(loadData);
            })};
        //返回异步对象
        return new app.bluebird(promisefunc);   
    },

    //创建异步下载文件夹所有文件对象
    CreateLoadDirPromise:function(resPath, resType=""){
        //创建异步函数
        let promisefunc = function(resolve, reject){
            //加载资源
            cc.loader.loadResAll(resPath, resType, function (error, loadDataList) {

                if(error){
                    reject(error);
                    return
                }

                resolve(loadDataList);
            })};
        //返回异步对象
        return new app.bluebird(promisefunc);
    },

    //---------------释放资源-----------------
    ReleaseAllRes:function(){
        for(var key in this.catchDataDict){
            console.log("ReleaseAllRes key:" + key);
            if (key.indexOf("jsonData") > -1) {
                //只释放配表资源
                cc.loader.releaseRes(key);
            }
        }
        this.catchDataDict = {};
        cc.game.off(cc.game.EVENT_HIDE,  this.OnEventHide.bind(this));
        cc.game.off(cc.game.EVENT_SHOW,  this.OnEventShow.bind(this));
    },
});


var g_pdk_ControlManager = null;

/**
 * 绑定模块外部方法
 */
exports.GetModel = function(){
    if(!g_pdk_ControlManager){
        g_pdk_ControlManager = new pdk_ControlManager();
    }
    return g_pdk_ControlManager;
}