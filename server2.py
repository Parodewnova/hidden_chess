from fastapi.responses import JSONResponse, FileResponse, PlainTextResponse,StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, File, UploadFile, Request, Response,status, WebSocket
from pydantic import BaseModel
import os,traceback,sys,random as rand,json


test = True
trigger_own_trap = False

app = FastAPI()
allowed_origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # List of allowed origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)
#initialise all statuses
all_status = {}
with open("./status.json","r") as reader:
    all_status = json.load(reader)

playerusernames = {}

max_logsize = 10
gameboard_size = [7,7] # row,height
tilesize_in_px = 100 # for client
class roomblueprint():
    roomjson_blueprint = {
        "leader":"",
        "ongoing":False,
        "timer_state":{},
        "players":[],
        "max-players":2,
        "rounds":0,
        "gameboard":{},
        "playerstats":{},
        "operation":False,
        "abilityusages":{},
        "round_animations":[]
    }
    def __init__(self):  # Default size or pass it in
        # Create a deep copy of the template for this instance
        import copy
        self.room_data = copy.deepcopy(self.roomjson_blueprint)
        for i in range(0,gameboard_size[0]):
            for i2 in range(0,gameboard_size[1]):
                self.room_data["gameboard"][f'{i}_{i2}'] = {
                    "players":[],
                    "structures":{},
                    "traps":{}
                }
class playerblueprint():
    playerstats_blueprint = {
        "health":[10,10], #current,max
        "tilelocation":"",
        "visibletiles":[],
        "currentusage":{},
        "abilities":[["mov:001",0],["trp:001",0],["trp:002",0],["trp:003",0],["atk:004",0],["utl:004",0]],
        "status":{
            # "exposed":{
            #     "data":[{"duration":2,"source":"sensor-mine"}],
            #     "description":"you are visible"
            # }
            # "bleed":{
            #     "data":[{"duration":3,"source":"penis-man"}],
            #     "description":"you are visible"
            # }
            # "UAV":{
            #     "data":[{"duration":3,"source":"penis-man"}],
            #     "description":"you are visible"
            # }
        },
        "ready":False,
        "player_logs":[],
        "player_animations":{},
        "visibletokens":{},
        "misc_tokenkeys":{
            "enemy_location":[] #token #tile
        },
        "damaged_logs":{}
    }
    def __init__(self):  # Default size or pass it in
        # Create a deep copy of the template for this instance
        import copy
        self.player_data = copy.deepcopy(self.playerstats_blueprint)

idlength = 20
alphastr = "abcdefghijklmnopqrstuvwxyz"
numerstr = "1234567890"
def generateID():
    output = ""
    for i in range(0,idlength):
        e1 = rand.randint(1,2)
        if e1 == 1:
            output+=numerstr[rand.randint(0,(len(numerstr)-1))]
            continue
        toappend = alphastr[rand.randint(0,(len(alphastr)-1))]
        e2 = rand.randint(1,4)
        if e2%2==0:
            toappend = toappend.upper()
        output+=toappend
    return output
        

registered_guests = {} #format => userID: websocket
all_rooms = {}
#intialise rooms
with open("serverfiles/setRoom.json","r") as reader: 
    roomIDs_arr = json.load(reader)["roomIDs"]
    for id in roomIDs_arr:
        all_rooms[id] = roomblueprint()

@app.get("/joinserverrequest/{USERID}/{ROOMID}/{USERNAME}")
async def func1(USERID:str, ROOMID:str,USERNAME:str):
    if not ROOMID in all_rooms.keys():
        return JSONResponse(content={"message":"not found"},status_code=200)
    room_json = all_rooms[ROOMID].room_data
    if(len(room_json["players"])>=room_json["max-players"]):
        return JSONResponse(content={"message":"room full"},status_code=200)
    room_json["players"].append(USERID)
    registered_guests[USERID] = None
    # add player stats
    room_json["playerstats"][USERID] = playerblueprint()
    # ================
    playerusernames[USERID] = USERNAME
    return JSONResponse(content={"message":"joined"},status_code=200)
class checkvaluesmodel(BaseModel):
    userID:str
    roomID:str
@app.post("/checkvalidvalues")
async def checkvalidvalues(model:checkvaluesmodel):
    userID = model.userID
    roomID = model.roomID

    if not roomID in all_rooms.keys():
        return JSONResponse(content={"error":"invalid room"})
    
    if not userID in all_rooms[roomID].room_data["players"]:
        return JSONResponse(content={"error":"invalid player"})
    
    return JSONResponse(content={"width":gameboard_size[0],"height":gameboard_size[1],"size":tilesize_in_px})
def func3(userTile,structure,leader): #I means include that tile A means exclude
    coodinates = userTile.split("_")
    total_coods = []
    arr = structure.split("-")
    YindexL = [i for i,val in enumerate(arr) if "I" in val or "A" in val][0]
    mark = "I" if "I" in arr[YindexL] else "A"
    XindexL = arr[YindexL].index(mark)

    Y = -1;
    X = -1
    for str_ in arr:
        Y+=1
        for char in str_:
            X+=1
            if char != "x" and char!="I":
                continue
            charX = XindexL-X
            charY = YindexL-Y
            invertX = -1
            if not leader:
                invertX = 1
            invertY = 1
            if not leader:
                invertY = -1
            newX = (int(coodinates[0])+charX*invertX)
            newY = (int(coodinates[1])+charY*invertY)
            if(newX>=gameboard_size[0] or newX<0 or newY>=gameboard_size[1] or newY<0):
                a=2
            else:
                total_coods.append(f"{newX}_{newY}")
        X=-1
    return total_coods


