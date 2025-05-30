import "./css/Home.css"
import {getstorage, mainurl,serverurl,setstorage,maxslots} from "./index.js"

function displayMessage(message){
    const displaymessagediv = document.getElementById("message")
    displaymessagediv.textContent = message
    setTimeout(()=>{
        displaymessagediv.textContent = ""
    },600)
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
const length = 10
const random = "abcdefghijklmnopqrstuvwxyz"
var user_ID = ""
for(let i=0;i<length;i++){
    const randomBool = Math.random() >= 0.5;
    var item = random.charAt(getRandomInt(0,random.length))
    if(randomBool){
        item = item.toUpperCase()
    }
    user_ID += item
}

async function joinserver(){
    const user_input_field = document.getElementById("input_ID")
    const user_input_value = user_input_field.value
    const username = user_ID//document.getElementById("username").value
    if(user_input_value===""){
        displayMessage("input can't be empty")
        return
    }
    // if(username===""){
    //     displayMessage("username can't be empty")
    //     return
    // }
    // check if user has their items
    // for(let check1=0;check1<maxslots();check1++){
    //     const value = getstorage("itemslot"+check1)
    //     if(value===null){
    //         displayMessage("select your loadout first")
    //         return
    //     }
    // }
    const reply = await fetch(serverurl+"joinserverrequest/"+user_ID+"/"+user_input_value+"/"+username,{
        method:"GET"
    })
    .then((response)=>{
        if(response.status!=200){
            return {
                "error":"server error: status "+response.status
            }
        }
        return response.json()
    })
    .then((data)=>{return data})
    .catch((error)=>{
        return {
            "error":"server error: "+error
        }
    })
    if(reply["error"]){
        displayMessage(reply["error"])
        return
    }
    if(reply["message"]==="not found"){
        displayMessage("room not found")
        return
    }
    else if(reply["message"]==="room full"){
        displayMessage("room is full")
        return
    }
    setstorage("userID",user_ID)
    window.location.href = mainurl+"gamelobby/"+user_input_value
}

function Home(){
    return(
        <div style={{width:"100%",height:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:"3px",backgroundColor:" #091f38"}}>
            <title>Hidden Chess</title> 
            <span style={{position:"absolute",top:"10%",textWrap:"nowrap"}}className="main-title">Hidden Chess</span>
            <span style={{textAlign:"center"}} className="user-id">Username:<input id="username" className="custom-input"></input> UserID: {user_ID}</span>
            <input id="input_ID" className="custom-input" style={{textAlign:"center"}} placeholder="Room-ID"></input>
            <button className="joinbutton" style={{margin:"10px"}} onClick={joinserver}>Join</button>
            <div id="message" style={{textAlign:"center",color:"red"}}></div>



            <a href={mainurl+"gallery"}>Gallery</a>
        </div>
    )
}


export default Home