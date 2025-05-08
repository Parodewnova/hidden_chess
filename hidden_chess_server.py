from fastapi.responses import JSONResponse, FileResponse, PlainTextResponse,StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, File, UploadFile, Request, Response,status, WebSocket
from pydantic import BaseModel

import json,random

test = True

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
gameboard_size = [5,5] # row,height
class roomblueprint():
    roomjson_blueprint = {
        "leader":"",
        "ongoing":False,
        "players":[],
        "max-players":2,
        "rounds":0,
        "gameboard":{},
        "playerstats":{},
        "operation":False
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
        "abilities":[["mov:001",0],["trp:001",0],["trp:002",0],["trp:003",0],["atk:001",0]],
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
        "visibletokens":{},
        "misc_tokenkeys":{
            "enemy_location":[] #token #tile
        }
    }
    def __init__(self):  # Default size or pass it in
        # Create a deep copy of the template for this instance
        import copy
        self.player_data = copy.deepcopy(self.playerstats_blueprint)


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
async def func2(model:checkvaluesmodel):
    userID = model.userID
    roomID = model.roomID

    if not roomID in all_rooms.keys():
        return JSONResponse(content={"error":"invalid room"})
    
    if not userID in all_rooms[roomID].room_data["players"]:
        return JSONResponse(content={"error":"invalid player"})
    
    return JSONResponse(content={"width":gameboard_size[0],"height":gameboard_size[1]})

async def deliverMessageToClient(clients,message_json):
    for client in clients:
        await registered_guests[client].send_json(message_json)
def updateplayerlogs(lobby_ID,player,message):
    player_arr = [player]
    if player==None or player == "": #global log update
        player_arr = all_rooms[lobby_ID].room_data["players"]
    for player in player_arr: 
        loglist = all_rooms[lobby_ID].room_data["playerstats"][player].player_data["player_logs"]
        loglist.append(message)
        while len(loglist) > max_logsize:
            loglist.pop(0)

@app.websocket("/clientSOCKET/{userID}/{lobbyID}")
async def websocket_endpoint(websocket: WebSocket, userID: str, lobbyID:str):
    await websocket.accept()
    registered_guests[userID] = websocket
    updateplayerlogs(lobbyID,userID,f"|stylebold:true###{playerusernames[userID]}|style        joined the lobby")


    for player in all_rooms[lobbyID].room_data["players"]:
        if player!=userID:
            updateplayerlogs(lobbyID,player,f"|stylebold:true###{playerusernames[userID]}|style        joined the lobby")
            break
    if(len(all_rooms[lobbyID].room_data["players"])==1):
        all_rooms[lobbyID].room_data["leader"] = userID
    await deliverMessageToClient(all_rooms[lobbyID].room_data["players"],{
        "leader":all_rooms[lobbyID].room_data["leader"],
        "ongoing":all_rooms[lobbyID].room_data["ongoing"],
        "event":["update-player-list","update-player-gameboard","request-user-logs"] #
    })
    try:
        while True:
            data = await websocket.receive_text()
            # Process received message
            
            # Send response back to client
            #await websocket.send_text(f"Echo: {data}")
    except Exception as e:
        a = 2
    finally:
        # delete from registered and the lobby
        del registered_guests[userID]
        all_rooms[lobbyID].room_data["players"].remove(userID)
        for player in all_rooms[lobbyID].room_data["players"]:
            all_rooms[lobbyID].room_data["playerstats"][player].player_data["ready"] = False
            updateplayerlogs(lobbyID,player,f"|stylebold:true###{playerusernames[userID]}|style        has left the lobby")
        try:
            all_rooms[lobbyID].room_data["leader"] = all_rooms[lobbyID].room_data["players"][0]
            await deliverMessageToClient(all_rooms[lobbyID].room_data["players"],{
                "leader":all_rooms[lobbyID].room_data["leader"],
                "ongoing":all_rooms[lobbyID].room_data["ongoing"],
                "event":["update-player-list","request-user-logs"]
            })
        except:
            if len(all_rooms[lobbyID].room_data["players"])==0:
                all_rooms[lobbyID] = roomblueprint()



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
    all_rooms[lobby_ID].room_data["rounds"]+=1
    updateplayerlogs(lobby_ID,"",f"|stylebold:true###Round {str(all_rooms[lobby_ID].room_data['rounds'])}")
    allplayers = all_rooms[lobby_ID].room_data["players"]
    for player in allplayers:
        player_stats = all_rooms[lobby_ID].room_data["playerstats"][player].player_data
        player_stats["ready"] = False
        player_stats["visibletiles"] = [player_stats["tilelocation"]]
    
    #check if players are on each other
    # if not test:
    #     for player in allplayers:
    #         opposition = get_opposition(allplayers,player)
    #         player_data = all_rooms[lobby_ID].room_data["playerstats"][player].player_data
    #         if player_data["tilelocation"]==all_rooms[lobby_ID].room_data["playerstats"][opposition].player_data["tilelocation"]:
    #             applyeffect(lobby_ID,"msc:001",opposition)

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
                updateplayerlogs(lobby_ID,player,f"|stylecolor:#FF0000###{all_status['bleed']['damage']} damage|styletaken from|stylecolor:#BA8E23,tooltip:{all_status['bleed']['tooltip'].replace(' ','~')}###[bleed]")
            if status=="UAV":
                UAV_data = player_status[status]["data"]
                for data in UAV_data:
                    tile_toreveal = data["tiles"].replace("'","").replace("[","").replace("]","").replace(" ","").split(",")
                    for tile in tile_toreveal:
                        all_rooms[lobby_ID].room_data["playerstats"][player].player_data["visibletiles"].append(tile)

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
        for remove in markforremoval_main:
            del player_status[remove]
            if(remove=="exposed"):
                opposition = get_opposition(allplayers,player)
                opposition_data = all_rooms[lobby_ID].room_data["playerstats"][opposition].player_data
                var1 = opposition_data["misc_tokenkeys"]["enemy_location"]
                removeItemFromVisibleToken(var1[0],var1[1],opposition_data["visibletokens"])
                updateplayerlogs(lobby_ID,player,"you are no longer|stylecolor:#BA8E23,tooltip:{all_status['exposed']['tooltip'].replace(' ','~')}###exposed")

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
        "event":["reset-abilities-&-actions","update-player-list","send-ability-gui","request-user-logs","update-user-statuses","update-user-tokens","update-player-gameboard","new-round"]
    })

