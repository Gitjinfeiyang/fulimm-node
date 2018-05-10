"use strict";
var express = require('express');
var router = express.Router();
var db = require('../db/mysql');
var jwt = require('jsonwebtoken');
var multer = require('multer');
var path = require('path');
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.resolve(__dirname, '../../uploads'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
var upload = multer({ storage: storage });
/* GET users listing. */
router.post('/login', function (req, res, next) {
    var { account, password } = req.body;
    db.login(account)
        .then((data) => {
        if (data.rows.length <= 0) {
            res.json({
                code: -1,
                msg: '用户不存在'
            });
        }
        else {
            if (password !== data.rows[0].password) {
                res.json({
                    code: -1,
                    msg: '密码错误'
                });
            }
            else {
                var token = jwt.sign({
                    data: {
                        account
                    }
                }, 'account', { expiresIn: 60 * 60 });
                res.json({
                    code: 0,
                    msg: '登录成功',
                    token,
                    data: data.rows[0]
                });
            }
        }
    });
});
router.post('/signup', function (req, res, next) {
    var { username, account, password, phone, email, sex, avatar } = req.body;
    sex = parseInt(sex);
    db.signUp({ username, account, password, phone, email, sex, avatar })
        .then((data) => {
        res.json({
            code: 0,
            msg: "成功"
        });
    })
        .catch((err) => {
        res.json({
            code: 1,
            msg: err.message
        });
    });
});
router.get('/userinfo', function (req, res, next) {
    res.json({
        code: 0,
        msg: '成功',
    });
});
router.post("/upload", upload.single("file"), function (req, res, next) {
    res.json({
        code: 0,
        msg: "成功",
        data: [{ url: 'uploads/' + req.file.filename }]
    });
});
module.exports = router;
//# sourceMappingURL=users.js.map