var express = require('express');
var app     = express();
var http    = require('http').Server(app);
var io      = require('socket.io')(http);
var util 	= require('./util.js');
var c  = require('./config.json');
var SAT = require('sat');
var V = SAT.Vector;
var C = SAT.Circle;
var quadtree = require('simple-quadtree');
var tree = quadtree(0, 0, c.gameWidth, c.gameHeight);
app.use(express.static(__dirname + '/../client'));

var users = [];
var massFood = [];
var minFood = [];
var airBubbles = [];
var booms = [];
var virus = [];
var food = [];
var sockets = {};
var leaderboard = [];
var leaderboardChanged = false;

var initMassLog = util.log(c.defaultPlayerMass, c.slowBase);

function addAirBubble(toAdd) {
    while (toAdd--) {
        airBubbles.push({
            // Make IDs unique.
            id: ((new Date()).getTime() + '' + airBubbles.length) >>> 0,
            x: util.randomInRange(0, c.gameWidth),
            y: c.gameHeight + util.randomInRange(0, c.gameWidth)* 0.2,
            target: {
                x : 0,
                y : util.randomInRange(0, c.gameHeight)
            },
            type: c.typeObj.AIR,
            level: util.randomInRange(0, c.airBubble.typeMax -1)
        });
    }
}

function addMinFood(toAdd) {
    while (toAdd--) {
        minFood.push({
            // Make IDs unique.
            id: ((new Date()).getTime() + '' + minFood.length) >>> 0,
            x: Math.floor(Math.random()* c.gameWidth * 0.8),
            y: Math.floor(Math.random()* c.gameHeight* 0.8),
            choose: false,
            timeOut: 0
        });
    }
}
function addFood(toAdd) {
    var size = c.food.level.length;
    var rand = Math.random();
    var i = 0;
    for (var j = 0; j < size; j++) {
        if(size < 0.5){
            i = 0;
            break;
        }else if(size < 0.7){
            i = 1;
            break;
        }else if(rand < 0.7 + (j - 1) * 0.3/ (size - 2)){
            i = j;
            break;
        }

    }
    var radius = c.food.level[i].radius;
    while (toAdd--) {
        var position = c.foodUniformDisposition ? 
        util.uniformPosition(food, radius) 
        : util.randomPosition(radius);
        food.push({
            // Make IDs unique.
            id: ((new Date()).getTime() + '' + food.length) >>> 0,
            x: position.x,
            y: position.y,
            direction: c.direct.LEFT,
            target: {
                x: Math.floor(Math.random()* c.gameWidth * 0.8),
                y: Math.floor(Math.random()* c.gameHeight* 0.8)
            },
            radius: c.food.level[i].radius,
            mass: c.food.level[i].foodMass,
            speedAnimation: 0,
            frameAnimation: 0,
            column: c.food.level[i].column,
            row: c.food.level[i].row,
            isHut: false,
            type: c.typeObj.FOOD,
            level: i
        });
    }
}

function addVirus(toAdd) {
    while (toAdd--) {
        var radius = c.virus.radius;
        var position = c.virusUniformDisposition ? util.uniformPosition(virus, radius) : util.randomPosition(radius);
        virus.push({
            id: ((new Date()).getTime() + '' + virus.length) >>> 0,
            x: position.x,
            y: 0,
            target :{
                x: position.x,
                y: util.randomInRange(50, c.gameHeight)
            },
            radius: radius,
            frameAnimation: 0,
            type: c.typeObj.VIRUS,
            status: c.virus.status.LIVE
        });
    }
}

function getTypeFish(mass){
    for (var i = 0; i < c.fishType.length; i++) {
        if(c.fishType[i].maxMass > mass)
            return i;
    }
    return c.fishType.length - 1;
}

