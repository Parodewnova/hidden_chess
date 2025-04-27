import {serverurl,getstorage,setstorage} from "./index.js"


export async function userReady(lobbyid,dynamicJSON){
    const reply = await fetch(serverurl+"api-game/userready/"+lobbyid,{
        method:"POST",
        headers:{
            "Content-Type":"application/json"
        },
        body: JSON.stringify(dynamicJSON)
    }).then(response => response.text()).then(data => data)
}
export async function gamestartfunction(lobbyid){
    const reply = await fetch(serverurl+"api-game/gamestart/"+lobbyid,{
        method:"GET",
    }).then(response => response.text()).then(data => data)
}




export function settiledisplay(parentdiv,tileid){
    const childs = parentdiv.children
    for (const child of childs){
        if(child.getAttribute("id")==tileid){
            child.style.background = "red"
        }
        else{
            if(child.getAttribute("blackout")==="true"){
                child.style.background = "black"
                continue;
            }
            child.style.background = ""
        }
    }
}