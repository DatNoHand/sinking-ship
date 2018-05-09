$('body').on('click', '#btn_play', function (e) {
  var username = $('#txt_username').val()
  if (username == undefined) { } else {
    console.log('OK!')
    // Continue to show other
    window.location = '/game/?u='+username
  }
});