function movePlayer(player) {
   
    if(player.isHut == true){
        var deg = Math.atan2(player.target.y, player.target.x);

        var slowDown = 1;
        if(player.speed <= 6.25) {
           // slowDown = util.log(player.mass, c.slowBase) + initMassLog;
        }
       deltaY = player.speed * Math.sin(deg)/slowDown;
       deltaX = player.speed * Math.cos(deg)/slowDown;
        
        player.y += deltaY;
        player.x += deltaX;
        player.speed -= 0.5;
        if(player.speed < 0) {
            player.isHut = false;
        }
        return;
    }
    //var x =0, y = 0;

    var target = player.target;
    if(target.x == 0 && target.y == 0){
        return;
    }
    //var dist = Math.sqrt(Math.pow(target.y, 2) + Math.pow(target.x, 2));
    var deg = Math.atan2(target.y, target.x);

    var slowDown = 1;
    if(player.speed <= 6.25) {
        //slowDown =  initMassLog + 1;
    }

    var deltaY = player.speed * Math.sin(deg)/ slowDown;
    var deltaX = player.speed * Math.cos(deg)/ slowDown;

    if(player.speed > 6.25) {
        player.speed -= 0.5;
    }
    // if (dist < (50 + player.radius)) {
    //     deltaY *= dist / (50 + player.radius);
    //     deltaX *= dist / (50 + player.radius);
    // }
    if (!isNaN(deltaY)) {
        player.y += deltaY;
    }
    if (!isNaN(deltaX)) {
        player.x += deltaX;
    }
 
    var borderCalc = player.radius / 3;
    if (player.x > c.gameWidth - borderCalc) {
        player.x = c.gameWidth - borderCalc;
    }
    if (player.y > c.gameHeight - borderCalc) {
        player.y = c.gameHeight - borderCalc;
    }
    if (player.x < borderCalc) {
        player.x = borderCalc;
    }
    if (player.y < borderCalc) {
        player.y = borderCalc;
    }
}
// di chuyển các đối thủ khác.
function moveFood(mass) {
    if(mass.target == undefined){
        return;
    }
    var deltaY = 0;
    var deltaX = 0;
    var slowDown = 1;
    if(mass.isHut == true){
        var deg = Math.atan2(mass.target.y, mass.target.x);
       deltaY = mass.speed * Math.sin(deg)/slowDown;
       deltaX = mass.speed * Math.cos(deg)/slowDown;
        
        mass.y += deltaY;
        mass.x += deltaX;
        mass.speed -= 0.5;
        if(mass.speed < 0) {
            mass.isHut = false;
        }
        return;
    }
    var deg = Math.atan2(mass.target.y - mass.y, mass.target.x - mass.x);

    if(mass.type == c.typeObj.VIRUS){
        deltaY = 5;
        deltaX = 0;

    }else if(mass.type == c.typeObj.FOOD){
        if(mass.stand != undefined && mass.stand == true)
            return;
        deltaY = c.food.level[mass.level].speed * Math.sin(deg)/slowDown;
        deltaX = c.food.level[mass.level].speed * Math.cos(deg)/slowDown;
    }else if(mass.type == c.typeObj.AIR){
        deltaY = -5;
        deltaX = 0;
    }else if(mass.type == c.typeObj.MASS){
        deltaY = mass.speed * Math.sin(deg)/slowDown;
        deltaX = mass.speed * Math.cos(deg)/slowDown;
        mass.speed -= 0.5;
        if(mass.speed < 0){
            mass.speed = 0;
        }
    }
    
    mass.y += deltaY;
    mass.x += deltaX;

    var borderCalc = mass.radius / 2;
    if (mass.x > c.gameWidth - borderCalc) {
        mass.x = c.gameWidth - borderCalc;
    }
    if (mass.y > c.gameHeight - borderCalc) {
        mass.y = c.gameHeight - borderCalc;
    }
    if (mass.x < borderCalc) {
        mass.x = borderCalc;
    }
    if (mass.y < borderCalc) {
        mass.y = borderCalc;
    }
}

function balanceMass() {
    // var totalMass = food.length * c.foodMass +
    //     users
    //         .map(function(u) {return u.massTotal; })
    //         .reduce(function(pu,cu) { return pu+cu;}, 0);

    // var massDiff = c.gameMass - totalMass;
    // var maxFoodDiff = c.food.maxFood - food.length;
    // var foodDiff = parseInt(massDiff / c.foodMass) - maxFoodDiff;
    // var foodToAdd = Math.min(foodDiff, maxFoodDiff);
    // var foodToRemove = -Math.max(foodDiff, maxFoodDiff);
    
    var foodToAdd = c.food.maxFood - food.length;
    if (foodToAdd > 0) {
        console.log('[DEBUG] Adding ' + foodToAdd + ' food to level!');
        addFood(foodToAdd);
    }
    

    var virusToAdd = c.virus.maxVirus - virus.length;

    if (virusToAdd > 0) {
        addVirus(virusToAdd);
    }
    if(c.maxMinFood > minFood.length){
        addMinFood(c.maxMinFood- minFood.length);
    }
    if(c.airBubble.maxAirBubble > airBubbles.length){
        addAirBubble(c.airBubble.maxAirBubble - airBubbles.length);
    }
 
}

