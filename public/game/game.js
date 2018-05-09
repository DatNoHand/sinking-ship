/**
* Everything the client has to do
* @author Gabriel Selinschek
**/

function getQueryParams(qs) {
    qs = qs.split("+").join(" ");
    var params = {},
        tokens,
        re = /[?&]?([^=]+)=([^&]*)/g;
    while (tokens = re.exec(qs)) {
        params[decodeURIComponent(tokens[1])]
            = decodeURIComponent(tokens[2]);
    }
    return params;
}

var $_GET = getQueryParams(document.location.search);

var obj = { Title: 'Sink ship', Url: '/shipgame' };
history.pushState(obj, obj.Title, obj.Url);

var username = $_GET.u
var host = false
var ready = false
var can_place = false
var my_turn = false

if (username == undefined || username == '') {
  document.write('NO_USERNAME')
  throw new Error('ERR')
}

var server = new WebSocket('ws://'+window.location.host+':80')

server.onopen = (event) => {
  var message = {
    type: 'login',
    username: username,
  }
  send(message)

  server.onmessage = (data) => {
    msg = decodemsg(data.data)
    console.log(msg)

    switch (msg.type) {
      case 'not':
        if (msg.not == 'HOST')
          host = true;
        if (msg.not == 'p2conn') {
          status('Player 2 connected')
        }
        if (msg.not == 'reset') {
          ws.close()
          timerToReload()
          window.location.href = 'http://'+window.location.host
        }
      break;
      case 'game':
        if (msg.txt == 'place_ships') {
          // Start placing ships (BE FAIR)
          draw_place()
        } else if (msg.txt == 'hit') {
          if (username == msg.player) {
            // Change Spot on Website to red
            $('.btn_spot[data-x="'+msg.x+'"][data-y="'+msg.y+'"]').addClass('hit')
            status('You hit, go again!')
            my_turn = true
          } else {
            status('Opponent hit, retreat!')
            my_turn = false;
          }
        } else if (msg.txt == 'no_hit') {
          if (username == msg.player) {
            $('.btn_spot[data-x="'+msg.x+'"][data-y="'+msg.y+'"]').addClass('nohit')
            status('You missed, reload!')
            my_turn = false
          } else {
            status('Opponent missed, attack!')
            my_turn = true
          }
        } else if (msg.txt == 'start') {
          // End placing and start the game
          $('body').off('click', '.btn_spot')
          my_turn = (((msg.starting_player == 'host') && host) || ((msg.starting_player == 'p2') && !host)) ? true : false
          if (my_turn) {
            status('Your turn!')
          } else {
            status('Wait for your turn!')
          }
          draw_game()
        }
        break;
        case 'err':
          if (msg.text == 'MAX_USERS') { document.write('MAX_USERS'); throw new Error('MAX_USERS')}
        }
      }
    }

draw_waiting()

function status(txt) {
  $('#status').text(txt)
}

function sleep(ms) {
  setTimeout(() => { }, ms)
}

function timerToReload() {
  for (var i = 3; i > 0; i--) {
    status('Opponent disconnected, restarting in '+count)
  }
  window.location = '/'
}

function draw_place() {
  var b = $('#b')
  b.empty()
  status('Place your Ships!')

  can_place = true

  for (var y = 0; y < 8; y++) {
    for (var x = 0; x < 8; x++) {
      b.append('<button data-x="'+(x+1)+'" data-y="'+(y+1)+'" class="btn_spot"></button>')
    }
    b.append('<br>')
  }

  b.append('<button class="btn ready">READY!</button>')
  $('.btn.ready').on('click', (e) => {
    msg = { type: 'game', txt: 'ready', host: host }
    send(msg)
    can_place = false
  })

  $('body').on('click', '.btn_spot', function (e) {
    if (can_place) {
      var x = $(this).data().x
      var y = $(this).data().y

      msg = {
        type: 'placed',
        host: host,
        turn: {x: x, y: y}
      }
      send(msg)
    }
  });
}

function draw_game() {
  var b = $('#b')
  b.empty()

  for (var y = 0; y < 8; y++) {
    for (var x = 0; x < 8; x++) {
      b.append('<button data-x="'+(x+1)+'" data-y="'+(y+1)+'" class="btn_spot"></button>')
    }
    b.append('<br>')
  }

  $('body').on('click', '.btn_spot', function (e) {
    if (my_turn) {
      var x = $(this).data().x
      var y = $(this).data().y

      msg = {
        type: 'turn',
        host: host,
        turn: {x: x, y: y}
      }
      send(msg)
      my_turn = false;
    }
  });
}

function draw_waiting() {
  var b = $('#b')
  b.empty()
  status('Waiting for Player 2!')
}

function decodemsg(msg) {
  msg = JSON.parse(msg);
  return msg;
}

function send(msg) {
  server.send(JSON.stringify(msg))
}
