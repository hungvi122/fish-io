// var io = require('socket.io-client');
// var ChatClient = require('./chat.js');
// var Canvas = require('./canvas');
var playerName;
var playerNameInput = document.getElementById('playerNameInput');

var socketServer;

var socket;

var localRoom;

var game = new Game();

function getServer(){
    socketServer = io();

    socketServer.on('joinRoom', function(room){
        console.log("Room: ", room);
        localRoom = room;
        startGame('player');
    })

    socketServer.on('disconnect', function () {
        socketServer.close();
    });
    
}

function startGame(type) {
    playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '');
    global.playerType = type;
    global.playerName = playerName;
    document.getElementById('shadowCanvas').style.display = "block";
    document.getElementById('radar').style.display = "block";
    $('#gameAreaWrapper').fadeIn(2000);
    document.getElementById('baner-icon').style.display = "block";
    document.getElementById('skill-icon').style.display = "block";
    $('#startMenuWrapper').fadeOut(2000);
    $('#score').fadeIn(2000);
    
    if (!socket) {
        // socket = io({query:"type=" + type});
        socket = io({query:"type=" + type});
        SetupSocket(socket, socketServer, localRoom);
    }
    // socket = io({query:"type=" + type}
    //     SetupSocket(socket);
    if (!global.animLoopHandle)
        animloop();
    // socket = io();
    socket.emit('respawn');
    // global.socket = socket;
    window.chat.socket = socket;
    window.chat.registerFunctions();
    
    window.canvas.socket = socket;
    global.socket = socket;

}

// check if nick is valid alphanumeric characters (and underscores)
function validNick() {
    var regex = /^\w*$/;
    console.log('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}
var valueProgress = 0;
var progressTime;
function progressBar(){
    valueProgress++;
    // console.log(valueProgress);
    $("#progressValue").css("width", valueProgress.toString() + "%");
    if(valueProgress == 100){
        document.getElementById('baner-icon').style.display = "block";
        getServer();
        clearInterval(progressTime);
        valueProgress= 0;
        $("#progressValue").css("width", "0%");
        $( "#inputText" ).show();
        $("#progressBar").hide();
    }
}
function appRule(){
    var rulesIndex = 1;
            var rules = ["Feed your fish to grow your school","Protect your fish!","Avoid of jellyfish!","Devour other player's Queen fish to growth!","Hold left mouse button to speed up your fish","Hold right mouse button to absorb fish and item", "Space key to create the boom!"];

            function rotateRules()
            {
                $("#rules").fadeOut("slow", function()
                {
                    $(this)
                        .text(rules[rulesIndex++ % rules.length])
                        .fadeIn("slow", function()
                        {
                            setTimeout(function()
                            {
                                rotateRules();
                            }, 3000);
                        });
                });
            }

            setTimeout(function()
            {
                rotateRules();
            }, 3000);
}
$(document).ready(function(){
    'use strict';
    $( "#startMenu" ).show();
    $( "#inputText" ).fadeIn(2000);
    $( "#shareApp" ).fadeIn(4000);
    appRule();
    var btn = document.getElementById('startButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');

    btn.onclick = function () {
        // check if the nick is valid
        if (validNick()) {
            // getServer();
            startGame('player');
           
            
        } else {
            nickErrorText.style.display = 'inline';
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;

        if (key === global.KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startGame('player');
                // getServer();
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });


});

function SetupSocket(socket, socketServer, room) {
  game.handleNetwork(socket, socketServer, room);
}

window.requestAnimFrame = (function(){
    return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            function( callback ){
                window.setTimeout(callback, 1000 / 60);
            };
})();


function animloop(){
    requestAnimFrame(animloop);
    gameLoop();
    // waveImage();
    
}


function gameLoop() {
  // game.handleLogic();
  game.handleGraphics();
}


window.addEventListener('resize', function() {
    if (!socket) return;
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
    c.width = screenWidth;
    c.height = screenHeight;
    document.body.width = player.screenWidth = shadowCanvas.width = c.width = global.screenWidth = global.playerType == 'player' ? window.innerWidth : global.gameWidth;
    document.body.height = player.screenHeight = shadowCanvas.height = c.height = global.screenHeight = global.playerType == 'player' ? window.innerHeight : global.gameHeight;
    
    if (global.playerType == 'spectate') {
        player.x = global.gameWidth / 2;
        player.y = global.gameHeight / 2;
    }

    socket.emit('windowResized', { screenWidth: global.screenWidth, screenHeight: global.screenHeight });
}, true);