
function getSrl(){
  chrome.storage.local.get(null, function(result) {
    var allKeys = Object.keys(result);
    
    allKeys.sort(function(a, b) {
      return parseInt(a.slice(4)) - parseInt(b.slice(4));
    });

    for (var key of allKeys) {
      var value = result[key];
      var stepNo = parseInt(key.slice(4));
      var stepContainer = document.createElement('div');
      var stepContainerAfter = document.createElement('div');
      var stepHeader = document.createElement('div');
      var stepFooter = document.createElement('div');
      var stepImg = document.createElement('img');
      var stepTitle = document.createElement("h3");
      var stepDescription = document.createElement("p");
      stepContainer.setAttribute("class", "stepContainer");
      stepContainerAfter.setAttribute("class", "stepContainerAfter");
      stepHeader.setAttribute("class", "stepHeader");
      stepFooter.setAttribute("class", "stepFooter");
      var stepContainerId = 'stepContainer'+key;
      var stepHeaderId = 'stepHeader'+key;
      var stepFooterId = 'stepFooter'+key;
      stepContainer.id = stepContainerId;
      stepHeader.id = stepHeaderId;
      stepFooter.id = stepFooterId;
      document.body.appendChild(stepContainer);
      document.body.appendChild(stepContainerAfter);
      var stepContainerClass = document.querySelector('#'+stepContainerId);
      stepContainerClass.appendChild(stepHeader);
      stepContainerClass.appendChild(stepFooter);
      var stepHeaderClass = document.querySelector('#'+stepHeaderId);
      var stepFooterClass = document.querySelector('#'+stepFooterId);
      stepImg.id = key;
      stepImg.src = value;
      stepImg.style.width = '120%';
      stepHeaderClass.appendChild(stepImg);
      // var stepImgId = document.querySelector('#'+key);
      stepFooterClass.appendChild(stepTitle);
      stepFooterClass.appendChild(stepDescription);
      stepTitle.innerHTML = 'Step #'+stepNo;
      stepDescription.innerHTML = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris tempor id turpis in porttitor. Vivamus ex felis, efficitur in sodales sit amet, dapibus efficitur ante. Aliquam eu pretium nibh, ut elementum purus. Sed dignissim dui a varius pretium. In sit amet eleifend dui, non consequat ante.";
      
    }

    
  });

  
}

getSrl();