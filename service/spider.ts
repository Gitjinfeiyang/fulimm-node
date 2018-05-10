var cheerio = require("cheerio");
var superagent = require("superagent");
var db=require("../db/mysql");
var child_process=require("child_process");
var url=require("url");

class Message{
    type:string;
    taskArr:any;
    constructor(type:string,taskArr:any){
        this.type=type;
        this.taskArr=taskArr;
    }
}

class Spider {
    taskArr:Array<any>;
    childProcess:any;
    constructor(){
        this.taskArr=[];
        this.childProcess=child_process.fork("./build/service/task");
        this.childProcess.on("message",(message : Message) => {
            switch(message.type){
                case "list":
                    this.taskArr=message.taskArr;
                    break;
                
                case "run_success":
                    this.childProcess.send({type:"list"});
            }
        })
    }

    getPage(url:string){
        return superagent.get(url);
    }


    async createPageTask(name:string,taskArr:any){
        let taskArrStr="";
        let targetArr=taskArr[taskArr.length-1].target;
        let keyArr=[];
        let customDef:any={};
        for(let i=0; i<targetArr.length; i++){
            keyArr.push(targetArr[i].key)
        }
        try{
            let response=await superagent.get(taskArr[0].entry);
            let $=cheerio.load(response.text);
            let favicon=$("[rel='icon']").attr("href");
            if(!favicon||favicon.length<=0){
                favicon=$("[rel='shortcut icon']").attr("href");
            }
            if(!favicon||favicon.length<=0){
                favicon=$("[rel='icon shortcut']").attr("href");                
            }
            if(favicon){
                if(favicon.indexOf("//") >=0){
                    // customDef.favicon=favicon.replace("//","")
                    customDef.favicon=favicon
                }else{
                    customDef.favicon=new url.URL(taskArr[0].entry,favicon).href;
                }
            }
        }catch(err){
            throw new Error("入口地址无法访问")
        }
        try{
            taskArrStr=JSON.stringify(taskArr);
        }catch(err){
            throw new Error("任务数据格式有问题");
        }
        let result = await db.createPageTask(name,JSON.stringify(customDef),taskArrStr);
        try{
            await db.createTaskTable(name+'_'+result.rows.insertId,keyArr);
        }catch(err){
            throw new Error("创建结果表失败")
        }
        return result;
    }

    async runTask(id:number){
        this.childProcess.send({type:"run",id})
    }

    stopTask(id:number){
        this.childProcess.send({type:"stop",id})
    }

    deleteTask(id:number){
        this.stopTask(id);
        db.deleteTask(id);
    }

    getRunningTaskList(){
        return this.taskArr;
    }

    async getResult(name:string,id:number,start:number,rows:number){
        let results=await db.getTaskResult(name+"_"+id,start,rows);
        results=results.rows;
        return results;
    }


}

let spider=new Spider();



module.exports= spider;