async def deliverMessageToClient(clients,message_json):
    for client in clients:
        await registered_guests[client].send_json(message_json)
async def updateandsendlogstoclient(lobby_ID,players,message): #players is an array and empty array == global log update
    if len(players) == 0:
        players = all_rooms[lobby_ID].room_data["players"]
    for client in players:
        loglist = all_rooms[lobby_ID].room_data["playerstats"][client].player_data["player_logs"]
        loglist.append(message)
        while len(loglist) > max_logsize:
            loglist.pop(0)
        await registered_guests[client].send_json({ # send to client
            "event":["update-player-logs"],
            "data[0]":loglist
        })
def updateplayerlogs(lobby_ID,players,message): #players is an array and empty array == global log update
    if len(players) == 0:
        players = all_rooms[lobby_ID].room_data["players"]
    for client in players:
        loglist = all_rooms[lobby_ID].room_data["playerstats"][client].player_data["player_logs"]
        loglist.append(message)
        while len(loglist) > max_logsize:
            loglist.pop(0)
def updateplayerlistjsonreturn(lobbyID):
    readystatejson = {}
    PLAYERARR = all_rooms[lobbyID].room_data["players"]
    for player in PLAYERARR:
        readystatejson[player] = all_rooms[lobbyID].room_data["playerstats"][player].player_data["ready"]
    maxplayers = 2
    if test:
        maxplayers = 1
    jsontoreturn = {"players":PLAYERARR,"leader":all_rooms[lobbyID].room_data["leader"],"ongoing":all_rooms[lobbyID].room_data["ongoing"],"readystate":readystatejson,"maxplayers":maxplayers}
    return jsontoreturn
def fetchclientsideability(id):
    split = id.split(":")
    with open("./abilities/"+split[0]+"/"+split[1]+".json","r") as reader:
        return json.load(reader)["clientside"]

@app.websocket("/clientSOCKET/{userID}/{lobbyID}")
async def websocket_endpoint(websocket: WebSocket, userID: str, lobbyID:str):
    await websocket.accept()
    registered_guests[userID] = websocket
    await updateandsendlogstoclient(lobbyID,[userID],formatcarddescription(f"->format:custom:bold:true###{playerusernames[userID]}->joined the lobby"))

    for player in all_rooms[lobbyID].room_data["players"]:
        if player!=userID:
            await updateandsendlogstoclient(lobbyID,[player],formatcarddescription(f"->format:custom:bold:true###{playerusernames[userID]}->joined the lobby"))
            break
    if(len(all_rooms[lobbyID].room_data["players"])==1):
        all_rooms[lobbyID].room_data["leader"] = userID
    await deliverMessageToClient(all_rooms[lobbyID].room_data["players"],{
        "event":["update-player-list"],
        "data[0]":updateplayerlistjsonreturn(lobbyID)
    })
    try:
        while True:
            data = await websocket.receive_text()
            await handlewebsocket_messages(lobbyID,userID,data)
            # Process received message
            
            # Send response back to client
            #await websocket.send_text(f"Echo: {data}")
    except Exception as e:
        exc_type, exc_value, exc_traceback = sys.exc_info()
        tb = traceback.extract_tb(exc_traceback)[-1]  # Get last traceback entry
        print(f"Error occurred on line {tb.lineno} in {tb.filename}")
        print(f"Line content: {tb.line}")
        print(f"Error: {exc_value}")
    finally:
        # delete from registered and the lobby
        del registered_guests[userID]
        all_rooms[lobbyID].room_data["players"].remove(userID)
        for player in all_rooms[lobbyID].room_data["players"]:
            all_rooms[lobbyID].room_data["playerstats"][player].player_data["ready"] = False
            await updateandsendlogstoclient(lobbyID,[player],formatcarddescription(f"->format:custom:bold:true###{playerusernames[userID]}->has left the lobby"))
        try:
            all_rooms[lobbyID].room_data["leader"] = all_rooms[lobbyID].room_data["players"][0]
            await deliverMessageToClient(all_rooms[lobbyID].room_data["players"],{
                "event":["update-player-list"],
                "data[0]":updateplayerlistjsonreturn(lobbyID)
            })
        except:
            if len(all_rooms[lobbyID].room_data["players"])==0:
                all_rooms[lobbyID] = roomblueprint()
