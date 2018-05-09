/**
* TODO
* ...
* @author Gabriel Selinschek
*/

// Config Vars
var config = require('./config.js')
var locale = require('./locale/de-AT.js')

// Other Modules
var fs = require('fs');
var uuid = require('uuid');
var strip = require('rpi-ws281x-native');

// HTTP Server for WS
var http = require('http');
var express = require('express');
var app = express();
app.use(express.static(__dirname + config.http.public_dir));

// Websocket
var WebSocket = require('ws');
var WebSocketServer = require('ws').Server;

var httpServer = http.createServer(app);
httpServer.listen(config.wss.port);

var wss = new WebSocketServer({ server: httpServer });

// Main Server Code
// Vars
var i = 0;
var host_connected;
var NUM_LEDS = parseInt(config.led.num),
    pixelData = new Uint32Array(NUM_LEDS);
var num_users = 0
var hostready = false
var p2ready = false
var host_ships = []
var p2_ships = []
var hostreset = false
var p2reset = false

var matrix_host = [
  [ 57, 58, 59, 60, 61, 62, 63, 64 ],
  [ 56, 55, 54, 53, 52, 51, 50, 49 ],
  [ 41, 42, 43, 44, 45, 46, 47, 48 ],
  [ 40, 39, 38, 37, 36, 35, 34, 33 ],
  [ 25, 26, 27, 28, 29, 30, 31, 32 ],
  [ 24, 23, 22, 21, 20, 19, 18, 17 ],
  [ 9, 10, 11, 12, 13, 14, 15, 16 ],
  [ 8, 7, 6, 5, 4, 3, 2, 1],
]

var matrix_p2 = [
  [ 65, 66, 67, 68, 69, 70, 71, 72 ],
  [ 80, 79, 78, 77, 76, 75, 74, 73 ],
  [ 81, 82, 83, 84, 85, 86, 87, 88 ],
  [ 96, 95, 94, 93, 92, 91, 90, 89 ],
  [ 97, 98, 99, 100, 101, 102, 103, 104 ],
  [ 112, 111, 110, 109, 108, 107, 106, 105 ],
  [ 113, 114, 115, 116, 117, 118, 119, 120 ],
  [ 128, 127, 126, 125, 124, 123, 122, 121 ],
]

resetGame()

console.log(locale.listening_on + ' ' + config.wss.port);