io.on('connection', function (socket) {
    console.log('A user connected!', socket.handshake.query.type);

    var type = socket.handshake.query.type;
    var radius = c.fishType["0"].radius;
    var position = c.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);

     
    var massTotal = 0;

    var currentPlayer = {
        id: socket.id,
        x: position.x,
        y: position.y,
        radius: radius,
        speed: c.speedPlayer,
        speedAnimation: 0,
        frameAnimation: 0,
        width: c.fishType["0"].width,
        height: c.fishType["0"].height,
        column: c.fishType["0"].column,
        row: c.fishType["0"].row,
        massTotal: massTotal,
        hue: Math.round(Math.random() * 360),
        type: type,
        lastHeartbeat: new Date().getTime(),
        target: {
            x: 0,
            y: 0
        },
        isHut: false,
        direction: c.direct.LEFT,
        timeAcceleration: {status: true, timeClick: 0},
        timeSpeed: {status: true, timeClick: 0}
    };
    socket.on('mouseRight',function(){

        function HutObject(obj){ 
            if(obj == undefined || obj.id == currentPlayer.id)
                return;

            var distance = util.getDistance(currentPlayer, obj);
            var deg1 = Math.atan2(obj.y, obj.x);
            var deg2 = Math.atan2(currentPlayer.y, currentPlayer.x);
            var sub = deg2 - deg1;

            var deg = Math.atan2(currentPlayer.target.y, currentPlayer.target.x);
            var slowDown = 1;
            deltaY = currentPlayer.speed * Math.sin(deg)/slowDown;
            deltaX = currentPlayer.speed * Math.cos(deg)/slowDown;
            var direction2 = (currentPlayer.x < obj.x) ? 1: -1;
            if(distance < c.radiusAbsorb  && (Math.abs(sub) < Math.PI/4) && !(direction2 ^ direction)){
                obj.target = {x: currentPlayer.x + deltaX + direction * currentPlayer.width/2 -obj.x, y :currentPlayer.y + deltaY -obj.y};
                obj.speed = 20;
                obj.isHut = true;
                if(obj.type == c.typeObj.MASS)
                    console.log("massFOOD", obj);
            }
        
        }
        if(!currentPlayer.timeAcceleration.status){
            return;
        }
        currentPlayer.timeAcceleration.status = false;
        currentPlayer.timeAcceleration.timeClick = new Date().getTime();
        var direction = (currentPlayer.target.x > 0) ? 1: -1;
        
       for (var i = 0; i < food.length; i++) {
            HutObject(food[i]);
        }
        console.log("massFood", massFood);
        for (var i = 0; i < massFood.length; i++) {
            HutObject(massFood[i]);
        }
        for (var i = 0; i < users.length; i++) {
            HutObject(users[i]);
        }
        // food.forEach(HutObject);
        // massFood.forEach(HutObject);
        // users.forEach(HutObject);
        
    });
    socket.on('mouseLeft',function(){
        if(!currentPlayer.timeSpeed.status){
            return;
        }
        currentPlayer.timeSpeed.status = false;
        currentPlayer.timeSpeed.timeClick = new Date().getTime();
        currentPlayer.speed = 20;
        
    });
    socket.on('gotit', function (player) {
        if (util.findIndex(users, player.id) > -1) {
            console.log('[INFO] Player ID is already connected, kicking.');
            socket.disconnect();
        } else if (!util.validNick(player.name)) {
            socket.emit('kick', 'Invalid username.');
            
            socket.disconnect();
        } else {
            console.log('[INFO] Player ' + player.name + ' connected!');
            sockets[player.id] = socket;

            var radius = c.fishType["0"].radius;
            var position = c.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);

            player.x = position.x;
            player.y = position.y;
            player.target.x = 0;
            player.target.y = 0;
            if(type === 'player') {
                player.massTotal = c.defaultPlayerMass;
                player.radius = radius;
            }
            else {
                 player.massTotal = 0;
            }
            player.hue = Math.round(Math.random() * 360);
            currentPlayer = player;
            currentPlayer.lastHeartbeat = new Date().getTime();
            users.push(currentPlayer);
            console.log("USER: ", users);

            io.emit('playerJoin', { name: currentPlayer.name });
            var temp1 = {
                gameWidth: c.gameWidth,
                gameHeight: c.gameHeight
            }
            socket.emit('gameSetup', temp1);
            console.log('Total players: ' + users.length);
        }

    });

    socket.on('pingcheck', function () {
        socket.emit('pongcheck');
    });

    socket.on('windowResized', function (data) {
        console.log('windowResized', data);
        currentPlayer.screenWidth = data.screenWidth;
        currentPlayer.screenHeight = data.screenHeight;
    });

    socket.on('respawn', function () {
        console.log('respawn');
        if (util.findIndex(users, currentPlayer.id) > -1)
            users.splice(util.findIndex(users, currentPlayer.id), 1);
        socket.emit('welcome', currentPlayer);
    });

    socket.on('disconnect', function () {
        if (util.findIndex(users, currentPlayer.id) > -1)
            users.splice(util.findIndex(users, currentPlayer.id), 1);
        console.log('[INFO1] User ' + currentPlayer.name + ' disconnected!');

        socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
    });
    // Heartbeat function, update everytime.
    socket.on('0', function(target) {
        currentPlayer.lastHeartbeat = new Date().getTime();
        if(currentPlayer.isHut)
            return;
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            currentPlayer.target = target;
            if(target.x > 0)
                currentPlayer.direction = c.direct.RIGHT;
            else if(target.x < 0) currentPlayer.direction = c.direct.LEFT;
        }
    });
});