async def handlewebsocket_messages(lobby_ID,userID,message):
    content_split = message.split("=>")
    if content_split[0] == "[loadabilitiestoserver]":
        all_abilities = content_split[1].split(" ")
        abilityarr = []
        for content in all_abilities:
            abilityarr.append([content,0])
        all_rooms[lobby_ID].room_data["playerstats"][userID].player_data["abilities"] = abilityarr
        return
    if content_split[0] == "[loadgameboard]":
        loadtype = content_split[1]
        inverted = False
        if all_rooms[lobby_ID].room_data["leader"]!=userID:
            inverted = True
        operation  = ""
        if loadtype == "startinglocation":
            operation = "starting"
            y = 0 if not inverted else gameboard_size[1]-1
            content = []
            for x in range(0,gameboard_size[0]):
                content.append(f"{x}_{y}")
            all_rooms[lobby_ID].room_data["playerstats"][userID].player_data["visibletiles"] = content 
        else:
            operation = "started"
            content = {}
            for tile in all_rooms[lobby_ID].room_data["playerstats"][userID].player_data["visibletiles"]:
                filtercontent = dict(all_rooms[lobby_ID].room_data["gameboard"][tile])
                #remove all invisible enemy traps
                to_remove = [] 
                for trap_ID in filtercontent["traps"]:
                    trapcontent = filtercontent["traps"][trap_ID]
                    trapcontent["source"] = getserversideabilityinfo(trapcontent["identifier"],"name")
                    if trapcontent["setter"] == userID:
                        continue
                    if trapcontent["invisible"]:
                        to_remove.append(trap_ID)
                for remove in to_remove:
                    del filtercontent["traps"][remove]
                content[tile] = filtercontent
            
            playerabilities = all_rooms[lobby_ID].room_data["playerstats"][userID].player_data["abilities"]
            abilityjson = {}
            for abilityid in playerabilities:
                c2 = fetchclientsideability(abilityid[0])
                c2["description"] = formatcarddescription(c2["description"])
                c2["cardcooldown"] = abilityid[1]
                abilityjson[abilityid[0]] = c2
            await deliverMessageToClient([userID],{
                "event":["load-user-abilities"],
                "data[0]":abilityjson
            })
        await deliverMessageToClient([userID],{
            "event":["user-gameboard-content"],
            "data[0]":{
                "operation":operation,
                "visibletiles": content,
                "visibletokens": all_rooms[lobby_ID].room_data["playerstats"][userID].player_data["visibletokens"],
                "inverted":inverted
            }
        })
        return
    if content_split[0] == "[setplayerready]":
        setready = True
        if content_split[1] == "false":
            setready = False
        elif content_split[1] == "setability":
            abilityjson = json.loads(content_split[2])
            all_rooms[lobby_ID].room_data["playerstats"][userID].player_data["currentusage"] = abilityjson
        elif content_split[1] == "animationready":
            print("ready")
        else:
            all_rooms[lobby_ID].room_data["playerstats"][userID].player_data["tilelocation"] = content_split[1]
        all_rooms[lobby_ID].room_data["playerstats"][userID].player_data["ready"] = setready
        await deliverMessageToClient(all_rooms[lobby_ID].room_data["players"],{
            "event":["update-player-list"],
            "data[0]":updateplayerlistjsonreturn(lobby_ID)
        })
        for player in all_rooms[lobby_ID].room_data["players"]: # check if both players are ready
            if not all_rooms[lobby_ID].room_data["playerstats"][player].player_data["ready"]:
                return
        if not all_rooms[lobby_ID].room_data["ongoing"]: # condition for setting timer check
            all_rooms[lobby_ID].room_data["timer_state"] = {} #clear out previous timers
            # begin timer
            timerID = generateID()
            timer_JSON = {
                "current":1,
                "set":[],
                "cancel":False
            }
            all_rooms[lobby_ID].room_data["timer_state"][timerID] = timer_JSON #create new unique timer
            await deliverMessageToClient(all_rooms[lobby_ID].room_data["players"],{
                "event":["timer-data"],
                "data[0]":{
                    "timer-id":timerID,
                    "seconds":timer_JSON["current"]
                }
            })
            return
        if all_rooms[lobby_ID].room_data["ongoing"]: #begin round animation
            if(content_split[1]) == "animationready":
                await handleanimations(lobby_ID)
            else:
                await round_operations(lobby_ID)
        return
    if content_split[0] == "[timer-running]": # game start timer
        chk = content_split[1].split(":") #id + cancel check
        timerID = chk[0]
        cancel = chk[1]
        try:
            all_rooms[lobby_ID].room_data["timer_state"][timerID]["set"].append(userID)
        except: # if fails means the timer is cleared which is expected
            return
        if cancel == "cancel":
            all_rooms[lobby_ID].room_data["timer_state"][timerID]["cancel"] = True
        if len(all_rooms[lobby_ID].room_data["timer_state"][timerID]["set"]) != len(all_rooms[lobby_ID].room_data["players"]):
            return
        if all_rooms[lobby_ID].room_data["timer_state"][timerID]["cancel"]:
            return
        all_rooms[lobby_ID].room_data["timer_state"][timerID]["set"] = [] # clear timer checker
        all_rooms[lobby_ID].room_data["timer_state"][timerID]["current"]-=1
        eventlist = ["timer-data"]
        if(all_rooms[lobby_ID].room_data["timer_state"][timerID]["current"]==0):
            eventlist.append("update-player-list")
            for player in all_rooms[lobby_ID].room_data["players"]: # game start == initialise game start here
                player_tile = all_rooms[lobby_ID].room_data["playerstats"][player].player_data["tilelocation"]
                all_rooms[lobby_ID].room_data["playerstats"][player].player_data["visibletiles"] = [player_tile]
                all_rooms[lobby_ID].room_data["playerstats"][player].player_data["ready"] = False
                all_rooms[lobby_ID].room_data["ongoing"] = True
                all_rooms[lobby_ID].room_data["gameboard"][player_tile]["players"].append(player)
        await deliverMessageToClient(all_rooms[lobby_ID].room_data["players"],{
            "event":eventlist,
            "data[0]":{
                "timer-id":timerID,
                "seconds":all_rooms[lobby_ID].room_data["timer_state"][timerID]["current"]
            },
            "data[1]":updateplayerlistjsonreturn(lobby_ID)
        })
        return
    if content_split[0] == "[request-status-update]": # send updates status to player
        statusjson = all_rooms[lobby_ID].room_data["playerstats"][userID].player_data["status"]
        await deliverMessageToClient([userID],{
            "event":["load-user-status"],
            "data[0]":statusjson
        })
        return


