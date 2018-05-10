var router=require("express").Router();
var spiderService=require("../service/spider");
var db=require("../db/mysql")

router.post("/createPageTask",async function(req:any,res:any,next:any){
    let result={};
    let {name,task} = req.body;
    try{
        result=await spiderService.createPageTask(name,task);
    }catch(err){
        res.json({
            code:1,
            msg:err.message
        })
        return;
    }
        
    res.json({
        code:0,
        msg:'成功',
        data:result
    })
})

router.get('/taskList',async function(req:any,res:any,next:any){
    let list=await db.getTaskList();
    let runningList=spiderService.getRunningTaskList();
    let runningHash:any={};
    list=list.rows;
    for(let i=0,j=runningList.length; i<j; i++){
        runningHash[runningList[i].id]=i;
    }
    for(let i=0; i<list.length; i++){
        if(runningHash[list[i].id] !== undefined){
            let {pause,stoping,taskQueLength,excutedTaskLength,failedUrl}=runningList[runningHash[list[i].id]].status;
            if(pause){
                list[i].status=2; //pause
            }else if(stoping){
                list[i].status=3; //stoping
            }else{
                list[i].status=1; //runing
            }
            list[i].taskQueLength=taskQueLength;
            list[i].excutedTaskLength=excutedTaskLength;
            list[i].failedUrl=failedUrl;
        }else{
            list[i].status=0; //stoped
        }
    }
    
    res.json({
        code:"0",
        msg:"成功",
        data:list
    })
})

router.get("/getTaskById",async function(req:any, res:any, next:Function){
    let {id} = req.query;
    if(!id){
        res.json({
            code:1,
            msg:"参数错误"
        })
    }else{
        let task=await db.getTaskById(id)
        task=task.rows[0];
        res.json({
            code:0,
            msg:"成功",
            data:task
        })
    }
})

router.get("/result",async function(req:any,res:any,next:any){
    let {id,name,start,rows}=req.query;
    start=parseInt(start);
    rows=parseInt(rows);
    let result=await spiderService.getResult(name,id,start,rows);
    let total=await db.getTaskResultCount(name+"_"+id);
    res.json({
        code:0,
        msg:"成功",
        data:{
            start,
            rows,
            total:total.rows[0]['count(*)'],
            list:result
        }
    })
})

router.post("/runTask",function(req:any,res:any,next:any){
    let {id} = req.body;
    spiderService.runTask(id);
    process.nextTick(() => {
        res.json({
            code:0,
            msg:"成功"
        })
    })
    
})

router.post("/stopTask",function(req:any,res:any,next:any){
    let {id} = req.body;
    spiderService.stopTask(id);
    process.nextTick(() => {
        res.json({
            code:0,
            msg:"成功"
        })
    })
})

router.post("/deleteTask",function(req:any,res:any,next:any){
    let {id} = req.body;
    spiderService.deleteTask(id);
    res.json({
        code:0,
        msg:"成功"
    })
})

router.get("/getPage",function(req:any,res:any,next:Function){
    let {url}=req.query;
    spiderService.getPage(url)
        .then((resData:any) => {
            res.json({
                code:0,
                msg:"成功",
                data:resData.text
            })
        })
        .catch((err:Error) => {
            res.json({
                code:1,
                msg:"失败"
            })
        })
})

module.exports=router;