// If the server gets a connection
wss.on('connection', function(ws, req) {

  ws.host = false
  ws.player = false

  if (!host_connected) {
    host_connected = true;
    num_users++
    ws.host = true;

    msg = { type: 'not', not: 'HOST'}
    ws.send(JSON.stringify(msg))
  } else if (num_users < 2) {
    num_users++
    msg = { type: 'not', not: 'p2'}
    ws.send(JSON.stringify(msg))
    msg = { type: 'not', not: 'p2conn'}
    ws.player = true
    SendToEveryone(msg)
    msg = {type: 'game', txt: 'place_ships'}
    SendToEveryone(msg)
  } else {
    msg = { type: 'err', text: 'MAX_USERS'}
    ws.send(JSON.stringify(msg))
  }

  ws.on('close', () => {
    if (ws.host)
      host_connected = false;
    num_users--
    if (ws.player) {
      resetGame()
    }
  });

  ws.on('message', (msg) => {

    try {
      var msg = JSON.parse(msg);
    } catch	(e){
      ws.send('{"type": "err", "msg": "ERR_SYNTAX"}');
      ws.terminate();
    }

    // If there is no type in the message
    if (!msg.type) {
      ws.send('{"type": "err", "msg": "ERR_SYNTAX"}');
      ws.terminate();
    }

    console.log(msg)
    ws.uid = uuid.v1();
    var led_id_p1
    var led_id_p2
    var x
    var y

    switch (msg.type) {
      case 'login':
        ws.username = msg.username
      break
      case 'reset':

      hostreset = (ws.host && msg.host) ? true : hostreset
      p2reset = (!ws.host && msg.host) ? true : p2reset

      if (hostreset && p2reset) {
        resetGame()
      }
      break
      case 'turn':
        x = msg.turn.x
        y = msg.turn.y

        led_id_p1 = matrix_host[y-1][x-1]-1
        led_id_p2 = matrix_p2[y-1][x-1]-1

        if (ws.host && msg.host) {
          // P1 clicks, but looks for LED_ID on matrix_p2
          // If it is a hit
          var hit = false
          for (var i = 0; i < p2_ships.length; i++) {
            if (led_id_p2 == p2_ships[i][2]) {
              // BUMM
              hit = true
              break
            }
          }
          if (hit) {
            // p2 change to red
            SendToEveryone({type: 'game', txt: 'hit', player: ws.username, x: x, y: y})
            pixelData[led_id_p2] = 0xff0000
          } else {
            // If miss, yellow on enemy side and on my website
            SendToEveryone({type: 'game', txt: 'no_hit', player: ws.username, x: x, y: y})
            pixelData[led_id_p2] = 0xffff00
          }
      } else {
        // P2 clicks, but looks for LED_ID on matrix_host
        var hit = false
        for (var i = 0; i < host_ships.length; i++) {
          if (led_id_p1 == host_ships[i][2]) {
            // BUMM
            hit = true
            break
          }
        }
        if (hit) {
          SendToEveryone({type: 'game', txt: 'hit', player: ws.username, x: x, y: y})
          pixelData[led_id_p1] = 0xff0000
          // Only change color of website
          // TODO
        } else {
          // If miss, yellow on enemy side and on my website
          SendToEveryone({type: 'game', txt: 'no_hit', player: ws.username, x: x, y: y})
          pixelData[led_id_p1] = 0xffff00
        }
      }
      strip.render(pixelData)
      break;
      case 'placed':
      x = msg.turn.x-1
      y = msg.turn.y-1

      // Placed ships are Green on your side
      if (ws.host && msg.host) {
        led_id = matrix_host[y][x]-1
        // If this LED has already been marked as a ship
        if (host_ships.length) {
          var exists = false
          for (var i = 0; i < host_ships.length; i++) {
            if (host_ships[i][2] == led_id) {
              exists = true;
            }
          }
          if (!exists) host_ships.push([x, y, led_id])
        } else {
          host_ships.push([x, y, led_id])
        }
      } else {
        led_id = matrix_p2[y][x]-1
        // If this LED has already been marked as a ship
        if (p2_ships.length) {
          var exists = false
          for (var i = 0; i < p2_ships.length; i++) {
            if (p2_ships[i][2] == led_id) {
              exists = true;
            }
          }
          if (!exists) p2_ships.push([x, y, led_id])
        } else {
          p2_ships.push([x, y, led_id])
        }
      }
      pixelData[led_id] = 0x00ff00
      strip.render(pixelData)
    break;
    case 'game':
      if (msg.txt == 'ready') {
        if (ws.host && msg.host) {
          hostready = true
        } else {
          p2ready = true
        }
        // If both players are ready
        if (hostready && p2ready) {
          var starting_player = (Math.random() > .5) ? 'host' : 'p2'
          SendToEveryone({ type: 'game', txt: 'start', starting_player: starting_player})
        }
        ws.ready = true
      }
    break;
    }
  });
})

function resetGame() {
  SendToEveryone({ type: 'not', not: 'reset'})

  setTimeout(() => {
    for (var i = 0; i < config.led.num; i++) {
      pixelData[i] = 0xff00ff;
    }
    strip.render(pixelData)
  }, 2000)

  strip.init(NUM_LEDS)
  strip.setBrightness(config.led.brightness)

  if (config.led.use_background_color)
    setBackgroundColor(config.led.background_color)

}

function setBackgroundColor(color) {
  for (var i = 0; i < config.led.num; i++) {
    pixelData[i] = color;
  }
  strip.render(pixelData)
}

function SendToEveryone(data) {
wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
});
}

function SendToEveryoneButOrigin(data, ws) {
wss.clients.forEach(function each(client) {
  if (client !== ws && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(data));
  }
});
}

// ---- trap the SIGINT and reset before exit
process.on('SIGINT', function () {
  strip.reset();
  process.nextTick(function () { process.exit(0); });
});
