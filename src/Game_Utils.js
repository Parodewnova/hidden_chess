import {serverurl,getstorage,setstorage} from "./index.js"
import "./css/GAMEUTILS.css"




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
export async function newroundfunction(lobbyid){
    const reply = await fetch(serverurl+"api-game/newround/"+lobbyid,{
        method:"GET",
    }).then(response => response.text()).then(data => data)
}
// export async function displaycurrentRound(lobbyid,e){
//     const reply = await fetch(serverurl+"api-game/newround/"+lobbyid,{
//         method:"GET",
//     }).then(response => response.text()).then(data => data)
// }
// export async function fetchplayerlogs(lobbyid) {
//     const reply = await fetch(serverurl+"api-game/fetch-player-logs/"+lobbyid+"/"+getstorage("userID"),{
//         method:"GET",
//     }).then(response => response.text()).then(data => data)
//     return reply
// }
export async function fetchplayerstats(lobbyid,component) {
    const reply = await fetch(serverurl+"api-game/fetchplayerstats/"+lobbyid+"/"+getstorage("userID")+"/"+component,{
        method:"GET",
    }).then(response => response.json()).then(data => data)
    return reply
}




export function settiledisplay(parentdiv,tileid){
    const childs = parentdiv.children
    for (const child of childs){
        if(child.getAttribute("id")==tileid){
            child.children[0].style.background = "red"
        }
        else{
            if(child.getAttribute("blackout")==="true"){
                child.children[0].style.background = "black"
                continue;
            }
            child.children[0].style.background = ""
        }
    }
}

export function convertTileFormat(cood,structure,leader,maxBoardSize){ // cood is 2_0 3_3 in str format, maxBoardSize is an [] with 0 = x max and 1 = y max
    //console.log(cood+"_"+structure+"_"+leader+"_"+maxBoardSize)
    const coodinates = cood.split("_")
    const total_coods = []
    const arr = structure.split("-")
    const YindexL = arr.flatMap((val, index) => val.includes("L") ? [index] : [])[0]
    const XindexL = arr[YindexL].indexOf("L")

    const maxX = maxBoardSize[0]
    const maxY = maxBoardSize[1]
    if(structure=="L"){ // highlight all tiles
        const tile_to_highlight = []
        for(let Y=0;Y<maxY;Y++){
            for(let X=0;X<maxX;X++){
                const val = X+"_"+Y
                if(val!=cood){
                    tile_to_highlight.push(val)
                }
            }
        }
        return tile_to_highlight
    }

    let Y = -1;
    let X = -1
    for (const s of arr){
        Y+=1
        for (const char of s){
            X+=1
            if(char!='x'){
                continue
            }
            let charX = XindexL-X
            let charY = YindexL-Y
            let invertX = -1
            if (!leader){
                invertX = 1
            }
            let invertY = 1
            if (! leader){
                invertY = -1
            }
            total_coods.push((parseInt(coodinates[0])+charX*invertX)+"_"+(parseInt(coodinates[1])+charY*invertY))
        }
        X=-1
    }

    const toReturn = []
    for(const val of total_coods ){
        const split = val.split("_")
        const x = parseInt(split[0])
        const y = parseInt(split[1])
        if (x<0||x>=maxX){
            continue
        }
        if (y<0||y>=maxY){
            continue
        }
        toReturn.push(val)
    }

    return toReturn
}

export const TrapSet = ({start,end}) =>{
    const dimensions = [8,25]
    return (
    <div
      className="TRAPSETCSS"
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
      }}
    />
  );
}