var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var jwt = require("jsonwebtoken");

var index = require('./build/routes/index');
var users = require('./build/routes/users');
var spider = require('./build/routes/spider')

var app = express();


const routeFilterList={
  '/users/login':true,
  '/users/signup':true,
  '/users/upload':true,
  '/uploads':true,
}

//设置跨域
const corsHeader={
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods':'GET,PUT,POST,DELETE',
  'Access-Control-Allow-Headers': 'Content-Type,token',
  'Access-Control-Allow-Credentials':'true',
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
// app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads',express.static(path.join(__dirname, 'uploads'),{
  maxAge:30*60,
}));


app.use(function(req,res,next){
  let token=req.get("token");

    res.set({
      ...corsHeader,
      "Cache-Control":"no-store"
    })
  if(routeFilterList[req.path]||req.path.indexOf("uploads")>=0) {
    next()
    return;
  }

  if(!token){
    res.status(203).json({
      code:-1,
      msg:'用户未登录'
    })
  }else{
    var verify;
    try{
      verify=jwt.verify(token,'account');
    }catch(err){
      res.status(203).json({
        code:-1,
        msg:"用户未登录或登录已过期"
      })
      return;
    }
    if(verify&&verify.data){
      res.locals.user=verify.data;
      next();
      return;
    }else{
      res.status(203).json({
        code:-1,
        msg:"用户未登录或登录已过期"
      })
      return;
    }
  }
})



app.use('/', index);
app.use('/users', users);
app.use('/spider', spider);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
