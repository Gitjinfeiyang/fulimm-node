"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var cheerio = require("cheerio");
var superagent = require("superagent");
var db = require("../db/mysql");
var child_process = require("child_process");
var url = require("url");
class Message {
    constructor(type, taskArr) {
        this.type = type;
        this.taskArr = taskArr;
    }
}
class Spider {
    constructor() {
        this.taskArr = [];
        this.childProcess = child_process.fork("./build/service/task");
        this.childProcess.on("message", (message) => {
            switch (message.type) {
                case "list":
                    this.taskArr = message.taskArr;
                    break;
                case "run_success":
                    this.childProcess.send({ type: "list" });
            }
        });
    }
    getPage(url) {
        return superagent.get(url);
    }
    createPageTask(name, taskArr) {
        return __awaiter(this, void 0, void 0, function* () {
            let taskArrStr = "";
            let targetArr = taskArr[taskArr.length - 1].target;
            let keyArr = [];
            let customDef = {};
            for (let i = 0; i < targetArr.length; i++) {
                keyArr.push(targetArr[i].key);
            }
            try {
                let response = yield superagent.get(taskArr[0].entry);
                let $ = cheerio.load(response.text);
                let favicon = $("[rel='icon']").attr("href");
                if (!favicon || favicon.length <= 0) {
                    favicon = $("[rel='shortcut icon']").attr("href");
                }
                if (!favicon || favicon.length <= 0) {
                    favicon = $("[rel='icon shortcut']").attr("href");
                }
                if (favicon) {
                    if (favicon.indexOf("//") >= 0) {
                        // customDef.favicon=favicon.replace("//","")
                        customDef.favicon = favicon;
                    }
                    else {
                        customDef.favicon = new url.URL(taskArr[0].entry, favicon).href;
                    }
                }
            }
            catch (err) {
                throw new Error("入口地址无法访问");
            }
            try {
                taskArrStr = JSON.stringify(taskArr);
            }
            catch (err) {
                throw new Error("任务数据格式有问题");
            }
            let result = yield db.createPageTask(name, JSON.stringify(customDef), taskArrStr);
            try {
                yield db.createTaskTable(name + '_' + result.rows.insertId, keyArr);
            }
            catch (err) {
                throw new Error("创建结果表失败");
            }
            return result;
        });
    }
    runTask(id) {
        return __awaiter(this, void 0, void 0, function* () {
            this.childProcess.send({ type: "run", id });
        });
    }
    stopTask(id) {
        this.childProcess.send({ type: "stop", id });
    }
    deleteTask(id) {
        this.stopTask(id);
        db.deleteTask(id);
    }
    getRunningTaskList() {
        return this.taskArr;
    }
    getResult(name, id, start, rows) {
        return __awaiter(this, void 0, void 0, function* () {
            let results = yield db.getTaskResult(name + "_" + id, start, rows);
            results = results.rows;
            return results;
        });
    }
}
let spider = new Spider();
module.exports = spider;
//# sourceMappingURL=spider.js.map