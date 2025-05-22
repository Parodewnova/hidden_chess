import { useEffect,useRef,useState } from "react";
import { useParams } from 'react-router-dom'
import { serverurl,getstorage,setstorage,maxslots } from ".";

import "./css/Game.css"


function Game(){
    const socketRef = useRef(null)
    const {lobbyid} = useParams()

    const [loaded,setloaded] = useState(false)
    const [miscpanel,setmiscpanel] = useState(null)
    const [playersheader,setplayersheader] = useState(null)




    
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
        setstorage("boardwidth",reply["width"])
        setstorage("boardheight",reply["height"])
        setloaded(true)
    }

    async function handlemessage(event,eventdata){
        if(event=="update-player-list"){
            const player_arr = eventdata["players"]
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
            console.log(message)
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
        checkvalidvalues(lobbyid,getstorage("userID"))
    },[])
    return(
        <div style={{width:"100%",height:"100vh"}}>
            {miscpanel}
            <div style={{display:loaded==false?"none":"block"}}>
                <div id="playerheader" className="playerheadercss">{playersheader}</div>
            </div>
        </div>
    )
}
export default Game;