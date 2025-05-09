

def func3(userTile,structure,leader):
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
            if(newX>=5 or newX<0 or newY>=5 or newY<0):
                a=2
            else:
                total_coods.append(f"{newX}_{newY}")
        X=-1
    return total_coods


print(func3("4_2","oxo-xAx-oxo",False))