
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
      var stepDescription = document.createElement("span");
      stepContainer.setAttribute("class", "stepContainer");
      stepContainerAfter.setAttribute("class", "stepContainerAfter");
      stepHeader.setAttribute("class", "stepHeader");
      stepFooter.setAttribute("class", "stepFooter");
      stepDescription.setAttribute("class", "stepDescription");
      var stepContainerIdSetter = 'stepContainer'+key;
      var stepHeaderIdSetter = 'stepHeader'+key;
      var stepFooterIdSetter = 'stepFooter'+key;
      var stepDescriptionIdSetter = 'stepDescription'+key;
      stepContainer.id = stepContainerIdSetter;
      stepHeader.id = stepHeaderIdSetter;
      stepFooter.id = stepFooterIdSetter;
      stepDescription.id = stepDescriptionIdSetter;
      document.body.appendChild(stepContainer);
      document.body.appendChild(stepContainerAfter);
      var stepContainerIdGetter = document.querySelector('#'+stepContainerIdSetter);
      stepContainerIdGetter.appendChild(stepHeader);
      stepContainerIdGetter.appendChild(stepFooter);
      var stepHeaderIdGetter = document.querySelector('#'+stepHeaderIdSetter);
      var stepFooterIdGetter = document.querySelector('#'+stepFooterIdSetter);
      stepImg.id = key;
      stepImg.src = value;
      stepImg.style.width = '120%';
      stepHeaderIdGetter.appendChild(stepImg);
      stepFooterIdGetter.appendChild(stepTitle);
      stepFooterIdGetter.appendChild(stepDescription);
      stepTitle.innerHTML = 'Step #'+stepNo;
      stepDescription.innerHTML = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris tempor id turpis in porttitor. Vivamus ex felis, efficitur in sodales sit amet, dapibus efficitur ante. Aliquam eu pretium nibh, ut elementum purus. Sed dignissim dui a varius pretium. In sit amet eleifend dui, non consequat ante.";
    }

    let parent = document.body;
    parent.addEventListener("dblclick", function(event) {
      let target = event.target;
      if (target.classList.contains("stepDescription")) {
        let input = document.createElement("input");
        input.value = target.textContent;
        input.type = "text";
        input.className = "stepDescriptionEdit";
        target.replaceWith(input);
        input.focus();
        parent.addEventListener("click", function(event) {
          if (event.target == input) {
            input.focus();
          }
          else {
            let value = input.value;
            let newText = document.createElement("span");
            newText.textContent = value;
            newText.id = "text";
            newText.className = "stepDescription";
            input.replaceWith(newText);
          }
        });
      }
    });
    
  });
}

getSrl();