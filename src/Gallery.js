import React, { useEffect,useState,useRef  } from 'react';

import {serverurl,getstorage,setstorage,maxslots} from "./index.js"
import "./css/Gallery.css"





function Gallery(){
    var highlightindex = 0

    // const [jsonData, setJsonData] = useState({});
    // const addDynamicKey = (keyName, value) => {
    //     setJsonData(prev => ({
    //         ...prev,
    //         [keyName]: value      // Computed property name
    //     }));
    // };

    const headerspreset = ["Attack:atk","Trap:trp","Utilities:utl","Movement:mov"]
    const [headerdiv,setheader] = useState(null)
    const [clickedheaders,setclickedheaders] = useState("atk")

    const [itemcards,setitemcards] = useState(null)
    const [loghighlighter,setloghighlighter] = useState(null)

    const [cardseldiv,setcardseldiv] = useState(null)

    function formattextfunction(message){
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
        return(<div style={{margin:"3px",maxWidth:"100%",display:"flex",flexWrap:"wrap",alignContent:"center",justifyContent:"center"}}>{text_arr}</div>)
    }
    async function servertalk(specificContent){
        const reply = await fetch(serverurl+"api-gallery/gallerysite/fetch-"+specificContent,{
            method:"GET",
        }).then(response => response.json()).then(data => data)
        return reply
    }
    function loadheaders() {
        const headers_arr = []
        for(const name of headerspreset){
            const split = name.split(":")
            const headerdiv = 
            <div id={split[1]} className='header_divclass' style={{display:clickedheaders==split[1]?"flex":"none"}}>
                {split[0]}
            </div>
            headers_arr.push(headerdiv)
        }

        setheader(
            <div style={{maxWidth:"fitContent",height:"50px",display:"flex",alignContent:"center",justifyContent:"center",borderRadius:"15px",background:"whitesmoke",userSelect:"none"}}>
                <span className='header_gonext' onClick={()=>{changeheader(-1)}}>{"<"}</span>
                {headers_arr}
                <span className='header_gonext' onClick={()=>{changeheader(1)}}>{">"}</span>
            </div>
        )
    }
    function changeheader(increment){
        let currentindex = 0
        for(const name of headerspreset){
            if(name.includes(clickedheaders)){
                currentindex = headerspreset.indexOf(name)
            }
        }
        currentindex+=increment
        currentindex<0?currentindex=headerspreset.length-1:currentindex=currentindex
        currentindex>=headerspreset.length?currentindex=0:currentindex=currentindex
        setclickedheaders(headerspreset[currentindex].split(":")[1])
    }
    async function loaditems() {
        const itemjson = await servertalk("headeritems="+clickedheaders)
        const allcardlist = []
        Object.entries(itemjson).map(([key, value],index) =>{
            allcardlist.push(
                <div  className="highlightcardcss" style={{position:"relative",width:"200px",height:"320px",borderRadius:"15px",display:"flex",flexDirection:"column",padding:"3px",background:"white",cursor:"pointer"}} onClick={(e)=>{selitem(value["name"],value)}}>
                    <span style={{width:"100%",fontSize:"20px",fontWeight:"bold",textAlign:"center",textWrap:"wrap",borderBottom:"2px solid black",fontFamily: "'Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'"}}>{value["name"]}</span>
                    <span style={{position:"absolute",top:"10%",left:"0px",width:"50px",height:"fitContent",borderBottomRightRadius:"15px",borderTopRightRadius:"15px",borderRight:"2px solid black",background:"red",display:'flex',justifyContent:"center",alignContent:"center",fontSize:"25px",fontFamily: "'Impact', 'Arial Black', sans-serif",}}>{value["damage"]}</span>
                    <span style={{position:"absolute",top:"10%",right:"0px",width:"50px",height:"fitContent",borderBottomLeftRadius:"15px",borderTopLeftRadius:"15px",borderLeft:"2px solid black",background:"aquamarine",display:'flex',justifyContent:"center",alignContent:"center",fontSize:"25px",fontFamily: "'Impact', 'Arial Black', sans-serif",}}>{value["cooldown"]}</span>
                    <div style={{height:"150px",width:"100%"}}></div>
                    <div style={{width:"100%",flex:"1",background:"#ffcccc",borderRadius:"15px",display:"flex",justifyContent:"center",alignContent:"center"}}>{formattextfunction(value["description"])}</div>
                    
                </div>
            )
        })
        setitemcards(allcardlist)
    }
    async function selitem(itemname,itemjson){
        for(let val = 0;val<maxslots();val++){
            let value = getstorage("itemslot"+val)
            if(value===null){
                continue
            }
            value = value.split("js789on_content")[0]
            if(value===itemname){
                return
            }
        }
        const div = document.getElementById("selitemindex")
        const highlightindex = parseInt(div.textContent)

        setstorage("itemslot"+highlightindex,itemname+"js789on_content"+JSON.stringify(itemjson))
        let value = highlightindex+1
        if(value>maxslots()-1){
            value = maxslots()-1
        }
        div.textContent = value
        setloadout(value)
        //addDynamicKey(highlightindex,itemjson)
    }
    function setloadout(index){
        const div = document.getElementById("selitemindex")
        const highlightindex = parseInt(div.textContent)

        const cardarr = []
        for(let val = 0;val<maxslots();val++){
            const item = getstorage("itemslot"+val)
            if(item===null){
                continue
                cardarr.push(<div id={"itemslot"+val} className='itemslotdiv' style={{border:highlightindex==val?"3px dotted black":"1px solid black"}} onClick={()=>{div.textContent = val;setloadout(val)}}></div>)
            }
            const value = JSON.parse(item.split("js789on_content")[1])
            cardarr.push(
                <div className="hovercardcss" style={{position:"relative",width:"200px",height:"320px",borderRadius:"15px",border:index==val?"3px dotted black":"2px solid black",display:"flex",flexDirection:"column",padding:"3px",background:"white",cursor:"pointer"}} onClick={()=>{div.textContent = val; setloadout(val)}}>
                    <span style={{width:"100%",fontSize:"20px",fontWeight:"bold",textAlign:"center",textWrap:"wrap",borderBottom:"2px solid black",fontFamily: "'Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'"}}>{value["name"]}</span>+
                    <span style={{position:"absolute",top:"10%",left:"0px",width:"50px",height:"fitContent",borderBottomRightRadius:"15px",borderTopRightRadius:"15px",borderRight:"2px solid black",background:"red",display:'flex',justifyContent:"center",alignContent:"center",fontSize:"25px",fontFamily: "'Impact', 'Arial Black', sans-serif",}}>{value["damage"]}</span>
                    <span style={{position:"absolute",top:"10%",right:"0px",width:"50px",height:"fitContent",borderBottomLeftRadius:"15px",borderTopLeftRadius:"15px",borderLeft:"2px solid black",background:"aquamarine",display:'flex',justifyContent:"center",alignContent:"center",fontSize:"25px",fontFamily: "'Impact', 'Arial Black', sans-serif",}}>{value["cooldown"]}</span>
                    <div style={{height:"150px",width:"100%"}}></div>
                    <div style={{width:"100%",flex:"1",background:"#ffcccc",borderRadius:"15px",display:"flex",justifyContent:"center",alignContent:"center"}}>{formattextfunction(value["description"])}</div>
                </div>
            )
            setcardseldiv(cardarr)
        }
    }

                

    useEffect(()=>{
        setloadout(0)
    },[])
    useEffect(()=>{
        loadheaders()
        loaditems()
    },[clickedheaders])
    return(
        <div style={{width:"100%",height:"100%",display:'flex',alignContent:"start"}}>
            <div id='selitemindex' style={{display:"none"}}>0</div>
            <div style={{width:"100%",height:"100%",display:'flex',justifyContent:'center',margin:"5px",flexWrap:"wrap"}}>
                {headerdiv}
                <div style={{minWidth:"100%",height:"94vh",display:"flex",flexWrap:"wrap",overflowY:"auto",scrollbarWidth:"none",gap:"10px",padding:"10px",justifyContent:"center"}}>
                    {itemcards}
                    {loghighlighter}
                    <div style={{height:"100px",width:"100%"}}></div>
                </div>
            </div>
            {/* <div style={{width:"250px",height:"500px",position:"absolute",top:"50%",right:"0px",transform:"translate(-0%, -50%)",display:"flex",flexDirection:"column",rowGap:"5px",justifyContent:"flex-end"}}>
                {cardseldiv}
            </div> */}
            <div style={{width:"100%",height:"350px",position:"absolute",left:"0px",bottom:"0px",display:"flex",alignContent:"center",overflow:"hidden",gap:"10px",userSelect:"none",justifyContent:"center"}}>
                {cardseldiv}
            </div>
            {/* <div style={{width:"100%",margin:"10px",display:'flex',justifyContent:"center"}}></div> */}
            {/* <div style={{width:"100%",margin:"10px",display:"flex",flexWrap:"wrap",justifyContent:"start"}}>{itemcards}{loghighlighter}</div> */}
            {/* <div style={{position:"absolute",bottom:"0px",left:"0px",width:"100%",height:"30px",border:"1px solid black"}}>
                {cardsel}
            </div> */}
        </div>
    )
}

export default Gallery