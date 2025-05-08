import React, { useState,useEffect, createContext,useContext  } from 'react';


export const LogContext = createContext()
export function LogProvider({children}){
    const [gamelogs, setGameLogs] = useState([])
    return (
    <LogContext.Provider value={{ gamelogs, setGameLogs }}>
        {children}
    </LogContext.Provider>
    );
}

function Log(){
    const [loghighlighter,setloghighlighter] = useState(null)
    const { gamelogs, setGameLogs } = useContext(LogContext);

    useEffect(() => { // auto scroller
        const view = document.getElementById("logmessagelist")
        view.scrollTo({
            top: view.scrollHeight,
            behavior: 'smooth'
          });
    }, [gamelogs]);
    return(
        <div style={{display:"flex",flexDirection:"column",marginTop:"5px",border:"1px solid white",background:"bisque"}}>
            <h1 style={{width:"100%",textAlign:"center",fontSize:"15px"}}>--LOGS--</h1>
            <div id='logmessagelist' style={{overflowY:"auto",display:"flex",flexDirection:"column",maxHeight:"200px"}}>
                {gamelogs.map((log, index) => {
                    const text_arr = []
                    const logsplit = log.split("|style")
                    for(const value of logsplit){
                        if(value==""){
                            continue
                        }
                        const value_split = value.split("###")
                        if(value_split.length==1){
                            text_arr.push(<span style={{marginRight:"3px",fontSize:"13px"}}>{value_split[0].trim()}</span>)
                            continue
                        }
                        let bold = false
                        let size = 13
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
                        text_arr.push(<span style={{marginRight:"3px",fontSize:`${size}px`,color:colorhex,fontWeight:bold?"bold":"normal",cursor:tooltip===""?"default":"pointer"}} 
                        onMouseEnter={(e)=>{
                            if(tooltip===""){
                                return
                            }
                            const bounds = e.currentTarget.getBoundingClientRect()
                            setloghighlighter(
                                <div style={{position:"absolute",top:bounds.bottom+5,left:bounds-20}}>{tooltip}</div>
                            )
                        }}
                        onMouseLeave={setloghighlighter(null)}>{value_split[1]}</span>)
                    }
                    return(<div style={{margin:"3px",maxWidth:"100%",display:"flex",flexWrap:"wrap",alignContent:"center"}}>{text_arr}</div>)
                    //<span key={index} style={{margin:"3px",fontSize:"13px"}}>{log}</span>
                })}
            </div>
            {loghighlighter}
        </div> 
    )
}

export default Log