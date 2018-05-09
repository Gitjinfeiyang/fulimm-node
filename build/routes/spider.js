"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var router = require("express").Router();
var spiderService = require("../service/spider");
var db = require("../db/mysql");
router.post("/createPageTask", function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        let result = {};
        let { name, task } = req.body;
        try {
            result = yield spiderService.createPageTask(name, task);
        }
        catch (err) {
            res.json({
                code: 1,
                msg: err.message
            });
            return;
        }
        res.json({
            code: 0,
            msg: '成功',
            data: result
        });
    });
});
router.get('/taskList', function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        let list = yield db.getTaskList();
        let runningList = spiderService.getRunningTaskList();
        let runningHash = {};
        list = list.rows;
        for (let i = 0, j = runningList.length; i < j; i++) {
            runningHash[runningList[i].id] = i;
        }
        for (let i = 0; i < list.length; i++) {
            if (runningHash[list[i].id] !== undefined) {
                let { pause, stoping, taskQueLength, excutedTaskLength } = runningList[runningHash[list[i].id]].status;
                if (pause) {
                    list[i].status = 2; //pause
                }
                else if (stoping) {
                    list[i].status = 3; //stoping
                }
                else {
                    list[i].status = 1; //runing
                }
                list[i].taskQueLength = taskQueLength;
                list[i].excutedTaskLength = excutedTaskLength;
            }
            else {
                list[i].status = 0; //stoped
            }
        }
        res.json({
            code: "0",
            msg: "成功",
            data: list
        });
    });
});
router.get("/result", function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        let { id, name, start, rows } = req.query;
        start = parseInt(start);
        rows = parseInt(rows);
        let result = yield spiderService.getResult(name, id, start, rows);
        let total = yield db.getTaskResultCount(name + "_" + id);
        res.json({
            code: 0,
            msg: "成功",
            data: {
                start,
                rows,
                total: total.rows[0]['count(*)'],
                list: result
            }
        });
    });
});
router.post("/runTask", function (req, res, next) {
    let { id } = req.body;
    spiderService.runTask(id);
    process.nextTick(() => {
        res.json({
            code: 0,
            msg: "成功"
        });
    });
});
router.post("/stopTask", function (req, res, next) {
    let { id } = req.body;
    spiderService.stopTask(id);
    process.nextTick(() => {
        res.json({
            code: 0,
            msg: "成功"
        });
    });
});
router.post("/deleteTask", function (req, res, next) {
    let { id } = req.body;
    spiderService.deleteTask(id);
    res.json({
        code: 0,
        msg: "成功"
    });
});
router.get("/getPage", function (req, res, next) {
    let { url } = req.query;
    spiderService.getPage(url)
        .then((resData) => {
        res.json({
            code: 0,
            msg: "成功",
            data: resData.text
        });
    })
        .catch((err) => {
        res.json({
            code: 1,
            msg: "失败"
        });
    });
});
module.exports = router;
//# sourceMappingURL=spider.js.map