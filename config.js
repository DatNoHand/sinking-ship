var config = module.exports = {}

config.wss = {}
config.game = {}
config.led = {}
config.http = {}

// HTTP Config
config.http.public_dir = '/public'

// WebSocket config
config.wss.port = '80'

// Game config
config.game.version = '0.0.1'
config.game.name = 'Sink ships'

// LED Config
config.led.num = 128
config.led.brightness = 20
config.led.use_background_color = true
config.led.background_color = '0x2176ff'

// JS
