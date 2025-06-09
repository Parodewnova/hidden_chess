import { useEffect,useRef,useState } from "react";
import { useParams } from 'react-router-dom'
import { serverurl,getstorage,setstorage,maxslots } from ".";
import {convertTileFormat} from "./Game_Utils.js"

import "./css/Game.css"


function Game(){
    const socketRef = useRef(null)
    const {lobbyid} = useParams()

    const [loaded,setloaded] = useState(true)
    const [miscpanel,setmiscpanel] = useState(null)
    const [playersheader,setplayersheader] = useState(null)

    const [logscontent,setlogscontent] = useState([])
    const [loghighlighter,setloghighlighter] = useState(null)
    function formattextfunction(message,center){
        const defaultfontsize = 15
        const text_arr = []
        const logsplit = message.split("|style")
        let bracket_content = false
        let saved_status = []
        for(const value of logsplit){
            if(value==""){
                continue
            }
            const value_split = value.split("###")
            if(value_split.length==1){
                if(value_split[0]!=="["){
                    if(value_split[0]==="]"){
                        saved_status.push(<span>{bracket_content?" ]":""}</span>)
                        text_arr.push(<div style={{marginRight:"3px"}}>{saved_status}</div>)
                        saved_status = []
                        bracket_content = false
                        continue
                    }
                    if(bracket_content){
                        saved_status.push(<span style={{marginRight:"3px",fontSize:defaultfontsize+"px",textAlign:"center"}}>{value_split[0].trim()}</span>)
                        continue
                    }
                    text_arr.push(<span style={{marginRight:"3px",fontSize:defaultfontsize+"px",textAlign:"center"}}>{value_split[0].trim()}</span>)
                    continue
                }
                bracket_content = true
                saved_status.push(<span>{bracket_content?"[ ":""}</span>)
                continue
            }
            let bold = false
            let size = defaultfontsize
            let colorhex = "#000000"
            let tooltip = ""
            const changed = value_split[0].replace(" ","").split(",")
            for(const content of changed){
                const split2 = content.split(":")
                if(split2[0]==="bold"){
                    bold = Boolean(split2[1])
                    continue
                }
                if(split2[0]==="size"){
                    size = parseInt(split2[1])
                    continue
                }
                if(split2[0]==="color"){
                    colorhex = split2[1]
                    continue
                }
                if(split2[0]==="tooltip"){
                    tooltip = split2[1]
                    continue
                }
            }
            if(!bracket_content){
                text_arr.push(
                    <div style={{marginRight:"3px"}}>
                        <span style={{fontSize:`${size}px`,color:colorhex,fontWeight:bold?"bold":"normal",cursor:tooltip!==""?"pointer":"default",textAlign:"center"}} 
                            onMouseEnter={(e)=>{
                                if(tooltip===""){
                                    return
                                }
                                setloghighlighter(
                                    <div style={{position:"absolute",top:e.clientY+20,left:e.clientX-30,background:"white",fontSize:"12px",padding:"2px",borderRadius:"5px",border:"1px solid black",zIndex:"1200"}}>{tooltip.replaceAll("~"," ")}</div>
                                )
                            }}
                            onMouseLeave={()=>setloghighlighter(null)}
                            >{value_split[1]}
                        </span>
                    </div>
                )
            }
            else{
                saved_status.push(<span style={{fontSize:`${size}px`,color:colorhex,fontWeight:bold?"bold":"normal",cursor:tooltip!==""?"pointer":"default",textAlign:"center"}} 
                    onMouseEnter={(e)=>{
                        if(tooltip===""){
                            return
                        }
                        setloghighlighter(
                            <div style={{position:"absolute",top:e.clientY+20,left:e.clientX-30,background:"white",fontSize:"12px",padding:"2px",borderRadius:"5px",border:"1px solid black",zIndex:"1200"}}>{tooltip.replaceAll("~"," ")}</div>
                        )
                    }}
                    onMouseLeave={()=>setloghighlighter(null)}
                    >{value_split[1]}</span>)
            }
        }
        return(<div style={{margin:"3px",maxWidth:"100%",display:"flex",flexWrap:"wrap",alignContent:"center",justifyContent:!center?"flex-start":"center"}}>{text_arr}</div>)
    }

    const [isLeader,setisLeader] = useState(null)
    const lockplayerturn = useRef(false);
    const [playerstatus,setplayerstatus] = useState([])

    const [gameboardtile,setgameboardtile] = useState(null)
    const gameboardtiledata2 = useRef(null)
    const [gameboardtiledata,setgameboardtiledata] = useState(null) //json for tile id left and top values for easy access
    const animationsToPlay = useRef(null)
    const [animationpanels,setanimationpanels] = useState(null)
    const [totalanimations,settotalanimations] = useState(null)
    
    const [abilitycardsdata,setabilitycardsdata] = useState(null)
    const [abilitycardsgui,setabilitycardsgui] = useState(null)
    const [abilityselected,setabilityselected] = useState(null)
    const [abilitydisplaymainwidth,setabilitydisplaymainwidth] = useState(0)

    const [tilestohighlight,settilestohighlight] = useState({})
    const [highlightedtile,sethighlightedtile] = useState([])
    const [selectedhighlght,setselectedhighlght] = useState(null)

    const [rightclickedpoint,setrightclickedpoint] = useState([])
    const [transformstring,settransformstring] = useState("")

    const TrapSet = ({start,end,toLogArr}) =>{
        const dimensions = [8,25]
        return (
        <div className="trapsetcss"
        style={{
            "width":dimensions[0]+"px",
            "height":dimensions[1]+"px",
            '--start-x': `${start[0]-dimensions[0]/2}px`,
            '--start-y': `${start[1]}px`,
            '--end-x': `${end[0]-dimensions[0]/2}px`,
            '--end-y': `${end[1]-dimensions[1]}px`
        }}
        onAnimationEnd={(e)=>{
            e.currentTarget.style.display = "none"
            setlogscontent(log=>{
                const all = [...log]
                for(const val of toLogArr){
                    all.push(formattextfunction(val,false))
                }
                return all
            })
            animationdone()
        }}
        />
    );
    }
    const StatusApplied = ({location,toLogArr}) =>{
        const dimensions = [50,50]
        return (
        <div className="statusappliedcss"
        style={{
            "width":dimensions[0]+"px",
            "height":dimensions[1]+"px",
            '--center-x': `${location[0]}px`,
            '--center-y': `${location[1]}px`,
            "transform":"translate(-50%, -50%)"
        }}
        onAnimationEnd={(e)=>{
            e.currentTarget.style.display = "none"
            socketRef.current.send("[request-status-update]")
            setlogscontent(log=>{
                const all = [...log]
                for(const val of toLogArr){
                    all.push(formattextfunction(val,false))
                }
                return all
            })
            animationdone()
        }}
        />
    );
    }

    
    async function checkvalidvalues(lobbyID,userID){ // will return game stats
        const json_data = {
            "userID":userID,
            "roomID":lobbyID
        }
        const reply = await fetch(serverurl+"checkvalidvalues",{
            method:"POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(json_data)
        })
        .then((response)=>{
            if(response.status!=200){
                return {
                    "error":"invalid status: "+response.status
                }
            }
            return response.json()
        })
        .then((data)=>{return data})
        .catch((error)=>{
            return {
                "error":"server error occurred: "+error
            }
        })
        if(reply["error"]){
            setmiscpanel(<div className='errorModuleClass'>{reply["error"]}</div>)
            return
        }
        if(reply["error"]==="invalid room"){
            setmiscpanel(<div className='errorModuleClass'>invalid room id</div>)
            return
        }
        if(reply["error"]==="invalid player"){
            setmiscpanel(<div className='errorModuleClass'>you don't belong here</div>)
            return
        }
        setstorage("board_x",reply["width"])
        setstorage("board_y",reply["height"])
        setstorage("tile_px",reply["size"])
        setloaded(true)
    }

    const rightclickdisable = (event) => {
        if(event.button!=2){
            return
        }
        setrightclickedpoint([])
    }
    const rightclickenable = (event) => {
        if(event.button!=2){
            return
        }

        const boundingparent = event.currentTarget.getBoundingClientRect()
        let xrelative = event.clientX-boundingparent.x
        let yrelative = event.clientY-boundingparent.y
        setrightclickedpoint([xrelative,yrelative])
    }
    const handlemousemovement = (event) =>{
        if(rightclickedpoint.length==0){
            return
        }
        const increment = 5
        const boundingparent = event.currentTarget.getBoundingClientRect()
        let xrelative = event.clientX-boundingparent.x
        let yrelative = event.clientY-boundingparent.y

        // console.log(getstorage("transformx")+"_"+getstorage("transformy"))
        // console.log(parseInt(getstorage("maxXtransform"))+"_"+parseInt(getstorage("maxYtransform")))
        let xincrement = 0
        let yincrement = 0
        if(xrelative>rightclickedpoint[0]+50){
            xincrement = 1
        }
        else if(xrelative<rightclickedpoint[0]-50){
            xincrement = -1
        }
        if(yrelative>rightclickedpoint[1]+50){
            yincrement = 1
        }
        else if(yrelative<rightclickedpoint[1]-50){
            yincrement = -1
        }
        let xtransform_new = parseInt(getstorage("transformx"))+xincrement*increment
        if(xtransform_new>0){
            xtransform_new = 0
        }
        else if(xtransform_new<parseInt(getstorage("maxXtransform"))){
            xtransform_new = parseInt(getstorage("maxXtransform"))
        }
        let ytransform_new = parseInt(getstorage("transformy"))+yincrement*increment
        if(ytransform_new>0){
            ytransform_new = 0
        }
        else if(ytransform_new<parseInt(getstorage("maxYtransform"))){
            ytransform_new = parseInt(getstorage("maxYtransform"))
        }
        setstorage("transformx",xtransform_new)
        setstorage("transformy",ytransform_new)
        settransformstring("translate("+xtransform_new+"px,"+ytransform_new+"px)")
    }
        
    async function handlemessage(event,eventdata){
        if(event=="update-player-list"){
            const player_arr = eventdata["players"]
            if(player_arr.length!==eventdata["maxplayers"]){
                setstorage("gamestate","waiting_for_players")
                setgameboardtile(null)
                setselectedhighlght(null)
                setmiscpanel(
                    <div className="miscpanelcentered" style={{border:"2px solid black",fontSize:"20px",borderRadius:"15px",height:"50px",width:"250px",display:"flex",justifyContent:"center",alignItems:"center",fontWeight:"bold"}}>Waiting for players</div>
                )
            }
            else if (player_arr.length==eventdata["maxplayers"]&&!eventdata["ongoing"]){
                socketRef.current.send("[loadgameboard]=>startinglocation")
                setmiscpanel(
                    <div className="miscpanelcentered" style={{top:"13%",border:"2px solid black",fontSize:"20px",borderRadius:"15px",height:"50px",width:"250px",display:"flex",justifyContent:"center",alignItems:"center",fontWeight:"bold"}}>Select starting location</div>
                ) 
            }
            else{
                setmiscpanel(null)
            }
            setisLeader(eventdata["leader"]==getstorage("userID")?true:false)
            setplayersheader(
                <div style={{width:"100%",height:"100%",display:"flex"}}>
                    {
                        player_arr.map((value,index)=>{
                            //const leader = eventdata["leader"]==value?"":""
                            const readystate = eventdata["readystate"][value]?"ready.png":"loading.gif"
                            return(
                                <div style={{width:"50%",height:"100%",display:"flex",justifyContent:index==0?"flex-start":"flex-end"}}>
                                    <div style={{width:"30px",height:"100%",display:index==0?"flex":"none",width:"30px",height:"100%",justifyContent:"center",alignContent:"center"}}>
                                        <img style={{width:"90%",height:"100%",objectFit:"contain"}} src={serverurl+"api-game/get_image/"+readystate}></img>
                                    </div>
                                    <span style={{display:"flex",alignItems:"center",height:"100%"}}>
                                        {value}
                                    </span>
                                    <div style={{width:"30px",height:"100%",display:index==0?"none":"flex",width:"30px",height:"100%",justifyContent:"center",alignContent:"center"}}>
                                        <img style={{width:"90%",height:"100%",objectFit:"contain"}} src={serverurl+"api-game/get_image/"+readystate}></img>
                                    </div>
                                </div>
                            )
                        })
                    }
                </div>
            )
            return
        }
        if(event=="update-player-logs"){
            const logsarr = []
            for(const log of eventdata){
                logsarr.push(formattextfunction(log,false))
            }
            setlogscontent(logsarr)
            return
        }
        if(event=="user-gameboard-content"){
            const boardx = getstorage("board_x")
            const boardy = getstorage("board_y")
            const tilepx = getstorage("tile_px")

            const misc = {
                "operation":eventdata["operation"]
            }
            
            //console.log(eventdata)
            var leftval = 0,topval = 0
            var totalwidth = 0,totalheight = 0
            const tiledivarr = []
            const tiledatajson = {}
            var xsub,ysub
            for(var y =boardy-1;y>-1;y--){
                for(var x =0;x<boardx;x++){
                    if(eventdata["inverted"]){
                        xsub = boardx-1-x
                        ysub = boardy-1-y
                    }
                    else{
                        xsub = x
                        ysub = y
                    }
                    const tileid = xsub+"_"+ysub
                    let main_content_div = <div></div>
                    if(eventdata["operation"]==="started"){
                        const iconlist = []
                        let visible = false
                        if(tileid in eventdata["visibletiles"]){
                            visible = true
                            Object.entries(eventdata["visibletiles"][tileid]).map(([key, value]) =>{
                                if(key=="players"){
                                    for(const player of value){
                                        if(player===getstorage("userID")){
                                            document.getElementById("playertilediv").textContent = tileid
                                            iconlist.push("api-game/get_image/icon-assests|players.png")
                                        }
                                        else{
                                            iconlist.push("api-game/get_image/icon-assests|players-enemy.png")
                                        }
                                    }
                                }
                            })
                        }
                        else if(tileid in eventdata["visibletokens"]){
                            Object.entries(eventdata["visibletokens"][tileid]).map(([key, value]) =>{
                                if (value["type"]=="traps"){
                                    iconlist.push("api-game/get_image/icon-assests|traps.png")
                                }
                            })
                        }
                        if (iconlist.length!=0){ // set icons
                            main_content_div = 
                            <div style={{position:"relative",width:"100%",height:"100%",background:visible?"white":"",border:visible?"1px solid black":""}} className="fade-in">
                                <div id="icons" style={{display:"flex",position:"absolute",left:"0px",right:"0px",padding:"2px"}}>
                                    {
                                        Array.from(iconlist).map((value)=>{
                                            return(
                                                <img src={serverurl+value} style={{maxWidth:"20px",maxHeight:"20px"}}></img>
                                            )
                                        })
                                    }
                                </div>
                            </div>
                        }
                    }
                    tiledivarr.push(
                        <div key={tileid} style={{position:"absolute",left:leftval,top:topval,width:tilepx+"px",height:tilepx+"px"}}>
                            {main_content_div}
                        </div>
                    )
                    tiledatajson[tileid] = [leftval,topval]
                    if(eventdata["operation"]=="starting"&&eventdata["visibletiles"].includes(tileid)){
                        misc[tileid] = [leftval,topval]
                    }
                    leftval+=102
                }
                totalwidth = leftval
                leftval = 0
                topval+=102
            }
            if(gameboardtiledata==null){
                setgameboardtiledata(tiledatajson)
                gameboardtiledata2.current = tiledatajson
            }
            settilestohighlight(misc)
            totalheight = topval
            const gameboardmain = document.getElementById("gameboard")
            gameboardmain.style.width = totalwidth+"px"
            gameboardmain.style.height = totalheight+"px"
            setstorage("transformx",-((totalwidth-550)/2))
            setstorage("transformy",-(totalheight-550))

            setstorage("maxXtransform",-(totalwidth-550))
            setstorage("maxYtransform",-(totalheight-550))
            settransformstring("translate("+getstorage("transformx")+"px,"+getstorage("transformy")+"px)")
            setgameboardtile(tiledivarr)
            return
        }
        if(event=="load-user-abilities"){
            setabilitycardsdata(eventdata)
            return
        }
        if(event=="timer-data"){ // set gamestate to game_started here after timer ends
            if(getstorage("gamestate")=="start_tile_selection"){
                if(eventdata["seconds"]==0){
                    socketRef.current.send("[loadgameboard]=>gamestart")
                    setstorage("gamestate","game_started")
                    setmiscpanel(null)
                    setselectedhighlght(null)
                    return
                }
                setmiscpanel(
                    <div className="miscpanelcentered" style={{fontSize:"30px",borderRadius:"15px",fontWeight:"bold",paddingLeft:"20px",paddingRight:"20px",border:"2px solid black",textAlign:"center",zIndex:"1000",background:"white"}}>
                        {eventdata["seconds"]}
                    </div>
                )
                setTimeout(()=>{
                    let cancel = "nocancel"
                    if(getstorage("gamestate")!=="start_tile_selection"){
                        cancel = "cancel"
                    }
                    socketRef.current.send("[timer-running]=>"+eventdata["timer-id"]+":"+cancel)
                },1000)
            }
            return
        }
        if(event=="user-animations"){
            setabilityselected(null)
            setselectedhighlght(null)
            animationsToPlay.current = eventdata
            if(eventdata.length==0){
                animationdone()
            }
            else{
                playanimations()
            }
            return
        }
        if(event=="load-user-status"){
            const playerstatus = eventdata
            const statusDivArr = []
            for(const status in playerstatus){
                const div_status = 
                <div className='statusiconcss' onMouseEnter={(e)=>{
                    e.currentTarget.querySelector("#descriptionlabel").style.display = "flex"
                }} onMouseLeave={(e)=>{
                    e.currentTarget.querySelector("#descriptionlabel").style.display = "none"
                }}>
                    <img src={serverurl+"api-game/get_image/status-assests|"+status+".png"} style={{width:"100%",height:"100%",background:"white"}}></img>
                    <div id='descriptionlabel' style={{position:"absolute",display:"none",flexDirection:"column",fontSize:"12px",background:"white",width:"fitContent",padding:"3px"}}>
                        <span style={{color:'red',fontWeight:"bold",marginBottom:"3px"}}>{status}</span>
                        {
                            playerstatus[status]["data"].map((value, index)=>{
                                return (
                                    <div key={index} style={{border:"1px solid black",padding:"2px",display:"flex",flexDirection:"column"}}>
                                        {Object.entries(value).map(([key, value]) =>{
                                            if(key!="skip"){
                                                return <span>{key}: {value}</span>
                                            }
                                        })}
                                        {/* <span>duration: {value["duration"]}</span>
                                        <span>source: {value["source"]}</span> */}
                                    </div>
                                )
                            })
                        }
                        <span style={{marginTop:"3px",marginBottom:"3px"}}>[{playerstatus[status]["description"]}]</span>
                    </div>
                </div>
                statusDivArr.push(div_status)
            }
            setplayerstatus(statusDivArr)
            return
        }
        if(event=="new-round-load"){ // new round start reset all 
            lockplayerturn.current = false
        }
    }
    function playanimations(){
        const toAnimate = []
        const tilepx = getstorage("tile_px")
        //const animation = animationsToPlay.current[0]
        for (const animation of animationsToPlay.current){
            for(const tile of animation.tile){
                const left_top = gameboardtiledata2.current[tile]
                if (animation.animation == "trap-set"){
                    const end = [left_top[0]+tilepx/2,left_top[1]+tilepx/2]
                    const start = [end[0],end[1]-600]
                    toAnimate.push(
                        <TrapSet start={start} end={end} toLogArr={animation.log_to_add}/>
                    )
                }
                if (animation.animation == "status-applied"){
                    toAnimate.push(
                        <StatusApplied location={[left_top[0]+tilepx/2,left_top[1]+tilepx/2]} toLogArr={animation.log_to_add}/>
                    )
                }
            }
        }
        settotalanimations([0,toAnimate.length])
        setanimationpanels([...toAnimate])
    }
    function animationdone(){
        settotalanimations(item=>{
            if(item==null){
                socketRef.current.send("[setplayerready]=>animationready")
                return null
            }
            const latestarr = item[0]+=1
            if(latestarr!=item[1]){
                return [latestarr,item[1]]
            }
            socketRef.current.send("[setplayerready]=>animationready")
            setanimationpanels(null)
            return null
        })
    }

    function abilityselectedFunction(abilityFormat){
        const val = convertTileFormat(document.getElementById("playertilediv").textContent,abilityFormat,isLeader,[getstorage("board_x"),getstorage("board_y")])
        const tohighlight = {"operation":"ability-selection"}
        for(const div of val){
            tohighlight[div] = gameboardtiledata[div]
        }
        settilestohighlight(tohighlight)
    }

    useEffect(()=>{
        if(!loaded){
            return
        }
        socketRef.current = new WebSocket("ws://localhost:8000/clientSOCKET/"+getstorage("userID")+"/"+lobbyid);
        // Connection opened
        socketRef.current.onopen = () => {
            console.log("OPENED")
            //load user abilities to server
            // let ability_str = ""
            // for(let val = 0;val<maxslots();val++){
            //     const ability_identifier = JSON.parse(getstorage("itemslot"+val).split("js789on_content")[1])["identifier"]
            //     ability_str+=(ability_identifier+" ")
            // }
            // socketRef.current.send("[loadabilitiestoserver]=>"+ability_str.trim())
        };
        
        // Listen for messages
        socketRef.current.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            for (var i =0;i<message["event"].length;i++){
                const event = message["event"][i]
                handlemessage(event,message["data["+i+"]"])
            }
        };

        // Cleanup on unmount
        return () => {
        if (socketRef.current) {
            socketRef.current.close();
            console.log('WebSocket disconnected');
        }};
    },[loaded])


    useEffect(()=>{
        const highlight_arr = []
        const tilepx = getstorage("tile_px")
        Object.keys(tilestohighlight).forEach(key=>{
            if(key!="operation"&&selectedhighlght==null){
                highlight_arr.push(
                        <div id={key} style={{height:tilepx+"px",width:tilepx+"px",left:tilestohighlight[key][0],top:tilestohighlight[key][1]}} className="hightlighttilecss"
                        onClick={(e)=>{
                                if(tilestohighlight["operation"]=="starting"){
                                    const tileid = e.currentTarget.id
                                    setstorage("gamestate","start_tile_selection")
                                    setselectedhighlght(
                                        <div id={key} style={{height:tilepx+"px",width:tilepx+"px",left:tilestohighlight[key][0],top:tilestohighlight[key][1]}} className="highlightselectedcss"></div>
                                    )
                                    socketRef.current.send("[setplayerready]=>"+tileid)
                                    return
                                }
                                if(tilestohighlight["operation"]=="ability-selection"){
                                    lockplayerturn.current = true
                                    sethighlightedtile(null)
                                    const left_top = gameboardtiledata[e.currentTarget.id]
                                    setselectedhighlght(
                                        <div id={key} style={{height:tilepx+"px",width:tilepx+"px",left:left_top[0],top:left_top[1]}} className="highlightselectedcss"></div>
                                    )
                                    const abilityjson = {
                                        "tileselected":[key],
                                        "abilityselected":abilityselected
                                    }
                                    socketRef.current.send("[setplayerready]=>setability=>"+JSON.stringify(abilityjson))
                                    return
                                }
                            }
                        }>
                        </div>
                    )
            }
        })
        sethighlightedtile(highlight_arr)
    },[tilestohighlight])
    useEffect(()=>{ // generate ability gui here
        if(abilitycardsdata==null){
            return
        }
        const abilityguiarr = []
        Object.keys(abilitycardsdata).map((index,value)=>{
            const leftvalue = value*100
            const width = 200;
            setabilitydisplaymainwidth(leftvalue+width)
            let cardselected = abilityselected==index?true:false
            let cardtransformvalue = cardselected?"translateY(-50px)":"translateY(14px)"
            if(abilityselected==null){
                cardtransformvalue = ""
            }
            abilityguiarr.push(
                <div className="abilitycardcss" id={index} style={{left:leftvalue,width:width+"px",height:"320px",border:cardselected?"1px solid red":"1px solid black",transform:cardtransformvalue}} onClick={()=>{
                    if(lockplayerturn.current){
                        return
                    }
                    setabilityselected(index)
                    abilityselectedFunction(abilitycardsdata[index]["tileformat"])
                }} onMouseEnter={(e)=>{
                    e.currentTarget.style.transform = "translateY(-85%)"
                }} onMouseLeave={(e)=>{
                    e.currentTarget.style.transform =  cardtransformvalue
                }}>
                    <span style={{width:"100%",fontSize:"20px",fontWeight:"bold",textAlign:"center",textWrap:"wrap",borderBottom:"2px solid black",fontFamily: "'Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'",userSelect:"none"}}>{abilitycardsdata[index]["name"]}</span>
                    <span style={{position:"absolute",top:"10%",left:"0px",width:"50px",borderBottomRightRadius:"15px",borderTopRightRadius:"15px",borderRight:"2px solid black",background:"red",display:'flex',justifyContent:"center",alignContent:"center",fontSize:"25px",fontFamily: "'Impact', 'Arial Black', sans-serif",}}>{abilitycardsdata[index]["damage"]}</span>
                    <span style={{position:"absolute",top:"10%",right:"0px",width:"50px",borderBottomLeftRadius:"15px",borderTopLeftRadius:"15px",borderLeft:"2px solid black",background:"aquamarine",display:'flex',justifyContent:"center",alignContent:"center",fontSize:"25px",fontFamily: "'Impact', 'Arial Black', sans-serif",}}>{abilitycardsdata[index]["cooldown"]}</span>
                    <div style={{height:"150px",width:"100%"}}></div>
                    <div style={{width:"100%",flex:"1",background:"#ffcccc",borderRadius:"15px",display:"flex",justifyContent:"center",alignContent:"center"}}>{formattextfunction(abilitycardsdata[index]["description"],true)}</div>
                    <div style={{zIndex:"100",display:abilitycardsdata[index]["cardcooldown"]!=0?"block":"none",background:"rgba(0.5,0.5,0.5,0.5)",position:"absolute",top:"0px",left:"0px",width:"100%",height:"100%",borderRadius:"15px"}}></div>
                </div>
            )
        })
        setabilitycardsgui(abilityguiarr)
    },[abilitycardsdata,abilityselected])
    useEffect(()=>{
        document.getElementById("gameboardframe").addEventListener('contextmenu', (e)=>{
            e.preventDefault()
        });
        window.addEventListener('keydown', (e)=>{
            if(e.key!=="Escape"){
                return
            }
            if(getstorage("gamestate")==="start_tile_selection"){
                setstorage("gamestate","")
                setselectedhighlght(null)
                settilestohighlight(content=>{
                    const newContent = {...content}
                    return newContent
                })
                socketRef.current.send("[setplayerready]=>false")
                return
            }
            if(getstorage("gamestate")==="game_started"){
                if(lockplayerturn.current){
                    return
                }
                setabilityselected(null)
                sethighlightedtile(null)
                return
            }
        });
        checkvalidvalues(lobbyid,getstorage("userID"))
    },[])
    return(
        <div style={{width:"100%",height:"100vh"}}>
            <div id="selectedstartingtileid" val="" style={{display:"none"}}></div>
            <div id="lockplayerdiv" val="" style={{display:"none"}}></div>
            {miscpanel}
            {loghighlighter}
            <div style={{position:"absolute",left:"50%",bottom:"0px",width:abilitydisplaymainwidth,height:"55px",transform:"translateX(-50%)",zIndex:"900"}}>
                {abilitycardsgui}
            </div>
            <div style={{display:loaded==false?"none":"block"}}>
                <div id="playertilediv" style={{display:"none"}}></div>
                <div id='status-list' style={{maxWidth:"100%",display:"flex",flexWrap:"wrap"}}>{playerstatus}</div>
                <div id="playerheader" className="playerheadercss">{playersheader}</div>
                <div id="logpanel" style={{position:"absolute",left:"5px",bottom:"5px",maxHeight:"350px",width:"250px",border:"1px solid black",background:"#efe5b2",borderRadius:"5px",display:"flex",flexDirection:"column",justifyContent:"end"}}>
                    {logscontent}
                </div>
                <div id="gameboardframe" className="miscpanelcentered" style={{width:"550px",height:"550px",overflow:"hidden",border:"2px solid black",borderRadius:"10px",display:gameboardtile!=null?"block":"none"}}  onMouseMove={handlemousemovement} onMouseDown={rightclickenable} onMouseUp={rightclickdisable} onMouseLeave={rightclickdisable}>
                    <div id="gameboard" style={{position:"relative",borderRadius:"5px",display:"flex",flexWrap:"wrap",padding:"3px",transform:transformstring}}>
                        <img src={serverurl+"api-game/get_image/Fogtile.png"} style={{width:"100%",height:"100%",transform:"translate(-3px,-3px)",objectFit:"contain"}}></img>
                        {gameboardtile}
                        {highlightedtile}
                        {selectedhighlght}
                        {animationpanels}
                    </div>
                </div>
            </div>
        </div>
    )
}
export default Game;