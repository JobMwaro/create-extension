
function getSrl(){
  chrome.storage.local.get('step1', function(result) {
    console.log('Saved screenshot2:', result.screenshot);
    var stepContainer = document.createElement('div');
    var stepHeader = document.createElement('div');
    var stepFooter = document.createElement('div');
    var stepImg = document.createElement('img');
    var stepTitle = document.createElement("h3");
    var stepDescription = document.createElement("p");
    stepContainer.id = 'stepContainer';
    stepHeader.id = 'stepHeader';
    stepFooter.id = 'stepFooter';
    document.body.appendChild(stepContainer);
    var stepContainerId = document.querySelector('#stepContainer');
    stepContainerId.appendChild(stepHeader);
    stepContainerId.appendChild(stepFooter);
    var stepHeaderId = document.querySelector('#stepHeader');
    var stepFooterId = document.querySelector('#stepFooter');
    stepImg.src = result.step1;
    stepImg.style.width = '120%';
    stepHeaderId.appendChild(stepImg);
    stepFooterId.appendChild(stepTitle);
    stepFooterId.appendChild(stepDescription);
    stepTitle.innerHTML = "Step #1";
    stepDescription.innerHTML = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris tempor id turpis in porttitor. Vivamus ex felis, efficitur in sodales sit amet, dapibus efficitur ante. Aliquam eu pretium nibh, ut elementum purus. Sed dignissim dui a varius pretium. In sit amet eleifend dui, non consequat ante.";
  });

  
}

getSrl();