function tickPlayer(currentPlayer) {
    if(!currentPlayer.timeAcceleration.status){
        if(currentPlayer.timeAcceleration.timeClick < new Date().getTime() - c.timeAcceleration){
            currentPlayer.timeAcceleration.timeClick  = 0;
            currentPlayer.timeAcceleration.status = true;
        }
    }

    if(!currentPlayer.timeSpeed.status){
        if(currentPlayer.timeSpeed.timeClick < new Date().getTime() - c.timeSpeed){
            currentPlayer.timeSpeed.timeClick  = 0;
            currentPlayer.timeSpeed.status = true;
        }
    }
    movePlayer(currentPlayer);

    function funcFood(f) {
        var directionObject = (currentPlayer.target.x > 0)? 1: -1;
      //  var response = new SAT.Response();
        //var p = new SAT.Polygon(new SAT.Vector(), [
        var v1 = new SAT.Vector(currentPlayer.x + directionObject * currentPlayer.width/2,currentPlayer.y + currentPlayer.height/4);
        var v2 =  new SAT.Vector(currentPlayer.x + directionObject * currentPlayer.width/2,currentPlayer.y - currentPlayer.height/4);
        var v3 =  new SAT.Vector(currentPlayer.x  ,currentPlayer.y);
        //]);
        var food = new SAT.Circle(new SAT.Vector(f.x, f.y), f.radius);
        // return SAT.pointInPolygon(new V(f.x, f.y), p);
        return SAT.pointInCircle(v1, food) || SAT.pointInCircle(v2, food) || SAT.pointInCircle(v3, food);
    }
    // kiểm tra đụng độ boom.
    function funcFood2(f) {
        if(f.status == c.virus.status.DIED)
            return false;
        var v1 =  new SAT.Vector(currentPlayer.x - currentPlayer.width/2,currentPlayer.y );
        var v2 = new SAT.Vector(currentPlayer.x ,currentPlayer.y + currentPlayer.height/2);
        var v3 = new SAT.Vector(currentPlayer.x + currentPlayer.width/2,currentPlayer.y );
        var v4 = new SAT.Vector(currentPlayer.x ,currentPlayer.y - currentPlayer.height/2);
        var boom = new SAT.Circle(new SAT.Vector(f.x, f.y), f.radius);
        return SAT.pointInCircle(v1, boom) || SAT.pointInCircle(v2, boom) || SAT.pointInCircle(v3, boom) || SAT.pointInCircle(v4, boom) ;
    }

    function deleteFood(f) {
        food[f] = {};
        food.splice(f, 1);
    }

    function check(user) {
        if(user.id !== currentPlayer.id) {
            var response = new SAT.Response();
            var directionObject = (currentPlayer.target.x > 0)? 1: -1;
            var p = new SAT.Polygon(new SAT.Vector(), [
              new SAT.Vector(currentPlayer.x + directionObject * currentPlayer.width/2, currentPlayer.y + currentPlayer.height/4),
              new SAT.Vector(currentPlayer.x + directionObject * currentPlayer.width/2, currentPlayer.y - currentPlayer.height/4),
              new SAT.Vector(currentPlayer.x,currentPlayer.y)
            ]);
            var v1 =  new SAT.Vector(user.x - user.width/2,user.y );
            var v2 = new SAT.Vector(user.x ,user.y + user.height/2);
            var v3 = new SAT.Vector(user.x + user.width/2,user.y );
            var v4 = new SAT.Vector(user.x ,user.y - user.height/2);
                
            var collided = SAT.pointInPolygon(v1,p) || SAT.pointInPolygon(v2,p) ||SAT.pointInPolygon(v3,p) || SAT.pointInPolygon(v4,p);
            
            if (collided) {
                response.aUser = currentPlayer;
                response.bUser = {
                    id: user.id,
                    name: user.name,
                    x: user.x,
                    y: user.y,
                    massTotal: user.massTotal
                };
                playerCollisions.push(response);
            }
        }
        return true;
    }
    function updateRadius(currentPlayer){
        var type = getTypeFish(currentPlayer.massTotal);
        currentPlayer.radius = c.fishType[type].radius;
        currentPlayer.width = c.fishType[type].width;
        currentPlayer.height = c.fishType[type].height;
        currentPlayer.column = c.fishType[type].column;
        currentPlayer.row = c.fishType[type].row;
    }
    function collisionCheck(collision) {
        if (getTypeFish(collision.aUser.massTotal) > getTypeFish(collision.bUser.massTotal) ){
            console.log('[DEBUG] Killing user: ' + collision.bUser.id);
            console.log('[DEBUG] Collision info:');
            console.log(collision);

            var numUser = util.findIndex(users, collision.bUser.id);
            if (numUser > -1) {
                users.splice(numUser, 1);
                sockets[collision.bUser.id].emit('RIP');
            }
            currentPlayer.massTotal += collision.bUser.massTotal;
            updateRadius(currentPlayer);
        }
    }

    var playerCircle = new C(
            new V(currentPlayer.x, currentPlayer.y),
            currentPlayer.radius
        );

    var foodEaten = food.map(funcFood)
        .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);

    foodEaten.forEach(deleteFood);

    var massEaten = massFood.map(funcFood)
        .reduce(function(a, b, c) {return b ? a.concat(c) : a; }, []);

    var virusCollision = virus.map(funcFood2)
           .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);

        if(virusCollision.length > 0 ) {
            var numUser = util.findIndex(users, currentPlayer.id);
            users.splice(numUser, 1);
            virus[virusCollision[0]].status = c.virus.status.DIED;
            var count = 6;//(virusCell.mass/ c.fireFood > c.limitSplit) ? virusCell.mass/ c.fireFood : c.limitSplit;

            var radius = 20;
            var masa = currentPlayer.massTotal/count;
            for (var i = 0; i < count; i++) {
                massFood.push({
                    id: ((new Date()).getTime() + '' + massFood.length) >>> 0,
                    num: i,
                    masa: masa,
                    hue: currentPlayer.hue,
                    target: {
                        x: currentPlayer.x + Math.cos(2*i *Math.PI/ count) *5000,
                        y: currentPlayer.y + Math.sin(2*i *Math.PI/ count) *5000
                    },
                    x: currentPlayer.x,
                    y: currentPlayer.y,
                    radius: radius,
                    type: c.typeObj.MASS,
                    speed: 25
                });
            }

            sockets[currentPlayer.id].emit('RIP');
            
        }

    var masaGanada = 0;
    for(var m=0; m<massEaten.length; m++) {
        masaGanada += massFood[massEaten[m]].masa;
        massFood[massEaten[m]] = {};
        massFood.splice(massEaten[m],1);
        for(var n=0; n<massEaten.length; n++) {
            if(massEaten[m] < massEaten[n]) {
                massEaten[n]--;
            }
        }
    }

    masaGanada += (foodEaten.length * c.foodMass);

    if(masaGanada != undefined && masaGanada != null){
        currentPlayer.massTotal += masaGanada;
        updateRadius(currentPlayer);
    }

    var playerCollisions = [];
    for (var i = 0; i < users.length; i++) {
        check(users[i]);
    }
    playerCollisions.forEach(collisionCheck);
}
function UpdateSpeedAnimation(obj){
    if(obj == undefined){
        console.log(obj);
    }
    obj.speedAnimation = obj.speedAnimation + 1;
    if(obj.speedAnimation >= c.speedAnimation){
            obj.speedAnimation = 0;
            obj.frameAnimation += 1;
            if(obj.frameAnimation >= obj.column * obj.row){
                obj.frameAnimation = 0;
            }
    }
}
function moveloop() {
    for (var i = 0; i < users.length; i++) {
        UpdateSpeedAnimation(users[i]);
        tickPlayer(users[i]);
    }

    for (i=0; i < virus.length; i++) {
        if(virus[i].target.y > virus[i].y && virus[i].status == c.virus.status.LIVE) 
            moveFood(virus[i]);
        if(virus[i].status == c.virus.status.DIED)
        {
            virus[i].frameAnimation ++;
            if(virus[i].frameAnimation > 60){
                virus[i] = {};
                virus.splice(i,1);
                i--;
            }
        }
    }

    for (i=0; i < massFood.length; i++) {
        if(massFood[i].speed > 0) moveFood(massFood[i]);
    }

    for (i=0; i < food.length; i++) {
        if(food[i] != undefined){
            UpdateSpeedAnimation(food[i]);
            tickFood(food[i]);
        }
    }
    for (var i = 0; i < airBubbles.length; i++) {
            moveFood(airBubbles[i]);     
            if(airBubbles[i].target.y > airBubbles[i].y){
                airBubbles[i] = {};
                airBubbles.splice(i,1);
                i--;
            }
    }
}
function tickFood(food){
    function funcMinFood(f) {
        if(f.choose == true && f.timeOut + 6000 < new Date().getTime()){
            food.stand = true;
            return true;
        }
        var circle = new C(new V(food.x,food.y), food.radius);
        return SAT.pointInCircle(new V(f.x, f.y), circle);
    }

    function deleteFood(f) {
        minFood[f] = {};
        minFood.splice(f, 1);
    }

    function findMinFood(){
        var min = 0;
        var index = -1;
        for (var i = 0; i < minFood.length; i++) {
            if(minFood[i] != undefined && minFood[i].choose == false && (index == -1 || min > util.getDistance(minFood[i], food))) {
                min = util.getDistance(minFood[i], food);
                index = i;
            }
        }
        if(index == -1){    
            return undefined;
        }
        minFood[index].timeOut = new Date().getTime();
        minFood[index].choose = true;
        return minFood[index];
    }
    var minFoodEaten = minFood.map(funcMinFood)
        .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);
    minFoodEaten.forEach(deleteFood);

    if(food.isHut == false){
        var length = minFood.length;
        var data = findMinFood();
        if(data != undefined){
            food.target.x = data.x;
            food.target.y = data.y;
            food.stand = false;
            food.direction = food.target.x > food.x ? c.direct.RIGHT : c.direct.LEFT;
        }
    }
    moveFood(food);
}