def setRandomID():
    max = 10
    var = "abcdefghijklmnopqrstuvwxyz123456789"
    toreturn = ""
    for i in range(0,max):
        toreturn+=var[random.randint(0,(len(var)-1))]
    return toreturn
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



all_types = ["trp","mov",'atk','spell']
def get_opposition(players,currentplayer): # =============================================================================
    if test:
        return currentplayer
    for p in players:
        if currentplayer!=p:
            return p
def set_trap_action(lobbyID,json_): #example json = {'identifier': 'trp:001', 'tile-touched': '2_2', 'user': 'ltcDkmCla'}
    trap_jsondata = {
        "setter":json_["user"],
        "identifier":json_["identifier"]
    }
    trapID = setRandomID()
    #all_rooms[lobbyID].room_data["playerstats"][json_["user"]].player_data["traps"].append(trapID)
    ability_json = getserversideabilityinfo(json_["identifier"],"")
    addItemToVisibleToken(trapID,json_["tile-touched"],all_rooms[lobbyID].room_data["playerstats"][json_["user"]].player_data["visibletokens"],[False,ability_json["name"],"traps"])
    updateplayerlogs(lobbyID,json_["user"],f"|stylecolor:#71706E###{ability_json['name']}|styletrap set")
    trap_jsondata["invisible"] = ability_json["invisible"]
    all_rooms[lobbyID].room_data["gameboard"][json_["tile-touched"]]["traps"][trapID] = trap_jsondata
def trap_stepped_check(lobbyID,player,tile): #player here is the victim
    tiledata = all_rooms[lobbyID].room_data["gameboard"][tile]["traps"]
    setforRemoval = []
    for data in tiledata:
        if tiledata[data]["setter"] == player:
            continue
        #trigger it
        setforRemoval.append(data)
        trap_json = getserversideabilityinfo(tiledata[data]["identifier"],"")
        removeItemFromVisibleToken(data,tile,all_rooms[lobbyID].room_data["playerstats"][tiledata[data]["setter"]].player_data["visibletokens"]) #remove from setter
        updateplayerlogs(lobbyID,tiledata[data]["setter"],f"|stylebold:true###{player}|stylestepped into|stylecolor:#71706E###{trap_json['name']}")
        trap_effects = trap_json["effect"]
        trap_str = "["
        for eff in trap_effects:
            trap_str+=f"|stylecolor:#BA8E23,tooltip:{all_status[eff]['tooltip'].replace(' ','~')}###{eff}|style "
        trap_str = trap_str.rstrip().replace(" ",",")+"]"
        updateplayerlogs(lobbyID,player,f"You stepped into|stylecolor:#71706E###{trap_json['name']}|style and got {trap_str}")
        applyeffect(lobbyID,tiledata[data]["identifier"],player)
    #remove trap from gameboard
    for removaltrap in setforRemoval:
        del tiledata[removaltrap]