all_types = ['utl',"trp","mov",'atk']
async def round_operations(lobbyID):
    roundusage = {}
    for type in all_types:
        roundusage[type] = []
    for userID in all_rooms[lobbyID].room_data["players"]:
        ability_json= all_rooms[lobbyID].room_data["playerstats"][userID].player_data["currentusage"]
        # const abilityjson = { example json
        #     "tileselected":key,
        #     "abilityselected":abilityselected
        # }
        roundusage[ability_json["abilityselected"].split(":")[0]].append({
            "user":userID,
            "tile-touched":ability_json["tileselected"],
            "identifier":ability_json["abilityselected"]
        })
    
    for type in all_types:
        for content in roundusage[type]:
            if type == "utl":
                utl_action(lobbyID,content)
                continue
            if type == "mov":
                mov_action(lobbyID,content["user"],content["tile-touched"])
                continue
            if type == "atk":
                atk_action(lobbyID,content)
                continue
            if type == "trp":
                set_trap_action(lobbyID,content)
                continue
    await handleanimations(lobbyID)

async def handleanimations(lobbyID):
    # animations = trap-set, player-moved, status-applied
    for userID in all_rooms[lobbyID].room_data["players"]:
        all_rooms[lobbyID].room_data["playerstats"][userID].player_data["ready"] = False
        tosend = all_rooms[lobbyID].room_data["round_animations"][0][userID]
        for content in tosend: # send logs
            for txt in content["log_to_add"]:
                updateplayerlogs(lobbyID,[userID],txt)
        await deliverMessageToClient([userID],{
            "event":["user-animations"],
            "data[0]":tosend
        })
    # animationjson = {
    #     "sfx":"",
    #     "animation":"trap-set",
    #     "tile":json_["tile-touched"],
    #     "log_to_add":[f"|stylecolor:#71706E###{ability_json['name']}|styletrap set"]
    # }


@app.get("/api-game/gamestart/{lobby_ID}")
async def thebeginning(lobby_ID: str):
    all_rooms[lobby_ID].room_data["ongoing"] = True
    allplayers = all_rooms[lobby_ID].room_data["players"]
    for player in allplayers:
        player_stats = all_rooms[lobby_ID].room_data["playerstats"][player].player_data
        player_stats["ready"] = False
        player_stats["visibletiles"] = [player_stats["tilelocation"]]
        all_rooms[lobby_ID].room_data["gameboard"][player_stats["tilelocation"]]["players"].append(player)

    all_rooms[lobby_ID].room_data["rounds"] = 1
    updateplayerlogs(lobby_ID,"",f"|stylebold:true###Round {str(all_rooms[lobby_ID].room_data['rounds'])}")
    await deliverMessageToClient(all_rooms[lobby_ID].room_data["players"],{
        "leader":all_rooms[lobby_ID].room_data["leader"],
        "ongoing":all_rooms[lobby_ID].room_data["ongoing"],
        "round":all_rooms[lobby_ID].room_data["rounds"],
        "event":["update-player-list","update-player-gameboard","send-ability-gui","request-user-logs"]
    })
