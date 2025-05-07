import React, { useEffect,useRef  } from 'react';
import { useState } from "react";
import {useParams} from 'react-router-dom'
import {serverurl,getstorage, mainurl, setstorage} from "./index.js"
import {userReady,settiledisplay,fetchplayerstats,gamestartfunction,newroundfunction, convertTileFormat} from "./Game_Utils.js"

import "./css/Game.css"
import "./css/cardpopup.css"


// getstorage("userID") ==> user id

function Game(){
    const socketRef = useRef(null)
    const {lobbyid} = useParams()
    const [content,setContent] = useState(null)
    const [gameboard,setgameboard] = useState([])
    const [loaded,setLoaded] = useState(false)
    const [highlightedtiles,sethighlightedtile] = useState([])
    let clickedAbility = {}
    let useractiondone = false
    const [startbutton,setstartbutton] = useState(null)
    const [showCard, setShowCard] = useState(null)
    const [focusedCard, setFocusedCard] = useState(null)
    const [gamelogs, setGameLogs] = useState([])
    const [playerstatus,setplayerstatus] = useState([])

    const [minihighlight,setminihighlight] = useState(null)

    let visibletoken = {}
    const [spectatingtile,setspectatingtile] = useState(null)
    //const [visibletoken,setvisibletoken] = useState({})

    const tilesize = 100
    
    const [playerlistdiv,setplayerlistdiv] = useState(null)

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
            setContent(<div className='errorModuleClass'>{reply["error"]}</div>)
            return
        }
        if(reply["error"]==="invalid room"){
            setContent(<div className='errorModuleClass'>invalid room id</div>)
            return
        }
        if(reply["error"]==="invalid player"){
            setContent(<div className='errorModuleClass'>you don't belong here</div>)
            return
        }
        setstorage("boardwidth",reply["width"])
        setstorage("boardheight",reply["height"])
        setLoaded(true)
    }

    async function fetchgameboarddisplay(game_details){
        const reply = await fetch(serverurl+"api-game/fetchgameboard/"+lobbyid+"/"+getstorage("userID")).then((response)=>response.json()).then((data)=>data)
        console.log(reply)
        // update player health
        const playerhp = await fetchplayerstats(lobbyid,"health")
        const percentage = (playerhp[0]/playerhp[1])*100
        var x_start = 0,y_start = getstorage("boardheight")-1
        const inverse = game_details["leader"]!=getstorage("userID")
        if(inverse){
            x_start = getstorage("boardwidth")-1;y_start = 0
        }
        var tiledivarr = []
        var i_y = y_start
        for(var y =0;y<getstorage("boardheight");y++){
            var i_x = x_start
            for(var x =0;x<getstorage("boardwidth");x++){
                const tileid = i_x+"_"+i_y
                var blackout = true
                var clickable = false
                if (tileid in reply){
                    blackout = false
                    clickable = game_details["ongoing"]==false?true:false
                }
                const tilediv = 
                    <div blackout={blackout+""} id={tileid} style={{position:"relative",width:tilesize,height:tilesize,border:"1px solid black",background:blackout?"black":"none",color:"white"}} className='maintiledivcss' 
                    onClick={(e)=>{
                        if(!game_details["ongoing"]||JSON.stringify(clickedAbility)!=="{}"){
                            return
                        }
                        var blacked = false
                        if(e.currentTarget.getAttribute("blackout")==="true"){
                            blacked = true
                        }
                        
                        const display = e.currentTarget.getBoundingClientRect()
                        setminihighlight(
                            <div id={e.currentTarget.getAttribute("id")} style={{position:"absolute",width:display.width,height:display.height,left:display.left,top:display.top,border:"1px dotted lightgrey"}}></div>
                        )
                        let tilediv = null
                        if(!(tileid in reply)){
                            const tilecontent = visibletoken[e.currentTarget.getAttribute("id")]
                            const tiledivcomp = []
                            if(e.currentTarget.getAttribute("id") in visibletoken){
                                Object.entries(tilecontent).map(([key, value])=>{
                                    tiledivcomp.push(<span style={{cursor:"default",color:value.enemy?"red":"green",fontSize:"11px"}} key={key}>{value.itemname}</span>)
                                })
                            }
                            tilediv =
                            <div style={{top:display.top,left:display.right+10,cursor:"default"}} className='tilestatuscss'>
                                <span style={{color:blacked?"red":"white",width:"100%"}}>{blacked?"UNKNOWN?":""}</span>
                                {tiledivcomp}
                            </div>
                        }
                        else{
                            const tilecontent = reply[e.currentTarget.getAttribute("id")]
                            tilediv = 
                                <div style={{top:display.top,left:display.right+10,cursor:"default",fontSize:"12px"}} className='tilestatuscss'>
                                    <div style={{width:"100%",display:"flex",flexDirection:"column",color:"wheat"}} >
                                        PLAYERS
                                        {Object.entries(tilecontent["players"]).map(([key, value])=>{
                                            return <span style={{color:value!=getstorage("userID")?"red":"green",fontSize:"11px"}} key={key}>{value}</span>
                                        })}
                                    </div>
                                    <span style={{height:"3px"}}></span>
                                    <div style={{width:"100%",display:"flex",flexDirection:"column",color:"wheat"}} >
                                        TRAPS
                                        {Object.entries(tilecontent["traps"]).map(([key, value])=>{
                                            return <span style={{color:value["setter"]!=getstorage("userID")?"red":"green",fontSize:"11px"}} key={key}>{value["source"]}</span>
                                        })}
                                    </div>
                                </div>
                        }
                        setspectatingtile(tilediv)
                    }}>
                        <div id={`starting_tile~${tileid}`} style={{display:clickable?"block":"none"}} className='clickabletilediv' onClick={async (e)=>{
                            const json_data = {
                                "userID":getstorage("userID"),
                                "mode":"initialise",
                                "tile":e.currentTarget.getAttribute("id").split("~")[1],
                                "readystate":true
                            }
                            settiledisplay(e.currentTarget.parentElement.parentElement,tileid)
                            await userReady(lobbyid,json_data)
                        }}></div>
                        <img src={serverurl+"api-game/get_image/visible.png"} style={{position:"absolute",left:"5%",top:"5%",display:game_details["ongoing"]&&tileid in reply?"block":"none",maxWidth:"20%",maxHeight:"20%"}}></img>
                        <img src={serverurl+"api-game/get_image/interest.png"} style={{position:"absolute",left:"5%",top:"5%",display:!(tileid in reply)&&visibletoken&&visibletoken[tileid]!=null?"block":"none",maxWidth:"20%",maxHeight:"20%"}}></img>
                        <img src={serverurl+"api-game/get_image/Chess.png"} style={{display:tileid in reply&&reply[tileid].players.includes(getstorage("userID"))?"block":"none",maxWidth:"100%",maxHeight:"100%"}}></img>
                        <div style={{display:tileid in reply&&reply[tileid].players.includes(getstorage("userID"))?"block":"none",position:"absolute",bottom:"5%",left:"5%",width:"90%",height:"5px",background:"red"}}>
                            <div style={{position:"absolute",height:"100%",background:"green",width:`${percentage}%`}}></div>
                        </div>
                        <div id='userinteractiontile' highlight-id={tileid} style={{position:"absolute",display:"none"}} className='highlighttilecss' onClick={async (e)=>{
                            if(useractiondone){
                                return
                            }
                            useractiondone = true
                            sethighlightedtile([tileid])
                            const parent = e.currentTarget
                            parent.classList.replace("highlighttilecss","highlighttileselectedcss")
                            clickedAbility["tile-touched"] = tileid
                            const data = {
                                "userID":getstorage("userID"),
                                "mode":"useraction",
                                "readystate":useractiondone,
                                "ability":clickedAbility
                            }
                            await userReady(lobbyid,data)
                        }}></div>
                    </div>
                    if(inverse){
                        i_x-=1
                    }
                    else{
                        i_x+=1
                    }
                tiledivarr.push(tilediv)
            }
            if(inverse){
                i_y+=1
            }
            else{
                i_y-=1
            }
        }
        setgameboard(
            <div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",display:"flex",width:`${(tilesize+2)*getstorage("boardwidth")}px`,flexWrap:"wrap"}}>
                {tiledivarr}
            </div>
        )
    }

    async function fetchplayerlist(game_details){
        const reply = await fetch(serverurl+"api-game/fetchplayerlist/"+lobbyid).then((response)=>response.json()).then((data)=>data)
        const playerlist = reply["players"]
        if(!game_details["ongoing"]){
            if(playerlist.length==1){
                document.getElementById("message_display").textContent = "Waiting for players..."
            }
            else{
                document.getElementById("message_display").textContent = "select starting tile"
            }
        }
        else{
                document.getElementById("message_display").textContent = ""
        }
        setstartbutton(game_details["leader"]===getstorage("userID")&&game_details["readytobegin"]?<div className="startbuttoncss" onClick={()=>{setstartbutton(null);gamestartfunction(lobbyid)}}>Start</div>:null)
        setplayerlistdiv(
            <div className="top-right-box"style={{display:"flex",justifyContent:"center",alignItems:"center",flexDirection:"column",border:"1px solid black"}}>
                <span className="playerlistspan">Lobby:</span>
                {Object.entries(playerlist).map(([key, value]) =>
                {
                    const username = reply[value]["username"]
                    var readystate = reply[value]["readystate"]?"ready.png":"loading.gif"
                    return(
                        <div key={key}>
                            <span className="playerlistspan" style={{color:getstorage("userID")==value?"red":"black",margin:"5px"}}>{game_details["leader"]===value?"👑 ":""}{username}</span>
                            <img id='player_action_display_icon' src={serverurl+"api-game/get_image/"+readystate} style={{maxWidth:"25px"}}></img>
                        </div>
                    )
                })}
            </div>
        )
    };
    async function displayfunctiongui(game_details){
        const reply = await fetch(serverurl+"api-game/displayabilitygui/"+lobbyid+"/"+getstorage("userID")).then((response)=>response.json()).then((data)=>data)
        var cards = []
        for (const name in reply){
            const cooldown = reply[name]["cooldown"]
            const damage = reply[name]["damage"]
            const description = reply[name]["description"]
            const identifier = reply[name]["identifier"]
            const tileformat = reply[name]["tileformat"]
            const cardcooldown = reply[name]["currentcooldown"]
            
            const card = 
                <div style={{background:cardcooldown!=0?"rgba(0.5,0.5,0.5,0.5)":null,cursor:"pointer"}} className="card-popup" id={identifier} onClick={(e)=>{
                    if(cardcooldown!=0){
                        return
                    }
                    if(useractiondone){
                        return
                    }
                    const cardDIV = e.currentTarget
                    if(clickedAbility["identifier"]!=cardDIV.getAttribute("id")){
                        setTilesToHighlight(tileformat,game_details["leader"]==getstorage("userID"))
                        clickedAbility = {
                            "identifier":identifier
                        }

                        setFocusedCard(
                            <div className="focused-card">
                                <h1>{name}</h1>
                                <p>Damage: {damage}</p>
                                <p>CD: {cooldown}</p>
                                <p>{description}</p>
                            </div>
                        )
                        setminihighlight(null)
                        setspectatingtile(null)
                    }
                    else{
                        clickedAbility = {}
                        setFocusedCard(null);
                        sethighlightedtile([])
                    }

                }}>
                    <h2>{name}</h2>
                    <p>Damage: {damage}</p>
                    <p>CD: {cooldown}</p>
                </div>
            
            cards.push(card)
        }
            setShowCard(
                <div className="card-container">
                {cards}
                </div>
            )
        
        
    }
    async function setTilesToHighlight(tileformat,leader) {
        const reply = (await fetchplayerstats(lobbyid,"tilelocation"))
        sethighlightedtile(convertTileFormat(reply,tileformat,leader))
    }
    async function handleServerMessages(message){ //json format
        const gameinfo = {
            "leader":message["leader"],
            "ongoing":message["ongoing"]
        }
        for (var i =0;i<message["event"].length;i++){
            const event = message["event"][i]
            if(event=="request-user-logs"){
                const playerlogs = (await fetchplayerstats(lobbyid,"player_logs"))//.replace("[","").replace("]","").replaceAll("'","").replaceAll("\"","").split(",")
                setGameLogs(playerlogs)
            }
            if(event=="toggle-start-button"){
                gameinfo["readytobegin"] = message["readytobegin"]
                await fetchplayerlist(gameinfo)
                continue
            }
            if(event=="update-player-list"){
                await fetchplayerlist(gameinfo)
                continue
            }
            if(event=="update-player-gameboard"){
                await fetchgameboarddisplay(gameinfo)
                continue
            }
            if(event=="send-ability-gui"){
                gameinfo["readytobegin"] = message["readytobegin"]
                await displayfunctiongui(gameinfo)
                continue
            }
            if(event=="update-user-tokens"){
                setminihighlight(null)
                setspectatingtile(null)
                visibletoken = await fetchplayerstats(lobbyid,"visibletokens")
                continue
            }
            if(event=="update-user-statuses"){ // request update statuses
                const playerstatus = (await fetchplayerstats(lobbyid,"status"))
                const statusDivArr = []
                for(const status in playerstatus){
                    const div_status = 
                    <div className='statusiconcss' onMouseEnter={(e)=>{
                        e.currentTarget.querySelector("#descriptionlabel").style.display = "flex"
                    }} onMouseLeave={(e)=>{
                        e.currentTarget.querySelector("#descriptionlabel").style.display = "none"
                    }}>
                        <img src={serverurl+"api-game/get_image/status-assests|"+status+".png"} style={{width:"100%",height:"100%"}}></img>
                        <div id='descriptionlabel' style={{position:"absolute",display:"none",flexDirection:"column",fontSize:"12px",background:"white",width:"fitContent",padding:"3px"}}>
                            <span style={{color:'red',fontWeight:"bold",marginBottom:"3px"}}>{status}</span>
                            {
                                playerstatus[status]["data"].map((value, index)=>{
                                    return (
                                        <div key={index} style={{border:"1px solid black",padding:"2px",display:"flex",flexDirection:"column"}}>
                                            <span>duration: {value["duration"]}</span>
                                            <span>source: {value["source"]}</span>
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
                continue
            }
            if(event=="reset-abilities-&-actions"){
                // reset highlighted tiles
                sethighlightedtile([])
                clickedAbility = {}
                setFocusedCard(null)
                useractiondone = false
                continue
            }
        }
    }


    useEffect(() => { // set up websocket
        if(!loaded){
            return
        }
        socketRef.current = new WebSocket('ws://localhost:8000/clientSOCKET/'+getstorage("userID")+"/"+lobbyid);
        
        // Connection opened
        socketRef.current.onopen = () => {
            console.log('WebSocket connected');
            //socketRef.current.send("penis man");
        };
        
        // Listen for messages
        socketRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
            handleServerMessages(message)
        };

        // Cleanup on unmount
        return () => {
        if (socketRef.current) {
            socketRef.current.close();
        }
        };
    }, [loaded]);
    useEffect(() => { // highlighted tiles changed
        const allHighlightTiles = Array.from(document.querySelectorAll("#userinteractiontile"))
        for(const tile of allHighlightTiles){
            const tileID = tile.getAttribute("highlight-id")
            if(highlightedtiles.length==0){
                tile.classList.replace("highlighttileselectedcss","highlighttilecss")
                tile.style.display = "none"
                continue;
            }
            if(!highlightedtiles.includes(tileID)){
                tile.style.display = "none"
                continue;
            }
            tile.style.display = "block"
        }
    }, [highlightedtiles]);
    useEffect(() => {
        checkvalidvalues(lobbyid, getstorage("userID"));
        // sethighlightedtile(convertTileFormat("2_0","xxxxx-ooooo-ooLoo",true))
    }, []);
    useEffect(() => { // auto scroller
        const view = document.getElementById("logmessagelist")
        view.scrollTo({
            top: view.scrollHeight,
            behavior: 'smooth'
          });
    }, [gamelogs]);
    return(
        <div style={{width:"100%",height:"100vh"}}>
            <div style={{display:"none"}} id='player-ready-state'>false</div>
            <div style={{width:"100%",height:"100vh", display:loaded ?"flex" : "none",flexDirection:"column"}}>
                <div id='status-list' style={{maxWidth:"100%",display:"flex",flexWrap:"wrap"}}>{playerstatus}</div>
                <div style={{position:"absolute",width:"20%",right:"0px",height:"100%",padding:"20px"}} id="right-nav">
                    {playerlistdiv}
                    <div style={{display:"flex",flexDirection:"column",marginTop:"5px",border:"1px solid white",background:"bisque"}}>
                        <h1 style={{width:"100%",textAlign:"center",fontSize:"15px"}}>--LOGS--</h1>
                        <div id='logmessagelist' style={{overflowY:"auto",display:"flex",flexDirection:"column"}}>
                            {gamelogs.map((log, index) => (
                                <span key={index} style={{margin:"3px",fontSize:"13px"}}>{log}</span>
                            ))}
                        </div>
                    </div>      
                </div>
                <div style={{display:"flex",justifyContent:"center",alignContent:"center",flex:"1"}} id="main-nav">
                    <div id="message_display" style={{position:"absolute",top:"10%",left:"50%",transform:"translate(-50%, 0%)",fontSize:"20px",fontWeight:"bold"}}></div>
                    {gameboard}
                </div>
            </div>
            {content}
            {startbutton}
            {showCard}
            {focusedCard}
            {spectatingtile}
            {minihighlight}
        </div>
    )
}


export default Game