def moving_action(lobbyID,json):
    moved_player = json["user"]
    player_data = all_rooms[lobbyID].room_data["playerstats"][moved_player].player_data
    player_data["visibletiles"].remove(player_data["tilelocation"])
    all_rooms[lobbyID].room_data["gameboard"][player_data["tilelocation"]]["players"].remove(moved_player)
    player_data["tilelocation"] = json["tile-touched"]
    player_data["visibletiles"].append(player_data["tilelocation"])
    all_rooms[lobbyID].room_data["gameboard"][player_data["tilelocation"]]["players"].append(moved_player)
    trap_stepped_check(lobbyID,moved_player,json["tile-touched"])
    updateplayerlogs(lobbyID,moved_player,"You moved")
def atk_action(lobbyID,json_): #example json = {'identifier': 'trp:001', 'tile-touched': '2_2', 'user': 'ltcDkmCla'}
    boarddata = all_rooms[lobbyID].room_data["gameboard"][json_["tile-touched"]]["players"]
    enemy = get_opposition(all_rooms[lobbyID].room_data["players"],json_["user"])
    ability_json = getserversideabilityinfo(json_["identifier"],"")
    if enemy in boarddata:
        updateplayerlogs(lobbyID,json_["user"],f"hit |stylebold:true###{playerusernames[enemy]}|stylefor|stylecolor:#FF0000###{ability_json['damage']} damage|styleusing|stylecolor:#71706E###{ability_json['name']}")
        updateplayerlogs(lobbyID,enemy,f"hit by |stylecolor:#71706E###{ability_json['name']}|stylefor|stylecolor:#FF0000###{ability_json['damage']} damage")
        if ability_json["name"]=="strike":
            player_taking_damage(all_rooms[lobbyID].room_data["playerstats"][enemy].player_data,ability_json["damage"])
            applyeffect(lobbyID,json_["identifier"],enemy)
    else:
        updateplayerlogs(lobbyID,json_["user"],f"used |stylecolor:#71706E###{ability_json['name']}|style and it missed")
def spell_action(lobbyID,json_):
    ability_json = getserversideabilityinfo(json_["identifier"],"")
    if ability_json["name"]=="scout":
        applySpecialeffect(lobbyID,json_["identifier"],json_["user"],[json_["tile-touched"]])
        return
    if ability_json["name"]=="lose":
        player_taking_damage(all_rooms[lobbyID].room_data["playerstats"][json_["user"]].player_data,100000000)
        return

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
        gamedata[round_stats["identifier"].split(":")[0]].append(round_stats)
        PB["currentusage"] = {}
    for type in all_types:
        for json_data in gamedata[type]:
            if(type=="mov"):
                moving_action(lobbyID,json_data)
                continue
            if(type=="atk"):
                atk_action(lobbyID,json_data)
                continue
            if(type=="trp"):
                set_trap_action(lobbyID,json_data)
                continue
            if(type=="spell"):
                spell_action(lobbyID,json_data)
                continue

        #after trap set see if anyone is on the traps player movement is afterwards
        allplayers = all_rooms[lobbyID].room_data["players"]
        for player in allplayers:
            playertile = all_rooms[lobbyID].room_data["playerstats"][player].player_data["tilelocation"]
            trap_stepped_check(lobbyID,player,playertile)
def applyeffect(lobbyID,abilityidentifier,player): #player here is the victim
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
                "source":ability_data["name"],
                "tiles":str(tilesAffected).replace("'","")
            })
            all_rooms[lobbyID].room_data["playerstats"][player].player_data["status"][effect] = effect_json

    

@app.post("/api-game/userready/{lobby_ID}")
async def funcapi1(lobby_ID: str, request:Request):
    raw_body = await request.body()  # Get raw bytes
    body_json = json.loads(raw_body.decode())

    user_ID = body_json["userID"]
    mode = body_json["mode"]
    readystate = body_json["readystate"]

    allplayers = all_rooms[lobby_ID].room_data["players"]
    if not test:
        if(len(allplayers)!=2): #SEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
            return
    begin_game = True
    for player in allplayers:
        if(player==user_ID):
            all_rooms[lobby_ID].room_data["playerstats"][user_ID].player_data["ready"] = readystate
        ready = all_rooms[lobby_ID].room_data["playerstats"][player].player_data["ready"]
        if not ready:
            begin_game = False
        if(mode=="initialise"): # set player starting tile
            all_rooms[lobby_ID].room_data["playerstats"][user_ID].player_data["tilelocation"] = body_json["tile"]
        if(mode=="useraction"):
             all_rooms[lobby_ID].room_data["playerstats"][user_ID].player_data["currentusage"] = body_json["ability"]

    if not all_rooms[lobby_ID].room_data["ongoing"]: # not ongoing means starting game
        await deliverMessageToClient(all_rooms[lobby_ID].room_data["players"],{
            "leader":all_rooms[lobby_ID].room_data["leader"],
            "ongoing":all_rooms[lobby_ID].room_data["ongoing"],
            "readytobegin":begin_game,
            "event":["toggle-start-button"]
        })
        return
    if not begin_game:
        await deliverMessageToClient(all_rooms[lobby_ID].room_data["players"],{
                "leader":all_rooms[lobby_ID].room_data["leader"],
                "ongoing":all_rooms[lobby_ID].room_data["ongoing"],
                "event":["update-player-list"]
        })
        return
    #only one code will make it past here---------------
    # ongoing means user playing their rounds
    #event_arr = ["update-player-list"]
    game_operations(lobby_ID)
    await nextround(lobby_ID)