#@app.get("/api-game/newround/{lobby_ID}")
async def nextround(lobby_ID: str):
    allplayers = all_rooms[lobby_ID].room_data["players"]
    # see who got hit and send the sound effects before the round increments
    for player in allplayers:
        got_hit = False
        damaged_logs = all_rooms[lobby_ID].room_data["playerstats"][player].player_data["damaged_logs"]
        round = all_rooms[lobby_ID].room_data["rounds"]
        if not round in damaged_logs:
            continue
        round_logs = damaged_logs[round]
        for log_item in round_logs:
            if log_item["cause-entity"]==get_opposition(allplayers,player):
                got_hit = True
                break
        if got_hit: # send the hit notification to the other user
            await deliverMessageToClient([get_opposition(allplayers,player)],{
                "leader":all_rooms[lobby_ID].room_data["leader"],
                "ongoing":all_rooms[lobby_ID].room_data["ongoing"],
                "event":["play-track:hitenemy"] #
            })
                

    
    all_rooms[lobby_ID].room_data["rounds"]+=1
    updateplayerlogs(lobby_ID,"",f"|stylebold:true###Round {str(all_rooms[lobby_ID].room_data['rounds'])}")
    for player in allplayers:
        player_stats = all_rooms[lobby_ID].room_data["playerstats"][player].player_data
        player_stats["ready"] = False
        player_stats["visibletiles"] = [player_stats["tilelocation"]]

    #activate each status all player have
    for player in allplayers:
        player_status = all_rooms[lobby_ID].room_data["playerstats"][player].player_data["status"]
        for status in player_status:
            if status=="exposed":
                trapsetter = get_opposition(allplayers,player)
                trap_setter_status = all_rooms[lobby_ID].room_data["playerstats"][trapsetter].player_data
                var1 = trap_setter_status["misc_tokenkeys"]["enemy_location"]
                if len(var1)!=0:
                    removeItemFromVisibleToken(var1[0],var1[1],trap_setter_status["visibletokens"])
                id = setRandomID()
                trap_setter_status["misc_tokenkeys"]["enemy_location"] = [id,all_rooms[lobby_ID].room_data["playerstats"][player].player_data["tilelocation"]]
                addItemToVisibleToken(id,all_rooms[lobby_ID].room_data["playerstats"][player].player_data["tilelocation"],trap_setter_status["visibletokens"],[True,playerusernames[player],"players"])
                continue
            if status=="bleed":
                player_taking_damage(all_rooms[lobby_ID].room_data["playerstats"][player].player_data,all_status["bleed"]["damage"])
                updateplayerlogs(lobby_ID,player,formatcarddescription(f"format:damagetypephysical###{all_status['bleed']['damage']} damage->taken from->format:status###bleed"))
                continue
            if status=="burn":
                damage_taken = (all_status["burn"]["damage"])*len(player_status[status]["data"])
                player_taking_damage(all_rooms[lobby_ID].room_data["playerstats"][player].player_data,damage_taken)
                updateplayerlogs(lobby_ID,player,formatcarddescription(f"format:damagetypephysical###{damage_taken} damage->taken from->format:status###burn"))
                continue
            if status=="poison":
                player_data = all_rooms[lobby_ID].room_data["playerstats"][player].player_data
                if player_data["status"]["poison"]["data"][0]["skip"]:
                    player_data["status"]["poison"]["data"][0]["skip"] = False
                    continue
                damage = player_data["status"]["poison"]["data"][0]["potency"]
                player_taking_damage(player_data,damage)
                updateplayerlogs(lobby_ID,player,formatcarddescription(f"format:damagetypephysical###{damage} damage->taken from->format:status###poison"))
                continue
            if status=="UAV":
                UAV_data = player_status[status]["data"]
                for data in UAV_data:
                    tile_toreveal = data["tiles"].replace("'","").replace("[","").replace("]","").replace(" ","").split(",")
                    for tile in tile_toreveal:
                        all_rooms[lobby_ID].room_data["playerstats"][player].player_data["visibletiles"].append(tile)
                continue

    #tick down ability cooldowns
    for player in allplayers:
        PB = all_rooms[lobby_ID].room_data["playerstats"][player].player_data
        for ability_arr in PB["abilities"]:
            ability_arr[1]-=1
            if ability_arr[1]<0:
                ability_arr[1]=0

    #tick down status effects
    for player in allplayers:
        player_status = all_rooms[lobby_ID].room_data["playerstats"][player].player_data["status"]
        markforremoval_main = []
        for status in player_status:
            status_arr = player_status[status]["data"]
            markforremoval = []
            if(status=="poison"):
                poison_content = status_arr[0]
                poison_content["potency"]-=1
                if(poison_content["potency"]<=0):
                    markforremoval_main.append(status)
                continue
            for i in range(0,len(status_arr)):
                status1 = status_arr[i]
                status1["duration"]-=1
                if(status1["duration"]==0 or status1["duration"]<0):
                    markforremoval.append(i)
            for indextoremove in sorted(markforremoval,reverse=True):
                if(status=="UAV"): # remove the visible tiles
                    tile_toremove = status_arr[indextoremove]["tiles"].replace("'","").replace("[","").replace("]","").replace(" ","").split(",")
                    for tile in tile_toremove:
                        all_rooms[lobby_ID].room_data["playerstats"][player].player_data["visibletiles"].remove(tile)
                del status_arr[indextoremove]
            if(len(status_arr)==0):
                markforremoval_main.append(status)
        expiredStatusText = "->format:status###"
        for remove in markforremoval_main:
            del player_status[remove]
            #expiredStatusText+=f"|stylecolor:#BA8E23,tooltip:{all_status[remove]['tooltip'].replace(' ','~')}###{remove}|style "
            expiredStatusText+=remove+"&"
            if(remove=="exposed"):
                opposition = get_opposition(allplayers,player)
                opposition_data = all_rooms[lobby_ID].room_data["playerstats"][opposition].player_data
                var1 = opposition_data["misc_tokenkeys"]["enemy_location"]
                removeItemFromVisibleToken(var1[0],var1[1],opposition_data["visibletokens"])
        if not expiredStatusText=="->format:status###":
            expiredStatusText = expiredStatusText[:-1]+"->"
            updateplayerlogs(lobby_ID,player,f"{formatcarddescription(expiredStatusText)} has expired")

    #check for player hp and if its over
    player_lost = []
    for player in allplayers: #check players health
        player_hp = all_rooms[lobby_ID].room_data["playerstats"][player].player_data["health"][0]
        if(player_hp<=0):
            player_lost.append(player)
    if len(player_lost)>0: #end game
        await deliverMessageToClient(all_rooms[lobby_ID].room_data["players"],{
            "leader":all_rooms[lobby_ID].room_data["leader"],
            "ongoing":all_rooms[lobby_ID].room_data["ongoing"],
            "losers":player_lost,
            "event":["game-end"]
        })
        for player in allplayers:
           await registered_guests[player].close()
        return
    
    await deliverMessageToClient(all_rooms[lobby_ID].room_data["players"],{
        "leader":all_rooms[lobby_ID].room_data["leader"],
        "ongoing":all_rooms[lobby_ID].room_data["ongoing"],
        "event":["reset-abilities-&-actions","update-player-list","send-ability-gui","request-user-logs","update-user-statuses","update-user-tokens","update-player-gameboard"]
    })

@app.get("/api-game/get_image/{content}")
async def fetchAssests(content:str):
    path = "./gallery-assests/"+content.replace("|","/")
    if not os.path.exists(path):
        return JSONResponse(content={},status_code=404)
    return FileResponse(path)

def addItemToVisibleToken(tokenID,tile,player_visible_tokens,content_arr): #content_arr = [enemy,itemname,type]
    visibletokensformat = {
        "enemy":content_arr[0],
        "itemname":content_arr[1],
        "type":content_arr[2]
    }
    current = {}
    if tile in player_visible_tokens:
        current = player_visible_tokens[tile]
    current[tokenID] = visibletokensformat
    player_visible_tokens[tile] = current
def removeItemFromVisibleToken(tokenID,tile,player_visible_tokens):
    if not tile in player_visible_tokens:
        return
    current = player_visible_tokens[tile]
    del current[tokenID]
    player_visible_tokens[tile] = current
    if len(current)==0:
        del player_visible_tokens[tile]
def getserversideabilityinfo(identifier,specific): #'trp:001'
    type = identifier.split(":")[0]
    id = identifier.split(":")[1]
    with open("./abilities/"+type+"/"+id+".json","r") as reader:
        if(specific==None or specific==""):
            return json.load(reader)["serverside"]
        json_loaded = json.load(reader)["serverside"]
        return json_loaded[specific]
