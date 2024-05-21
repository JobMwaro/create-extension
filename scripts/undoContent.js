
if(document.querySelector('.custom-ribbon')){
var removeRibbon = document.querySelector('.custom-ribbon');
document.body.removeChild(removeRibbon);
console.log("Ribbon Removed");
}

if(document.querySelector('.button-container')){
  var removeStopRecordingButton = document.querySelector('.button-container');
  document.body.removeChild(removeStopRecordingButton);
  console.log("Stop Recording Button Removed");
}

if(document.removeEventListener('click', handleClick)){
  console.log("Click event removed.");
}