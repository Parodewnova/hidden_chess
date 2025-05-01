import React, { useEffect,useRef  } from 'react';
import { useState } from "react";
import {useParams} from 'react-router-dom'
import {serverurl,getstorage, mainurl, setstorage} from "./index.js"
import {userReady,settiledisplay,gamestartfunction,newroundfunction, convertTileFormat} from "./Game_Utils.js"

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
    const [abilityGUI,setabilitygui] = useState(null)
    const [showCard, setShowCard] = useState(null)
    const [focusedCard, setFocusedCard] = useState(null)

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
                    <div blackout={blackout+""} id={tileid} style={{position:"relative",width:tilesize,height:tilesize,border:"1px solid black",background:blackout?"black":"none",color:"white"}}>
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
                        <img src="http://localhost:8000/api-game/get_image/Chess.png" style={{display:tileid in reply&&reply[tileid].players.includes(getstorage("userID"))?"block":"none",maxWidth:"100%",maxHeight:"100%"}}></img>
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
            <div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",display:"flex",width:`${(tilesize+2)*getstorage("boardwidth")}px`,border:"1px solid black",flexWrap:"wrap"}}>
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
            const cooldown = reply[name]["cd"]
            const damage = reply[name]["dmg"]
            const chosencard = 
                <div></div>
            const card = 
                <div className="card-popup" id={reply[name]["id"]} onClick={(e)=>{
                    if(useractiondone){
                        return
                    }
                    const cardDIV = e.currentTarget
                    if(clickedAbility["id"]!=cardDIV.getAttribute("id")){
                        setTilesToHighlight(reply[name]["tileformat"],game_details["leader"]==getstorage("userID"))
                        clickedAbility = {
                            "id":reply[name]["id"],
                            "type":reply[name]["type"],

                        }

                        setFocusedCard(
                            <div className="focused-card">
                                <h1>{name}</h1>
                                <p>Damage: {damage}</p>
                                <p>CD: {cooldown}</p>
                            </div>
                        )
                    }
                    else{
                        clickedAbility = {}
                        setFocusedCard(null);
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
        const reply = await fetch(serverurl+"api-game/fetchplayerstats/"+lobbyid+"/"+getstorage("userID")).then((response)=>response.json()).then((data)=>data)
        sethighlightedtile(convertTileFormat(reply["tilelocation"],tileformat,leader))
    }

    async function handleServerMessages(message){ //json format
        const gameinfo = {
            "leader":message["leader"],
            "ongoing":message["ongoing"]
        }
        for (var i =0;i<message["event"].length;i++){
            const event = message["event"][i]
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
            if(event=="set-animations"){
                continue
            }
            if(event=="new-round"){
                // reset highlighted tiles
                sethighlightedtile([])
                clickedAbility = {}
                setFocusedCard(null)
                useractiondone = false
                await newroundfunction(lobbyid)
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
    return(
        <div style={{width:"100%",height:"100vh"}}>
            <div style={{display:"none"}} id='player-ready-state'>false</div>
            <div style={{width:"100%",height:"100vh", display:loaded ?"flex" : "none",flexDirection:"column"}}>
                <div style={{position:"absolute",width:"20%",right:"0px",height:"100%"}} id="right-nav">
                    {playerlistdiv}
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
        </div>
    )
}


export default Game