def player_taking_damage(player_data_json,damage):#player is victim
    player_data_json["health"][0]-=damage
def update_playerdamagelogs(currentRound,player_data_json,damagelogjson):
    # { damagelogjson example
    #     "damage":2,
    #     "cause":"",
    #     "cause-type":"" #mine? attacK?
    #     "cause-entity":"" # which entity caused it (the players name or bot if its a status effect just put status)
    # }
    arr = []
    if currentRound in player_data_json["damaged_logs"]:
        arr = player_data_json["damaged_logs"][currentRound]
    arr.append(damagelogjson)
    player_data_json["damaged_logs"][currentRound] = arr

def updateanimationsjson(lobbyID,animation): # append is true or false,if false = create a new array, true = append to previous animation array
    all_rooms[lobbyID].room_data["round_animations"].append(animation)


all_types = ['utl',"trp","mov",'atk']
def get_opposition(players,currentplayer): # =============================================================================
    if test:
        return currentplayer
    for p in players:
        if currentplayer!=p:
            return p
def set_trap_action(lobbyID,json_): #example json = {'identifier': 'trp:001', 'tile-touched': ['2_2'], 'user': 'ltcDkmCla'}
    trap_jsondata = {
        "setter":json_["user"],
        "identifier":json_["identifier"]
    }
    for tile_touched in json_["tile-touched"]:
        trapID = generateID()
        #all_rooms[lobbyID].room_data["playerstats"][json_["user"]].player_data["traps"].append(trapID)
        ability_json = getserversideabilityinfo(json_["identifier"],"")
        addItemToVisibleToken(trapID,tile_touched,all_rooms[lobbyID].room_data["playerstats"][json_["user"]].player_data["visibletokens"],[False,ability_json["name"],"traps"])
        trap_jsondata["invisible"] = ability_json["invisible"]
        all_rooms[lobbyID].room_data["gameboard"][tile_touched]["traps"][trapID] = trap_jsondata

    animationjson = {
        "sfx":"",
        "animation":"trap-set",
        "tile":json_["tile-touched"],
        "log_to_add":[f"|stylecolor:#71706E###{ability_json['name']}|styletrap set"]
    }
    updateanimationsjson(lobbyID,{json_["user"]:[animationjson]})
def trap_stepped_check(lobbyID,player,tile): #player here is the victim
    tiledata = all_rooms[lobbyID].room_data["gameboard"][tile]["traps"]
    setforRemoval = []
    for data in tiledata:
        trap_json = getserversideabilityinfo(tiledata[data]["identifier"],"")
        if not trigger_own_trap and not trap_json["friendly-fire"]:
            if tiledata[data]["setter"] == player:
                continue
        #trigger it
        setforRemoval.append(data)
        removeItemFromVisibleToken(data,tile,all_rooms[lobbyID].room_data["playerstats"][tiledata[data]["setter"]].player_data["visibletokens"]) #remove from setter
        if tiledata[data]["setter"] != player:
            updateplayerlogs(lobbyID,tiledata[data]["setter"],f"|stylebold:true###{player}|stylestepped into|stylecolor:#71706E###{trap_json['name']}")
        
        inflicted = True if len(trap_json["effect"])!=0 else False
        damage = True if trap_json["damage"]!=0 else False
        outputstr = ""
        trap_str = ""
        if damage:
            player_taking_damage(all_rooms[lobbyID].room_data["playerstats"][player].player_data,trap_json["damage"])
            outputstr+=f"it dealt->format:damagetypephysical###{trap_json['damage']} damage->"
        if inflicted:
            applyeffect(lobbyID,tiledata[data]["identifier"],player,[])
            trap_str = "->format:status###"
            for eff in trap_json["effect"]:
                trap_str+=eff+"&"
            trap_str = trap_str[:-1]+"->"
        updateplayerlogs(lobbyID,player,f"You stepped into|stylecolor:#71706E###{trap_json['name']}|style{formatcarddescription(outputstr)} and it inflicted {formatcarddescription(trap_str)}")
        update_playerdamagelogs(all_rooms[lobbyID].room_data["rounds"],all_rooms[lobbyID].room_data["playerstats"][player].player_data,{"damage":trap_json['damage'],"cause":trap_json["name"],"cause-type":"trap","cause-entity":tiledata[data]["setter"]})
    #remove trap from gameboard
    for removaltrap in setforRemoval:
        del tiledata[removaltrap]

def mov_action(lobbyID,user,tile_to_move_to):
    tile_to_move_to = tile_to_move_to[0]
    player_data = all_rooms[lobbyID].room_data["playerstats"][user].player_data
    player_data["visibletiles"].remove(player_data["tilelocation"])
    all_rooms[lobbyID].room_data["gameboard"][player_data["tilelocation"]]["players"].remove(user)
    player_data["tilelocation"] = tile_to_move_to
    player_data["visibletiles"].append(player_data["tilelocation"])
    all_rooms[lobbyID].room_data["gameboard"][player_data["tilelocation"]]["players"].append(user)

    
    animationjson = {
        "sfx":"",
        "animation":"player-moved",
        "tile":[tile_to_move_to],
        "log_to_add":[]
    }
    updateanimationsjson(lobbyID,{user:[animationjson]})
    
    trap_stepped_check(lobbyID,user,tile_to_move_to)
