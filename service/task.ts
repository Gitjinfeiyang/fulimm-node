var cheerio = require("cheerio");
var superagent = require("superagent");
var db=require("../db/mysql");
var url=require("url");

let taskArr:any=[];

console.log("task_process running")
process.on("message",function(message:any){
    switch(message.type){
        case 'run':
            runTask(message.id);
            break;
        
        case 'stop':
            stopTask(message.id);
            break;

        case 'list':
        let arr=[];
        for(let i=0; i<taskArr.length; i++){
            arr.push({
                id:taskArr[i].id,
                name:taskArr[i].name,
                status:taskArr[i].task.getStatus()
            })
        }
        (<any>process).send({type:"list",taskArr:arr});
            break;
    }
})

async function runTask(id:number){
    let taskInfo=await db.getTaskById(id);
    taskInfo=taskInfo.rows[0];
    if(taskInfo){
        let task=new PageTask(taskInfo.id,taskInfo.name,JSON.parse(taskInfo.task_current_arr))
        taskArr.push({
            ...taskInfo,
            task
        });
        (<any>process).send({type:"run_success"});        
        task.run()        
    }
}

function stopTask(id:number){
    

    for(let i=0; i<taskArr.length; i++){
        if(id == taskArr[i].id){
            if(taskArr[i].task.getStatus().pause){
                taskArr[i].task.stopRun(function(){
                    // task will stoped when the tasklimiter is empty
                    taskArr.splice(i,1);
                    (<any>process).send({type:"list",taskArr:getTaskList()});                    
                });
            }else{
                taskArr[i].task.pause()
            }
            
            (<any>process).send({type:"list",taskArr:getTaskList()});
            break;
        }
    }
}

function getTaskList(){
    let arr:any=[];
    for(let i=0; i<taskArr.length; i++){
        arr.push({
            id:taskArr[i].id,
            name:taskArr[i].name,
            status:taskArr[i].task.getStatus()
        })
    }
    return arr;
}



const header=function(host="www.google.com"){
    return {
        // 'Referer':host,
        // "Accept": "text/html,application/xhtml+xml,application/xml; q=0.9,image/webp,*/*;q=0.8",
        // 'User-Agent':'Mozilla/5.0 (Windows; U; Windows NT 6.1; en-US; rv:1.9.1.6) Gecko/20091201 Firefox/3.5.6',
        // 'ACCEPT_ENCODING':'gzip, deflate',
        // 'CONNECTION':'keep-alive',
        // 'HOST':host,
        // 'Cache-Control': 'max-age=0',
        // 'Accept-Language': 'zh-CN,zh;q=0.9',
        // 'Cookie':'JSESSIONID=EF576005F1BBA1EED17E6F753FD08B93; UM_distinctid=1633eda5e0f187-02e721df41a8ab-f373567-1fa400-1633eda5e105b7; Hm_lvt_65499fd57541d09e46def2791033d87f=1525767889,1525768885; CNZZDATA1254770214=17468930-1525764861-https%253A%252F%252Fwww.baidu.com%252F%7C1525770279; Hm_lpvt_65499fd57541d09e46def2791033d87f=1525772588'
    }
}



// TaskArr=[
//     {entry:'',
//      entrySelector:'',
//     method:'',
//     params:{}, //[]  {autoIncrement,start,end,step} string
//     target:selector[]}  {key,selector,value}
// ]


class TaskLimiter{
    limit:number;
    taskQue:Array<any>;
    currentRuningIndex:number;
    currentRuningCount:number;
    stop:boolean;
    onLast:Function;

    constructor(limit:number){
        this.limit=limit;
        this.taskQue=[];
        this.currentRuningIndex=0;
        this.currentRuningCount=0;
        this.stop=false;
        this.onLast=function(){}
    }

