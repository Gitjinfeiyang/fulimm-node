import User from '../models/user';

var mysql = require('mysql');
var pool  = mysql.createPool({
  connectionLimit : 500,
  host            : 'localhost',
  user            : 'root',
  password        : '123456',
  database        : 'fuli_mm'
});

var query=function(sql:string,values:any={}){
	return new Promise(( resolve:any, reject:any ) => {
		pool.getConnection(function(err:any, connection:any) {
		  if (err) {
			resolve( err )
		  } else {
			connection.query(sql, values, ( err:any, rows:any, fields:any) => {
	
			  if ( err ) {
				reject( err )
			  } else {
				resolve( {rows,fields} )
			  }
			  connection.release()
			})
		  }
		})
	  })
}

var escape=mysql.escape;
var escapeId=mysql.escapeId;



var signUp=function(user:User){
	var sql='insert into user set ?'
	return query(sql,{
		username:user.username,
		account:user.account,
		phone:user.phone,
		password:user.password,
		sex:user.sex,
		email:user.email,
		avatar:user.avatar
	})
}

var login=function(account:string){
	var sql='select * from user where account=?';
	return query(sql,account);
}

var createPageTask=function(name:string, customDef:string, taskArrStr:string){
	var sql='insert into task set ?';
	return query(sql,{
		type:'page_task',
		name,
		"custom_def":customDef,
		"task_origin_arr":taskArrStr,
		"task_current_arr":taskArrStr
	})
}

var getTaskList=function(){
	var sql="select * from task";
	return query(sql)
}

var getTaskById=function(id:number){
	var sql="select * from task where id = ?";
	return query(sql,[id])
}

var createTaskTable=function(tableName:string,keyArr:Array<string>){
		var name = tableName;
    var keys = 'id int auto_increment primary key,create_time timestamp not null default current_timestamp,';
    for (let i = 0; i < keyArr.length; i++) {
			if(i == keyArr.length-1){
        keys += keyArr[i] + ' varchar(255) ';				
			}else{
        keys += keyArr[i] + ' varchar(255), ';
			}
    }
    var sql = "create table "+name+" ("+keys+")";
    return query(sql);
}

var dropTable = function(tableName:string){
	var sql="drop table "+pool.escapeId(tableName);
	return query(sql)
}

var saveTaskResult=function(tableName:string,results:Array<any>){
	var sql="insert into "+pool.escapeId(tableName)+"(";
	let keys=Object.keys(results[0])
	for(let i=0; i<keys.length; i++){
		if(i == keys.length-1){
			sql+=pool.escapeId(keys[i])
		}else{
			sql+=pool.escapeId(keys[i])+","
		}
	}
	sql+=") values "
	for(let i=0; i<results.length; i++){
		let item="(";
		for(let j=0; j<keys.length; j++){
			if(j == keys.length -1 ){
				item+=pool.escape(results[i][keys[j]])
			}else{
				item+=pool.escape(results[i][keys[j]])+","
			}
		}

		if(i == results.length -1 ){
			item+=")"
		}else{
			item+="),"
		}
		sql+=item
	}
	return query(sql);
}

var saveTaskJson=function(id:number,taskJson:string){
	var sql="update `task` set `task_current_arr` = ? where `id` = ?";
	return query(sql,[taskJson,id]);
}

var getTaskResult=function(tableName:string,start:number,rows:number){
		var sql = `select * from ${escapeId(tableName)} limit ${start},${rows}`;
    //"select * from 'cnodejs_1' limit '0','10'"
    return query(sql);
}
var getTaskResultCount=function(tableName:string){
	var sql="select count(*) from ??";
	return query(sql,[tableName])
}

var deleteTask=function(id:number){
	var sql="delete from task where id = ?";
	return query(sql,[id])
}





var db={
	signUp,login,createPageTask,createTaskTable,getTaskList,getTaskById,saveTaskResult,
	saveTaskJson,deleteTask,getTaskResult,getTaskResultCount,dropTable
}

module.exports=db;


