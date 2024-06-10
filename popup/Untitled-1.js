chrome.tabCapture.requestCapture({audio: false, video: true}, function(stream) {
  // check if the stream is valid
  if (!stream) {
    console.error("Failed to capture tab");
    return;
  }
  // create a video element to play the stream
  let video = document.createElement("video");
  video.srcObject = stream;
  video.play();
  // do something with the video element, such as appending it to the document
  document.body.appendChild(video);
});