function gameloop() {
    if (users.length > 0) {
        users.sort( function(a, b) { return b.massTotal - a.massTotal; });

        var topUsers = [];

        for (var i = 0; i < Math.min(10, users.length); i++) {
            if(users[i].type == 'player') {
                topUsers.push({
                    id: users[i].id,
                    name: users[i].name
                });
            }
        }
        if (isNaN(leaderboard) || leaderboard.length !== topUsers.length) {
            leaderboard = topUsers;
            leaderboardChanged = true;
        }
        else {
            for (i = 0; i < leaderboard.length; i++) {
                if (leaderboard[i].id !== topUsers[i].id) {
                    leaderboard = topUsers;
                    leaderboardChanged = true;
                    break;
                }
            }
        }
        
    }
    balanceMass();
}

function sendUpdates() {
    users.forEach( function(u) {
        // center the view if x/y is undefined, this will happen for spectators
        u.x = u.x || c.gameWidth / 2;
        u.y = u.y || c.gameHeight / 2;

        // console.log("food: ", food);
        var visibleFood  = food
            .map(function(f) {
                if ( f.x > u.x - u.screenWidth/2 - 20 &&
                    f.x < u.x + u.screenWidth/2 + 20 &&
                    f.y > u.y - u.screenHeight/2 - 20 &&
                    f.y < u.y + u.screenHeight/2 + 20) {
                    return f;
                }
            })
            .filter(function(f) { return f; });

        var visibleAirbble  = airBubbles
            .map(function(f) {
                if ( f.x > u.x - u.screenWidth/2 - 20 &&
                    f.x < u.x + u.screenWidth/2 + 20 &&
                    f.y > u.y - u.screenHeight/2 - 20 &&
                    f.y < u.y + u.screenHeight/2 + 20) {
                    return f;
                }
            })
            .filter(function(f) { return f; });

        var visibleMass = massFood
            .map(function(f) {
                if ( f.x+f.radius > u.x - u.screenWidth/2 - 20 &&
                    f.x-f.radius < u.x + u.screenWidth/2 + 20 &&
                    f.y+f.radius > u.y - u.screenHeight/2 - 20 &&
                    f.y-f.radius < u.y + u.screenHeight/2 + 20) {
                    return f;
                }
            })
            .filter(function(f) { return f; });

        var visibleVirus  = virus
            .map(function(f) {
                if ( f.x > u.x - u.screenWidth/2 - f.radius &&
                    f.x < u.x + u.screenWidth/2 + f.radius &&
                    f.y > u.y - u.screenHeight/2 - f.radius &&
                    f.y < u.y + u.screenHeight/2 + f.radius) {
                    return f;
                }
            })
            .filter(function(f) { return f; });

        var visibleCells  = users
            .map(function(f) {
                if ( f.x+f.radius > u.x - u.screenWidth/2 - 20 &&
                    f.x-f.radius < u.x + u.screenWidth/2 + 20 &&
                    f.y+f.radius > u.y - u.screenHeight/2 - 20 &&
                    f.y-f.radius < u.y + u.screenHeight/2 + 20) {
                    if(f.id !== u.id) {
                        return {
                            id: f.id,
                            x: f.x,
                            y: f.y,
                            target: f.target,
                            radius: f.radius,
                            direction: f.direction,
                            frameAnimation: f.frameAnimation,
                            massTotal: Math.round(f.massTotal),
                            hue: f.hue,
                            name: f.name,
                            timeAcceleration: f.timeAcceleration,
                            timeSpeed: f.timeSpeed,
                            width: f.width,
                            height: f.height

                        };
                    } else {
                        return {
                            x: f.x,
                            y: f.y,
                            target: f.target,
                            radius: f.radius,
                            direction: f.direction,
                            frameAnimation: f.frameAnimation,
                            massTotal: Math.round(f.massTotal),
                            hue: f.hue,
                            timeAcceleration: f.timeAcceleration,
                            timeSpeed: f.timeSpeed,
                            width: f.width,
                            height: f.height
                        };
                    }
                }
             
            })
            .filter(function(f) { return f; });

            var userRadar = users.map(function(f){
                
                if( f.id != u.id)
                return {
                    x : f.x,
                    y : f.y
                }

            })
            .filter(function(f) { return f; });
        
        sockets[u.id].emit('serverTellPlayerMove', visibleCells, visibleFood, visibleVirus, visibleMass, visibleAirbble, userRadar);
        
        if (leaderboardChanged) {
            sockets[u.id].emit('leaderboard', {
                players: users.length,
                leaderboard: leaderboard
            });
        }
    });
    leaderboardChanged = false;
}

setInterval(moveloop, 1000 / 60);
setInterval(gameloop, 1000);
setInterval(sendUpdates, 1000 / c.networkUpdateFactor);


var serverPort = process.env.PORT || c.port;
http.listen(serverPort, function() {
  console.log("Server is listening on port " + serverPort);
});