def atk_action(lobbyID,json_): #example json = {'identifier': 'trp:001', 'tile-touched': ['2_2'], 'user': 'ltcDkmCla'}
    touched = False
    for tile_touched in json_["tile-touched"]:
        boarddata = all_rooms[lobbyID].room_data["gameboard"][tile_touched]["players"]
        enemy = get_opposition(all_rooms[lobbyID].room_data["players"],json_["user"])
        ability_json = getserversideabilityinfo(json_["identifier"],"")
        if enemy in boarddata:
            inflicted = True if len(ability_json["effect"])!=0 else False
            damage = True if ability_json["damage"]!=0 else False
            touched = True

            if damage:
                player_taking_damage(all_rooms[lobbyID].room_data["playerstats"][enemy].player_data,ability_json["damage"])
            if inflicted:
                applyeffect(lobbyID,json_["identifier"],enemy,[])
            
            logtxt = (f"for->format:damagetypephysical###{ability_json['damage']} damage->") if damage else ""
            statusapplied = "->format:status###" if inflicted else ""
            if inflicted:
                for effect in ability_json['effect']:
                    statusapplied+=f"{effect}&"
                statusapplied = statusapplied[:-1]+"->"
            updateandsendlogstoclient(lobbyID,enemy,formatcarddescription(f"hit by ->format:itemname###{ability_json['name']}->{logtxt}{('and inflicted with '+statusapplied) if inflicted else ''}"))
            logtxt = (f"for->format:damagetypephysical###{ability_json['damage']} damage->") if damage else ""
            updateplayerlogs(lobbyID,json_["user"],formatcarddescription(f"hit->format:custom:bold:true###{playerusernames[enemy]}->{logtxt}using->format:itemname###{ability_json['name']}->{(', inflicted '+statusapplied) if inflicted else ''}"))
            update_playerdamagelogs(all_rooms[lobbyID].room_data["rounds"],all_rooms[lobbyID].room_data["playerstats"][enemy].player_data,{"damage":ability_json["damage"],"cause":ability_json["name"],"cause-type":"attack","cause-entity":json_["user"]})
    if not touched:
        updateplayerlogs(lobbyID,json_["user"],formatcarddescription(f"used->format:itemname###{ability_json['name']}->and it missed"))
        return False
def utl_action(lobbyID,json_): #example json = {'identifier': 'trp:001', 'tile-touched': ['2_2'], 'user': 'ltcDkmCla'}
    ability_json = getserversideabilityinfo(json_["identifier"],"")
    inflicted = True if len(ability_json["effect"])!=0 else False
    damage = True if ability_json["damage"]!=0 else False

    if ability_json["name"] == "scout" or ability_json["name"] =="aerial-scan":
        updateanimationsjson(lobbyID,{json_["user"]:[applyeffect(lobbyID,json_["identifier"],json_["user"],json_["tile-touched"])]})
        return
    # for tile_touched in json_["tile-touched"]:
    #     boarddata = all_rooms[lobbyID].room_data["gameboard"][tile_touched]["players"]
    #     enemy = get_opposition(all_rooms[lobbyID].room_data["players"],json_["user"])
    #     ability_json = getserversideabilityinfo(json_["identifier"],"")
    #     if enemy in boarddata:
    #         touched = True

    #         if damage:
    #             player_taking_damage(all_rooms[lobbyID].room_data["playerstats"][enemy].player_data,ability_json["damage"])
    #         if inflicted:
    #             applyeffect(lobbyID,json_["identifier"],enemy,[])
            
    #         logtxt = (f"for|stylecolor:#FF0000###{ability_json['damage']} damage|style") if damage else ""
    #         statusapplied = "[" if inflicted else ""
    #         if inflicted:
    #             for effect in ability_json['effect']:
    #                 statusapplied+=f"|stylecolor:#BA8E23,tooltip:{all_status[effect]['tooltip'].replace(' ','~')}###{effect}|style "
    #             statusapplied = statusapplied.rstrip().replace(" ",",")+"]"
    #         updateplayerlogs(lobbyID,enemy,f"hit by |stylecolor:#71706E###{ability_json['name']}|style{logtxt}{("and inflicted with "+statusapplied) if inflicted else ""}")
    #         logtxt = (f"for|stylecolor:#FF0000###{ability_json['damage']} damage|style") if damage else ""
    #         updateplayerlogs(lobbyID,json_["user"],f"hit |stylebold:true###{playerusernames[enemy]}|style{logtxt}using|stylecolor:#71706E###{ability_json['name']}{("|style, inflicted "+statusapplied) if inflicted else ""}")
    
    
    # ability_json = getserversideabilityinfo(json_["identifier"],"")
    # if ability_json["name"]=="scout":
    #     applyeffect(lobbyID,json_["identifier"],json_["user"],[json_["tile-touched"]])
    #     return
    # if ability_json["name"]=="lose":
    #     player_taking_damage(all_rooms[lobbyID].room_data["playerstats"][json_["user"]].player_data,100000000)
    #     return
    # if ability_json["name"]=="dummy":
    #     player_taking_damage(all_rooms[lobbyID].room_data["playerstats"][json_["user"]].player_data,100000000)
    #     return

