import { useEffect,useRef,useState } from "react";
import { useParams } from 'react-router-dom'
import { serverurl,getstorage,setstorage,maxslots } from ".";

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
                                    <div style={{position:"absolute",top:e.clientY+20,left:e.clientX-30,background:"white",fontSize:"12px",padding:"2px",borderRadius:"5px",border:"1px solid black",zIndex:"100"}}>{tooltip.replaceAll("~"," ")}</div>
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
                            <div style={{position:"absolute",top:e.clientY+20,left:e.clientX-30,background:"white",fontSize:"12px",padding:"2px",borderRadius:"5px",border:"1px solid black",zIndex:"100"}}>{tooltip.replaceAll("~"," ")}</div>
                        )
                    }}
                    onMouseLeave={()=>setloghighlighter(null)}
                    >{value_split[1]}</span>)
            }
        }
        return(<div style={{margin:"3px",maxWidth:"100%",display:"flex",flexWrap:"wrap",alignContent:"center",justifyContent:!center?"flex-start":"center"}}>{text_arr}</div>)
    }

    const [gameboardtile,setgameboardtile] = useState(null)
    const [abilitycardsgui,setabilitycardsgui] = useState(null)

    const [tilestohighlight,settilestohighlight] = useState({})
    const [highlightedtile,sethighlightedtile] = useState([])
    const [selectedspawnpoint,setselectedspawnpoint] = useState(null)

    const [rightclickedpoint,setrightclickedpoint] = useState([])
    const [transformstring,settransformstring] = useState("")


    
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
                setselectedspawnpoint(null)
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
        }
        if(event=="user-gameboard-content"){
            const boardx = getstorage("board_x")
            const boardy = getstorage("board_y")
            const tilepx = getstorage("tile_px")

            const misc = {
                "operation":eventdata["operation"]
            }

            var leftval = 0,topval = 0
            var totalwidth = 0,totalheight = 0
            const tiledivarr = []
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
                    if(eventdata["operation"]==="started"&&tileid in eventdata["visibletiles"]){
                        const iconlist = []
                        Object.entries(eventdata["visibletiles"][tileid]).map(([key, value]) =>{
                            if(key=="players"){
                                for(const player of value){
                                    if(player===getstorage("userID")){
                                        iconlist.push("api-game/get_image/icon-assests|players.png")
                                    }
                                    else{
                                        iconlist.push("api-game/get_image/icon-assests|players-enemy.png")
                                    }
                                }
                            }
                        })
                        main_content_div = 
                        <div style={{position:"relative",width:"100%",height:"100%",background:"white",border:"1px solid black"}} className="fade-in">
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
                    tiledivarr.push(
                        <div key={tileid} style={{position:"absolute",left:leftval,top:topval,width:tilepx+"px",height:tilepx+"px"}}>
                            {main_content_div}
                        </div>
                    )
                    if(eventdata["operation"]=="starting"&&eventdata["visibletiles"].includes(tileid)){
                        misc[tileid] = [leftval,topval]
                    }
                    leftval+=102
                }
                totalwidth = leftval
                leftval = 0
                topval+=102
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
        }
        if(event=="load-user-abilities"){
            setabilitycardsgui(
                <div style={{position:"absolute",right:"0px",bottom:"0px",height:"20px",border:"1px solid black",display:"flex",flexDirection:"row-reverse"}}>
                    {Object.keys(eventdata).map((index,value)=>{
                        const leftvalue = value*100
                        return(
                            <div style={{width:"130px",height:"20px",border:"1px solid black"}}>

                            </div>
                        )
                    })}
                </div>
            )
        }
        if(event=="timer-data"){
            if(getstorage("gamestate")=="start_tile_selection"){
                if(eventdata["seconds"]==0){
                    socketRef.current.send("[loadgameboard]=>gamestart")
                    setmiscpanel(null)
                    setselectedspawnpoint(null)
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
        }
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
            if(key!="operation"&&selectedspawnpoint==null){
                highlight_arr.push(
                        <div id={key} style={{height:tilepx+"px",width:tilepx+"px",left:tilestohighlight[key][0],top:tilestohighlight[key][1]}} className="hightlighttilecss"
                        onClick={(e)=>{
                                if(tilestohighlight["operation"]=="starting"){
                                    const tileid = e.currentTarget.id
                                    setstorage("gamestate","start_tile_selection")
                                    setselectedspawnpoint(
                                        <div id={key} style={{height:tilepx+"px",width:tilepx+"px",left:tilestohighlight[key][0],top:tilestohighlight[key][1]}} className="spawnpointselected"></div>
                                    )
                                    socketRef.current.send("[setplayerready]=>"+tileid)
                                }
                            }
                        }>
                        </div>
                    )
            }
        })
        sethighlightedtile(highlight_arr)
    },[tilestohighlight])
    useEffect(()=>{
        document.getElementById("gameboardframe").addEventListener('contextmenu', (e)=>{
            e.preventDefault()
        });
        window.addEventListener('keydown', (e)=>{
            if(e.key!=="Escape"||getstorage("gamestate")!=="start_tile_selection"){
                return
            }
            setstorage("gamestate","")
            setselectedspawnpoint(null)
            settilestohighlight(content=>{
                const newContent = {...content}
                return newContent
            })
            socketRef.current.send("[setplayerready]=>false")
        });
        checkvalidvalues(lobbyid,getstorage("userID"))
    },[])
    return(
        <div style={{width:"100%",height:"100vh"}}>
            <div id="selectedstartingtileid" val="" style={{display:"none"}}></div>
            {miscpanel}
            {loghighlighter}
            {abilitycardsgui}
            <div style={{display:loaded==false?"none":"block"}}>
                <div id="playerheader" className="playerheadercss">{playersheader}</div>
                <div id="logpanel" style={{position:"absolute",left:"5px",bottom:"5px",maxHeight:"350px",width:"250px",border:"1px solid black",background:"#efe5b2",borderRadius:"5px",display:"flex",flexDirection:"column",justifyContent:"end"}}>
                    {logscontent}
                </div>
                <div id="gameboardframe" className="miscpanelcentered" style={{width:"550px",height:"550px",overflow:"hidden",border:"2px solid black",borderRadius:"10px",display:gameboardtile!=null?"block":"none"}}  onMouseMove={handlemousemovement} onMouseDown={rightclickenable} onMouseUp={rightclickdisable} onMouseLeave={rightclickdisable}>
                    <div id="gameboard" style={{position:"relative",borderRadius:"5px",display:"flex",flexWrap:"wrap",padding:"3px",transform:transformstring}}>
                        <img src={serverurl+"api-game/get_image/Fogtile.png"} style={{width:"100%",height:"100%",transform:"translate(-3px,-3px)",objectFit:"contain"}}></img>
                        {gameboardtile}
                        {highlightedtile}
                        {selectedspawnpoint}
                    </div>
                </div>
            </div>
        </div>
    )
}
export default Game;