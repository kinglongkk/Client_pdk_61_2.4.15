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
        // bundle 缓存（例如 'pdk'）
        this.subBundleName = app.subGameName;
        this.subBundle = cc.assetManager.getBundle(this.subBundleName) || null;
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

            const loadFromBundle = function (bundle) {
                try {
                    bundle.load(resPath, finalResType, function (error, loadData) {
                        if (error) {
                            // 分包里没有则回退到 resources
                            that.Log("bundle.load failed, fallback to resources. bundle(%s) resPath(%s) err:%s", that.subBundleName, resPath, (error.stack || error));
                            return loadFromResources();
                        }
                        that.catchDataDict[resPath] = loadData;
                        resolve(loadData);
                    });
                } catch (e) {
                    // 意外异常时回退到 resources
                    that.ErrLog("bundle.load exception, fallback to resources. resPath(%s) err:%s", resPath, e.stack || e);
                    loadFromResources();
                }
            };

            // 优先使用子游戏 bundle（如 'pdk'），失败则回退到 resources
            if (that.subBundle) {
                loadFromBundle(that.subBundle);
            } else {
                cc.assetManager.loadBundle(that.subBundleName, function (err, bundle) {
                    if (err || !bundle) {
                        that.ErrLog("loadBundle(%s) failed, fallback to resources. err:%s", that.subBundleName, err && (err.stack || err));
                        loadFromResources();
                        return;
                    }
                    that.subBundle = bundle;
                    loadFromBundle(bundle);
                });
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