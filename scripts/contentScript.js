
function getSrl(){
  const img = document.getElementById("canvasScreen");
  chrome.storage.local.get("screenshot", function(result) {
    console.log("Saved screenshot2:", result.screenshot);
    img.src = result.screenshot;
  });
}

getSrl();