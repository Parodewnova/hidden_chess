from fastapi.responses import JSONResponse, FileResponse, PlainTextResponse,StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, File, UploadFile, Request, Response,status, WebSocket
from pydantic import BaseModel
from asyncio import Lock

import json


app = FastAPI()
allowed_origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # List of allowed origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)

playerusernames = {
    
}

max_logsize = 30
gameboard_size = [5,5] # row,height
class roomblueprint():
    roomjson_blueprint = {
        "leader":"",
        "ongoing":False,
        "players":[],
        "max-players":2,
        "rounds":0,
        "gameboard":{},
        "playerstats":{}
    }
    def __init__(self):  # Default size or pass it in
        # Create a deep copy of the template for this instance
        import copy
        self.room_data = copy.deepcopy(self.roomjson_blueprint)
        for i in range(0,gameboard_size[0]):
            for i2 in range(0,gameboard_size[1]):
                self.room_data["gameboard"][f'{i}_{i2}'] = {
                    "players":[],
                    "status":[],
                    "obstaces":[]
                }
class playerblueprint():
    playerstats_blueprint = {
        "tilelocation":"",
        "visibletiles":[],
        "currentusage":{},
        "abilities":{
            "move":{
                "id":"001",
                "type":"mov",
                "dmg":0,
                "cd":0,
                "tileformat":"oxo-xLx-oxo"
            },
            "name2":{
                "id":"002",
                "type":"atk",
                "dmg":2,
                "cd":1,
                "tileformat":"xxxxx-ooooo-ooLoo"
            }
        },
        "status":[],
        "ready":False,
        "player_logs":[]
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
    updateplayerlogs(lobbyID,userID,playerusernames[userID]+" joined the lobby")


    for player in all_rooms[lobbyID].room_data["players"]:
        if player!=userID:
            updateplayerlogs(lobbyID,player,playerusernames[userID]+" joined the lobby")
            break
    if(len(all_rooms[lobbyID].room_data["players"])==1):
        all_rooms[lobbyID].room_data["leader"] = userID
    await deliverMessageToClient(all_rooms[lobbyID].room_data["players"],{
        "leader":all_rooms[lobbyID].room_data["leader"],
        "ongoing":all_rooms[lobbyID].room_data["ongoing"],
        "event":["update-player-list","update-player-gameboard","request-user-logs"]
    })
    try:
        while True:
            data = await websocket.receive_text()
            print(data)
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
            updateplayerlogs(lobbyID,player,userID+" has left the lobby")
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


    all_rooms[lobby_ID].room_data["rounds"] =1
    updateplayerlogs(lobby_ID,"","Round 1")
    await deliverMessageToClient(all_rooms[lobby_ID].room_data["players"],{
        "leader":all_rooms[lobby_ID].room_data["leader"],
        "ongoing":all_rooms[lobby_ID].room_data["ongoing"],
        "round":all_rooms[lobby_ID].room_data["rounds"],
        "event":["update-player-list","update-player-gameboard","send-ability-gui","request-user-logs"]
    })
@app.get("/api-game/newround/{lobby_ID}")
async def rounds(lobby_ID: str):
    allplayers = all_rooms[lobby_ID].room_data["players"]
    for player in allplayers:
        player_stats = all_rooms[lobby_ID].room_data["playerstats"][player].player_data
        player_stats["ready"] = False
        player_stats["visibletiles"] = [player_stats["tilelocation"]]
    

    all_rooms[lobby_ID].room_data["rounds"]+=1
    updateplayerlogs(lobby_ID,"","Round "+str(all_rooms[lobby_ID].room_data["rounds"]))
    await deliverMessageToClient(all_rooms[lobby_ID].room_data["players"],{
        "leader":all_rooms[lobby_ID].room_data["leader"],
        "ongoing":all_rooms[lobby_ID].room_data["ongoing"],
        "event":["update-player-list","update-player-gameboard","send-ability-gui","request-user-logs"]
    })



all_types = ["trp","mov",'atk']
def get_opposition(players,currentplayer):
    a=2
def move(lobbyID,json):
    moved_player = json["user"]
    player_data = all_rooms[lobbyID].room_data["playerstats"][moved_player].player_data
    player_data["visibletiles"].remove(player_data["tilelocation"])
    all_rooms[lobbyID].room_data["gameboard"][player_data["tilelocation"]]["players"].remove(moved_player)
    player_data["tilelocation"] = json["tile-touched"]
    player_data["visibletiles"].append(player_data["tilelocation"])
    all_rooms[lobbyID].room_data["gameboard"][player_data["tilelocation"]]["players"].append(moved_player)

# example = {'ipnypFuRME': {'id': '001', 'type': 'mov', 'tile-touched': '2_1'}, 'XOZlJBhVb': {'id': '001', 'type': 'mov', 'tile-touched': '3_4'}}
def game_operations(lobbyID):
    allplayers = all_rooms[lobbyID].room_data["players"]
    gamedata = {"trp":[],"mov":[],"atk":[]}
    for player in allplayers:
        round_stats = all_rooms[lobbyID].room_data["playerstats"][player].player_data["currentusage"]
        round_stats["user"] = player # ==> added userID to data
        gamedata[round_stats["type"]].append(round_stats)
        all_rooms[lobbyID].room_data["playerstats"][player].player_data["currentusage"] = {}
    for type in all_types:
        for json_data in gamedata[type]:
            if(type=="mov"):
                move(lobbyID,json_data)
                continue
            if(type=="atk"):
                continue
            if(type=="trp"):
                continue


    

@app.post("/api-game/userready/{lobby_ID}")
async def funcapi1(lobby_ID: str, request:Request):
    raw_body = await request.body()  # Get raw bytes
    body_json = json.loads(raw_body.decode())

    user_ID = body_json["userID"]
    mode = body_json["mode"]
    readystate = body_json["readystate"]

    allplayers = all_rooms[lobby_ID].room_data["players"]
    # if(len(allplayers)!=2): #SEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    #     return
    json_data = {}
    begin_game = True
    for player in allplayers:
        if(player==user_ID):
            all_rooms[lobby_ID].room_data["playerstats"][user_ID].player_data["ready"] = readystate
        ready = all_rooms[lobby_ID].room_data["playerstats"][player].player_data["ready"]
        if not ready:
            begin_game = False
        json_data[player] = ready
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
    # ongoing means user playing their rounds
    event_arr = ["update-player-list"]
    if(begin_game):
        game_operations(lobby_ID)
        event_arr.append("update-player-gameboard")
        event_arr.append("new-round")
    await deliverMessageToClient(all_rooms[lobby_ID].room_data["players"],{
            "leader":all_rooms[lobby_ID].room_data["leader"],
            "ongoing":all_rooms[lobby_ID].room_data["ongoing"],
            "event":event_arr
        })
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
        content[item] = all_rooms[lobby_id].room_data["gameboard"][item]
    #content[user_ID] = player_data["tilelocation"]
    return JSONResponse(content=content,status_code=200)
@app.get("/api-game/displayabilitygui/{lobby_id}/{userID}")
async def funcapi4(lobby_id:str,userID:str):
    Ability = all_rooms[lobby_id].room_data["playerstats"][userID].player_data["abilities"] 
    return JSONResponse(content=Ability,status_code=200)
@app.get("/api-game/get_image/{file_id}")
async def funcapi5(file_id: str):
    image_path = "./gallery-assests/"+file_id
    return FileResponse(image_path,status_code=200)
@app.get("/api-game/fetchplayerstats/{lobby_id}/{user_id}")
async def funcapi6(lobby_id:str,user_id:str):
    return JSONResponse(content=all_rooms[lobby_id].room_data["playerstats"][user_id].player_data,status_code=200)
@app.get("/api-game/fetch-player-logs/{lobby_id}/{user_id}")
async def funcapi7(lobby_id:str,user_id:str):
    log = all_rooms[lobby_id].room_data["playerstats"][user_id].player_data["player_logs"]
    return PlainTextResponse(str(log),status_code=200)
    
 