    run(){
        if(this.currentRuningCount<this.limit){
            if(this.stop) return;
            for(let i=this.currentRuningIndex; i<this.taskQue.length; i++){
                this.taskQue[i]();
                this.currentRuningCount++;
                this.currentRuningIndex++;
                console.log(this.currentRuningIndex++,"/",this.taskQue.length)
                if(i === this.taskQue.length-1){
                    try{
                        this.onLast&&this.onLast()
                    }catch(err){

                    }
                }
                if(this.currentRuningCount>=this.limit){
                    // console.log('---limit---'+this.currentRuningCount)
                    break;
                }
            }
        }
        
    }

    //添加的task必须是异步任务
    //任务完成需调用done，否则将一直占用名额
    //retry必须加条件控制，否则可能死循环
    add(task:Function){
        let taskFn:any=() => {
            task(() => {
                this.currentRuningCount--;
                taskFn=null;
                this.run();
            },() => {
                taskFn();
            })
        }
        this.taskQue.push(taskFn)
        this.run()
    }

    stopRun(){
        this.stop=true;
    }

    reRun(){
        this.stop=false;
        this.run()
    }
    
}

class Task{
    id:number;
    name:string;
    taskArrJSON:any;
    taskQue:Array<any>;
    currentTaskIndex:number;
    taskLimiter:TaskLimiter;
    result:Array<any>;
    stop:boolean;
    endCallback:Function;
    interval:any;

    constructor(id:number,name:string,taskArr:any){
        this.id=id;
        this.name=name;
        this.taskArrJSON=taskArr;
        this.taskQue=[];
        this.currentTaskIndex=0;
        this.taskLimiter=new TaskLimiter(1);
        this.result=[];
        this.stop=false;
        this.endCallback=this.saveDb||function(){};
        // this.interval=setInterval(() => {//每10分钟入库
        //     if(this.result.length<=0) {
        //         clearInterval(this.interval);
        //         this.interval=null;
        //         return;
        //     }
        //     this.saveDb();
        // },1*60*1000);
    }

    run(){
        this.taskQue.length=this.taskArrJSON.length; 
        for(let i=0; i<this.taskArrJSON.length; i++){
            this.taskQue[i]=((data={}) => {
                if(this.stop) return;
                this.currentTaskIndex=i;
                this.excuteTask(this.taskArrJSON[i],data,(i == this.taskArrJSON.length-1) ? () => {
                    this.endCallback(this.result);
                } : this.taskQue[i+1]);
            });
        }

        this.taskQue[0]();
    }

    onEnd(callback:Function){
        this.endCallback=callback;
    }

    excuteTask(task:Object,data:Object,next:Function){
        next()
    }

    pause(){
        this.stop=true;
        this.taskLimiter.stopRun();
    }

    stopRun(callback:Function){
        this.stop=true;
        this.taskLimiter.onLast=callback;
        this.taskLimiter.reRun();
    }

    reRun(){
        this.stop=false;
        this.taskLimiter.reRun();
    }

    saveDb(){
        if(this.result.length<=100) return;
        let length=this.result.length;
        db.saveTaskResult(this.name+"_"+this.id,this.result)
        .then((res:any) => {
            console.log("save count:",length)
        })
        .catch((err:Error) => {
            console.log("result sql fail:",err.message)
        })
        db.saveTaskJson(this.id,JSON.stringify(this.taskArrJSON)).catch((err:Error) => {
            console.log("taskJson sql fail:",err.message)
        })
        this.result=[];
    }

    getStatus(){
        return {
            pause:this.stop&&this.taskLimiter.stop,
            stoping:this.stop&&!this.taskLimiter.stop,
            currentRuningCount:this.taskLimiter.currentRuningCount,
            taskQueLength:this.taskLimiter.taskQue.length,
            excutedTaskLength:this.taskLimiter.currentRuningIndex
        }
    }
}

class PageTask extends Task{
    