@app.get("/api-game/fetchplayerlist/{lobby_id}")
async def funcapi2(lobby_id:str):
    json_data = {
        "players":all_rooms[lobby_id].room_data["players"]
    }
    for player in json_data["players"]:
        playerjson = {
            "username": playerusernames[player],
            "readystate":all_rooms[lobby_id].room_data["playerstats"][player].player_data["ready"]
        }
        json_data[player] = playerjson 
    return JSONResponse(content=json_data,status_code=200)
@app.get("/api-game/fetchgameboard/{lobby_id}/{user_ID}")
async def funcapi3(lobby_id:str,user_ID:str):
    player_data = all_rooms[lobby_id].room_data["playerstats"][user_ID].player_data
    to_add = []
    if(len(player_data["visibletiles"])==0):
        first_index = 0
        min = 0; max = gameboard_size[0]
        if(user_ID!=all_rooms[lobby_id].room_data["leader"]):
            first_index = gameboard_size[1]-1
        for i in range(min,max):
            to_add.append(f'{i}_{first_index}')
    else:
        to_add = player_data["visibletiles"]
    content = {}
    for item in to_add:
        filtercontent = dict(all_rooms[lobby_id].room_data["gameboard"][item])
        #remove all invisible enemy traps
        to_remove = [] 
        for trap_ID in filtercontent["traps"]:
            trapcontent = filtercontent["traps"][trap_ID]
            trapcontent["source"] = getserversideabilityinfo(trapcontent["identifier"],"name")
            if trapcontent["setter"] == user_ID:
                continue
            if trapcontent["invisible"]:
                to_remove.append(trap_ID)
        for remove in to_remove:
            del filtercontent["traps"][remove]
        content[item] = filtercontent
    #content[user_ID] = player_data["tilelocation"]
    return JSONResponse(content=content,status_code=200)
@app.get("/api-game/displayabilitygui/{lobby_id}/{userID}")
async def funcapi4(lobby_id:str,userID:str):
    abilityjson = {}
    ability_identifyers = all_rooms[lobby_id].room_data["playerstats"][userID].player_data["abilities"] #[0] identifier [1] cooldown
    for code in ability_identifyers:
        type = code[0].split(":")[0]
        id = code[0].split(":")[1]
        with open("./abilities/"+type+"/"+id+".json","r") as reader:
            json_loaded = json.load(reader)["clientside"]
            abilityjson[json_loaded["name"]] = {
                "identifier":json_loaded["identifier"],
                "description":json_loaded["description"],
                "tileformat":json_loaded["tileformat"],
                "cooldown":json_loaded["cooldown"],
                "damage":json_loaded["damage"],
                "currentcooldown":code[1]
            }
    return JSONResponse(content=abilityjson,status_code=200)
@app.get("/api-game/get_image/{file_id}")
async def funcapi5(file_id: str):
    image_path = "./gallery-assests/"+(file_id.replace("|","/"))
    return FileResponse(image_path,status_code=200)
@app.get("/api-game/fetchplayerstats/{lobby_id}/{user_id}/{component}")
async def funcapi6(lobby_id:str,user_id:str,component:str):
    playerdata = all_rooms[lobby_id].room_data["playerstats"][user_id].player_data
    #print(playerdata)
    return JSONResponse(content=playerdata[component],status_code=200)
@app.get("/api-game/fetchgamesettings")
async def funcapi7():
    return JSONResponse(content={"board-size":gameboard_size},status_code=200)
@app.get("/api-game/fetchgamesounds/{sound}")
async def funcapi8(sound:str):
    return FileResponse(
        path="./gallery-mp3/"+sound+".mp3",
        media_type="audio/mpeg",
    )

# @app.get("/api-game/fetch-player-logs/{lobby_id}/{user_id}")
# async def funcapi7(lobby_id:str,user_id:str):
#     log = all_rooms[lobby_id].room_data["playerstats"][user_id].player_data["player_logs"]
#     return PlainTextResponse(str(log),status_code=200)
    
 