# example = {'ipnypFuRME': {'identifier': 'mov:001', 'tile-touched': '2_1'}, 'XOZlJBhVb': {'identifier': 'mov:001', 'tile-touched': '3_4'}}
def game_operations(lobbyID):
    allplayers = all_rooms[lobbyID].room_data["players"]
    gamedata = {}
    for setter in all_types:
        gamedata[setter] = []
    for player in allplayers:
        PB = all_rooms[lobbyID].room_data["playerstats"][player].player_data
        round_stats = PB["currentusage"]
        # get card cooldown and apply it
        for player_abilities in PB["abilities"]:
            if(player_abilities[0]==round_stats["identifier"]):
                player_abilities[1] = (getserversideabilityinfo(round_stats["identifier"],"cooldown")+1)
                break
        round_stats["user"] = player # ==> added userID to data
        leader = True if all_rooms[lobbyID].room_data["leader"] == player else False
        if getserversideabilityinfo(round_stats["identifier"],"cursor") == "player":
            round_stats["tile-touched"] = func3(PB["tilelocation"],getserversideabilityinfo(round_stats["identifier"],"tileformat"),leader)
        else:
            round_stats["tile-touched"] = func3(round_stats["tile-touched"],getserversideabilityinfo(round_stats["identifier"],"tileformat"),leader)
        gamedata[round_stats["identifier"].split(":")[0]].append(round_stats)
        PB["currentusage"] = {}
    for type in all_types:
        for json_data in gamedata[type]:
            if(type=="mov"):
                moving_action(lobbyID,json_data["user"],json_data["tile-touched"])
                continue
            if(type=="atk"):
                atk_action(lobbyID,json_data)
                continue
            if(type=="trp"):
                set_trap_action(lobbyID,json_data)
                continue
            if(type=="utl"):
                utl_action(lobbyID,json_data)
                continue

        #after trap set see if anyone is on the traps player movement is afterwards
        allplayers = all_rooms[lobbyID].room_data["players"]
        for player in allplayers:
            playertile = all_rooms[lobbyID].room_data["playerstats"][player].player_data["tilelocation"]
            trap_stepped_check(lobbyID,player,playertile)
def applyeffect(lobbyID,abilityidentifier,player,tilesAffected): #player here is the victim 
    split =  abilityidentifier.split(":")
    with open("./abilities/"+split[0]+"/"+split[1]+".json","r") as reader:
        ability_data = json.load(reader)["serverside"]
        effectstr = ""
        for effect in ability_data["effect"]:
            effect_json = {
                "data":[],
                "description":all_status[effect]["description"]
            }
            if effect in all_rooms[lobbyID].room_data["playerstats"][player].player_data["status"]:
                effect_json = all_rooms[lobbyID].room_data["playerstats"][player].player_data["status"][effect]
            if(effect=="poison"):
                if len(effect_json["data"])==0:
                    effect_json["data"].append({
                        "potency":ability_data["effect-duration"]+1,
                        "skip":True
                    })
                else:
                    effect_json["data"][0]["potency"]+=ability_data["effect-duration"]
            else:
                json_toappend = {
                    "duration":ability_data["effect-duration"]+1,
                    "source":ability_data["name"]
                }
                if len(tilesAffected) != 0:
                    json_toappend["tiles"] = str(tilesAffected).replace("'","")
                effect_json["data"].append(json_toappend)
            all_rooms[lobbyID].room_data["playerstats"][player].player_data["status"][effect] = effect_json
            effectstr+=f"format:status###{effect}->"
        animationjson = {
            "sfx":"",
            "animation":"status-applied",
            "tile":[all_rooms[lobbyID].room_data["playerstats"][player].player_data["tilelocation"]],
            "log_to_add":[formatcarddescription(effectstr+"applied")]
        }
        return animationjson
def applySpecialeffect(lobbyID,abilityidentifier,player,tilesAffected): #player here is the victim this is for status that affect tiles tilesAffected is arr
    split =  abilityidentifier.split(":")
    with open("./abilities/"+split[0]+"/"+split[1]+".json","r") as reader:
        ability_data = json.load(reader)["serverside"]
        for effect in ability_data["effect"]:
            effect_json = {
                "data":[],
                "description":all_status[effect]["description"]
            }
            if effect in all_rooms[lobbyID].room_data["playerstats"][player].player_data["status"]:
                effect_json = all_rooms[lobbyID].room_data["playerstats"][player].player_data["status"][effect]
            effect_json["data"].append({
                "duration":ability_data["effect-duration"]+1,
                "source":ability_data["name"]
            })
            all_rooms[lobbyID].room_data["playerstats"][player].player_data["status"][effect] = effect_json




def formatcarddescription(description):
    new_description = ""
    for part in description.split("->"):
        if part == "":
            continue
        if "###" not in part:
            new_description+=(part+" ")
            continue

        split = part.split("###")
        wantedformat = split[0].split(":")[1]
        if(wantedformat=="status"):
            new_description += "|style["
            for status in split[1].split("&"):
                new_description+=f"|stylecolor:#BA8E23,tooltip:{all_status[status]['tooltip'].replace(' ','~')}###{status}|style,"
            new_description = new_description[:-1]+"]|style"
            continue
        if("damagetype" in wantedformat):
            damage_type = wantedformat.replace("damagetype","")
            hexcolor = "#000000"
            if damage_type == "physical":
                hexcolor = "#FF0000"
            new_description+=f"|stylecolor:{hexcolor}###{split[1]}|style "
            continue
        if(wantedformat=="custom"):
            add_content = ""
            for components in split[0].replace("format:custom:","").split(","):
                comp_split = components.split(":")
                if(comp_split[0]=="color"):
                    add_content+=f"color:{comp_split[1]},"
                    continue
                if(comp_split[0]=="tooltip"):
                    add_content+=f"tooltip:{comp_split[1].replace(' ','~')},"
                    continue
                if(comp_split[0]=="bold"):
                    add_content+=f"bold:true,"
                    continue
            new_description+=f"|style{add_content[:-1]}###{split[1]}|style "
            continue
        if(wantedformat=="itemname"):
            hexcolor = "#71706E"
            new_description+=f"|stylecolor:{hexcolor}###{split[1]}|style "
            continue
        print(new_description)
    return new_description.strip()