    // todo 
    // 1.正则
    // 2.数据去重
    // 3.错误处理
    // 4.数据入库时机
    excuteTask(task:any,data:any,next:Function){
        //入口
        if(task.entry){
            //有参数
            if(task.params&&task.params.length>0){
                let params=task.params;
                let paramType='';
                let param:any;
                let entry=task.entry;
                let self=this;
                params.forEach((item:any) => {
                    param=item.value;
                    paramType = typeof param;
                    
                    //参数是数组
                    if(Array.isArray(param)){
                        for(let i=0; i<param.length; i++){
                            let entryItem=""
                            //如果已经查询过
                            if(entry.indexOf("?")>0){
                                entryItem=task.entry+'&'+item.name+'='+i;
                            }else{
                                entryItem=task.entry+'?'+item.name+'='+i;
                            }
                            self.taskLimiter.add((done:Function,retry:Function) => {
                                superagent.get(entryItem).set(header(this.taskArrJSON[0].entry))
                                .then((res:any) => {
                                    done();
                                    next({text:res.text});
                                })
                                .catch((err:any) => {
                                    done()
                                })
                            })
                            
                        }
                    
                    //参数是对象
                    }else if(paramType=='object'){
                        for(let i=parseInt(param.start); i<parseInt(param.end); i+=parseInt(param.step)){
                            let entryItem=""
                            //如果已经查询过
                            if(entry.indexOf("?")>0){
                                entryItem=task.entry+'&'+item.name+'='+i;
                            }else{
                                entryItem=task.entry+'?'+item.name+'='+i;
                            }
                            this.taskLimiter.add((done:Function,retry:Function) => {
                                param.start=i;
                                superagent.get(entryItem).set(header(this.taskArrJSON[0].entry))
                                .then((res:any) => {
                                    done();
                                    next({text:res.text});
                                })
                                .catch((err:any) => {
                                    console.log("error : "+entryItem)
                                    done()
                                })
                            })
                        }
                    }else{
                    }
                }) 

            //没有参数
            }else{
                superagent.get(task.entry).set(header(this.taskArrJSON[0].entry))
                    .then((res:any) => {
                        next({text:res.text});
                    })
                    .catch((err:any) => {

                    })
            }
        
        //中间流程
        }else if (task.entrySelector){
            let $=cheerio.load(data.text);
            let entrys=$(task.entrySelector);
            if(entrys[0]){
                //todo 暂时限制3个请求
                for(let i=0; i<entrys.length; i++){
                    this.taskLimiter.add((done:Function,retry:Function) => {
                        let href=entrys[i].attribs.href;
                        
                        href=new url.URL(this.taskArrJSON[0].entry,href)
                        superagent.get(href).set(header(this.taskArrJSON[0].entry))
                            .then((res:any) => {
                                done()                                
                                next({text:res.text});
                            })
                            .catch((err:any) => {
                                done();
                            })
                    })
                }
            }
        

        //抓取目标
        }else if(task.target){
            let $=cheerio.load(data.text);
            let results:any={};
            for(let i=0; i<task.target.length; i++){
                let fields=[];
                // let targets=$(task.target[i].selector);
                // for(let j=0; j<targets.length; j++){
                //     fields.push(targets[i].children[0].data);
                // }
                let items=$(task.target[i].selector)
                switch(task.target[i].value){
                    case 'text':
                        results[task.target[i].key]=[]    
                        for(let o=0; o<items.length; o++){
                            results[task.target[i].key].push($(items[o]).text().trim())
                        }
                        break;
                    default :
                        results[task.target[i].key]=[]                        
                        for(let o=0,j=items.length; o<j; o++){
                            results[task.target[i].key].push(items[o].attribs[task.target[i].value].trim())
                        }
                }
            }
            let keys=Object.keys(results);
            let length=results[keys[0]].length;
            for(let i=0; i<length; i++){
                let item:any={};
                for(let j=0; j<keys.length; j++){
                    item[keys[j]]=results[keys[j]][i]
                }
                this.result.push(item);    
            }
            next();//end
        }
    }
}