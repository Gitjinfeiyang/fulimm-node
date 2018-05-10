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

function getTaskList():Array<any>{
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

function getURL(a:string,b:string):string{
    // if(b.indexOf("//")>=0){
        return b;
    // }else{
        // return new url.URL(a,b+"").href;
    // }
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
                this.taskQue[i]&&this.taskQue[i]();
                this.currentRuningCount++;
                this.currentRuningIndex++;
                if(i >= this.taskQue.length-1){
                    try{
                        //todo 没有等最后一个任务的结果返回就关闭了任务
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
    add(task:Function,maxRetryTimes=3){
        let tryTimes=0;
        let taskFn:any=() => {
            tryTimes++;
            task(() => {
                this.currentRuningCount--;
                taskFn=null;
                this.run();
            },() => {
                //将任务加入队尾，执行下个任务，如果次数超出，执行下次任务，该任务不再执行
                if(tryTimes<3){
                    this.taskQue.push(taskFn);
                }else{
                    taskFn=null;
                }
                this.currentRuningCount--;                
                this.run();                                    
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

    isEmpty():boolean{
        return this.currentRuningIndex>=this.taskQue.length;
    }
    
}


const taskLimitCount=1;
const taskLimitSectionCount=100; // 一次生成100个任务,防止曝内存
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
    startTime:Date;
    failedUrl:any;


    constructor(id:number,name:string,taskArr:any){
        this.id=id;
        this.name=name;
        this.taskArrJSON=taskArr;
        this.taskQue=[];
        this.currentTaskIndex=0;
        this.taskLimiter=new TaskLimiter(taskLimitCount);
        this.result=[];
        this.stop=false;
        this.endCallback=this.saveDb||function(){};
        this.startTime=new Date();
        this.failedUrl={};
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
        this.taskLimiter.onLast=() => {
            this.saveDb()
            callback()
        }
        this.taskLimiter.reRun();
        if(this.taskLimiter.isEmpty()){
            this.saveDb()            
            callback()
        }
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
            excutedTaskLength:this.taskLimiter.currentRuningIndex,
            failedUrl:this.failedUrl
        }
    }


    request(url:string,callback:Function){
        if(this.stop) return;
        let tryTimes=1;
        this.taskLimiter.add((done:Function,retry:Function) => {
            tryTimes++;
            superagent.get(url).set(header(this.taskArrJSON[0].entry))
            .then((res:any) => {
                console.log("success: "+url)
                done();
                //如果失败过
                try{
                    if(this.failedUrl[url]){
                        this.failedUrl[url]={tryTimes,success:true};
                    }
                    callback({text:res.text});
                }catch(err){
                    console.log(err)
                }
                
            })
            .catch((err:any) => {
                this.failedUrl[url]={tryTimes,success:false};
                console.log("retry "+tryTimes+": "+url)
                //失败后重试
                retry()
            })
        })
    }
}

class PageTask extends Task{
    
    // todo 
    // 1.正则    删除正则判断，使用url模块
    // 2.数据去重    网页抓取暂无去重
    // 3.错误处理    目前忽略错误  已改为重试，重试超过3次不再重试,失败过的任务都会被记录
    // 4.数据入库时机   每次抓取完成检查是否有100条数据
    // 5.入口循环添加任务  每次会生成所有任务，任务量大内存占用高，有隐患，准备修改为每次添加一定量任务，完成后再添加
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
                            
                            this.request(entryItem,next)
                            
                        }
                    
                    //参数是对象
                    }else if(paramType=='object'){
                        //限制一次添加10个任务，执行完毕再继续添加
                        let count=0,max=10;
                        for(let i=parseInt(param.start); i<parseInt(param.end); i+=parseInt(param.step)){
                            let entryItem=""
                            //如果已经查询过
                            if(entry.indexOf("?")>0){
                                entryItem=task.entry+'&'+item.name+'='+i;
                            }else{
                                entryItem=task.entry+'?'+item.name+'='+i;
                            }
                            count++;
                            if(count>=max){
                                this.request(entryItem,(data:any) => {
                                    param.start++;
                                    next(data)
                                    this.taskQue[0]()
                                })
                                break;
                            }else{
                                this.request(entryItem,function(data:any){
                                    param.start++;
                                    next(data)
                                })
                            }
                            
                        }
                    }else{
                    }
                }) 

            //没有参数
            }else{
                this.request(task.entry,next)
            }
        
        //中间流程
        }else if (task.entrySelector){
            let $=cheerio.load(data.text);
            let entrys=$(task.entrySelector);
            if(entrys[0]){
                for(let i=0; i<entrys.length; i++){
                    let href=entrys[i].attribs.href;
                    href=getURL(this.taskArrJSON[0].entry,href)
                    this.request(href,next);                    
                }
            }
        

        //抓取目标
        }else if(task.target){
            let $=cheerio.load(data.text);
            let results:any={};
            for(let i=0; i<task.target.length; i++){
                let fields=[];
                let items=$(task.target[i].selector);
                results[task.target[i].key]=[]                    
                switch(task.target[i].value){
                    case 'text':
                        for(let o=0; o<items.length; o++){
                            results[task.target[i].key].push($(items[o]).text().trim())
                        }
                        break;
                    case 'dataset':
                        for(let o=0; o<items.length; o++){
                            results[task.target[i].key].push($(items[o]).data(task.target[i].value))
                        }
                        break;
                    default :
                        for(let o=0,j=items.length; o<j; o++){
                            results[task.target[i].key].push(items[o].attribs[task.target[i].value].trim())
                        }
                }
            }
            //组装数据
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
